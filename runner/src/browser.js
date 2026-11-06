import os from 'node:os'
import { chromium } from 'playwright'
import { config } from './config.js'
import { installClickRecorder } from '../../extension/issues/clickRecorder.js'

// The browser gets only what it needs to start. No database, MinIO or JWT
// secrets: those stay in the worker process.
function minimalEnv() {
  return {
    HOME: process.env.HOME || '/home/pwuser',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    TMPDIR: os.tmpdir(),
    FONTCONFIG_PATH: '/etc/fonts'
  }
}

export async function launchBrowser(proxyPort) {
  return chromium.launch({
    headless: true,
    // Playwright defaults to --no-sandbox. We run under Playwright's seccomp
    // profile instead, which lets Chromium keep its own sandbox.
    chromiumSandbox: true,
    env: minimalEnv(),
    args: [
      `--proxy-server=http://127.0.0.1:${proxyPort}`,
      // Chromium skips the proxy for loopback by default. "<-loopback>"
      // removes that exception, so loopback hits the proxy and is refused.
      '--proxy-bypass-list=<-loopback>',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      '--deny-permission-prompts',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--no-first-run'
    ]
  })
}

// Counting semaphore for live contexts across the whole worker.
export function createSemaphore(max, log = console) {
  let live = 0
  let peak = 0
  const waiting = []
  return {
    async acquire(label = '') {
      if (live >= max) await new Promise((resolve) => waiting.push(resolve))
      live++
      peak = Math.max(peak, live)
      log.log?.(`[runner] context open ${label} (live ${live}/${max})`)
    },
    release(label = '') {
      live--
      log.log?.(`[runner] context closed ${label} (live ${live}/${max})`)
      waiting.shift()?.()
    },
    get live() { return live },
    get peak() { return peak }
  }
}

// One context per pass. Observe only: no downloads, no permissions, no
// service workers, no saved state, popups closed as they open.
export async function newSafeContext(browser, { blockedHosts, recordVideoDir } = {}) {
  const context = await browser.newContext({
    viewport: config.viewport,
    screen: config.viewport,
    deviceScaleFactor: 1,
    acceptDownloads: false,
    permissions: [],
    serviceWorkers: 'block',
    javaScriptEnabled: true,
    ignoreHTTPSErrors: false,
    locale: 'en-US',
    ...(recordVideoDir ? { recordVideo: { dir: recordVideoDir, size: config.viewport } } : {})
  })

  let mainPage = null
  context.on('page', (page) => {
    if (!mainPage) { mainPage = page; return }
    page.close().catch(() => {}) // popups and window.open: one page only
  })

  // Second layer behind the egress proxy: only web schemes, never a host
  // the proxy has already refused, and a short redirect chain.
  await context.route('**/*', (route) => {
    const request = route.request()
    let url
    try { url = new URL(request.url()) } catch { return route.abort('blockedbyclient') }
    if (!['http:', 'https:', 'data:', 'blob:'].includes(url.protocol)) return route.abort('blockedbyclient')
    if (blockedHosts?.has(url.hostname.replace(/^\[|\]$/g, ''))) return route.abort('blockedbyclient')
    if (request.isNavigationRequest()) {
      let hops = 0
      for (let r = request.redirectedFrom(); r; r = r.redirectedFrom()) hops++
      if (hops > config.maxRedirects) return route.abort('blockedbyclient')
    }
    return route.continue()
  })

  // Notes which elements get click handlers, before the page's own scripts
  // run, so the tab-skipped check can find things only a mouse can use.
  await context.addInitScript(installClickRecorder)

  return context
}
