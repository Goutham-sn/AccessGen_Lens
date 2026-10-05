import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { overlayCall, settle } from './pageScripts.js'

// Every recorded pass shows a timing mark right after the page is ready,
// notes when it turned white, and afterwards finds that moment in the saved
// video. The difference is the correction applied to every moment, and a
// missing mark is noted in the run's debug list. (This is how the trim was
// found to cut too much; see trim.js.)

const BOX_CENTRE = [24, 24]
const call = (page, method, ...args) => page.evaluate(overlayCall, { method, args })

// Black long enough to survive the trim: the recording can start up to
// about 350 ms late, and the trim cuts that much from the front.
const DARK_MS = 500

// Returns the wall-clock time the square turned white.
export async function showSyncMark(page) {
  await call(page, 'syncBox', 'dark')
  await page.evaluate(settle)
  await page.waitForTimeout(DARK_MS)
  await call(page, 'syncBox', 'light')
  await page.evaluate(settle)
  const stamp = Date.now()
  await page.waitForTimeout(160)
  await call(page, 'syncBox', 'off')
  await page.evaluate(settle)
  return stamp
}

async function findFfmpeg() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/ms-playwright'
  const dir = (await fs.readdir(root)).find((d) => d.startsWith('ffmpeg-'))
  return dir ? path.join(root, dir, 'ffmpeg-linux') : null
}

// Every frame of the first `seconds` of a video, as PNGs named by
// presentation time in milliseconds. `crop` ([w, h, x, y]) keeps only that
// part of each frame, which makes reading one corner fast.
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

// Brightness of one pixel per image, decoded by Chromium itself.
async function brightness(page, file, [x, y]) {
  const b64 = (await fs.readFile(file)).toString('base64')
  return page.evaluate(async ({ b64, x, y }) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(x, y, 1, 1).data
    return (d[0] + d[1] + d[2]) / 3
  }, { b64, x, y })
}

// Video time (ms) of the first frame where the square is white after
// having been black, or null if the mark was not found.
export async function findSyncOnset(browser, videoPath, { withinSeconds = 3 } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-'))
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    const frames = await extractFrames(videoPath, dir, { seconds: withinSeconds, crop: [48, 48, 0, 0] })
    // Relative, not absolute: the low vision filter dims white to about 170
    // and lifts black to about 25, but the jump stays large.
    let dark = null
    for (const f of frames) {
      const v = await brightness(page, f.file, BOX_CENTRE)
      if (v < 70) dark = dark === null ? v : Math.min(dark, v)
      else if (dark !== null && v - dark > 90) return f.ms
    }
    return null
  } finally {
    await context.close().catch(() => {})
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
