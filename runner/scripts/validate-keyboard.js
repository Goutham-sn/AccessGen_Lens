// Hand-check list for the keyboard detectors. Runs the five detectors on
// each URL exactly as a keyboard persona's measure pass would (same egress
// proxy, same safe context, same measure pass), whatever their capability
// flags say.
//
// One URL at a time, with a 5 second gap between them. Each URL is visited
// once and never retried. A bot wall (a CAPTCHA or "are you human" page) or
// a browser message box at load stops that URL; nothing is done to get past
// either. A URL that does not load is listed and the run carries on.
//
// Writes, into one folder:
//   moments.csv         url, detector, selector, highlighted screenshot,
//                       verified by hand (left empty for you)
//   moments-detail.csv  the same rows with the stop, headline, fact and a
//                       clean screenshot, to read alongside
//   runs.csv            per URL: label, final URL, HTTP status, load time,
//                       run time, stops, how the walk ended, moments per
//                       detector, the reason it stopped (bot wall, did not
//                       load, ...), and the run date
//   notes.csv           what we could not look at, per URL
//   screenshots/        a clean and a highlighted shot per finding
//
// Screenshots are taken after the measure pass is over, never during it.
// For each finding the element is scrolled into view and given focus (so
// you see what it looks like with focus), the clean shot is taken, then the
// magenta ring is drawn for the highlighted shot.
//
// Usage, from the repo root (urls.txt: a URL per line, then a short label;
// # starts a comment line):
//   docker compose run --rm --no-deps \
//     -v "$PWD/runner/validation:/app/runner/validation" \
//     runner node scripts/validate-keyboard.js validation/urls.txt
// Options:
//   --out validation/<folder>   where to write (default: a timestamped folder)
//   --fixtures                  serve fixtures/checks/keyboard at
//                               https://fixtures.lens.test instead of the
//                               network, to try the script itself
//   --gap <ms>                  pause between URLs (default 5000)
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
import { installOverlay, overlayCall, locateAndDescribe, settle, detectChallenge } from '../src/pageScripts.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const runnerRoot = path.join(here, '..')
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const listFile = args.find((a, i) => !a.startsWith('--') && !['--out', '--gap'].includes(args[i - 1]))
const gapMs = parseInt(option('--gap') || '5000', 10)

if (!listFile) {
  console.error('Usage: node scripts/validate-keyboard.js <urls.txt> [--out validation/<folder>] [--gap <ms>] [--fixtures]')
  process.exit(1)
}

const runDate = new Date().toISOString()
const outDir = path.resolve(runnerRoot, option('--out') || `validation/${runDate.replace(/[:.]/g, '-').slice(0, 19)}`)
const shotsDir = path.join(outDir, 'screenshots')
await fs.mkdir(shotsDir, { recursive: true })

// "https://example.com/  a short label" -> { url, label }
const entries = (await fs.readFile(path.resolve(runnerRoot, listFile), 'utf8'))
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => { const [url, ...rest] = l.split(/\s+/); return { url, label: rest.join(' ') } })

// A CSV cell: quoted, quotes doubled, and never read as a formula by a
// spreadsheet (page text could start with =, +, - or @).
const cell = (v) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
const row = (cells) => cells.map(cell).join(',')
const detectorIds = KEYBOARD_CHECKS.map((c) => c.id)
const momentRows = [row(['url', 'detector', 'selector', 'highlighted screenshot', 'verified by hand'])]
const detailRows = [row(['url', 'detector', 'step', 'selector', 'headline', 'fact', 'highlighted screenshot', 'clean screenshot'])]
const runRows = [row(['url', 'label', 'final url', 'http status', 'load ms', 'run ms', 'stops', 'walk ended',
  ...detectorIds.map((id) => `${id} moments`), 'stopped reason', 'run date'])]
const noteRows = [row(['url', 'note'])]

// UTF-8 with a byte order mark, so spreadsheet apps show quotes and
// accented names as written.
const BOM = '﻿'
async function writeAll() {
  await fs.writeFile(path.join(outDir, 'moments.csv'), BOM + momentRows.join('\n') + '\n')
  await fs.writeFile(path.join(outDir, 'moments-detail.csv'), BOM + detailRows.join('\n') + '\n')
  await fs.writeFile(path.join(outDir, 'runs.csv'), BOM + runRows.join('\n') + '\n')
  await fs.writeFile(path.join(outDir, 'notes.csv'), BOM + noteRows.join('\n') + '\n')
}

