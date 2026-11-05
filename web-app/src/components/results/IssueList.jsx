import { useState } from 'react'
import { getProfile } from '../../data/profiles.js'
import { isAutoMoment, fmtClock } from '../../utils/moments.js'
import { auditOf, splitMoments, PEOPLE_WORDS } from '../../utils/issues.js'
import { PinnedShot } from '../report/PinnedShot.jsx'
import { UnverifiedLabel } from '../shared/UnverifiedLabel.jsx'

const IMPACT = {
  critical: 'border-ember-700 bg-ember-700 text-white',
  serious: 'border-ember-600 text-ember-700',
  moderate: 'border-ink-400 text-ink-700',
  minor: 'border-rule text-ink-500'
}

function Who({ ids }) {
  return (
    <span className="text-sm text-ink-600">
      Hurts: {ids.map((id) => PEOPLE_WORDS[id] || getProfile(id)?.name || id).join(', ')}
    </span>
  )
}

function WatchButton({ moment, onWatch }) {
  if (!onWatch || moment.timestamp_ms == null) return null
  return (
    <button type="button" onClick={() => onWatch(moment)} className="font-mono text-xs text-brand-700 underline underline-offset-2 hover:text-brand-900">
      ▶ {fmtClock(moment.timestamp_ms)} in the video
    </button>
  )
}

// What axe measured, shown so anyone can see the problem: the element's
// own colours side by side, and the ratio against what it needs.
function Measured({ m }) {
  if (!m) return null
  if (m.kind === 'contrast' && m.fg && m.bg) {
    return (
      <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex h-7 items-center rounded-[3px] border border-rule px-2 font-semibold" style={{ color: m.fg, background: m.bg }}>Aa sample</span>
        <span className="font-mono text-xs text-ink-700">
          text {m.fg} on {m.bg} · <b className="text-ember-700">{m.ratio}:1</b>{m.needs ? `, needs ${m.needs}:1` : ''}{m.fontSize ? ` · ${m.fontSize}` : ''}
        </span>
      </span>
    )
  }
  if (m.kind === 'size') {
    return <span className="mt-1.5 block font-mono text-xs text-ink-700">{m.width} × {m.height} px, needs at least {m.needs} × {m.needs} px</span>
  }
  return null
}

