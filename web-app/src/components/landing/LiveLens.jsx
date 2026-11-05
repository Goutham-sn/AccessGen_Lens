import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DemoShop } from './DemoShop.jsx'
import { avatarColorFor } from '../../data/personaCards.js'

// The landing page's live demo: the same small shop seen through each
// person's eyes and hands, right here, with nothing to install. The effects
// are the extension's, rebuilt for one framed area: colour matrices, blur,
// a blind spot or a tunnel that follows the pointer, a shaking pointer whose
// clicks land where the shake puts them, letters that will not stay still,
// a screen reader's captions.

const DEUTERANOPIA = '0.367 0.861 -0.228 0 0 0.280 0.673 0.047 0 0 -0.012 0.043 0.969 0 0 0 0 0 1 0'

export const LENS_PEOPLE = [
  { id: 'you', name: 'You', line: 'As you see it', hint: 'Do it once as yourself first.' },
  { id: 'ravi', name: 'Ravi', age: 65, line: "Parkinson's tremor", hint: 'Your hand shakes. The click lands where the shake puts it.', tremor: 11 },
  { id: 'meera', name: 'Meera', age: 72, line: 'Macular degeneration', hint: 'The middle of your vision is gone. Look around the edges.', blotch: 80, filter: 'blur(1.2px) contrast(0.85)' },
  { id: 'david', name: 'David', age: 38, line: 'Red-green colour blindness', hint: 'Red and green look the same to you.', filter: 'url(#lens-deut)' },
  { id: 'thomas', name: 'Thomas', age: 51, line: 'Tunnel vision after a stroke', hint: 'You only see a small circle around the pointer.', tunnel: 95 },
  { id: 'ananya', name: 'Ananya', age: 19, line: 'Dyslexia and ADHD', hint: 'Letters shift while you read, and things keep pulling at you.', jumble: true, distract: true },
  { id: 'james', name: 'James', age: 32, line: 'Blind, uses a screen reader', hint: 'You cannot see the page. Move the pointer and listen to what it says.', filter: 'blur(9px)', sr: true }
]

const MIRROR = { b: 'd', d: 'b', p: 'q', q: 'p', n: 'u', u: 'n' }
function jumbleWord(w, seed) {
  if (w.length < 4) return w
  const r = (n) => Math.abs(Math.sin(seed * 9301 + w.length * 49297 + n * 233)) % 1
  if (r(1) > 0.5) return w
  const c = w.split('')
  const i = 1 + Math.floor(r(2) * (c.length - 3))
  ;[c[i], c[i + 1]] = [c[i + 1], c[i]]
  if (r(3) < 0.4) { const j = Math.floor(r(4) * c.length); if (MIRROR[c[j]]) c[j] = MIRROR[c[j]] }
  return c.join('')
}

