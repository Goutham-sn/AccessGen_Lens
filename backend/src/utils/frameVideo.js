import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getObjectBuffer, putBuffer } from './storage.js'

// Joins a manual session's captured frames (real tab pixels, about one every
// 0.7 s, from the extension's captureVisibleTab loop) into an MP4, each frame
// held for exactly as long as it was on screen. Used when no tabCapture
// recording was made, which used to mean no video at all.

const MIN_FRAMES = 2
const MAX_HOLD_SECONDS = 5 // a frame never covers a long gap (tab hidden, worker asleep)

export function ffmpegAvailable() {
  return new Promise((resolve) => {
    const p = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'])
    p.on('error', () => resolve(false))
    p.on('close', (code) => resolve(code === 0))
  })
}

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, { cwd })
    let err = ''
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000) })
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-600)}`))))
  })
}

// Width and height from a JPEG's start-of-frame marker.
export function jpegSize(buf) {
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue }
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    i += 2 + len
  }
  return null
}

const even = (n) => Math.max(2, Math.floor(n / 2) * 2)

// The concat list: each frame shown until the next one was taken.
export function concatList(frames, endMs) {
  const lines = []
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].timestamp_ms : Math.max(endMs, f.timestamp_ms + 700)
    const hold = Math.min(MAX_HOLD_SECONDS, Math.max(0.1, (next - f.timestamp_ms) / 1000))
    lines.push(`file 'f${String(i).padStart(6, '0')}.jpg'`, `duration ${hold.toFixed(3)}`)
  })
  // The concat demuxer ignores the last duration unless the file repeats.
  if (frames.length) lines.push(`file 'f${String(frames.length - 1).padStart(6, '0')}.jpg'`)
  return lines.join('\n') + '\n'
}

// frames: rows from session_frames (frame_index 0 is an old-style thumbnail
// and is skipped). Returns { key, offsetMs } or null when there is too little.
export async function compileFramesToVideo(session, frames) {
  const usable = frames
    .filter((f) => f.frame_index > 0 && f.screenshot_url)
    .sort((a, b) => a.timestamp_ms - b.timestamp_ms)
  if (usable.length < MIN_FRAMES) return null

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `lens-${session.id}-`))
  try {
    let written = 0
    let size = null
    const kept = []
    for (const f of usable) {
      const buf = await getObjectBuffer(f.screenshot_url).catch(() => null)
      if (!buf) continue
      size = size || jpegSize(buf)
      await fs.writeFile(path.join(dir, `f${String(written).padStart(6, '0')}.jpg`), buf)
      kept.push(f)
      written += 1
    }
    if (written < MIN_FRAMES) return null

    const endMs = (session.duration_seconds || 0) * 1000
    await fs.writeFile(path.join(dir, 'list.txt'), concatList(kept, endMs))
    await run([
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', 'list.txt',
      // Every frame fitted into the first one's size (the window can be
      // resized mid-session), with even dimensions for H.264.
      '-vf', size
        ? `scale=${even(size.width)}:${even(size.height)}:force_original_aspect_ratio=decrease,pad=${even(size.width)}:${even(size.height)}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`
        : 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
      '-r', '10', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
      '-movflags', '+faststart',
      'out.mp4'
    ], dir)

    const key = `sessions/${session.id}/frames.mp4`
    await putBuffer(key, await fs.readFile(path.join(dir, 'out.mp4')), 'video/mp4')
    return { key, offsetMs: kept[0].timestamp_ms }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
