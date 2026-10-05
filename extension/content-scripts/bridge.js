// Runs only on the web app (localhost:5173). Relays messages between the
// web app page and the extension background service worker.
//
// Requests and responses use a fixed envelope so they can never be confused:
//   page -> bridge: { source: 'accessgen-web', kind: 'request', requestId, type, payload }
//   bridge -> page: { source: 'accessgen-bridge', kind: 'response', requestId, type, payload }
//   bridge -> page: { source: 'accessgen-bridge', kind: 'event', payload }
// The bridge only ever acts on web requests, so its own replies (which share
// this window) are ignored instead of being forwarded again.

const WEB = 'accessgen-web'
const BRIDGE = 'accessgen-bridge'
const MAX_TYPE_LEN = 64
// Each allowed type, and the only payload fields forwarded for it. Anything
// else the page puts in the payload is dropped here.
const ALLOWED_FIELDS = {
  ACCESSGEN_PING: [],
  ACCESSGEN_GET_STATUS: [],
  ACCESSGEN_START_SIMULATION: ['sessionId', 'url', 'profiles', 'token', 'apiUrl', 'uploadToken'],
  ACCESSGEN_STOP_SIMULATION: [],
  ACCESSGEN_UPDATE_PROFILES: ['profiles'],
  ACCESSGEN_LOG_EMPATHY_MOMENT: ['label', 'note']
}

function pickPayload(type, payload) {
  const out = {}
  if (!payload || typeof payload !== 'object') return out
  for (const key of ALLOWED_FIELDS[type]) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) out[key] = payload[key]
  }
  return out
}

function postToPage(message) {
  try {
    window.postMessage({ source: BRIDGE, ...message }, window.location.origin)
  } catch {
    // Ignore post-reload / invalidated contexts.
  }
}

// Web app -> extension
window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return
  const data = event.data
  if (!data || data.source !== WEB || data.kind !== 'request') return
  const { type, requestId, payload } = data
  if (typeof type !== 'string' || type.length > MAX_TYPE_LEN || !Object.hasOwn(ALLOWED_FIELDS, type)) return
  if (typeof requestId !== 'string') return

  const respond = (responsePayload) =>
    postToPage({ kind: 'response', requestId, type, payload: responsePayload })

  try {
    chrome.runtime.sendMessage({ type, payload: pickPayload(type, payload) }, (response) => {
      // Read lastError exactly once so Chrome does not log it as unchecked.
      const err = chrome.runtime.lastError
      respond(err ? { error: err.message } : response)
    })
  } catch (err) {
    // Extension context may have been invalidated after reload.
    respond({ error: err?.message || 'Extension context invalidated' })
  }
})

// Extension -> web app
try {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'ACCESSGEN_RELAY') {
      postToPage({ kind: 'event', payload: message.payload })
    }
  })
} catch {
  // Ignore if the runtime is already torn down.
}
