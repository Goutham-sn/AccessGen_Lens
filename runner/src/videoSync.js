import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { overlayCall, settle } from './pageScripts.js'
import { trimStart } from './trim.js'
import { stick } from './measuringStick.js'

// Video timing. Playwright's recording does not start exactly when the page
// is created, so wall-clock times do not map exactly onto video time.
// Right after the page is ready, the overlay shows a timing mark (a corner
// square, black then white). The mark is found in the raw recording, which
// gives the correction for this run, and the delivered video is cut just
// after the mark, so the mark itself is never shown to anyone.
//
// Wall time T appears in the raw video at (T - videoStart) + correction.

const DARK_MS = 500 // long enough to be seen even with a late recording start
const LIGHT_MS = 160
const CUT_MARGIN_MS = 80 // two frames after the mark has gone
const SQUARE = [48, 48, 0, 0] // crop: width, height, x, y
const CENTRE = [24, 24]

const call = (page, method, ...args) => page.evaluate(overlayCall, { method, args })

// Shows the mark. Returns the wall-clock times it turned white and went away.
export async function showSyncMark(page) {
  await call(page, 'syncBox', 'dark')
  await page.evaluate(settle)
  await page.waitForTimeout(DARK_MS)
  await call(page, 'syncBox', 'light')
  await page.evaluate(settle)
  const white = Date.now()
  await page.waitForTimeout(LIGHT_MS)
  await call(page, 'syncBox', 'off')
  await page.evaluate(settle)
  return { white, off: Date.now() }
}

async function findFfmpeg() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/ms-playwright'
  const dir = (await fs.readdir(root)).find((d) => d.startsWith('ffmpeg-'))
  return dir ? path.join(root, dir, 'ffmpeg-linux') : null
}

// Frames of a video as PNGs named by presentation time in milliseconds,
// from the start up to `seconds`. `crop` ([w, h, x, y]) keeps only that part
// of each frame, which keeps this fast.
export async function extractFrames(videoPath, outDir, { seconds, crop } = {}) {
  const ffmpeg = await findFfmpeg()
  if (!ffmpeg) throw new Error('ffmpeg not found')
  await fs.mkdir(outDir, { recursive: true })
  const limit = seconds ? ['-t', String(seconds)] : []
  const filter = crop ? ['-vf', `crop=${crop.join(':')}`] : []
  await new Promise((resolve, reject) => {
    execFile(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', videoPath, ...limit, ...filter,
      '-vsync', 'passthrough', '-enc_time_base', '1/1000', '-frame_pts', '1', '-f', 'image2', path.join(outDir, '%d.png')],
    { timeout: 60000 }, (err, _o, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve()))
  })
  const files = (await fs.readdir(outDir)).filter((f) => f.endsWith('.png'))
  return files.map((f) => ({ ms: Number(f.replace('.png', '')), file: path.join(outDir, f) })).sort((a, b) => a.ms - b.ms)
}

// Brightness (0 to 255) at one point of each image, decoded by Chromium in
// a blank context of its own (a page's own security rules could block it).
export async function brightnessOf(browser, images, [x, y]) {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    const out = []
    for (const img of images) {
      const b64 = Buffer.isBuffer(img) ? img.toString('base64') : (await fs.readFile(img)).toString('base64')
      out.push(await page.evaluate(async ({ b64, x, y }) => {
        const i = new Image()
        i.src = `data:image/png;base64,${b64}`
        await i.decode()
        const c = document.createElement('canvas')
        c.width = i.width
        c.height = i.height
        const ctx = c.getContext('2d')
        ctx.drawImage(i, 0, 0)
        const d = ctx.getImageData(x, y, 1, 1).data
        return (d[0] + d[1] + d[2]) / 3
      }, { b64, x, y }))
    }
    return out
  } finally {
    await context.close().catch(() => {})
  }
}

// What the page's top-left corner looks like on camera before the mark, so
// the delivered video can be checked for any trace of the mark.
export async function readPageCorner(browser, page) {
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: SQUARE[0], height: SQUARE[1] } })
  return (await brightnessOf(browser, [png], CENTRE))[0]
}

