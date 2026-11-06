import { useState } from 'react'
import { isAutoMoment, fmtClock } from '../../utils/moments.js'
import { auditOf, listMoments } from '../../utils/issues.js'
import { PinnedShot } from '../report/PinnedShot.jsx'
import { UnverifiedLabel } from '../shared/UnverifiedLabel.jsx'

function WatchButton({ moment, onWatch }) {
  if (!onWatch || moment.timestamp_ms == null) return null
  return (
    <button type="button" onClick={() => onWatch(moment)} className="font-mono text-xs text-brand-700 underline underline-offset-2 hover:text-brand-900">
      ▶ Watch it at {fmtClock(moment.timestamp_ms)}
    </button>
  )
}

// The element's own colours side by side, so anyone can see it.
function Measured({ m }) {
  if (!m || m.kind !== 'contrast' || !m.fg || !m.bg) return null
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex h-7 items-center rounded-[3px] border border-rule px-2 font-semibold" style={{ color: m.fg, background: m.bg }}>Aa sample</span>
      <span className="font-mono text-xs text-ink-700">text {m.fg} on {m.bg}</span>
    </span>
  )
}

function Elements({ id, nodes, count }) {
  const [open, setOpen] = useState(false)
  if (!nodes.length) return null
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-[4px] border border-ink-900/20 px-2.5 py-1 text-sm text-ink-900 hover:border-ink-900/60"
      >
        {open ? 'Hide' : 'Show'} {count === 1 ? 'the element' : `all ${count} elements`}
      </button>
      {open && (
        <ol id={id} className="mt-3 divide-y divide-rule rounded-lg border border-rule bg-white">
          {nodes.map((node, i) => (
            <li key={i} className="p-3">
              <p className="font-mono text-xs text-ink-500">{i + 1}. {node.selector}</p>
              {node.html && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-[3px] bg-mist px-2 py-1.5 font-mono text-xs text-ink-800">{node.html}</pre>}
              <Measured m={node.measured} />
            </li>
          ))}
          {count > nodes.length && <li className="p-3 text-sm text-ink-500">and {count - nodes.length} more of the same</li>}
        </ol>
      )}
    </>
  )
}

// One moment: what happened, where, and when in the video.
function Moment({ moment, n, onWatch }) {
  const a = auditOf(moment)
  const felt = !a && !isAutoMoment(moment) && moment.source !== 'runner'
  const nodes = a?.nodes || []
  const html = !a && (moment.evidence?.html || moment.evidence?.measured?.html)
  const shot = moment.screenshot_url || moment.shot_url
  const pins = nodes.map((nd, i) => (nd.rect?.vw ? { ...nd.rect, n: i + 1 } : null)).filter(Boolean)
  const headline = felt ? `“${moment.label}”` : (moment.headline || moment.label)
  const text = a ? (a.why || moment.fact || moment.note) : felt && moment.note ? `“${moment.note}”` : (moment.fact || moment.note)
  return (
    <li id={`moment-${moment.id}`} className="scroll-mt-20 border-t border-rule py-5 first:border-t-0">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num font-mono text-xs text-ink-500">{String(n).padStart(2, '0')}</span>
            {moment.timestamp_ms != null && <span className="font-mono text-[11px] text-ink-500">{fmtClock(moment.timestamp_ms)}</span>}
            {felt && <span className="rounded-[3px] border border-ember-600 px-1.5 py-px font-mono text-[11px] text-ember-700">felt by the tester</span>}
            {moment.unverified && <UnverifiedLabel />}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink-900">{headline}</h3>
          {text && <p className={`mt-1 text-ink-700 ${felt ? 'italic' : ''}`}>{text}</p>}
          {html && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-[3px] bg-mist px-2 py-1.5 font-mono text-xs text-ink-800">{html}</pre>}
          {!a && moment.pattern_count > 1 && <p className="mt-1 font-mono text-xs text-ink-500">{moment.pattern_count} places like this</p>}
          <div className="mt-2"><WatchButton moment={moment} onWatch={onWatch} /></div>
          {a && <Elements id={`elements-${moment.id}`} nodes={nodes} count={a.count || nodes.length} />}
        </div>
        {shot && (
          <div className="self-start">
            <PinnedShot
              src={shot}
              rects={pins.length ? pins : null}
              rect={moment.rect}
              alt={`The page at that moment: ${moment.headline || moment.label}`}
              className="rounded-lg border border-rule"
            />
            {nodes[0]?.measured && <Measured m={nodes[0].measured} />}
          </div>
        )}
      </div>
    </li>
  )
}

// Every moment of a session, in the order they happened, on one page.
export function IssueList({ moments, onWatch, emptyText }) {
  const list = listMoments(moments)
  if (!list.length) return <p className="text-ink-700">{emptyText || 'Nothing was recorded in this session.'}</p>
  return (
    <ol>
      {list.map((m, i) => <Moment key={m.id} moment={m} n={i + 1} onWatch={onWatch} />)}
    </ol>
  )
}
