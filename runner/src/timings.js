// Phase timings for one persona. mark(name) records the time since the
// previous mark, so the phases add up to the total.
export function createTimings(label) {
  const start = Date.now()
  let last = start
  const phases = {}
  return {
    mark(name) {
      const now = Date.now()
      phases[name] = (phases[name] || 0) + (now - last)
      last = now
    },
    skip() { last = Date.now() },
    done() {
      const result = { ...phases, total: Date.now() - start }
      console.log(`[runner] timings ${label} ${JSON.stringify(result)}`)
      return result
    }
  }
}
