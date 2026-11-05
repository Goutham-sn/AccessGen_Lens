// AccessGen Lens: session recorder (injected into the target page).
// Logs interactions and batch-uploads them every 5 seconds, for the Journey
// Map and event count on the report, and uploads empathy moments: the ones
// the tester logs with "I felt this" and the ones the profiles notice on
// their own (friction.js).
//
// Pictures: the session video and every moment picture come from the
// background worker (chrome.tabs.captureVisibleTab and tabCapture), which
// see the real rendered pixels with the simulation on. This file used to
// draw them with html2canvas, which cannot render CSS or SVG filters (the
// picture showed the page without the simulation) and throws on any page
// with a cross-origin image (no picture at all).

(() => {
  if (window.__accessgenRecorder) return
  window.__accessgenRecorder = true

  const TRACKED_EVENTS = ['click', 'keydown', 'scroll', 'focus', 'blur', 'submit', 'change']
  const UPLOAD_INTERVAL_MS = 5000
  const SCROLL_GAP_MS = 400
  // Keys worth keeping as they are. Anything else typed into a field is
  // stored only as "character": the recorder never keeps what was typed
  // (passwords, emails, search terms).
  const NAMED_KEYS = new Set(['Tab', 'Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'Delete', 'Shift', 'Control', 'Alt', 'Meta'])

  let sessionId = null
  let sessionStartTime = Date.now()
  let recording = false
  let lastScrollAt = 0

  let eventBuffer = []
  let uploadTimer = null

  function getElementSelector(el) {
    if (!el || !el.tagName) return null
    if (el.id) return `#${el.id}`
    let selector = el.tagName.toLowerCase()
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/).filter((c) => !c.startsWith('accessgen')).slice(0, 2).join('.')
      if (cls) selector += `.${cls}`
    }
    return selector
  }

  function elementLabel(el) {
    if (!el || el.nodeType !== 1) return null
    if (el.matches?.('input[type="password"]')) return 'password field'
    const text = el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') ||
      (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ? el.getAttribute('placeholder') || el.name : el.innerText)
    return text ? String(text).replace(/\s+/g, ' ').trim().slice(0, 80) : null
  }

  function nextFrame() {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  }

  // A picture of the page as the tester sees it, with the AccessGen panel
  // hidden while it is taken. Counted, so two pictures in quick succession
  // never show it again while the second is still waiting for its turn.
  let hiding = 0
  // One picture serves every moment reported within a second of it: the
  // page audit reports many at once, and each picture briefly lifts the
  // panel (and a blind user's dark screen) off the page.
  let lastShot = null
  function captureScreenshot() {
    if (lastShot && Date.now() - lastShot.at < 1200) return lastShot.promise
    const promise = takeScreenshot()
    lastShot = { at: Date.now(), promise }
    return promise
  }
  async function takeScreenshot() {
    const panel = document.getElementById('accessgen-control-panel')
    // A blind user's dark screen hides the page; the team needs to see it.
    const veils = Array.from(document.querySelectorAll('[data-accessgen-hide-on-capture]'))
    hiding += 1
    try {
      panel?.style.setProperty('visibility', 'hidden', 'important')
      veils.forEach((v) => v.style.setProperty('visibility', 'hidden', 'important'))
      await nextFrame()
      const reply = await chrome.runtime.sendMessage({ type: 'ACCESSGEN_SCREENSHOT' })
      return reply?.ok ? reply.dataUrl : null
    } catch {
      return null
    } finally {
      hiding -= 1
      if (hiding === 0) {
        panel?.style.setProperty('visibility', 'visible', 'important')
        veils.forEach((v) => v.style.removeProperty('visibility'))
      }
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

  async function uploadEvents() {
    if (!sessionId || eventBuffer.length === 0) return
    const events = eventBuffer
    eventBuffer = []

    if (!(await upload('frames', { frames: [], events }))) {
      // Not accepted: requeue for the next attempt.
      eventBuffer = events.concat(eventBuffer).slice(-500)
    }
  }

  function keyFor(e) {
    if (e.type !== 'keydown') return null
    if (NAMED_KEYS.has(e.key) || /^F\d{1,2}$/.test(e.key)) {
      const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.metaKey && 'Meta', e.shiftKey && e.key !== 'Shift' && 'Shift'].filter(Boolean)
      return [...mods, e.key === ' ' ? 'Space' : e.key].join('+')
    }
    return 'character'
  }

  function trackEvent(e) {
    if (!recording) return
    const target = e.target
    if (target?.dataset?.accessgen || target?.dataset?.accessgenPanel) return
    if (e.type === 'scroll') {
      const now = Date.now()
      if (now - lastScrollAt < SCROLL_GAP_MS) return
      lastScrollAt = now
    }
    // A run of typed characters is one event, not one per letter.
    const key = keyFor(e)
    const last = eventBuffer[eventBuffer.length - 1]
    if (key === 'character' && last?.key === 'character' && last.target === getElementSelector(target)) return

    eventBuffer.push({
      type: e.type,
      timestamp: Date.now() - sessionStartTime,
      target: target === document || target === window ? 'page' : getElementSelector(target),
      label: target === document || target === window ? null : elementLabel(target),
      x: typeof e.clientX === 'number' ? Math.round(e.clientX) : null,
      y: typeof e.clientY === 'number' ? Math.round(e.clientY) : null,
      key
    })
  }

  for (const eventType of TRACKED_EVENTS) {
    document.addEventListener(eventType, trackEvent, { capture: true, passive: true })
  }

  // Empathy moments from "I felt this": capture a picture and POST now.
  window.addEventListener('accessgen-empathy', async (e) => {
    if (!sessionId) return
    const { label, note, activeProfiles } = e.detail
    const timestampMs = Date.now() - sessionStartTime
    const screenshot = await captureScreenshot()

    await upload('moment', { label, note, screenshot, timestampMs, activeProfiles, source: 'extension' })
  })

  // Struggles the profiles noticed themselves: uploaded as automatic moments.
  window.addEventListener('accessgen-friction', async (e) => {
    if (!sessionId || !recording) return
    const { kind, profileId, headline, detail, rect, evidence } = e.detail
    const timestampMs = Date.now() - sessionStartTime
    const screenshot = await captureScreenshot()
    await upload('moment', {
      label: headline,
      note: detail,
      screenshot,
      timestampMs,
      source: 'extension-auto',
      detector: kind,
      profileId,
      rect,
      evidence
    })
  })

  function startTimers() {
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
      if (recording) {
        startTimers()
        eventBuffer.push({ type: 'navigate', timestamp: Date.now() - sessionStartTime, target: 'page', label: document.title || location.pathname, x: null, y: null, key: null })
      }
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
      // the reply channel immediately. The background worker gives the tab
      // a fixed grace period before closing it, which protects this flush.
      uploadEvents().finally(() => {
        window.__accessgenRecorder = false
      })
    }

    return false
  })
})()
