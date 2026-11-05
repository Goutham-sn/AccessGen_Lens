import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'
import { send } from '../../content-scripts/communicator.js'
import { reportFriction, describeElement } from '../../content-scripts/friction.js'
import { styleHost, mountTopLayer, keepOnTop } from '../../overlay/topLayer.js'

// What the reading keys stop on: the things a screen reader's browse mode
// reads one at a time.
const READABLE = 'h1,h2,h3,h4,h5,h6,p,li,a[href],button,input:not([type="hidden"]),select,textarea,img,[role="button"],[role="link"],[role="heading"],[role="img"],blockquote,figcaption,td,th,label,summary'
const HEADINGS = 'h1,h2,h3,h4,h5,h6,[role="heading"]'

const IMPLICIT_ROLES = {
  A: 'link', BUTTON: 'button', INPUT: 'text field', SELECT: 'combo box',
  TEXTAREA: 'text field', IMG: 'image', H1: 'heading level 1',
  H2: 'heading level 2', H3: 'heading level 3', H4: 'heading level 4',
  H5: 'heading level 5', H6: 'heading level 6', NAV: 'navigation',
  MAIN: 'main content', HEADER: 'banner', FOOTER: 'content information',
  UL: 'list', OL: 'list', LI: 'list item', TABLE: 'table', FORM: 'form',
  DIALOG: 'dialog', ARTICLE: 'article', ASIDE: 'complementary'
}

const INPUT_TYPES = {
  checkbox: 'check box', radio: 'radio button', submit: 'submit button',
  button: 'button', search: 'search field', email: 'email field',
  password: 'password field', tel: 'telephone field', url: 'web address field',
  number: 'number field', range: 'slider', date: 'date field', file: 'file chooser'
}

