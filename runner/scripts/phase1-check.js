// Phase 1 checks, run inside the runner container:
//   docker compose run --rm runner node scripts/phase1-check.js
// Uses a stub store, so nothing is written to the database or MinIO.
// Fixture pages are served from a fake host by context.route, so they never
// touch the network (and so never need a hole in the egress proxy).
// Smaller limits than production so the cap checks are quick. Set
// unconditionally: compose's own environment would otherwise win.
process.env.RUNNER_PERSONA_CAP_MS = process.env.CHECK_PERSONA_CAP_MS || '10000'
process.env.RUNNER_MAX_CONTEXTS = process.env.CHECK_MAX_CONTEXTS || '2'

const fs = await import('node:fs/promises')
const path = await import('node:path')
const { fileURLToPath } = await import('node:url')
const { config } = await import('../src/config.js')
const { createEgressProxy } = await import('../src/egressProxy.js')
const { addLocalNetworks } = await import('../src/blocklist.js')
const { launchBrowser, createSemaphore, newSafeContext } = await import('../src/browser.js')
const { runPersona } = await import('../src/persona.js')

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_HOST = 'https://fixtures.lens.test'
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const PAGES = {
  '/simple.html': `<!doctype html><title>Fixture</title><main><h1>Hello</h1>
    <a href="#a">One</a> <a href="#b">Two</a> <button>Three</button></main>`,
  '/fetch-metadata.html': `<!doctype html><title>Fetch</title><script>
    window.result = fetch('http://169.254.169.254/latest/meta-data/').then(() => 'reached', () => 'blocked')
  </script>`,
  '/file-escape.html': `<!doctype html><title>File</title>
    <iframe id="f" src="file:///etc/passwd"></iframe>`
}

async function serveFixtures(context, { neverLoad = false } = {}) {
  await context.route(`${FIXTURE_HOST}/**`, async (route) => {
    if (neverLoad) return // never fulfilled: the page never commits
    const p = new URL(route.request().url()).pathname
    if (!PAGES[p]) return route.fulfill({ status: 404, body: 'not found' })
    return route.fulfill({ status: 200, contentType: 'text/html', body: PAGES[p] })
  })
}

await addLocalNetworks(config.internalServices)
const proxy = createEgressProxy({ log: { warn() {} } })
const proxyPort = await proxy.listen()
const browser = await launchBrowser(proxyPort)

// ---------------------------------------------------------------- SSRF
{
  const context = await newSafeContext(browser, { blockedHosts: proxy.blockedHosts })
  await serveFixtures(context)
  const page = await context.newPage()

  const targets = [
    'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/', 'http://100.64.0.1/', 'http://postgres:5432/', 'http://minio:9000/',
    'http://redis:6379/', 'http://backend:3001/', 'http://localhost/'
  ]
  for (const url of targets) {
    let reached = false
    try {
      const res = await page.goto(url, { timeout: 8000 })
      reached = Boolean(res && res.status() < 400)
    } catch { /* refused, as it should be */ }
    check(`browser cannot reach ${url}`, !reached)
  }

  try {
    const res = await page.goto('https://httpbin.org/redirect-to?url=http%3A%2F%2F169.254.169.254%2F', { timeout: 15000 })
    check('public redirect to metadata is refused', !(res && res.ok() && page.url().includes('169.254')))
  } catch (err) {
    check('public redirect to metadata is refused', true, String(err.message).split('\n')[0])
  }

  await page.goto(`${FIXTURE_HOST}/fetch-metadata.html`)
  const fetched = await page.evaluate(() => window.result)
  check('page JavaScript cannot fetch the metadata address', fetched === 'blocked', fetched)

  await page.goto(`${FIXTURE_HOST}/file-escape.html`)
  await page.waitForTimeout(500)
  const fileLeak = await page.evaluate(() => {
    try { return document.getElementById('f').contentDocument?.body?.innerText || '' } catch { return '' }
  })
  check('a page cannot load file: URLs', !fileLeak.includes('root:'))

  await page.evaluate(() => { location.href = 'chrome://version' }).catch(() => {})
  await page.waitForTimeout(500)
  check('a page cannot navigate itself to chrome://', !page.url().startsWith('chrome://'), page.url())

  await context.close()
}

