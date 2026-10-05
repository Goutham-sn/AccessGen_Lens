// AccessGen Lens: background service worker.
// Orchestrates simulation lifecycle: receives commands from the web app
// (via bridge.js), injects content scripts into the target tab, re-injects
// on navigation, and relays realtime data back to the web app tab.

const state = {
  isActive: false,
  sessionId: null,
  activeProfiles: [],
  targetTabId: null,
  // True only once the offscreen MediaRecorder has actually started, never
  // just because a session is active.
  isRecording: false,
  recordingStartedAt: null,
  // In-memory only, like injectInFlight: guards against a double start
  // while one beginRecording() call is still waiting on the offscreen doc.
  recordingInFlight: false,
  startedAt: null,
  url: null,
  token: null,
  // Per-session upload token from the web app. Lets the extension finish its
  // uploads after the 15 minute access token expires. Never logged.
  uploadToken: null,
  apiUrl: 'http://localhost:3001',
  webAppTabId: null,
  injectInFlight: false,
  // True while startSimulation is waiting for the tab's first load to
  // complete. webNavigation.onCommitted fires for that SAME first
  // navigation (before "complete"), and its own internal listener would
  // otherwise race startSimulation's injection for the identical page
  // load (both firing on the very same status-change event), doubling
  // every timer, observer and rAF loop the moment a session starts. This
  // flag tells onCommitted to stand down until the initial injection is
  // done and only handle *later* (real) navigations.
  pendingInitialLoad: false
}

async function persistState() {
  // injectInFlight / pendingInitialLoad are in-memory coordination flags
  // for THIS service worker instance only; they must never be persisted.
  // MV3 kills the worker after ~30s idle and respawns it fresh on the next
  // event; if a worker was ever torn down while injectInFlight happened to
  // be true, restoring that `true` into every future instance would wedge
  // injectSimulation()'s very first line (`if (state.injectInFlight) return`)
  // shut forever: no code path left could ever reset it, since it belonged
  // to an async call that no longer exists. That is exactly how the overlay
  // can silently stop appearing at all.
  // The upload token goes to chrome.storage.session instead: kept in memory
  // by the browser, cleared when it closes, and not readable by content
  // scripts (the default access level is trusted contexts only).
  const { injectInFlight, pendingInitialLoad, recordingInFlight, uploadToken, ...durable } = state
  await chrome.storage.local.set({ simulationState: durable })
  await chrome.storage.session.set({ uploadToken: uploadToken || null })
}

async function restoreState() {
  const { simulationState } = await chrome.storage.local.get('simulationState')
  if (simulationState) Object.assign(state, simulationState)
  // Older versions kept it in local storage: never trust that copy.
  delete state.uploadToken
  const { uploadToken } = await chrome.storage.session.get('uploadToken')
  state.uploadToken = typeof uploadToken === 'string' ? uploadToken : null
  // A freshly spawned worker never has anything in flight, regardless of
  // what an earlier (possibly abruptly-killed) instance last wrote.
  state.injectInFlight = false
  state.pendingInitialLoad = false
  state.recordingInFlight = false
}
// Every listener waits on this before touching state. A worker woken by an
// event would otherwise handle it against the defaults, and a late restore
// would overwrite whatever that handler had just written.
const stateReady = restoreState().catch((err) => {
  console.warn('[accessgen] state restore failed:', err?.message)
})

// ---------------------------------------------------------------- injection

async function injectSimulation(tabId) {
  if (state.injectInFlight) return
  state.injectInFlight = true

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/simulation-controller.js']
    })
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/recorder.js']
    })
    // Hand configuration to the freshly injected scripts.
    await chrome.tabs.sendMessage(tabId, {
      type: 'ACCESSGEN_INIT',
      payload: {
        sessionId: state.sessionId,
        profiles: state.activeProfiles,
        // No access token and no upload token: the page's renderer never
        // holds them. recorder.js sends its uploads here (ACCESSGEN_UPLOAD)
        // and this worker adds the credentials.
        startedAt: state.startedAt,
        // Interaction capture in recorder.js runs for the whole session,
        // independent of whether the tab video is being recorded yet.
        isRecording: true,
        // Drives the overlay's recording dot: the real video state.
        videoRecording: state.isRecording
      }
    })
  } catch {
    // Ignore transient tab/context errors during re-injection.
  } finally {
    state.injectInFlight = false
  }
  // Tab-specific badges can be reset by a navigation, so re-apply it.
  applyBadge()
}

