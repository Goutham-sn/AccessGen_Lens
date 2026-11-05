import { styleHost, mountTopLayer } from './topLayer.js'

// The step-in screen: the moment before the page becomes someone else's.
// It names the person, says what changes, and gives the mission. The
// simulation is already on underneath, so as the screen fades the tester
// is already inside it. It starts the mission clock when it closes.

const CSS = `
  :host { all: initial; }
  .wrap { position: fixed; inset: 0; display: grid; place-items: center; padding: 24px;
    background: rgba(14,14,14,.95);
    color: #f4f3ff; font: 16px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
    opacity: 0; transition: opacity .6s ease; cursor: auto; letter-spacing: normal; word-spacing: normal; text-align: left; }
  .wrap.show { opacity: 1; }
  .wrap.leave { opacity: 0; transition: opacity 1.1s ease; }
  .card { max-width: 620px; width: 100%; transform: translateY(10px); transition: transform .8s ease; }
  .show .card { transform: none; }
  .eyebrow { font: 500 12px/1.2 ui-monospace, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; color: #ef9a85; }
  h1 { font-size: 52px; font-weight: 600; line-height: 1.05; margin: 12px 0 6px; letter-spacing: -.02em; color: #fff; }
  .line { color: #d6d3cc; font-size: 17px; margin: 0; }
  .story { color: rgba(244,243,255,.75); font-size: 17px; margin: 18px 0 0; }
  .changes { margin: 22px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
  .changes li { display: flex; gap: 10px; color: rgba(244,243,255,.85); font-size: 15px; }
  .changes li::before { content: ''; flex: 0 0 10px; height: 2px; margin-top: 11px; background: #e2502f; }
  .mission { margin-top: 26px; border-left: 3px solid #e2502f; background: #1d1d1d; border-radius: 4px; padding: 14px 18px; }
  .mission small { display: block; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: rgba(244,243,255,.55); font-weight: 600; }
  .mission p { margin: 6px 0 0; font-size: 20px; font-weight: 600; line-height: 1.3; color: #fff; }
  .row { display: flex; align-items: center; gap: 16px; margin-top: 28px; }
  button { font: 600 16px/1 inherit; font-family: inherit; border: 0; border-radius: 4px; padding: 14px 24px; cursor: pointer;
    background: #fbfaf7; color: #161616; }
  button:focus-visible { outline: 2px solid #fbfaf7; outline-offset: 3px; }
  .count { color: rgba(244,243,255,.5); font-size: 14px; }
  @media (prefers-reduced-motion: reduce) { .wrap, .card, .wrap.leave { transition: none; } }
`

export function showIntro({ persona, profiles, hints, mission, baseline, autoMs = 9000 }) {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    host.dataset.accessgen = 'true'
    // Profiles let events on the panel through; the same goes for this.
    host.dataset.accessgenPanel = 'true'
    styleHost(host, { inset: '0', width: '100vw', height: '100vh', 'z-index': '2147483647' })
    const root = host.attachShadow({ mode: 'open' })
    const names = (profiles || []).map((p) => p.name || p.id)
    const who = baseline
      ? 'Yourself'
      : persona?.name ? `${persona.name}${persona.age ? `, ${persona.age}` : ''}` : 'Someone else'
    const line = baseline
      ? 'No simulation. The page exactly as you normally see it.'
      : persona?.line || names.join(' · ')

    root.innerHTML = `<style>${CSS}</style>
      <div class="wrap" role="dialog" aria-modal="true" aria-labelledby="ag-intro-title">
        <div class="card">
          <div class="eyebrow">${baseline ? 'First, as yourself' : 'You are now'}</div>
          <h1 id="ag-intro-title"></h1>
          <p class="line"></p>
          <p class="story"></p>
          <ul class="changes"></ul>
          <div class="mission" hidden><small>Your mission</small><p></p></div>
          <div class="row"><button type="button">${baseline ? 'Start as myself' : 'Step in'}</button><span class="count"></span></div>
        </div>
      </div>`
    root.querySelector('h1').textContent = who
    root.querySelector('.line').textContent = line
    const story = root.querySelector('.story')
    if (baseline) story.textContent = persona?.name
      ? `Do the mission the way you always would. Then you will do exactly the same as ${persona.name}, and see the difference.`
      : 'Do the mission the way you always would. Then you will do it again with the simulation on.'
    else story.textContent = persona?.story || ''
    if (!story.textContent) story.remove()
    const list = root.querySelector('.changes')
    for (const h of baseline ? [] : (hints || []).slice(0, 3)) {
      const li = document.createElement('li')
      li.textContent = h
      list.appendChild(li)
    }
    if (!list.children.length) list.remove()
    if (mission?.goal) {
      const box = root.querySelector('.mission')
      box.hidden = false
      box.querySelector('p').textContent = mission.goal
    }

    const wrap = root.querySelector('.wrap')
    const button = root.querySelector('button')
    const count = root.querySelector('.count')
    let done = false
    let left = Math.round(autoMs / 1000)
    const timer = setInterval(() => {
      left -= 1
      count.textContent = left > 0 ? `Starting in ${left}` : ''
      if (left <= 0) finish()
    }, 1000)

    function finish() {
      if (done) return
      done = true
      clearInterval(timer)
      wrap.classList.add('leave')
      resolve()
      setTimeout(() => host.remove(), 1200)
    }
    button.addEventListener('click', finish)
    // Every key but Tab steps in, so no profile's key rules can trap it here.
    root.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key !== 'Tab') { e.preventDefault(); finish() }
    })

    mountTopLayer(host)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.classList.add('show')
      button.focus({ preventScroll: true })
    }))
    count.textContent = `Starting in ${left}`
  })
}
