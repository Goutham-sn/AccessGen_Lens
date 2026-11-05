import { styleHost, mountTopLayer } from './topLayer.js'
import { pauseSimulation, resumeSimulation } from '../profiles/pageFilter.js'

// "Show me where": lifts the simulation for a few seconds and rings the
// exact elements a finding is about, numbered, on the real page. For a
// contrast problem, that is every piece of text that is too faint.
const SHOW_MS = 4200

function elementsOf(friction) {
  const out = []
  for (const node of friction?.evidence?.nodes || []) {
    try {
      const el = document.querySelector(node.selector)
      if (el) out.push(el)
    } catch { /* a selector the page no longer matches */ }
  }
  if (!out.length && friction?.targetEl?.isConnected) out.push(friction.targetEl)
  return out.slice(0, 40)
}

let active = null

export function showWhere(friction) {
  active?.()
  const els = elementsOf(friction)
  if (!els.length) return false
  els[0].scrollIntoView({ block: 'center', behavior: 'instant' })
  pauseSimulation()

  const host = document.createElement('div')
  host.dataset.accessgen = 'true'
  host.dataset.accessgenKeep = 'true'
  styleHost(host, { inset: '0', width: '100vw', height: '100vh', 'pointer-events': 'none', 'z-index': '2147483646' })
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>
    .ring { position: fixed; border: 3px solid #e2502f; border-radius: 4px; box-shadow: 0 0 0 3px #fff, 0 0 0 9999px rgba(0,0,0,.18); animation: in .25s ease-out; }
    .ring + .ring { box-shadow: 0 0 0 3px #fff; }
    .n { position: absolute; left: -3px; top: -22px; background: #e2502f; color: #fff; font: 600 12px/18px ui-monospace, Menlo, monospace; padding: 0 5px; border-radius: 2px; }
    .note { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); max-width: 80vw; background: #161616; color: #fbfaf7; padding: 10px 16px; border-radius: 4px; font: 500 14px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    @keyframes in { from { transform: scale(1.15); opacity: 0 } to { transform: none; opacity: 1 } }
  </style>`
  const place = () => {
    root.querySelectorAll('.ring').forEach((r) => r.remove())
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      const ring = document.createElement('div')
      ring.className = 'ring'
      Object.assign(ring.style, { left: `${r.left - 5}px`, top: `${r.top - 5}px`, width: `${r.width + 10}px`, height: `${r.height + 10}px` })
      if (els.length > 1) {
        const n = document.createElement('span')
        n.className = 'n'
        n.textContent = String(i + 1)
        ring.appendChild(n)
      }
      root.appendChild(ring)
    })
  }
  const note = document.createElement('div')
  note.className = 'note'
  note.textContent = `${friction.headline}. The simulation is paused for a moment so you can see it.`
  root.appendChild(note)
  mountTopLayer(host)
  place()
  const onScroll = () => place()
  window.addEventListener('scroll', onScroll, true)

  const done = () => {
    clearTimeout(timer)
    window.removeEventListener('scroll', onScroll, true)
    host.remove()
    resumeSimulation()
    active = null
  }
  const timer = setTimeout(done, SHOW_MS)
  active = done
  return true
}