// ------------------------------------------------------- tab recording
//
// Real tab video via chrome.tabCapture + MediaRecorder, run inside a
// hidden offscreen document. This replaced an html2canvas-per-500ms +
// server-side FFmpeg-stitching pipeline that kept failing: html2canvas
// throws on tainted canvases (any page with a cross-origin image without
// CORS headers, i.e. almost every real site), so most sessions uploaded
// zero usable frames and no video was ever produced. Recording the actual
// tab compositor output has none of that: it's the real pixels, and it
// costs the simulated page nothing extra to run.

async function ensureOffscreenDocument() {
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
    if (contexts.length > 0) return
  } catch {
    // chrome.runtime.getContexts requires Chrome 116+, so fall through and
    // let createDocument's own "already exists" error (caught below) be
    // the source of truth on older versions.
  }
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Records the simulated tab so the session can be replayed afterward.'
    })
  } catch (err) {
    if (!String(err?.message).includes('single offscreen')) throw err
  }
}

async function closeOffscreenDocument() {
  try {
    await chrome.offscreen.closeDocument()
    console.log('[recorder] offscreen document closed')
  } catch {
    // No offscreen document open: nothing to close.
  }
}

// Toolbar badge on the simulated tab, so the tester is prompted without
// anything being drawn into the page under test (it would end up in the
// recording). "!" = waiting for the tester to start recording, "REC" = live.
function applyBadge() {
  const tabId = state.targetTabId
  if (tabId == null || !state.isActive) return
  const recording = state.isRecording
  chrome.action.setBadgeText({ tabId, text: recording ? 'REC' : '!' }).catch(() => {})
  chrome.action.setBadgeBackgroundColor({ tabId, color: recording ? '#b91c1c' : '#b45309' }).catch(() => {})
}

function clearBadge(tabId) {
  if (tabId == null) return
  chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {})
}

async function getRecordShortcut() {
  try {
    const commands = await chrome.commands.getAll()
    return commands.find((c) => c.name === 'start-recording')?.shortcut || ''
  } catch {
    return ''
  }
}

function recordingFailed(reason) {
  console.warn('[recorder] recording failed:', reason)
  if (state.sessionId) forwardToWebApp({ event: 'recording-failed', sessionId: state.sessionId, reason })
  return { ok: false, error: reason }
}

// Starts the tab video. Only callable right after the tester invoked the
// extension on the simulated tab (popup click or keyboard shortcut): Chrome's
// tabCapture refuses a tab the extension has not been invoked on, which is
// why this cannot run automatically when the session starts.
async function beginRecording(tabId) {
  if (!state.isActive || !state.sessionId) return recordingFailed('No simulation is running')
  if (tabId == null || tabId !== state.targetTabId) return recordingFailed('Switch to the simulated tab first')
  if (state.isRecording) return { ok: true, alreadyRecording: true }
  if (state.recordingInFlight) return { ok: false, error: 'Recording is already starting' }

  state.recordingInFlight = true
  try {
    // Create the offscreen document first: it is the slow step, and the
    // stream id below expires within seconds of being issued.
    await ensureOffscreenDocument()
    console.log('[recorder] offscreen document ready')

    let streamId
    try {
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId })
    } catch (err) {
      console.warn('[recorder] getMediaStreamId failed:', err.message)
      return recordingFailed(`Chrome would not allow capturing this tab (${err.message})`)
    }
    console.log('[recorder] stream id obtained for tab', tabId)

    const reply = await chrome.runtime.sendMessage({
      target: 'accessgen-offscreen',
      type: 'ACCESSGEN_OFFSCREEN_START',
      payload: {
        streamId,
        sessionId: state.sessionId,
        apiUrl: state.apiUrl,
        token: state.token,
        uploadToken: state.uploadToken,
        sessionStartedAt: state.startedAt
      }
    }).catch((err) => ({ ok: false, error: err.message }))
    console.log('[recorder] offscreen start reply', reply)

    if (!reply?.ok) {
      await closeOffscreenDocument()
      return recordingFailed(reply?.error || 'The recorder did not start')
    }

    state.isRecording = true
    state.recordingStartedAt = reply.startedAt
    await persistState()
    applyBadge()
    forwardToWebApp({
      event: 'recording-started',
      sessionId: state.sessionId,
      recordingStartedAt: reply.startedAt,
      offsetMs: Math.max(0, reply.startedAt - (state.startedAt || reply.startedAt))
    })
    chrome.tabs.sendMessage(tabId, { type: 'ACCESSGEN_VIDEO_STATE', payload: { on: true } }).catch(() => {})
    return { ok: true }
  } catch (err) {
    return recordingFailed(err.message)
  } finally {
    state.recordingInFlight = false
  }
}

