// Stands in for extension/content-scripts/communicator.js inside the runner
// bundle. The extension version talks to chrome.runtime, which does not
// exist here. Profiles that report events call this instead, and the
// runner may expose a binding with this name to receive them.
export function setSession() {}

export function send(event, data = {}) {
  try {
    globalThis.__accessgenRunnerEvent?.({ event, at: Date.now(), ...data })
  } catch {
    // No binding exposed: the event is simply not collected.
  }
}
