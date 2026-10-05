import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'

// Playwright's video starts the moment the page is created, so the first
// seconds are a blank page while the site loads. We cut those off so the
// video starts when the page is ready. Stream copy does not cut these files
// cleanly (the first decodable frame lands well after the cut), so the rest
// is re-encoded with Playwright's own ffmpeg. Fastest VP8 settings on 4
// threads: about 0.5 s for a 7 s clip, against about 2.9 s single-threaded.

let ffmpegPath
async function findFfmpeg() {
  if (ffmpegPath !== undefined) return ffmpegPath
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/ms-playwright'
  try {
    const dir = (await fs.readdir(root)).find((d) => d.startsWith('ffmpeg-'))
    ffmpegPath = dir ? path.join(root, dir, 'ffmpeg-linux') : null
  } catch {
    ffmpegPath = null
  }
  return ffmpegPath
}

// Returns the path of the trimmed file, or null if trimming was not possible
// (the caller then keeps the original and a trim of 0).
export async function trimStart(inputPath, trimMs) {
  const ffmpeg = await findFfmpeg()
  if (!ffmpeg || trimMs <= 0) return null
  const out = inputPath.replace(/\.webm$/, '') + '.trimmed.webm'
  await new Promise((resolve, reject) => {
    execFile(ffmpeg, [
      '-hide_banner', '-loglevel', 'error',
      '-ss', (trimMs / 1000).toFixed(3),
      '-i', inputPath,
      '-an', '-c:v', 'vp8', '-qmin', '0', '-qmax', '50', '-crf', '8',
      '-deadline', 'realtime', '-speed', '16', '-threads', '4', '-b:v', '1M',
      '-y', out
    ], { timeout: 60000 }, (err) => (err ? reject(err) : resolve()))
  })
  const stat = await fs.stat(out).catch(() => null)
  return stat && stat.size > 0 ? out : null
}