async function stopTabRecording() {
  try {
    const reply = await chrome.runtime.sendMessage({
      target: 'accessgen-offscreen',
      type: 'ACCESSGEN_OFFSCREEN_STOP'
    })
    console.log('[recorder] stop reply', reply)
    return reply || { ok: false, error: 'No reply from the recorder' }
  } catch (err) {
    console.warn('[recorder] stop failed:', err.message)
    return { ok: false, error: err.message }
  }
}

// Stops the recorder, waits for its onstop to build the blob and for the
// upload to finish, closes the offscreen document, and only then reports
// the outcome. Callers send session-ended after this resolves.
async function finishRecording(sessionId, wasRecording) {
  let result
  if (wasRecording) {
    const reply = await stopTabRecording()
    result = reply.ok
      ? { ok: true }
      : { ok: false, reason: reply.error || `Upload failed (status ${reply.status ?? 'unknown'})` }
  } else {
    result = { ok: false, reason: 'Recording was never started' }
  }
  await closeOffscreenDocument()

  if (sessionId) {
    forwardToWebApp(result.ok
      ? { event: 'recording-uploaded', sessionId }
      : { event: 'recording-failed', sessionId, reason: result.reason })
  }
  return result
}

async function destroySimulation(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ACCESSGEN_DESTROY' })
  } catch {
    // Tab may be gone or scripts not injected: nothing to clean up.
  }
  // chrome.tabs.sendMessage resolves as soon as ANY listener in the tab
  // responds. simulation-controller.js answers immediately; recorder.js
  // only answers after it finishes flushing the last batch of frames to
  // the backend. Give that flush a moment to actually land before the
  // caller closes the tab and cancels whatever request was in flight.
  await new Promise((resolve) => setTimeout(resolve, 600))
}

// ------------------------------------------------------------- lifecycle

async function startSimulation({ profiles, sessionId, url, token, apiUrl, uploadToken }, senderTabId) {
  state.isActive = true
  state.sessionId = sessionId
  state.activeProfiles = profiles || []
  // Recording starts later, from the popup or the keyboard shortcut.
  state.isRecording = false
  state.recordingStartedAt = null
  state.startedAt = Date.now()
  state.url = url
  state.token = token || null
  state.uploadToken = typeof uploadToken === 'string' ? uploadToken : null
  if (apiUrl) state.apiUrl = apiUrl
  state.webAppTabId = senderTabId ?? state.webAppTabId
  state.pendingInitialLoad = true

  // Reuse a tab already showing the target URL, otherwise open a new one.
  const existing = (await chrome.tabs.query({})).find((t) => t.url === url)
  let tab
  if (existing) {
    tab = await chrome.tabs.update(existing.id, { active: true })
  } else {
    tab = await chrome.tabs.create({ url, active: true })
  }
  state.targetTabId = tab.id
  await persistState()
  applyBadge()

  // Wait for the page to finish loading before injecting.
  await new Promise((resolve) => {
    const listener = (tabId, info) => {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
    // Already loaded (existing tab): resolve on next tick.
    chrome.tabs.get(tab.id).then((t) => {
      if (t.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    })
  })

  await injectSimulation(state.targetTabId)
  state.pendingInitialLoad = false
  return { ok: true, tabId: state.targetTabId }
}

// Uploads from recorder.js (events, thumbnail, empathy moments). It runs in
// the simulated page, where the page's CORS rules apply and where the
// credentials should never be, so it hands the body here and this worker
// makes the request with the access token and the upload token. Only the
// simulated tab of the live session may use it, the session id comes from
// this worker's state, and only the expected fields are forwarded.
const UPLOAD_KINDS = {
  frames: { path: 'frames', fields: ['frames', 'events'] },
  moment: { path: 'empathy-moments', fields: ['label', 'note', 'screenshot', 'timestampMs', 'activeProfiles'] }
}

async function uploadFromTab(sender, payload) {
  const kind = UPLOAD_KINDS[payload?.kind]
  if (!kind) return { ok: false, error: 'Unknown upload' }
  if (!state.isActive || !state.sessionId || sender?.tab?.id == null || sender.tab.id !== state.targetTabId) {
    return { ok: false, error: 'No live session for this tab' }
  }
  const body = {}
  for (const key of kind.fields) {
    if (payload.body && Object.prototype.hasOwnProperty.call(payload.body, key)) body[key] = payload.body[key]
  }
  try {
    const res = await fetch(`${state.apiUrl}/api/sessions/${state.sessionId}/${kind.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(state.uploadToken ? { 'X-Upload-Token': state.uploadToken } : {})
      },
      body: JSON.stringify(body)
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

async function endSessionOnBackend(sessionId, token, apiUrl, uploadToken) {
  if (!sessionId) return
  try {
    await fetch(`${apiUrl}/api/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(uploadToken ? { 'X-Upload-Token': uploadToken } : {})
      }
    })
  } catch {
    // Backend unreachable: the web app's own "Stop session" flow (if the
    // user goes back to it) will retry this.
  }
}

