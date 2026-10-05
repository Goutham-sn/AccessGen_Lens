// AccessGen Lens offscreen recorder.
// Runs in a hidden extension document (not the simulated tab), so its
// lifetime is independent of whatever happens to the tab being recorded.
// Uses the real tab video stream via chrome.tabCapture + MediaRecorder:
// it records the actual rendered pixels the user saw, with none of the
// cross-origin canvas taint or per-frame upload failures that html2canvas
// hit on real-world pages.

let recorder = null
let chunks = []
let uploadInfo = null // { sessionId, apiUrl, token, uploadToken, recordingOffsetMs }
let stopDeferred = null // resolved by onstop, however the stop was triggered

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm'
}

function createDeferred() {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

// Resolves with { startedAt } only once MediaRecorder has actually fired
// its start event, so the background never reports a recording that isn't.
async function startRecording({ streamId, sessionId, apiUrl, token, uploadToken, sessionStartedAt }) {
  if (recorder && recorder.state !== 'inactive') throw new Error('Already recording')

  uploadInfo = { sessionId, apiUrl, token, uploadToken, recordingOffsetMs: 0 }
  chunks = []
  stopDeferred = createDeferred()

  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    })
    console.log('[recorder] getUserMedia ok')
    recorder = new MediaRecorder(stream, { mimeType: pickMimeType() })
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop())
    recorder = null
    uploadInfo = null
    throw err
  }

  recorder.ondataavailable = (e) => {
    console.log('[recorder] chunk', e.data.size)
    if (e.data.size > 0) chunks.push(e.data)
  }

  // Assigned exactly once, here, at creation, not inside the stop handler.
  // It has to fire and upload no matter WHAT triggers the actual stop: the
  // background's explicit message, or (if the user just closes the tab
  // directly) the video track ending on its own below.
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop())
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
    chunks = []
    console.log('[recorder] onstop blob', blob.size)

    if (!uploadInfo?.sessionId || blob.size === 0) {
      stopDeferred.resolve({ ok: false, error: 'Nothing was recorded' })
      return
    }

    try {
      const form = new FormData()
      // Text fields go before the file: multer only fills req.body with
      // fields that arrive ahead of it.
      form.append('recordingOffsetMs', String(uploadInfo.recordingOffsetMs))
      form.append('video', blob, 'session.webm')
      const res = await fetch(`${uploadInfo.apiUrl}/api/sessions/${uploadInfo.sessionId}/recording`, {
        method: 'POST',
        // The upload token keeps working after the 15 minute access token
        // expires, and for a short grace period after /end.
        headers: {
          ...(uploadInfo.token ? { Authorization: `Bearer ${uploadInfo.token}` } : {}),
          ...(uploadInfo.uploadToken ? { 'X-Upload-Token': uploadInfo.uploadToken } : {})
        },
        body: form
      })
      const body = await res.text().catch(() => '')
      console.log('[recorder] upload status', res.status, body)
      stopDeferred.resolve(res.ok
        ? { ok: true, status: res.status }
        : { ok: false, status: res.status, error: `Upload failed (status ${res.status})` })
    } catch (err) {
      console.warn('[recorder] upload error', err.message)
      stopDeferred.resolve({ ok: false, error: `Upload failed (${err.message})` })
    } finally {
      uploadInfo = null
    }
  }

  let startedAt
  try {
    startedAt = await new Promise((resolve, reject) => {
      recorder.onstart = () => resolve(Date.now())
      recorder.onerror = (e) => reject(e.error || new Error('MediaRecorder error'))
      recorder.start(1000) // collect a chunk every second so stopping is fast
    })
  } catch (err) {
    recorder.onstop = null
    stream.getTracks().forEach((t) => t.stop())
    recorder = null
    uploadInfo = null
    throw err
  }
  recorder.onerror = null
  uploadInfo.recordingOffsetMs = Math.max(0, startedAt - (sessionStartedAt || startedAt))
  console.log('[recorder] MediaRecorder started', recorder.mimeType)

  // Stop cleanly if the tab stream ends on its own (e.g. the tab closed):
  // onstop above still fires and still uploads whatever was captured.
  stream.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  })

  return { startedAt }
}

function stopRecordingAndUpload() {
  if (!recorder || !stopDeferred) return Promise.resolve({ ok: false, error: 'Not recording' })
  // If something already stopped it (e.g. the tab closed a moment ago),
  // state is already 'inactive': don't call stop() again, just return the
  // same promise onstop is (or already did) resolve.
  if (recorder.state !== 'inactive') recorder.stop()
  return stopDeferred.promise
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'accessgen-offscreen') return false

  if (message.type === 'ACCESSGEN_OFFSCREEN_START') {
    startRecording(message.payload)
      .then(({ startedAt }) => sendResponse({ ok: true, startedAt }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (message.type === 'ACCESSGEN_OFFSCREEN_STOP') {
    stopRecordingAndUpload().then((result) => sendResponse(result))
    return true
  }

  return false
})
