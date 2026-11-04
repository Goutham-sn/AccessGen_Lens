// How the web app handles a persona record from GET /personas.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value)
}

// The id to link a session to, or null. Only a real database id counts: a
// persona kept in the browser from before records had real ids (such as
// 'david-38') must not reach the database.
export function personaIdOf(persona) {
  return isUuid(persona?.id) ? persona.id : null
}

// The persona as a session stores it. The same five fields the runner stores
// for a watched session (backend runs.controller), so a report reads the same
// whichever way the session was started.
export function snapshotOf(persona) {
  if (!persona) return null
  return {
    id: personaIdOf(persona),
    name: persona.name,
    age: persona.age ?? null,
    story: persona.story ?? null,
    profiles: Array.isArray(persona.profiles) ? persona.profiles : []
  }
}

// People in the order of their cards on /start; anyone without a card last.
export function inCardOrder(records, cards) {
  const rank = (r) => {
    const i = cards.findIndex((c) => c.personaName === r.name)
    return i === -1 ? Infinity : i
  }
  return [...records].sort((a, b) => rank(a) - rank(b))
}