function fmt(ms) {
  return ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`
}

export function LiveLens() {
  const [personId, setPersonId] = useState('you')
  const person = LENS_PEOPLE.find((p) => p.id === personId)
  const frame = useRef(null)
  const overlay = useRef(null)
  const cursor = useRef(null)
  const pos = useRef({ x: 260, y: 160, sx: 260, sy: 160, inside: false })
  const redirecting = useRef(false)
  const [tick, setTick] = useState(0)
  const [caption, setCaption] = useState('')
  const [toast, setToast] = useState(null)
  const [basket, setBasket] = useState(0)
  const [run, setRun] = useState({ startedAt: null, mistakes: 0, done: false })
  // The start time in a ref as well: a click can start and finish the
  // mission in one event, before the state above has updated.
  const startRef = useRef(null)
  const [results, setResults] = useState({})
  const [distraction, setDistraction] = useState(false)

  const reset = useCallback(() => {
    startRef.current = null
    setRun({ startedAt: null, mistakes: 0, done: false })
    setBasket(0)
    setToast(null)
    setCaption('')
  }, [])
  useEffect(reset, [personId, reset])

  const showToast = (text, tone) => {
    setToast({ text, tone })
    clearTimeout(showToast.t)
    showToast.t = setTimeout(() => setToast(null), 1400)
  }

  // The clock starts when the pointer first enters the shop: finding the
  // right thing is part of the task.
  const begin = () => {
    if (startRef.current) return
    startRef.current = performance.now()
    setRun((r) => ({ ...r, startedAt: startRef.current }))
  }

  const onAdd = (p) => {
    if (run.done) return
    begin()
    if (!p.inStock) {
      setRun((r) => ({ ...r, mistakes: r.mistakes + 1 }))
      showToast(`Sorry, ${p.name} is sold out`, 'bad')
      return
    }
    setBasket(1)
    showToast('Added to basket', 'good')
    const ms = performance.now() - (startRef.current || performance.now())
    setRun((r) => {
      setResults((all) => ({ ...all, [personId]: { ms, mistakes: r.mistakes } }))
      return { ...r, done: true }
    })
  }
  const onSave = () => {
    if (run.done) return
    begin()
    setRun((r) => ({ ...r, mistakes: r.mistakes + 1 }))
    showToast('Saved to wishlist', 'bad')
  }

  // Letters that will not keep still.
  useEffect(() => {
    if (!person.jumble) return
    const t = setInterval(() => setTick((n) => n + 1), 700)
    return () => clearInterval(t)
  }, [person.jumble])
  const T = useMemo(() => (person.jumble ? (s) => s.replace(/[A-Za-z]{4,}/g, (w) => jumbleWord(w, tick + w.charCodeAt(0))) : (s) => s), [person.jumble, tick])

  // Something keeps pulling at Ananya's attention.
  useEffect(() => {
    if (!person.distract) { setDistraction(false); return }
    const t = setInterval(() => setDistraction((d) => !d), 2600)
    return () => clearInterval(t)
  }, [person.distract])

  // The shaking pointer, and the vision overlays, drawn every frame.
  useEffect(() => {
    let raf
    let t = 0
    const loop = () => {
      t += 1
      const p = pos.current
      const amp = person.tremor || 0
      p.sx = p.x + (Math.sin(t * 0.5) * amp + Math.sin(t * 0.83) * amp * 0.5)
      p.sy = p.y + (Math.cos(t * 0.47) * amp + Math.cos(t * 0.91) * amp * 0.5)
      if (cursor.current) {
        cursor.current.style.transform = `translate(${p.sx - 2}px, ${p.sy - 2}px)`
        cursor.current.style.opacity = amp && p.inside ? '1' : '0'
      }
      if (overlay.current) {
        if (person.tunnel) {
          overlay.current.style.background = `radial-gradient(circle at ${p.x}px ${p.y}px, transparent ${person.tunnel * 0.55}px, rgba(5,5,10,.82) ${person.tunnel}px, #05050a ${person.tunnel * 1.6}px)`
        } else if (person.blotch) {
          overlay.current.style.background = `radial-gradient(ellipse ${person.blotch * 1.25}px ${person.blotch}px at ${p.x}px ${p.y}px, rgba(20,14,14,.96) 0%, rgba(20,14,14,.85) 45%, rgba(20,14,14,0) 100%)`
        } else {
          overlay.current.style.background = 'none'
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [person])

  const onPointerMove = (e) => {
    const r = frame.current.getBoundingClientRect()
    pos.current.x = e.clientX - r.left
    pos.current.y = e.clientY - r.top
    pos.current.inside = true
    if (!run.done) begin()
    if (person.sr) {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-sr]')
      const said = el ? el.getAttribute('data-sr') : ''
      setCaption(said === '' ? '' : said)
    }
  }

  // The click you make is the click the tremor gives you.
  const onClickCapture = (e) => {
    if (!person.tremor || redirecting.current) return
    e.preventDefault()
    e.stopPropagation()
    const r = frame.current.getBoundingClientRect()
    const target = document.elementFromPoint(r.left + pos.current.sx, r.top + pos.current.sy)
    const hit = target && frame.current.contains(target) ? target.closest('button') : null
    const aimed = e.target.closest?.('button')
    if (hit) {
      redirecting.current = true
      try { hit.click() } finally { redirecting.current = false }
    } else if (aimed) {
      begin()
      setRun((s) => ({ ...s, mistakes: s.mistakes + 1 }))
      showToast('Missed', 'bad')
    }
  }

  const you = results.you
  const mine = results[personId]

  return (
    <div className="w-full">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="lens-deut"><feColorMatrix type="matrix" values={DEUTERANOPIA} /></filter>
      </svg>

      <div role="tablist" aria-label="Whose eyes and hands" className="flex flex-wrap gap-2">
        {LENS_PEOPLE.map((p) => {
          const active = p.id === personId
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPersonId(p.id)}
              className={`group flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-left text-sm transition ${
                active ? 'border-white/40 bg-white text-ink-900 shadow-lg shadow-black/30' : 'border-white/10 bg-white/[0.04] text-white/80 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-ink-900"
                style={{ background: p.id === 'you' ? '#e8e5ff' : avatarColorFor(p.name) || '#d1ccff' }}
              >
                {p.id === 'you' ? '★' : p.name.charAt(0)}
              </span>
              <span className="leading-tight">
                <span className="block font-semibold">{p.id === 'you' ? 'You' : `${p.name}, ${p.age}`}</span>
                <span className={`block text-[11px] ${active ? 'text-ink-500' : 'text-white/50'}`}>{p.line}</span>
              </span>
              {results[p.id] && <span aria-label="done" className="ml-1 text-emerald-500">●</span>}
            </button>
          )
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1b1c26] shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 flex-1 truncate rounded-md bg-white/5 px-3 py-1 text-[11px] text-white/45">northwind.example/shoes</span>
            {person.id !== 'you' && <span className="rounded-full bg-ember-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ember-300">As {person.name}</span>}
          </div>
          <div
            ref={frame}
            className="relative h-[400px] overflow-hidden"
            style={{ cursor: person.tremor ? 'none' : undefined }}
            onPointerMove={onPointerMove}
            onPointerLeave={() => { pos.current.inside = false; setCaption('') }}
            onPointerDown={begin}
            onClickCapture={onClickCapture}
            aria-label={`A sample shop, as ${person.id === 'you' ? 'you' : person.name} would experience it`}
          >
            <div className="h-full" style={{ filter: person.filter || 'none', transition: 'filter .5s ease' }}>
              <DemoShop T={T} onAdd={onAdd} onSave={onSave} basket={basket} toast={toast} />
            </div>
            {person.distract && (
              <>
                <div aria-hidden="true" className="pointer-events-none absolute right-4 top-14 h-14 w-14 rounded-full bg-pink-500/50 blur-md transition-opacity duration-700" style={{ opacity: distraction ? 1 : 0.2 }} />
                <div aria-hidden="true" className="pointer-events-none absolute bottom-16 left-3 h-10 w-10 rounded-full bg-amber-400/60 blur-md transition-opacity duration-700" style={{ opacity: distraction ? 0.2 : 1 }} />
                {distraction && (
                  <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-stone-900 shadow-xl ring-1 ring-black/10">
                    🔔 3 people are looking at this right now!
                  </div>
                )}
              </>
            )}
            <div ref={overlay} aria-hidden="true" className="pointer-events-none absolute inset-0" />
            <div ref={cursor} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 opacity-0">
              <svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 1 L2 15 L6 11.5 L9 18 L11.5 17 L8.5 10.5 L14 10 Z" fill="black" stroke="white" strokeWidth="1.2" /></svg>
            </div>
            {person.sr && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#0b0f19] px-4 py-2.5 font-mono text-[13px] text-[#7ee787]">
                <span className="mr-2 text-[11px] text-white/40">Screen reader says</span>
                {caption || <span className="text-white/30">(nothing: move the pointer over the page)</span>}
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ember-300">Your mission</p>
          <p className="mt-2 font-display text-xl leading-snug">Put a pair of shoes that is in stock in the basket.</p>
          <p className="mt-3 text-sm text-white/60">{person.hint}</p>

          <div className="mt-5 rounded-xl bg-black/30 p-4" aria-live="polite">
            {mine ? (
              <>
                <p className="text-sm text-white/60">{person.id === 'you' ? 'You did it in' : `As ${person.name}, it took`}</p>
                <p className="font-display text-3xl font-semibold">{fmt(mine.ms)}</p>
                <p className="text-sm text-white/60">{mine.mistakes} wrong {mine.mistakes === 1 ? 'try' : 'tries'}</p>
                {you && person.id !== 'you' && mine.ms > you.ms * 1.3 && (
                  <p className="mt-3 text-sm font-semibold text-ember-300">{(mine.ms / you.ms).toFixed(1)}× longer than you.</p>
                )}
                <button type="button" onClick={reset} className="mt-3 text-sm text-white/70 underline">Try again</button>
              </>
            ) : (
              <p className="text-sm text-white/60">{run.startedAt ? 'Timing you…' : 'The clock starts as soon as you move into the shop.'}</p>
            )}
          </div>

          {Object.keys(results).length > 1 && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {LENS_PEOPLE.filter((p) => results[p.id]).map((p) => (
                <li key={p.id} className="flex justify-between text-white/75">
                  <span>{p.id === 'you' ? 'You' : p.name}</span>
                  <span className="tabular-nums">{fmt(results[p.id].ms)}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
