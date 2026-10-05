// Talks to the extension through the bridge content script via window.postMessage.
//
// Requests and responses use a fixed envelope so they can never be confused:
//   page -> bridge: { source: 'accessgen-web', kind: 'request', requestId, type, payload }
//   bridge -> page: { source: 'accessgen-bridge', kind: 'response', requestId, type, payload }
//   bridge -> page: { source: 'accessgen-bridge', kind: 'event', payload }

const ACCESSGEN_PREFIX = 'ACCESSGEN_'
const WEB = 'accessgen-web'
const BRIDGE = 'accessgen-bridge'
const TIMEOUT_MS = 5000
const MAX_PENDING = 20

const pending = new Map() // requestId -> { resolve, reject, timeout }
const subscribers = new Set()
let listening = false

class BridgeError extends Error {} // the bridge answered, but with an error

function ensureListener() {
  if (listening) return
  listening = true
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return
    const data = event.data
    if (!data || data.source !== BRIDGE) return

    if (data.kind === 'response') {
      const entry = pending.get(data.requestId)
      if (!entry) return
      pending.delete(data.requestId)
      clearTimeout(entry.timeout)
      if (data.payload?.error) entry.reject(new BridgeError(data.payload.error))
      else entry.resolve(data.payload)
    } else if (data.kind === 'event') {
      for (const callback of subscribers) callback(data.payload)
    }
  })
}

export function sendToExtension(type, payload) {
  ensureListener()
  return new Promise((resolve, reject) => {
    if (pending.size >= MAX_PENDING) {
      reject(new Error('Too many pending extension requests'))
      return
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timeout = setTimeout(() => {
      pending.delete(requestId)
      reject(new Error('Extension not responding'))
    }, TIMEOUT_MS)

    pending.set(requestId, { resolve, reject, timeout })
    window.postMessage(
      { source: WEB, kind: 'request', requestId, type: `${ACCESSGEN_PREFIX}${type}`, payload },
      window.location.origin
    )
  })
}

// Retries only when the bridge answered with an error (extension present, but
// the service worker may still be waking up). A timeout means no bridge, so
// it is not retried.
async function withRetry(fn, attempts = 3, base = 500) {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (!(err instanceof BridgeError) || i >= attempts - 1) throw err
      await new Promise((r) => setTimeout(r, base * 2 ** i))
    }
  }
}

export function listenFromExtension(callback) {
  ensureListener()
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

export async function checkExtensionInstalled() {
  try {
    await withRetry(() => sendToExtension('PING', {}))
    return true
  } catch {
    return false
  }
}

export async function startSimulation(config) {
  return sendToExtension('START_SIMULATION', config)
}

export async function stopSimulation() {
  return sendToExtension('STOP_SIMULATION', {})
}

export async function updateProfiles(profiles) {
  return sendToExtension('UPDATE_PROFILES', { profiles })
}

export async function logEmpathyMoment(label, note) {
  return sendToExtension('LOG_EMPATHY_MOMENT', { label, note })
}

export async function getExtensionStatus() {
  return withRetry(() => sendToExtension('GET_STATUS', {}))
}
