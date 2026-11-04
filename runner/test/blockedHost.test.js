// A page the egress proxy refuses (a private or internal address) is said to be
// unopenable at once, with a plain reason, on every path that loads a page: the
// shared loader, the pre-check and a real run. Before, an http:// address the
// proxy refused showed up as an empty page and the loader waited out its whole
// deadline before saying "still empty after 12 seconds".
// Needs Chromium, so run it in the runner container:
//   docker compose run --rm runner node --test test/blockedHost.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createEgressProxy, EGRESS_HEADER } from '../src/egressProxy.js'
import { launchBrowser, newSafeContext, createSemaphore } from '../src/browser.js'
import { loadPage } from '../src/load.js'
import { runPrecheck } from '../src/precheck.js'
import { runPersona } from '../src/persona.js'
import { readProfilesSource } from './helpers.js'

const PRIVATE = 'We could not open this page. It may be private, or not reachable from the public internet.'
const quiet = { log() {}, warn() {}, error() {} }

let proxy
let browser
let profilesSource
let work
before(async () => {
  proxy = createEgressProxy({ log: quiet })
  const port = await proxy.listen()
  browser = await launchBrowser(port)
  profilesSource = await readProfilesSource()
  work = await fs.mkdtemp(path.join(os.tmpdir(), 'blocked-host-'))
})
after(async () => {
  await browser?.close()
  await proxy?.close()
  await fs.rm(work, { recursive: true, force: true })
})

// Fresh proxy state each time: the bug showed only on the first try at a host,
// before the proxy had added it to blockedHosts.
async function firstTry(url, deadlineMs = 6000) {
  proxy.blockedHosts.clear()
  const context = await newSafeContext(browser, { blockedHosts: proxy.blockedHosts })
  const page = await context.newPage()
  const started = Date.now()
  const result = await loadPage(page, url, { deadline: Date.now() + deadlineMs })
  const tookMs = Date.now() - started
  await context.close()
  return { result, tookMs }
}

for (const url of ['http://127.0.0.1:3001/', 'https://127.0.0.1:3001/', 'http://10.0.0.5/', 'http://169.254.169.254/latest/meta-data/']) {
  test(`the shared loader: ${url} is not openable, said at once, on the first try`, async () => {
    const { result, tookMs } = await firstTry(url)
    assert.equal(result.ok, false)
    assert.equal(result.reason, PRIVATE)
    assert.ok(!result.empty, 'not reported as an empty page')
    assert.ok(tookMs < 3000, `took ${tookMs} ms`)
  })
}

test('a refused page is never reported as empty, even with a long deadline', async () => {
  const { result, tookMs } = await firstTry('http://127.0.0.1:3001/', 30000)
  assert.equal(result.reason, PRIVATE)
  assert.ok(tookMs < 3000, `took ${tookMs} ms, not the 30 s deadline`)
})

test('the pre-check: a refused address finishes within the deadline with the plain reason, and frees its context', async () => {
  proxy.blockedHosts.clear()
  const sem = createSemaphore(2, quiet)
  const started = Date.now()
  const result = await runPrecheck('http://127.0.0.1:3001/', { browser, sem, blockedHosts: proxy.blockedHosts, log: quiet })
  assert.deepEqual(result, { ok: false, reason: PRIVATE })
  assert.ok(Date.now() - started < 3000, `took ${Date.now() - started} ms`)
  assert.equal(sem.live, 0, 'the context was given back')
})

test('a real run: a refused address stops the run with the plain reason, quickly', async () => {
  proxy.blockedHosts.clear()
  const saved = { finalized: null }
  const store = {
    async getSession() { return { start_time: new Date() } },
    async markRunning() {},
    async putVideo() { return 'video-key' },
    async putImage(key) { return key },
    async saveMoment() { return 'm' },
    async saveTaskFailure() { return 'f' },
    async finalize(id, data) { saved.finalized = data }
  }
  const started = Date.now()
  const result = await runPersona({ url: 'http://127.0.0.1:3001/' }, {
    sessionId: '00000000-0000-4000-8000-0000000000bb',
    persona: { name: 'Meera' },
    profiles: [{ id: 'keyboard-only', severity: 3 }]
  }, {
    browser,
    sem: createSemaphore(2, quiet),
    blockedHosts: proxy.blockedHosts,
    store,
    progress: { phase() {}, moment() {}, done() {} },
    profilesSource
  })
  assert.equal(result.coverage.stoppedReason, PRIVATE)
  assert.ok(Date.now() - started < 8000, `took ${Date.now() - started} ms`)
})

test('the proxy labels its own refusals, and a site cannot use the label', async () => {
  const label = (port, url) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: url, headers: { host: new URL(url).host } }, (res) => {
      res.resume()
      resolve({ status: res.statusCode, label: res.headers[EGRESS_HEADER] })
    })
    req.on('error', reject)
    req.end()
  })

  const refusing = createEgressProxy({ log: quiet })
  const refusingPort = await refusing.listen()
  assert.deepEqual(await label(refusingPort, 'http://127.0.0.1:3001/'), { status: 403, label: 'refused' })
  await refusing.close()

  // A site that sends the label itself: the proxy is allowed to reach it here, and strips it.
  const site = http.createServer((req, res) => { res.writeHead(200, { [EGRESS_HEADER]: 'refused' }).end('hello') })
  await new Promise((r) => site.listen(0, '127.0.0.1', r))
  const sitePort = site.address().port
  const permissive = createEgressProxy({
    log: quiet,
    isBlocked: () => false,
    lookup: async () => ['127.0.0.1'],
    connect: () => net.connect(sitePort, '127.0.0.1')
  })
  const permissivePort = await permissive.listen()
  assert.deepEqual(await label(permissivePort, 'http://a-site.test/'), { status: 200, label: undefined })
  await permissive.close()
  await new Promise((r) => site.close(r))
})
