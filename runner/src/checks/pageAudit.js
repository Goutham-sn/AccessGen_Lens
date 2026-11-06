import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describeRule, nodeSummary, AXE_OPTIONS, sortIssues, isWcagAorAA } from '../../../extension/issues/rules.js'

// Check 'page-audit': the whole page through axe-core, the open-source
// accessibility rules engine, with WCAG 2.0, 2.1 and 2.2 rules at levels A
// and AA only. Each rule that fails is one finding, with every element that
// fails it; the recorded pass shows the first one on camera. Only what
// actually fails is reported: nothing the engine could not decide.

const require = createRequire(import.meta.url)
let axeSource = null
async function loadAxe() {
  if (!axeSource) axeSource = await fs.readFile(require.resolve('axe-core/axe.min.js'), 'utf8')
  return axeSource
}

const MAX_NODES = 60
const confirmCache = new WeakMap()

// Runs inside the page (main world). Our own overlay and canvases are left out.
async function runAxeInPage(options) {
  const exclude = [['[data-accessgen]'], ['accessgen-runner-overlay']]
  const result = await window.axe.run({ exclude }, options)
  const rectOf = (selector) => {
    try {
      const el = document.querySelector(selector)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) }
    } catch { return null }
  }
  const pick = (list) => list.map((r) => ({
    id: r.id, impact: r.impact, help: r.help, description: r.description, helpUrl: r.helpUrl, tags: r.tags,
    nodes: r.nodes.map((n) => ({
      target: n.target, html: n.html, failureSummary: n.failureSummary,
      rect: rectOf(Array.isArray(n.target) ? String(n.target[0]) : String(n.target)),
      // What axe measured (colours and contrast, a target's size).
      any: (n.any || []).filter((c) => c.data).map((c) => ({ id: c.id, data: c.data })),
      none: (n.none || []).filter((c) => c.data).map((c) => ({ id: c.id, data: c.data }))
    }))
  }))
  return { violations: pick(result.violations), incomplete: pick(result.incomplete) }
}

export async function auditPage(page) {
  const has = await page.evaluate(() => typeof window.axe?.run === 'function').catch(() => false)
  // evaluate, not a script tag: the page's own Content Security Policy does
  // not apply to it.
  if (!has) await page.evaluate(await loadAxe())
  return page.evaluate(runAxeInPage, AXE_OPTIONS)
}

function issueOf(r) {
  const d = describeRule(r)
  const nodes = r.nodes.slice(0, MAX_NODES).map((n) => ({ ...nodeSummary(n), rect: n.rect }))
  return { ...d, count: r.nodes.length, nodes }
}

export function findingsFromAudit(result, { profileIds = [], personaName = 'They' } = {}) {
  const issues = sortIssues(result.violations.filter((r) => r.nodes.length && isWcagAorAA(r)).map(issueOf), profileIds)
  return issues.map((issue) => {
    const mine = issue.who.find((w) => profileIds.includes(w))
    const first = issue.nodes[0]
    const count = issue.count
    return {
      detector: 'page-audit',
      profile: mine || issue.who[0],
      selector: first.selector,
      patternKey: `rule:${issue.rule}`,
      headline: count === 1 ? issue.title : `${issue.title} (${count} on this page)`,
      fact: `${issue.why}${mine ? '' : ` ${personaName} may not feel this one, but someone else will.`}`,
      forTeam: first.summary || issue.title,
      evidence: { audit: true, ...issue }
    }
  })
}

export function needsReviewLines(result) {
  return result.incomplete
    .filter((r) => r.nodes.length)
    .map((r) => {
      const d = describeRule(r)
      return `Check by hand: ${d.title} (${r.nodes.length} ${r.nodes.length === 1 ? 'place' : 'places'}). The rules engine could not decide these on its own.`
    })
}

export default {
  id: 'page-audit',
  async measure({ page, profileIds, persona, note }) {
    const result = await auditPage(page)
    return findingsFromAudit(result, { profileIds, personaName: persona?.persona?.name || 'This person' })
  },
  // Recorded pass: the element is still there (the engine checks that) and
  // the rule still fails on this fresh page.
  async confirm({ page, finding }) {
    // One audit for the whole recorded pass, not one per finding.
    if (!confirmCache.has(page)) confirmCache.set(page, auditPage(page).catch(() => null))
    const result = await confirmCache.get(page)
    return Boolean(result?.violations.some((r) => r.id === finding.evidence.rule))
  },
  async runFixture(browser, { fixtureDir, expected }) {
    const out = {}
    for (const file of Object.keys(expected)) {
      const html = await fs.readFile(path.join(fixtureDir, file), 'utf8')
      const context = await browser.newContext()
      const page = await context.newPage()
      try {
        await page.setContent(html, { waitUntil: 'load' })
        const result = await auditPage(page)
        out[file] = { rules: findingsFromAudit(result).map((f) => f.evidence.rule).sort() }
      } finally {
        await context.close()
      }
    }
    return out
  }
}
