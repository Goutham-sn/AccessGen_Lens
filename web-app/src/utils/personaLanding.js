// Where a built-in person lands on /start when picked from the Personas page.
// cards: PERSONA_CARDS. canWatch(card): whether that Watch card can be chosen
// right now (available, and able to take part in the current mode).
// Returns { action: 'choose' | 'show', cardId } or null when there is no card:
//   choose  the Watch card is chosen
//   show    the card is scrolled to with Details open. Used when the person has
//           only an Explore card, or their Watch card cannot be chosen now (an
//           Explore card is preferred, since it is not affected by that).
export function landingFor(personaName, cards, canWatch) {
  const mine = cards.filter((c) => c.personaName === personaName)
  const watch = mine.find((c) => c.mode === 'automated')
  const explore = mine.find((c) => c.mode === 'extension')
  if (watch && canWatch(watch)) return { action: 'choose', cardId: watch.id }
  if (explore) return { action: 'show', cardId: explore.id }
  if (watch) return { action: 'show', cardId: watch.id }
  return null
}