// ------------------------------------------------------- browser env
{
  const leaks = []
  for (const pid of await fs.readdir('/proc')) {
    if (!/^\d+$/.test(pid)) continue
    const cmd = await fs.readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '')
    if (!/chrom/i.test(cmd)) continue
    const env = await fs.readFile(`/proc/${pid}/environ`, 'utf8').catch(() => '')
    for (const key of ['DATABASE_URL', 'MINIO_SECRET_KEY', 'MINIO_ACCESS_KEY', 'JWT_SECRET', 'REDIS_URL']) {
      if (env.includes(`${key}=`)) leaks.push(`${pid}:${key}`)
    }
  }
  check('browser processes carry no database, MinIO, Redis or JWT settings', leaks.length === 0, leaks.join(' '))
}

// ------------------------------------------------- caps (stub store)
const finalized = []
const stubStore = {
  async getSession() { return { start_time: new Date() } },
  async markRunning() {},
  async putVideo(id) { return `sessions/${id}/session.webm` },
  async finalize(id, data) { finalized.push({ id, ...data }) }
}
const stubProgress = { phase() {}, done() {} }
const profilesSource = await fs.readFile(path.join(here, '../dist/profiles.js'), 'utf8')

{
  const sem = createSemaphore(config.maxContexts, { log() {} })
  const job = { url: `${FIXTURE_HOST}/simple.html` }
  const personas = Array.from({ length: 5 }, (_, i) => ({
    sessionId: `00000000-0000-0000-0000-00000000000${i}`,
    persona: { name: `Test${i}` },
    profiles: [{ id: 'keyboard-only', severity: 3 }, { id: 'deuteranopia', severity: 3 }]
  }))
  await Promise.all(personas.map((s) => runPersona(job, s, {
    browser, sem, blockedHosts: proxy.blockedHosts, store: stubStore, progress: stubProgress,
    profilesSource, extraRoute: (ctx) => serveFixtures(ctx)
  })))
  check(`five personas never hold more than ${config.maxContexts} contexts`, sem.peak <= config.maxContexts, `peak ${sem.peak}`)
  const ok = finalized.filter((f) => f.videoKey && !f.coverage.stoppedReason)
  check('each persona finalized with a video', ok.length === 5, `${ok.length}/5`)
  const walked = finalized.every((f) => f.coverage.stopsVisited === 3 && f.coverage.walkEnded === 'wrapped')
  check('keyboard walk visits the 3 stops and stops when focus wraps', walked,
    finalized.map((f) => `${f.coverage.stopsVisited}/${f.coverage.walkEnded}`).join(' '))
  check('recorded pass matches the measure pass at every stop', finalized.every((f) => f.debug.mismatches.length === 0))
}

{
  const before = finalized.length
  await runPersona({ url: 'file:///etc/passwd' }, {
    sessionId: '00000000-0000-0000-0000-0000000000fe', persona: { name: 'File' }, profiles: [{ id: 'keyboard-only' }]
  }, { browser, sem: createSemaphore(1, { log() {} }), blockedHosts: proxy.blockedHosts, store: stubStore, progress: stubProgress, profilesSource })
  const f = finalized[before]
  check('the runner refuses anything but http and https', Boolean(f?.coverage.stoppedReason) && !f?.videoKey, f?.coverage.stoppedReason)
}

{
  finalized.length = 0
  const sem = createSemaphore(config.maxContexts, { log() {} })
  const started = Date.now()
  await runPersona({ url: `${FIXTURE_HOST}/never.html` }, {
    sessionId: '00000000-0000-0000-0000-0000000000ff', persona: { name: 'Slow' }, profiles: [{ id: 'keyboard-only' }]
  }, {
    browser, sem, blockedHosts: proxy.blockedHosts, store: stubStore, progress: stubProgress,
    profilesSource, extraRoute: (ctx) => serveFixtures(ctx, { neverLoad: true })
  })
  const took = Date.now() - started
  check(`a page that never loads ends within the ${config.personaCapMs} ms cap`,
    took <= config.personaCapMs + 5000 && finalized.length === 1, `${took} ms`)
  check('...and the session is finalized with a plain reason', Boolean(finalized[0]?.coverage.stoppedReason),
    finalized[0]?.coverage.stoppedReason)
  check('...without opening a recorded pass after the measure pass failed to load',
    finalized[0]?.timings.launch === undefined && !finalized[0]?.videoKey)
}

await browser.close()
await proxy.close()
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
