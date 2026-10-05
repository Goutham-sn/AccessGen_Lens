// AccessGen Lens: session recorder (injected into the target page).
// Logs every interaction and batch-uploads it to the backend every 5
// seconds, for the Journey Map and event count on the report.
//
// The session VIDEO is no longer this file's job. It used to capture a
// screenshot every 500ms with html2canvas and have the backend stitch
// them into an MP4 with FFmpeg, but html2canvas throws on a tainted
// canvas, and a canvas taints the moment it draws a cross-origin image
// without CORS headers, which is true of almost every real website. Most
// sessions uploaded zero usable frames, so no video was ever produced.
// Real tab video now comes from chrome.tabCapture + MediaRecorder, run in
// an offscreen document by the background worker; it records the actual
// rendered pixels, costs this page nothing to run, and has none of the
// cross-origin failure modes. This file keeps exactly one html2canvas
// call: a single one-time thumbnail right when recording starts, for the
// dashboard card and report cover.

import html2canvas from 'html2canvas'

(() => {
  if (window.__accessgenRecorder) return
  window.__accessgenRecorder = true

  const TRACKED_EVENTS = ['click', 'keydown', 'scroll', 'focus', 'blur']
  const UPLOAD_INTERVAL_MS = 5000

  let sessionId = null
  let sessionStartTime = Date.now()
  let recording = false
  let thumbnailCaptured = false

  let eventBuffer = []
  let uploadTimer = null

  function getElementSelector(el) {
    if (!el || !el.tagName) return null
    if (el.id) return `#${el.id}`
    let selector = el.tagName.toLowerCase()
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.')
      if (cls) selector += `.${cls}`
    }
    return selector
  }

  async function captureScreenshot() {
    try {
      const canvas = await html2canvas(document.documentElement, {
        useCORS: true,
        scale: 0.4,
        logging: false,
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        ignoreElements: (el) => el.tagName === 'ACCESSGEN-CONTROL-PANEL'
      })
      return canvas.toDataURL('image/jpeg', 0.7)
    } catch {
      return null
    }
  }

  // Every upload goes through the background worker, which adds the
  // credentials and makes the request from the extension's own origin. This
  // script runs inside the simulated page, so it holds no tokens, and a
  // fetch from here would be under the page's CORS rules.
  async function upload(kind, body) {
    try {
      const reply = await chrome.runtime.sendMessage({ type: 'ACCESSGEN_UPLOAD', payload: { kind, body } })
      return Boolean(reply?.ok)
    } catch {
      return false // extension reloaded or worker unreachable
    }
  }

  async function captureThumbnailOnce() {
    if (thumbnailCaptured || !sessionId) return
    thumbnailCaptured = true
    const screenshot = await captureScreenshot()
    if (!screenshot) return
    // The thumbnail is a nice-to-have, not worth retrying.
    await upload('frames', {
      frames: [{
        frameIndex: 0,
        timestamp: 0,
        screenshot,
        scrollX: Math.round(window.scrollX),
        scrollY: Math.round(window.scrollY)
      }],
      events: []
    })
  }

  async function uploadEvents() {
    if (!sessionId || eventBuffer.length === 0) return
    const events = eventBuffer
    eventBuffer = []

    if (!(await upload('frames', { frames: [], events }))) {
      // Not accepted: requeue for the next attempt.
      eventBuffer = events.concat(eventBuffer).slice(-500)
    }
  }

  function trackEvent(e) {
    if (!recording) return
    if (e.target?.dataset?.accessgen || e.target?.dataset?.accessgenPanel) return
    eventBuffer.push({
      type: e.type,
      timestamp: Date.now() - sessionStartTime,
      target: getElementSelector(e.target),
      x: typeof e.clientX === 'number' ? Math.round(e.clientX) : null,
      y: typeof e.clientY === 'number' ? Math.round(e.clientY) : null,
      key: e.key || null
    })
  }

  for (const eventType of TRACKED_EVENTS) {
    document.addEventListener(eventType, trackEvent, { capture: true, passive: true })
  }

  // Empathy moments: capture a fresh screenshot and POST immediately.
  window.addEventListener('accessgen-empathy', async (e) => {
    if (!sessionId) return
    const { label, note, activeProfiles } = e.detail
    const screenshot = await captureScreenshot()

    await upload('moment', {
      label,
      note,
      screenshot,
      timestampMs: Date.now() - sessionStartTime,
      activeProfiles
    })
  })

  function startTimers() {
    captureThumbnailOnce()
    if (uploadTimer) return
    uploadTimer = setInterval(uploadEvents, UPLOAD_INTERVAL_MS)
  }

  function stopTimers() {
    clearInterval(uploadTimer)
    uploadTimer = null
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message || {}

    if (type === 'ACCESSGEN_INIT') {
      sessionId = payload.sessionId
      if (payload.startedAt) sessionStartTime = payload.startedAt
      recording = payload.isRecording !== false
      if (recording) startTimers()
      // simulation-controller also answers INIT; don't double-respond.
    }

    if (type === 'ACCESSGEN_RECORDING') {
      recording = payload.on
      if (recording) startTimers()
      else stopTimers()
    }

    if (type === 'ACCESSGEN_DESTROY') {
      recording = false
      stopTimers()
      // Fire-and-forget: simulation-controller.js also listens for this
      // message and responds synchronously, which wins the race and closes
      // the reply channel immediately. Calling sendResponse here too (even
      // later, after this flush finishes) would try to use an
      // already-closed channel and throw "message channel closed before a
      // response was received". The background worker doesn't rely on this
      // response anyway; it gives the tab a fixed grace period before
      // closing it, which is what actually protects this flush.
      uploadEvents().finally(() => {
        window.__accessgenRecorder = false
      })
    }

    return false
  })
})()
