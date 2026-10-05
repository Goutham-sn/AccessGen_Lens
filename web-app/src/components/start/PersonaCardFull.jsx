import { cardTitle, getCard, fillPronouns } from '../../data/personaCards.js'
import { ForYourTeam } from './ForYourTeam.jsx'

const SHOW_DRAFT_TAG = import.meta.env.DEV

function seconds(card) {
  if (!card.estimatedSeconds) return null
  if (card.mode === 'extension') {
    const minutes = Math.round(card.estimatedSeconds / 60)
    return `About ${minutes} minute${minutes === 1 ? '' : 's'}. You decide when to stop.`
  }
  return `About ${card.estimatedSeconds} seconds.`
}

// One card: a labelled group whose name includes the experience
// ("Ravi, 65, low vision"). `isLive(check)` says whether a runner check is
// running today; automated cards only claim live checks. `children` holds
// the card's control (checkbox, button or nothing).
// `pronouns` come from the persona record and fill the pronoun tokens in the
// card's copy; without them the copy uses they/them/their.
export function PersonaCardFull({ card, isLive, detailsOpen, onToggleDetails, children, unavailableReason, pronouns }) {
  const t = (text) => fillPronouns(text, pronouns)
  const titleId = `${card.id}-title`
  const detailsId = `${card.id}-details`
  const comingId = `${card.id}-coming`
  const later = card.mode === 'later'
  const automated = card.mode === 'automated'

  const looked = automated ? card.looksAt.filter((i) => isLive(i.check)) : (card.looksAt || [])
  const notYet = automated ? card.looksAt.filter((i) => !isLive(i.check)) : []
  const tags = [
    card.mode === 'extension' && 'You drive it, we record it',
    later && 'Coming',
    SHOW_DRAFT_TAG && card.draft && 'Draft'
  ].filter(Boolean)
  const notLines = [...notYet.map((i) => ({ text: i.text })), ...(card.notSimulated || [])]

  return (
    <div
      id={`card-${card.id}`}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={later ? comingId : undefined}
      className={`rounded-xl border p-4 ${later ? 'border-dashed border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={titleId} className="text-lg font-semibold text-ink-900">{cardTitle(card)}</h3>
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {tags.map((t) => <Tag key={t}>{t}</Tag>)}
          </ul>
        )}
      </div>
      {card.place && <p className="text-sm text-ink-600">{card.place}</p>}
      {later && <p id={comingId} className="mt-1 text-sm font-medium text-ink-700">Not available yet.</p>}

      <p className="mt-3 text-sm text-ink-700">{t(card.story)}</p>

      <h4 className="mt-3 text-sm font-semibold text-ink-900">
        {card.kind === 'situation' ? 'What changes' : `How ${card.name} uses the web`}
      </h4>
      <p className="text-sm text-ink-700">{t(card.howTheyUseTheWeb)}</p>

      {!later && (
        <>
          {card.whatYouWillSee?.length > 0 && (
            <>
              <h4 className="mt-3 text-sm font-semibold text-ink-900">What you will see</h4>
              <ul className="list-disc pl-5 text-sm text-ink-700">
                {card.whatYouWillSee.map((w) => <li key={w}>{t(w)}</li>)}
              </ul>
            </>
          )}

          {looked.length > 0 && (
            <>
              <h4 className="mt-3 text-sm font-semibold text-ink-900">
                {automated ? 'What this run looks at' : 'What to look out for'}
              </h4>
              <ul className="list-disc pl-5 text-sm text-ink-700">
                {looked.map((i) => <li key={i.text}>{t(i.text)}</li>)}
              </ul>
            </>
          )}

          {notLines.length > 0 && (
            <>
              <h4 className="mt-3 text-sm font-semibold text-ink-900">
                {automated ? 'Not looked at in this run' : 'Not part of this card'}
              </h4>
              <ul className="list-disc pl-5 text-sm text-ink-700">
                {notLines.map((l) => (
                  <li key={l.text}>
                    {l.seeCard && getCard(l.seeCard)
                      ? <a href={`#card-${l.seeCard}`} className="text-brand-700 underline">{t(l.text)}</a>
                      : t(l.text)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {seconds(card) && <p className="mt-3 text-sm text-ink-700">{seconds(card)}</p>}

          {unavailableReason && (
            <p id={`${card.id}-unavailable`} className="mt-3 text-sm font-medium text-ink-900">{unavailableReason}</p>
          )}

          <div className="mt-3">{children}</div>

          {card.guidelines?.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                aria-expanded={detailsOpen}
                aria-controls={detailsId}
                onClick={onToggleDetails}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-brand-700 underline"
              >
                Details<span className="sr-only"> for {cardTitle(card)}</span>
                <span aria-hidden="true">{detailsOpen ? '▴' : '▾'}</span>
              </button>
              <ForYourTeam id={detailsId} guidelines={card.guidelines} hidden={!detailsOpen} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Tag({ children }) {
  return (
    <li className="rounded-full border border-gray-400 bg-white px-2 py-0.5 text-xs font-medium text-ink-900">
      {children}
    </li>
  )
}