const STOPPED_CHALLENGE = 'Bot wall: the page asked to confirm that a person is visiting. We stopped and did not try to get past it.'
const STOPPED_DIALOG = 'The page opened a browser message box as it loaded. We stopped and left it untouched.'

await addLocalNetworks(config.internalServices)
const proxy = createEgressProxy({ log: { log() {}, warn() {}, error() {} } })
const proxyPort = await proxy.listen()
const browser = await launchBrowser(proxyPort)

let shotNumber = 0
try {
  for (const [index, { url, label }] of entries.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, gapMs))
    console.log(`\n[${index + 1}/${entries.length}] ${url}  ${label}`)
    const started = Date.now()
    const record = { finalUrl: '', status: '', loadMs: '', stops: '', ended: '', counts: {}, reason: '' }
    const context = await newSafeContext(browser, { blockedHosts: proxy.blockedHosts })
    try {
      if (flag('--fixtures')) await serveFixtureDir(context, path.join(runnerRoot, 'fixtures/checks/keyboard'))
      const page = await context.newPage()
      // A native alert or confirm at load: never accepted or dismissed.
      let dialogSeen = false
      page.on('dialog', () => { dialogSeen = true })
      const deadline = Date.now() + config.personaCapMs

      const loaded = await loadPage(page, url, { deadline })
      record.loadMs = Date.now() - started
      record.finalUrl = page.url()
      if (!loaded.ok) {
        record.reason = `Did not load: ${loaded.reason}`
        continue
      }
      record.status = loaded.status ?? ''
      if (dialogSeen) { record.reason = STOPPED_DIALOG; continue }
      if (await page.evaluate(detectChallenge).catch(() => null)) { record.reason = STOPPED_CHALLENGE; continue }
      if (loaded.status >= 400) noteRows.push(row([url, `The page answered with status ${loaded.status}, so this may not be the page you meant.`]))

      const coverage = await measureCoverage(page)
      if (coverage.closedShadowRoots) noteRows.push(row([url, coverageLines.closedSections(coverage.closedShadowRoots)]))
      const run = await measurePass(page, { detectors: KEYBOARD_CHECKS, deadline, persona: { persona: { name: 'David' } } })
      record.stops = run.walk?.stops.length ?? 0
      record.ended = run.walk?.ended ?? ''
      if (record.ended === 'time') record.reason = 'Reached the time limit for one page; kept what was measured.'
      for (const note of run.notes) noteRows.push(row([url, note]))
      for (const p of run.problems) noteRows.push(row([url, `Detector problem (${p.detector}${p.step ? `, stop ${p.step}` : ''}): ${p.message}`]))
      for (const id of detectorIds) record.counts[id] = run.candidates.filter((f) => f.detector === id).length

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
        momentRows.push(row([url, f.detector, f.selector, highlighted, '']))
        detailRows.push(row([url, f.detector, f.step ?? '', f.selector, f.headline, f.fact, highlighted, clean]))
      }
    } catch (err) {
      record.reason = record.reason || `The script stopped on this page: ${String(err?.message || err).slice(0, 300)}`
    } finally {
      await context.close().catch(() => {})
      const runMs = Date.now() - started
      runRows.push(row([url, label, record.finalUrl, record.status, record.loadMs, runMs, record.stops, record.ended,
        ...detectorIds.map((id) => record.counts[id] ?? ''), record.reason, runDate]))
      const counts = detectorIds.map((id) => `${id} ${record.counts[id] ?? '-'}`).join(', ')
      console.log(`  status ${record.status || '-'}, load ${record.loadMs} ms, run ${runMs} ms, stops ${record.stops || 0} (${record.ended || '-'})`)
      console.log(`  ${record.reason || counts}`)
      // Written after every URL, so a stopped run still leaves its rows.
      await writeAll()
    }
  }
} finally {
  await browser.close().catch(() => {})
  await proxy.close().catch(() => {})
}

await writeAll()
console.log(`\nWrote ${momentRows.length - 1} moment row(s) for ${entries.length} URL(s) to ${path.relative(runnerRoot, outDir)}`)
