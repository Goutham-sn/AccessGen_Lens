// Hand-check list for the keyboard detectors. Runs the five detectors on
// each URL exactly as a keyboard persona's measure pass would (same egress
// proxy, same safe context, same measure pass), whatever their capability
// flags say, and writes:
//   moments.csv  url, detector, step, selector, headline, fact,
//                highlighted screenshot, clean screenshot, verified by hand
//   notes.csv    url, note  (what we could not look at, pages that did not
//                open, detector problems)
//   one highlighted and one clean screenshot per finding
// "verified by hand" is left empty for you to fill in.
//
// The screenshots are taken after the measure pass is over, never during
// it. For each finding the element is scrolled into view and given focus
// (so you see what it looks like with focus), the clean shot is taken, then
// the magenta ring is drawn for the highlighted shot.
//
// Usage, from the repo root (urls.txt: one URL per line, # for comments):
//   docker compose run --rm --no-deps \
//     -v "$PWD/runner/validation:/app/runner/validation" \
//     runner node scripts/validate-keyboard.js validation/urls.txt
// Options:
//   --out validation/<folder>   where to write (default: a timestamped folder)
//   --fixtures                  serve fixtures/checks/keyboard at
//                               https://fixtures.lens.test instead of the
//                               network, to try the script itself
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../src/config.js'
import { createEgressProxy } from '../src/egressProxy.js'
import { addLocalNetworks } from '../src/blocklist.js'
import { launchBrowser, newSafeContext } from '../src/browser.js'
import { loadPage } from '../src/load.js'
import { measureCoverage } from '../src/coverage.js'
import { measurePass } from '../src/measure.js'
import { KEYBOARD_CHECKS } from '../src/checks/index.js'
import { serveFixtureDir } from '../src/checks/fixtureServer.js'
import { coverageLines } from '../src/copy.js'
import { installOverlay, overlayCall, locateAndDescribe, settle } from '../src/pageScripts.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const runnerRoot = path.join(here, '..')
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const listFile = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')

if (!listFile) {
  console.error('Usage: node scripts/validate-keyboard.js <urls.txt> [--out validation/<folder>] [--fixtures]')
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = path.resolve(runnerRoot, option('--out') || `validation/${stamp}`)
const shotsDir = path.join(outDir, 'screenshots')
await fs.mkdir(shotsDir, { recursive: true })

const urls = (await fs.readFile(path.resolve(runnerRoot, listFile), 'utf8'))
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

// A CSV cell: quoted, quotes doubled, and never read as a formula by a
// spreadsheet (page text could start with =, +, - or @).
const cell = (v) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
const row = (cells) => cells.map(cell).join(',')
const momentRows = [row(['url', 'detector', 'step', 'selector', 'headline', 'fact', 'highlighted screenshot', 'clean screenshot', 'verified by hand'])]
const noteRows = [row(['url', 'note'])]

await addLocalNetworks(config.internalServices)
const proxy = createEgressProxy({ log: { log() {}, warn() {}, error() {} } })
const proxyPort = await proxy.listen()
const browser = await launchBrowser(proxyPort)

let shotNumber = 0
try {
  for (const url of urls) {
    console.log(`\n${url}`)
    const context = await newSafeContext(browser, { blockedHosts: proxy.blockedHosts })
    try {
      if (flag('--fixtures')) await serveFixtureDir(context, path.join(runnerRoot, 'fixtures/checks/keyboard'))
      const page = await context.newPage()
      const deadline = Date.now() + config.personaCapMs
      const loaded = await loadPage(page, url, { deadline })
      if (!loaded.ok) {
        noteRows.push(row([url, loaded.reason]))
        console.log(`  did not open: ${loaded.reason}`)
        continue
      }
      if (loaded.status >= 400) noteRows.push(row([url, `The page answered with status ${loaded.status}, so this may not be the page you meant.`]))
      const coverage = await measureCoverage(page)
      if (coverage.closedShadowRoots) noteRows.push(row([url, coverageLines.closedSections(coverage.closedShadowRoots)]))
      const run = await measurePass(page, { detectors: KEYBOARD_CHECKS, deadline, persona: { persona: { name: 'David' } } })
      for (const note of run.notes) noteRows.push(row([url, note]))
      for (const p of run.problems) noteRows.push(row([url, `Detector problem (${p.detector}${p.step ? `, stop ${p.step}` : ''}): ${p.message}`]))
      console.log(`  walk ended: ${run.walk?.ended}, stops: ${run.walk?.stops.length ?? 0}, findings: ${run.candidates.length}`)

      await page.evaluate(installOverlay)
      for (const f of run.candidates) {
        shotNumber++
        const base = `${String(shotNumber).padStart(3, '0')}-${f.detector}`
        let highlighted = ''
        let clean = ''
        if (f.selector === 'body') {
          // Focus went to the page itself: there is no element to ring.
          clean = `screenshots/${base}-page.png`
          await page.screenshot({ path: path.join(outDir, clean) })
        } else {
          const el = await page.evaluate(locateAndDescribe, f.selector).catch(() => null)
          if (el) {
            await page.evaluate((sel) => document.querySelector(sel)?.focus({ preventScroll: true }), f.selector).catch(() => {})
            await page.evaluate(settle)
            clean = `screenshots/${base}-clean.png`
            await page.screenshot({ path: path.join(outDir, clean) })
            const vp = el.viewport
            const large = el.rect.width * el.rect.height > 0.5 * vp.width * vp.height
            await page.evaluate(overlayCall, { method: 'highlight', args: [{ rect: el.rect, number: shotNumber, large }] })
            await page.evaluate(settle)
            highlighted = `screenshots/${base}-highlighted.png`
            await page.screenshot({ path: path.join(outDir, highlighted) })
            await page.evaluate(overlayCall, { method: 'clearMoment' })
          }
        }
        momentRows.push(row([url, f.detector, f.step ?? '', f.selector, f.headline, f.fact, highlighted, clean, '']))
        console.log(`  ${f.detector}${f.step ? ` at stop ${f.step}` : ''}: ${f.headline}`)
      }
    } catch (err) {
      noteRows.push(row([url, `The script stopped on this page: ${String(err?.message || err).slice(0, 300)}`]))
      console.log(`  stopped: ${err?.message || err}`)
    } finally {
      await context.close().catch(() => {})
    }
  }
} finally {
  await browser.close().catch(() => {})
  await proxy.close().catch(() => {})
}

await fs.writeFile(path.join(outDir, 'moments.csv'), momentRows.join('\n') + '\n')
await fs.writeFile(path.join(outDir, 'notes.csv'), noteRows.join('\n') + '\n')
console.log(`\nWrote ${momentRows.length - 1} finding(s) and ${noteRows.length - 1} note(s) to ${path.relative(runnerRoot, outDir)}`)