function AuditIssue({ moment, n, onWatch }) {
  const a = auditOf(moment)
  const [open, setOpen] = useState(false)
  const nodes = a.nodes || []
  const id = `issue-${moment.id}`
  return (
    <li id={`moment-${moment.id}`} className="scroll-mt-20 border-t border-rule py-5 first:border-t-0">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num font-mono text-xs text-ink-500">{String(n).padStart(2, '0')}</span>
            <span className={`rounded-[3px] border px-1.5 py-px font-mono text-[11px] uppercase ${IMPACT[a.impact] || IMPACT.moderate}`}>{a.impact}</span>
            <span className="font-mono text-[11px] text-ink-500">{a.rule}</span>
            {moment.unverified && <UnverifiedLabel />}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink-900">{moment.headline || moment.label}</h3>
          <p className="mt-1 text-ink-700">{a.why || moment.fact || moment.note}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Who ids={a.who || []} />
            <WatchButton moment={moment} onWatch={onWatch} />
            {a.helpUrl && (
              <a href={a.helpUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-700 underline underline-offset-2">How to fix it</a>
            )}
          </div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-[4px] border border-ink-900/20 px-2.5 py-1 text-sm text-ink-900 hover:border-ink-900/60"
          >
            {open ? 'Hide' : 'Show'} {a.count === 1 ? 'the element' : `all ${a.count} elements`}
          </button>
          {open && (
            <ol id={id} className="mt-3 divide-y divide-rule rounded-lg border border-rule bg-white">
              {nodes.map((node, i) => (
                <li key={i} className="p-3">
                  <p className="font-mono text-xs text-ink-500">{i + 1}. {node.selector}</p>
                  {node.html && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-[3px] bg-paper px-2 py-1.5 font-mono text-xs text-ink-800">{node.html}</pre>}
                  <Measured m={node.measured} />
                  {node.summary && <p className="mt-1.5 text-sm text-ink-700">{node.summary.replace(/^Fix (any|all) of the following:\s*/i, '')}</p>}
                </li>
              ))}
              {a.count > nodes.length && <li className="p-3 text-sm text-ink-500">and {a.count - nodes.length} more of the same</li>}
            </ol>
          )}
        </div>
        {moment.screenshot_url && (
          <div className="self-start">
            <PinnedShot
              src={moment.screenshot_url}
              rects={nodes.map((nd, i) => (nd.rect?.vw ? { ...nd.rect, n: i + 1 } : null)).filter(Boolean)}
              rect={moment.rect}
              alt={`Where it is on the page: ${moment.label}`}
              className="rounded-lg border border-rule"
            />
            {nodes.filter((nd) => nd.rect?.vw).length > 1 && <p className="mt-1 font-mono text-[11px] text-ink-500">Numbers match the list of elements.</p>}
            {nodes[0]?.measured && !open && <Measured m={nodes[0].measured} />}
          </div>
        )}
      </div>
    </li>
  )
}

function SeenIssue({ moment, n, onWatch }) {
  const felt = !isAutoMoment(moment) && moment.source !== 'runner'
  return (
    <li id={`moment-${moment.id}`} className="scroll-mt-20 border-t border-rule py-5 first:border-t-0">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num font-mono text-xs text-ink-500">{String(n).padStart(2, '0')}</span>
            <span className="font-mono text-[11px] text-ink-500">{fmtClock(moment.timestamp_ms)}</span>
            {moment.unverified && <UnverifiedLabel />}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink-900">{felt ? `“${moment.label}”` : (moment.headline || moment.label)}</h3>
          {(moment.fact || moment.note) && <p className={`mt-1 text-ink-700 ${felt ? 'italic' : ''}`}>{felt && moment.note ? `“${moment.note}”` : (moment.fact || moment.note)}</p>}
          {moment.for_team && <p className="mt-2 border-l-2 border-rule pl-3 text-sm text-ink-600">For the team: {moment.for_team}</p>}
          {moment.pattern_count > 1 && <p className="mt-1 font-mono text-xs text-ink-500">{moment.pattern_count} places like this</p>}
          <div className="mt-2"><WatchButton moment={moment} onWatch={onWatch} /></div>
        </div>
        {(moment.screenshot_url || moment.shot_url) && (
          <PinnedShot src={moment.screenshot_url || moment.shot_url} rect={moment.rect} alt={`The page at that moment: ${moment.label}`} className="self-start rounded-lg border border-rule" />
        )}
      </div>
    </li>
  )
}

function Group({ id, title, sub, children, count }) {
  if (!count) return null
  return (
    <section aria-labelledby={id} className="mt-10 first:mt-0">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink-900 pb-2">
        <h3 id={id} className="text-base font-semibold text-ink-900">{title}</h3>
        <span className="num font-mono text-sm text-ink-600">{count}</span>
      </div>
      {sub && <p className="mt-2 text-sm text-ink-600">{sub}</p>}
      <ol className="mt-1">{children}</ol>
    </section>
  )
}

// Every issue a session found, all on one page: the rules engine's (with
// every element), what was seen as the page was used, what the tester
// felt, and what needs a person to check.
export function IssueList({ moments, reviewLines = [], onWatch, emptyText }) {
  const { audit, seen, felt, review } = splitMoments(moments)
  const total = audit.length + seen.length + felt.length
  let n = 0
  if (!total && !review.length && !reviewLines.length) {
    return <p className="text-ink-700">{emptyText || 'Nothing was recorded in this session.'}</p>
  }
  return (
    <div>
      <Group id="issues-audit" title="Broken against the accessibility rules" count={audit.length}
        sub={`Checked against every rule of axe-core, the open-source accessibility rules engine. ${audit.reduce((s, m) => s + (auditOf(m).count || 1), 0)} elements in all.`}>
        {audit.map((m) => <AuditIssue key={m.id} moment={m} n={++n} onWatch={onWatch} />)}
      </Group>
      <Group id="issues-seen" title="Seen while the page was used" count={seen.length}
        sub="Noticed by the simulation itself: keyboard, focus, missed clicks, what a screen reader said.">
        {seen.map((m) => <SeenIssue key={m.id} moment={m} n={++n} onWatch={onWatch} />)}
      </Group>
      <Group id="issues-felt" title="Felt by the tester" count={felt.length} sub="Logged with “I felt this”, in the tester's own words.">
        {felt.map((m) => <SeenIssue key={m.id} moment={m} n={++n} onWatch={onWatch} />)}
      </Group>
      <Group id="issues-review" title="Check these by hand" count={review.length + reviewLines.length}
        sub="The rules engine could not decide these on its own. They may be fine, or not: a person has to look.">
        {review.map((m) => <AuditIssue key={m.id} moment={m} n={++n} onWatch={onWatch} />)}
        {reviewLines.map((line, i) => (
          <li key={`line-${i}`} className="border-t border-rule py-4 text-ink-700 first:border-t-0">{line.replace(/^Check by hand: /, '')}</li>
        ))}
      </Group>
    </div>
  )
}