// You are not looking at the screen. You are listening to it.
export class ScreenReader extends BaseProfile {
  init() {
    // Blur the page: the eyes are elsewhere.
    setPageFilter(this, 'blur(10px)')

    this.mountBanner()

    // Speech needs a user gesture first (Chrome's autoplay rule). Hold the
    // latest announcement and speak it on the first key press or click.
    this.pendingSpeech = null
    this.speechUnlocked = false
    const unlock = () => {
      if (this.speechUnlocked) return
      this.speechUnlocked = true
      if (this.pendingSpeech) this.speak(this.pendingSpeech)
      this.pendingSpeech = null
    }
    this.addListener(window, 'keydown', unlock, { capture: true })
    this.addListener(window, 'pointerdown', unlock, { capture: true })

    // Announce on every focus change.
    this.addListener(document, 'focusin', (e) => {
      const el = e.target
      if (!el || el.dataset?.accessgenPanel || el.closest?.('[data-accessgen]')) return
      this.readIndex = -1
      const label = this.getLabel(el)
      this.announce(this.getAnnouncement(el))
      if (!label) this.noticeUnnamed(el)
    }, { capture: true })

    // Browse mode: Down and Up arrows read the next and previous thing on
    // the page, H jumps to the next heading (Shift+H the previous one), the
    // way a screen reader user skims. Off inside fields, where keys type.
    this.readIndex = -1
    this.addListener(window, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t?.dataset?.accessgenPanel) return
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      let step = 0
      let selector = READABLE
      if (e.key === 'ArrowDown') step = 1
      else if (e.key === 'ArrowUp') step = -1
      else if (e.key === 'h' || e.key === 'H') { step = e.shiftKey ? -1 : 1; selector = HEADINGS }
      else return
      e.preventDefault()
      e.stopPropagation()
      this.readNext(step, selector)
    }, { capture: true })

    // Monitor aria-live regions.
    const liveObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const region = (m.target.nodeType === 1 ? m.target : m.target.parentElement)
          ?.closest?.('[aria-live], [role="alert"], [role="status"]')
        if (!region || region.dataset?.accessgen) continue
        if (region.getAttribute('aria-live') === 'off') continue
        const text = region.textContent?.trim()
        if (text) this.announce(text)
      }
    })
    this.addObserver(liveObserver, document.body, {
      childList: true, subtree: true, characterData: true
    })

    // Announce the page itself, the way a screen reader greets a document.
    const title = document.title || 'Untitled page'
    const landmarks = document.querySelectorAll('nav, main, header, footer, aside, form').length
    const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6').length
    const links = document.querySelectorAll('a[href]').length
    this.announce(
      `${title}. Page loaded. ${headings} headings, ${links} links, ${landmarks} landmarks. Press Tab to move, the Down arrow to read, H for the next heading.`
    )
  }

  noticeUnnamed(el) {
    reportFriction({
      kind: 'sr-unnamed-focus',
      profileId: 'screen-reader',
      target: el,
      headline: `You heard only "${this.getAnnouncement(el)}"`,
      detail: `Sighted users see ${describeElement(el)}. A screen reader user hears nothing that says what it is for.`
    })
  }

  readNext(step, selector) {
    const items = Array.from(document.querySelectorAll(selector)).filter((el) => {
      if (el.closest('[data-accessgen]') || el.closest('[aria-hidden="true"]')) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    if (items.length === 0) {
      this.announce(selector === HEADINGS ? 'No headings on this page' : 'Nothing to read')
      return
    }
    if (this.readIndex < 0 && document.activeElement && document.activeElement !== document.body) {
      const from = items.indexOf(document.activeElement)
      if (from >= 0) this.readIndex = from
    }
    const next = this.readIndex + step
    if (next < 0 || next >= items.length) {
      this.announce(step > 0 ? 'End of page' : 'Top of page')
      return
    }
    this.readIndex = next
    const el = items[next]
    el.scrollIntoView({ block: 'center' })
    const isText = /^(P|LI|TD|TH|BLOCKQUOTE|FIGCAPTION|LABEL)$/.test(el.tagName)
    const text = isText ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : this.getAnnouncement(el)
    this.announce(text)
    if (el.tagName === 'IMG' && !el.hasAttribute('alt')) {
      this.announce(`image, ${el.getAttribute('src')?.split('/').pop()?.split('?')[0] || 'unlabelled'}`)
    }
  }

  // ---- announcement construction -------------------------------------

  getAnnouncement(element) {
    const role = this.getRole(element)
    const label = this.getLabel(element)
    const state = this.getElementState(element)
    const description = this.getAriaDescribedBy(element)
    return this.buildNaturalAnnouncement(role, label, state, description)
  }

  getRole(el) {
    const explicit = el.getAttribute('role')
    if (explicit) return explicit.replace(/-/g, ' ')
    if (el.tagName === 'INPUT') {
      return INPUT_TYPES[el.type] || 'text field'
    }
    return IMPLICIT_ROLES[el.tagName] || ''
  }

  getLabel(el) {
    return el.getAttribute('aria-label')
      || this.getAriaLabelledBy(el)
      || this.getAssociatedLabel(el)
      || el.getAttribute('placeholder')
      || el.getAttribute('alt')
      || (el.tagName === 'IMG' ? null : el.textContent?.trim().slice(0, 120))
      || el.getAttribute('title')
      || el.value
      || null
  }

  getAriaLabelledBy(el) {
    const ids = el.getAttribute('aria-labelledby')
    if (!ids) return null
    return ids.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ') || null
  }

  getAssociatedLabel(el) {
    if (!el.id) return null
    return document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim() || null
  }

  getAriaDescribedBy(el) {
    const ids = el.getAttribute('aria-describedby')
    if (!ids) return null
    return ids.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ') || null
  }

  getElementState(el) {
    const states = []
    if (el.checked) states.push('checked')
    else if (el.type === 'checkbox' || el.type === 'radio') states.push('not checked')
    const expanded = el.getAttribute('aria-expanded')
    if (expanded === 'true') states.push('expanded')
    if (expanded === 'false') states.push('collapsed')
    if (el.required || el.getAttribute('aria-required') === 'true') states.push('required')
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') states.push('unavailable')
    const selected = el.getAttribute('aria-selected')
    if (selected === 'true') states.push('selected')
    if (el.getAttribute('aria-invalid') === 'true') states.push('invalid entry')
    if (el.getAttribute('aria-current')) states.push('current')
    return states
  }

  buildNaturalAnnouncement(role, label, states, description) {
    // This is where broken markup becomes audible: an unlabelled button
    // announces as just "button": exactly what a blind user hears.
    const parts = []
    parts.push(label || (role ? `unlabelled ${role}` : 'unlabelled element'))
    if (role && label) parts.push(role)
    if (states.length) parts.push(states.join(', '))
    if (description) parts.push(description)
    return parts.join(', ')
  }

  // ---- output ---------------------------------------------------------

  speak(text) {
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.2
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    } catch {
      // Speech unavailable: banner and log still work.
    }
  }

  announce(text) {
    if (!text) return
    if (this.speechUnlocked) this.speak(text)
    else this.pendingSpeech = text

    this.bannerText.textContent = text
    send('sr-announcement', { text })
  }

  // The caption bar: what the screen reader just said. It sits in the top
  // layer, so the page blur does not reach it (it used to be blurred too).
  mountBanner() {
    this.banner = document.createElement('div')
    this.banner.setAttribute('aria-hidden', 'true')
    this.banner.dataset.accessgen = 'true'
    styleHost(this.banner, { left: '0', right: '0', bottom: '0', width: '100%', 'z-index': '2147483646', 'pointer-events': 'none' })
    const shadow = this.banner.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        .bar { background: #0b0f19; color: #7ee787; border-top: 2px solid #1f6feb;
               font: 500 16px/1.5 ui-monospace, 'Cascadia Code', Menlo, monospace;
               padding: 12px 340px 12px 20px; display: flex; gap: 12px; align-items: baseline; }
        .tag { color: #8b949e; font-size: 12px; white-space: nowrap; }
        .text { overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      </style>
      <div class="bar"><span class="tag">Screen reader says</span><span class="text"></span></div>`
    this.bannerText = shadow.querySelector('.text')
    this.bannerText.textContent = 'Screen reader active. Press any key to turn on speech.'
    this.elements.push(this.banner)
    mountTopLayer(this.banner)
    this.unkeep = keepOnTop(this.banner)
  }

  destroy() {
    this.unkeep?.()
    try { window.speechSynthesis.cancel() } catch { /* no speech */ }
    clearPageFilter(this)
    super.destroy()
  }
}
