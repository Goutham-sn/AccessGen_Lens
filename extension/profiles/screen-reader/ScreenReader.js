import { BaseProfile } from '../BaseProfile.js'
import { send } from '../../content-scripts/communicator.js'

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
    // Blur the page — the eyes are elsewhere.
    this.previousFilter = document.documentElement.style.filter
    document.documentElement.style.filter =
      `${this.previousFilter ? this.previousFilter + ' ' : ''}blur(10px)`

    this.mountBanner()

    // Announce on every focus change.
    this.addListener(document, 'focusin', (e) => {
      const el = e.target
      if (!el || el.dataset?.accessgenPanel) return
      this.announce(this.getAnnouncement(el))
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
      `${title}. Page loaded. ${headings} headings, ${links} links, ${landmarks} landmarks. Use Tab to move through the page.`
    )
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
    // announces as just "button" — exactly what a blind user hears.
    const parts = []
    parts.push(label || (role ? `unlabelled ${role}` : 'unlabelled element'))
    if (role && label) parts.push(role)
    if (states.length) parts.push(states.join(', '))
    if (description) parts.push(description)
    return parts.join(', ')
  }

  // ---- output ---------------------------------------------------------

  announce(text) {
    if (!text) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.2
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    } catch {
      // Speech unavailable — banner and log still work.
    }

    this.banner.textContent = text
    send('sr-announcement', { text })
  }

  mountBanner() {
    this.banner = document.createElement('div')
    this.banner.setAttribute('aria-hidden', 'true')
    this.banner.dataset.accessgen = 'true'
    this.banner.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #0b0f19; color: #7ee787;
      font: 500 15px/1.5 ui-monospace, 'Cascadia Code', monospace;
      padding: 14px 20px; z-index: 2147483644;
      border-top: 2px solid #1f6feb;
      filter: none;
    `
    this.banner.textContent = '♪ Screen reader active'
    this.addElement(this.banner)
  }

  destroy() {
    try { window.speechSynthesis.cancel() } catch { /* no speech */ }
    document.documentElement.style.filter = this.previousFilter || ''
    super.destroy()
  }
}
