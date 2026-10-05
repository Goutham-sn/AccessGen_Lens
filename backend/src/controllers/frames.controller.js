import { Session } from '../models/Session.js'
import { Frame } from '../models/Frame.js'
import { Event } from '../models/Event.js'
import { putDataUrl, putBuffer, getObjectStream, statObject } from '../utils/storage.js'

// Owner or upload token, checked by sessionWriter('frames') in the route.
export async function uploadFrames(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const { frames = [], events = [] } = req.body

    const frameRecords = await Promise.all(frames.map(async (frame) => {
      const key = `sessions/${session.id}/frames/${String(frame.frameIndex).padStart(6, '0')}.jpg`
      await putDataUrl(key, frame.screenshot)
      return {
        session_id: session.id,
        frame_index: frame.frameIndex,
        timestamp_ms: frame.timestamp ?? 0,
        screenshot_url: key,
        scroll_x: frame.scrollX,
        scroll_y: frame.scrollY,
        focused_element: frame.focusedElement,
        active_profiles: frame.activeProfiles,
        cognitive_load_score: frame.cognitiveLoad
      }
    }))

    await Frame.insertMany(frameRecords)
    await Event.insertMany(events.map((e) => ({
      session_id: session.id,
      timestamp_ms: e.timestamp ?? 0,
      event_type: e.type,
      target_element: e.target ? { selector: e.target } : null,
      coordinates: e.x != null ? { x: e.x, y: e.y } : null,
      key_pressed: e.key
    })))
    await Session.incrementCounts(session.id, { frames: frames.length, events: events.length })

    res.json({ received: frameRecords.length, events: events.length })
  } catch (err) { next(err) }
}

// Real tab recording, uploaded whole by the extension's offscreen document
// once MediaRecorder finishes: a single webm file, not frames to stitch.
// Owner or upload token, checked by sessionWriter('recording') in the route.
// With the upload token this works once, until the grace period after /end
// runs out, even if the finalize job has already marked the session complete.
// `store` is only swapped out by tests, to make storing fail on purpose.
export function makeUploadRecording({ store = putBuffer } = {}) {
  return async function uploadRecording(req, res, next) {
    let claimed = false
    try {
      const session = await Session.findById(req.params.id)
      if (!session) return res.status(404).json({ error: 'Session not found' })
      if (!req.file) return res.status(400).json({ error: 'No video file received' })
      if (req.writer?.via === 'upload-token') {
        claimed = await Session.claimRecordingToken(session.id)
        if (!claimed) return res.status(401).json({ error: 'Not allowed to upload to this session' })
      }

      const offset = Number.parseInt(req.body?.recordingOffsetMs, 10)
      const recordingOffsetMs = Number.isFinite(offset) && offset >= 0 ? offset : null

      const key = `sessions/${session.id}/session.webm`
      await store(key, req.file.buffer, req.file.mimetype || 'video/webm')
      await Session.update(session.id, {
        video_url: key,
        recording_offset_ms: recordingOffsetMs,
        status: 'complete',
        processing_complete: true
      })

      req.app.get('io')?.to(`session:${session.id}`).emit('session-processed', { sessionId: session.id, videoUrl: key })
      res.status(201).json({ ok: true })
    } catch (err) {
      // Storing failed after the single use was claimed: give it back.
      if (claimed) await Session.releaseRecordingToken(req.params.id).catch(() => {})
      next(err)
    }
  }
}

export const uploadRecording = makeUploadRecording()

const CONTENT_TYPES = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.pdf': 'application/pdf'
}
const SEEKABLE_EXTENSIONS = ['.webm', '.mp4']

// Streams a stored object (frame JPEG, session recording, or PDF report)
// back to the browser. Supports Range requests so <video> seeking works.
export async function streamMedia(req, res, next) {
  try {
    const key = req.params[0]
    if (!key || key.includes('..')) return res.status(400).json({ error: 'Bad key' })

    const stat = await statObject(key).catch(() => null)
    if (!stat) return res.status(404).json({ error: 'Not found' })

    const ext = Object.keys(CONTENT_TYPES).find((e) => key.endsWith(e))
    const contentType = ext ? CONTENT_TYPES[ext] : 'image/jpeg'
    const seekable = SEEKABLE_EXTENSIONS.some((e) => key.endsWith(e))

    res.setHeader('Content-Type', contentType)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=3600')

    const range = req.headers.range
    if (range && seekable) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      const start = match[1] ? parseInt(match[1], 10) : 0
      const end = match[2] ? parseInt(match[2], 10) : stat.size - 1
      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      res.setHeader('Content-Length', end - start + 1)
      const { minioClient, BUCKET } = await import('../config/storage.js')
      const stream = await minioClient.getPartialObject(BUCKET, key, start, end - start + 1)
      stream.pipe(res)
      return
    }

    res.setHeader('Content-Length', stat.size)
    const stream = await getObjectStream(key)
    stream.pipe(res)
  } catch (err) { next(err) }
}
