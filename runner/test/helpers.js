// Shared helpers for the browser tests (run in the runner container).
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { serveFixtureDir, FIXTURE_HOST } from '../src/checks/fixtureServer.js'

const here = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURES = path.join(here, '../fixtures')
export { FIXTURE_HOST }

export async function readProfilesSource() {
  return fs.readFile(path.join(here, '../dist/profiles.js'), 'utf8')
}

export async function openFixture(browser, dir, file, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts })
  await serveFixtureDir(context, path.join(FIXTURES, dir))
  const page = await context.newPage()
  await page.goto(`${FIXTURE_HOST}/${file}`)
  return { context, page }
}

// RGB of pixels in an image, decoded by Chromium itself (no image library
// needed in the container). points: [[x, y], ...]
export async function pixelsOf(page, buffer, points, mime = 'image/png') {
  return page.evaluate(async ({ b64, mime, points }) => {
    const img = new Image()
    img.src = `data:${mime};base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return {
      width: img.width,
      height: img.height,
      pixels: points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)))
    }
  }, { b64: buffer.toString('base64'), mime, points })
}

export const isMagenta = ([r, g, b]) => r > 200 && g < 90 && b > 200

let ffmpeg
export async function findFfmpeg() {
  if (ffmpeg) return ffmpeg
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/ms-playwright'
  const dir = (await fs.readdir(root)).find((d) => d.startsWith('ffmpeg-'))
  ffmpeg = path.join(root, dir, 'ffmpeg-linux')
  return ffmpeg
}

export function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120000 }, (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout)))
  })
}

// Every frame of a video as PNG files named by presentation time in ms.
export { extractFrames } from '../src/videoSync.js'
