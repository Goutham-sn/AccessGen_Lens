// Channel from the simulated page back to the extension (and onward to the
// web app + backend). Imported by simulation-controller only, so the built
// content-script bundle stays self-contained.

function getSessionState() {
  if (!globalThis.__accessgenSessionState) {
    globalThis.__accessgenSessionState = { sessionId: null }
  }
  return globalThis.__accessgenSessionState
}

export function setSession(id) {
  getSessionState().sessionId = id
}

export function send(event, data = {}) {
  const state = getSessionState()
  try {
    chrome.runtime.sendMessage({
      type: 'ACCESSGEN_DATA',
      payload: { event, sessionId: state.sessionId, at: Date.now(), ...data }
    }).catch?.(() => {})
  } catch {
    // Extension context invalidated (e.g. reloaded) — drop silently.
  }
}
