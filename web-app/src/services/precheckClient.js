const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Asks for a pre-check and waits for the answer: POST, then GET until done.
// Returns the result ({ ok, ... }), or null if `isCurrent()` says the person
// has moved on (a new address, or the confirmation taken back). Throws the
// server's plain message when the request is refused (a bad address, a limit).
// api, sleep and the timings can be replaced, for tests.
export async function requestPrecheck(api, url, {
  isCurrent = () => true,
  sleep = wait,
  intervalMs = 600,
  giveUpMs = 15000,
  now = Date.now
} = {}) {
  const started = now()
  const first = await api.post('/runs/precheck', { url })
  if (first.status === 'done') return isCurrent() ? first.result : null
  if (!first.id) throw new Error('We could not check this page ahead of time.')

  for (;;) {
    await sleep(intervalMs)
    if (!isCurrent()) return null
    const next = await api.get(`/runs/precheck/${first.id}`)
    if (next.status === 'done') return isCurrent() ? next.result : null
    if (now() - started > giveUpMs) return { ok: false, reason: 'The check took too long.' }
  }
}
