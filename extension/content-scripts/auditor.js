// The page audit in Manual sessions: axe-core, every rule it has, on every
// page the tester visits, and again when the page changes a lot (a dialog
// opens, a menu expands, content loads). Each rule that fails becomes one
// automatic moment listing every element that fails it; a rule that fails
// again later on new elements gets a moment for those. What axe cannot
// decide alone is recorded as "check by hand", never dropped.
//
// Runs in the extension's isolated world: axe reads the DOM and computed
// styles, which are the page's own. AccessGen's own elements are excluded.

import axe from 'axe-core'
import { describeRule, nodeSummary, AXE_OPTIONS } from '../issues/rules.js'
import { reportFriction } from './friction.js'

const FIRST_AUDIT_MS = 1500
const CHANGE_SETTLE_MS = 2500
const MAX_AUDITS_PER_PAGE = 8
const BIG_CHANGE_NODES = 15
const MAX_NODES = 60

function rectOfSelector(selector) {
  try {
    const el = document.querySelector(selector)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height),
      vw: window.innerWidth, vh: window.innerHeight
    }
  } catch {
    return null
  }
}

function firstElement(selector) {
  try { return document.querySelector(selector) } catch { return null }
}

export function startAuditor({ profileIds = [] } = {}) {
  const seen = new Map() // rule -> Set of node selectors already reported
  let audits = 0
  let running = false
  let timer = null
  let addedSinceAudit = 0

  async function audit() {
    if (running || audits >= MAX_AUDITS_PER_PAGE) return
    running = true
    audits += 1
    try {
      const result = await axe.run(
        { exclude: [['[data-accessgen]'], ['#accessgen-control-panel']] },
        AXE_OPTIONS
      )
      report(result.violations, false)
      report(result.incomplete, true)
    } catch (err) {
      console.warn('[accessgen] page audit failed:', err?.message)
    } finally {
      running = false
      addedSinceAudit = 0
    }
  }

  function report(results, review) {
    for (const r of results) {
      const key = `${review ? 'review' : 'audit'}:${r.id}`
      const known = seen.get(key) || new Set()
      const fresh = r.nodes.filter((n) => !known.has(String(n.target)))
      if (!fresh.length) continue
      fresh.forEach((n) => known.add(String(n.target)))
      seen.set(key, known)
      const d = describeRule(r)
      const nodes = fresh.slice(0, MAX_NODES).map((n) => nodeSummary(n, rectOfSelector))
      const first = nodes[0]
      const relevant = d.who.some((w) => profileIds.includes(w))
      const count = fresh.length
      reportFriction({
        kind: key,
        profileId: d.who.find((w) => profileIds.includes(w)) || d.who[0],
        target: firstElement(first.selector),
        headline: review
          ? `Check by hand: ${d.title}${count > 1 ? ` (${count} places)` : ''}`
          : `${d.title}${count > 1 ? ` (${count} on this page)` : ''}`,
        detail: review
          ? `${d.why} The rules engine could not decide these on its own, so look at them yourself.`
          : d.why,
        evidence: {
          audit: true, review, rule: d.rule, impact: d.impact, who: d.who, relevant,
          count, nodes, helpUrl: d.helpUrl, tags: d.tags, page: location.href
        }
      })
    }
  }

  // Big changes to the page get a fresh look once they settle.
  const observer = new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && !n.closest?.('[data-accessgen]')) addedSinceAudit += 1 + (n.querySelectorAll ? Math.min(50, n.querySelectorAll('*').length) : 0)
      }
      if (m.type === 'attributes' && /^(open|aria-expanded|aria-hidden|hidden)$/.test(m.attributeName || '')) addedSinceAudit += BIG_CHANGE_NODES
    }
    if (addedSinceAudit < BIG_CHANGE_NODES) return
    clearTimeout(timer)
    timer = setTimeout(audit, CHANGE_SETTLE_MS)
  })
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'aria-expanded', 'aria-hidden', 'hidden']
  })
  const first = setTimeout(audit, FIRST_AUDIT_MS)

  return () => {
    clearTimeout(first)
    clearTimeout(timer)
    observer.disconnect()
  }
}