async function stopSimulation() {
  const sessionId = state.sessionId
  const tabId = state.targetTabId
  const token = state.token
  const uploadToken = state.uploadToken
  const apiUrl = state.apiUrl
  const wasRecording = state.isRecording

  if (tabId != null) {
    // Tell the content scripts to flush their last batch of events and
    // wait for that to actually happen before we touch the tab.
    await destroySimulation(tabId)
  }

  // /end first (sets end_time/duration, status: processing), THEN stop and
  // upload the recording (which sets video_url and status: complete).
  // Reversing this order would let /end's "processing" write clobber the
  // "complete" status the recording upload had just set.
  await endSessionOnBackend(sessionId, token, apiUrl, uploadToken)
  await finishRecording(sessionId, wasRecording)

  // Reset state (including targetTabId) before closing the tab, so the
  // tabs.onRemoved listener below (which also fires for this very removal)
  // sees its guard fail and doesn't send a second, redundant "ended" event.
  clearBadge(tabId)
  state.isActive = false
  state.isRecording = false
  state.recordingStartedAt = null
  state.sessionId = null
  state.uploadToken = null
  state.activeProfiles = []
  state.targetTabId = null
  state.startedAt = null
  state.pendingInitialLoad = false
  await persistState()

  if (tabId != null) {
    try { await chrome.tabs.remove(tabId) } catch { /* already closed */ }
  }

  // Tell the web app it can stop waiting: the recording is settled.
  if (sessionId) forwardToWebApp({ event: 'session-ended', sessionId })

  return { ok: true, sessionId }
}

async function updateProfiles(profiles) {
  state.activeProfiles = profiles
  await persistState()
  if (state.targetTabId != null) {
    await chrome.tabs.sendMessage(state.targetTabId, {
      type: 'ACCESSGEN_PROFILE_UPDATE',
      payload: { profiles }
    })
  }
  return { ok: true }
}

// -------------------------------------------------------------- messaging