// Raw video time (ms) where the mark turned white, or null if not found.
// Only frames inside [fromMs, toMs] are read.
export async function findMarkOnset(browser, videoPath, { fromMs, toMs }) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mark-'))
  try {
    const frames = (await extractFrames(videoPath, dir, { seconds: toMs / 1000, crop: SQUARE }))
      .filter((f) => f.ms >= fromMs && f.ms <= toMs)
    const values = await brightnessOf(browser, frames.map((f) => f.file), CENTRE)
    // Relative, not absolute: filters dim white and lift black, but the
    // jump from the darkest frame stays large.
    let dark = null
    for (let i = 0; i < frames.length; i++) {
      const v = values[i]
      if (v < 70) dark = dark === null ? v : Math.min(dark, v)
      else if (dark !== null && v - dark > 90) return frames[i].ms
    }
    return null
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

// Pure decision, given where the mark was stamped and where it was seen.
// A correction larger than the limit is treated as a misread: no correction,
// and a cut late enough that the mark is gone whatever the real delay was.
export function planCut({ onsetMs, whiteStampMs, offStampMs, limitMs }) {
  const found = onsetMs !== null && onsetMs !== undefined
  const measured = found ? onsetMs - whiteStampMs : null
  const applied = found && Math.abs(measured) <= limitMs
  const correctionMs = applied ? measured : 0
  const cutMs = applied ? onsetMs + LIGHT_MS + CUT_MARGIN_MS : offStampMs + limitMs
  return { found, measuredMs: measured, applied, correctionMs, cutMs }
}

// True when the first `seconds` of a video show no trace of the mark: the
// corner never goes dark when the page's corner is light, or light when it
// is dark.
export async function videoShowsNoMark(browser, videoPath, pageCorner, { seconds = 1.5 } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nomark-'))
  try {
    const frames = await extractFrames(videoPath, dir, { seconds, crop: SQUARE })
    const values = await brightnessOf(browser, frames.map((f) => f.file), CENTRE)
    const traces = values.filter((v) => (pageCorner >= 70 ? v < 70 : v > pageCorner + 90))
    return traces.length === 0
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

// From the raw recording to the delivered video: find the mark, decide the
// correction and the cut, cut, and check the mark is gone (cutting a little
// later once if a trace is left). Returns what to upload and how to map
// times onto it.
export async function deliverVideo({ browser, rawPath, videoStart, readyAt, mark, pageCorner }) {
  const limitMs = stick('calibration', 'maxCorrectionMs')
  const whiteStampMs = mark.white - videoStart
  const offStampMs = mark.off - videoStart
  const onsetMs = await findMarkOnset(browser, rawPath, {
    fromMs: Math.max(0, readyAt - videoStart - 500),
    toMs: offStampMs + 1500
  }).catch(() => null)
  const plan = planCut({ onsetMs, whiteStampMs, offStampMs, limitMs })

  let cutMs = plan.cutMs
  let file = await trimStart(rawPath, cutMs).catch(() => null)
  let noMark = file ? await videoShowsNoMark(browser, file, pageCorner).catch(() => false) : false
  let recut = false
  if (file && !noMark) {
    recut = true
    cutMs += 200
    file = await trimStart(rawPath, cutMs).catch(() => null)
    noMark = file ? await videoShowsNoMark(browser, file, pageCorner).catch(() => false) : false
  }
  if (!file) cutMs = 0 // trimming failed: deliver the raw video, mark and all

  return {
    file: file || rawPath,
    cutMs,
    correctionMs: plan.correctionMs,
    // For run_timings: what was measured and whether it was used.
    sync: {
      found: plan.found,
      measuredMs: plan.measuredMs,
      applied: plan.applied,
      correctionMs: plan.correctionMs,
      cutMs,
      recut,
      noMarkInVideo: noMark
    },
    // Video time of wall time T in the delivered file.
    toVideoMs: (wallMs) => wallMs - videoStart + plan.correctionMs - cutMs,
    // Wall time of the delivered file's first frame.
    zeroWallMs: videoStart + cutMs - plan.correctionMs
  }
}