function forwardToWebApp(payload) {
  // Relay realtime simulation data to every open web app tab.
  chrome.tabs.query({ url: 'http://localhost:5173/*' }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'ACCESSGEN_RELAY', payload }).catch(() => {})
    }
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message || {}

  const handlers = {
    ACCESSGEN_PING: () => ({ ok: true, version: chrome.runtime.getManifest().version }),
    ACCESSGEN_GET_STATUS: async () => ({
      isActive: state.isActive,
      sessionId: state.sessionId,
      activeProfiles: state.activeProfiles,
      isRecording: state.isRecording,
      recordingStartedAt: state.recordingStartedAt,
      targetTabId: state.targetTabId,
      recordShortcut: await getRecordShortcut(),
      url: state.url
    }),
    // Same reasoning as ACCESSGEN_STOP_SIMULATION below, but this one's the
    // more likely of the two to actually hit it: startSimulation() creates
    // a tab, waits for the ENTIRE page to finish loading (real sites can
    // easily take several seconds), injects the content scripts, and
    // starts tab capture, all before it would otherwise resolve. MV3
    // can recycle an idle-looking service worker mid-wait; if that
    // happens, the message port this response was meant to travel through
    // is gone by the time sendResponse would have fired, producing the
    // same "channel closed" error, and separately, holding the port open
    // that long could also just trip the web app's own 3-second
    // "Extension not responding" timeout on a slow site regardless of
    // worker lifetime. The caller only needs to know the request was
    // received, not that the whole multi-second startup finished; the
    // Session page it navigates to reflects live status anyway.
    ACCESSGEN_START_SIMULATION: () => {
      startSimulation(payload, sender.tab?.id).catch((err) => console.error('[accessgen] start failed:', err))
      return { ok: true }
    },
    // Deliberately NOT `() => stopSimulation()`: that would make the outer
    // wrapper below wait for the full stop sequence (including closing
    // the very tab that sent this message) before calling sendResponse.
    // By the time it got there, the tab (and the message channel to it)
    // would already be gone, which is exactly what was producing "message
    // channel closed before a response was received". Acknowledge
    // synchronously first; let the actual teardown run after.
    ACCESSGEN_STOP_SIMULATION: () => {
      console.log('[accessgen] STOP_SIMULATION received')
      stopSimulation().catch((err) => console.error('[accessgen] stop failed:', err))
      return { ok: true }
    },
    ACCESSGEN_UPDATE_PROFILES: () => updateProfiles(payload.profiles),
    // Sent by the popup's "Start recording" button. Opening the popup on
    // the simulated tab is the invocation tabCapture needs.
    ACCESSGEN_START_RECORDING: () => beginRecording(payload?.tabId),
    ACCESSGEN_STOP_RECORDING: async () => {
      state.isRecording = false
      await persistState()
      if (state.targetTabId != null) {
        await chrome.tabs.sendMessage(state.targetTabId, { type: 'ACCESSGEN_RECORDING', payload: { on: false } })
      }
      return { ok: true }
    },
    ACCESSGEN_LOG_EMPATHY_MOMENT: async () => {
      if (state.targetTabId == null) throw new Error('No active simulation')
      await chrome.tabs.sendMessage(state.targetTabId, {
        type: 'ACCESSGEN_CAPTURE_MOMENT',
        payload: { label: payload.label, note: payload.note }
      })
      return { ok: true }
    },
    ACCESSGEN_UPLOAD: () => uploadFromTab(sender, payload),
    ACCESSGEN_DATA: () => {
      forwardToWebApp(payload)
      return { ok: true }
    }
  }

  const handler = handlers[type]
  if (!handler) {
    // Always answer, so no sender is left waiting on a port that closes.
    sendResponse({ error: 'Unknown message type' })
    return false
  }

  // This callback must stay synchronous and return true: an async callback
  // returns a Promise instead of true, so Chrome closes the channel before
  // sendResponse runs.
  const run = async () => {
    await stateReady
    return handler()
  }
  run().then((value) => {
    try { sendResponse(value) } catch {}
  }).catch((err) => {
    try { sendResponse({ error: err.message }) } catch {}
  })
  return true
})

// -------------------------------------------------- navigation continuity

chrome.webNavigation.onCommitted.addListener(async (details) => {
  await stateReady
  if (!state.isActive) return
  if (details.tabId !== state.targetTabId || details.frameId !== 0) return
  // startSimulation is already injecting for this exact page load; this
  // commit event is for that same initial navigation, not a later one.
  // Handling it too would double-inject: two frame-capture timers, two
  // MutationObservers, two of every rAF loop, which is what was making
  // the simulated page feel laggy.
  if (state.pendingInitialLoad) return
  // Re-inject after the new document commits and finishes loading.
  const listener = async (tabId, info) => {
    if (tabId === state.targetTabId && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener)
      try {
        await injectSimulation(state.targetTabId)
      } catch (err) {
        console.warn('[accessgen] re-injection failed:', err.message)
      }
    }
  }
  chrome.tabs.onUpdated.addListener(listener)
})

// Keyboard shortcut (manifest "commands"). Pressing it counts as invoking
// the extension on the active tab, same as opening the popup there.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'start-recording') stateReady.then(() => beginRecording(tab?.id))
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stateReady
  if (tabId !== state.targetTabId) return

  const sessionId = state.sessionId
  const token = state.token
  const uploadToken = state.uploadToken
  const apiUrl = state.apiUrl
  const wasRecording = state.isRecording

  state.isActive = false
  state.isRecording = false
  state.recordingStartedAt = null
  state.sessionId = null
  state.uploadToken = null
  state.activeProfiles = []
  state.targetTabId = null
  state.startedAt = null
  state.pendingInitialLoad = false
  persistState()

  // The user closed the simulated tab directly instead of using the
  // overlay's Stop button: still end the session so it isn't left stuck
  // "recording" forever, still stop and upload whatever was recorded (the
  // tab's video track ending should have already triggered this in the
  // offscreen document, but asking explicitly is harmless if it already
  // has: it just reports "not recording"), and still let the web app
  // know it's ready.
  endSessionOnBackend(sessionId, token, apiUrl, uploadToken)
    .then(() => finishRecording(sessionId, wasRecording))
    .then(() => {
      if (sessionId) forwardToWebApp({ event: 'session-ended', sessionId })
    })
})
