import { config } from './config.js'
import { contentState } from './pageScripts.js'

// Plain words for the person running the tool. Never codes.
function plainLoadFailure(err) {
  const msg = String(err?.message || '')
  if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|ERR_BLOCKED_BY_CLIENT|ERR_NAME_NOT_RESOLVED|ERR_ADDRESS_UNREACHABLE/.test(msg)) {
    return 'We could not open this page. It may be private, or not reachable from the public internet.'
  }
  if (/Timeout/i.test(msg)) return 'The page took too long to start loading, so we stopped.'
  return 'We could not open this page.'
}

export const STILL_EMPTY = `The page was still empty after ${config.load.readyCapMs / 1000} seconds, so we could not look at it.`
export const STILL_CHANGING = 'The page was still changing when we started, so what we measured may differ from what a person sees a moment later.'

// The readiness rule, the same in the measure pass and the recorded pass:
//   1. the load event, waited for at most loadEventCapMs
//   2. then until the page has visible text or something to Tab to, the DOM
//      has not changed for quietMs, and there has been no navigation for
//      noNavigationMs (a navigation, such as a page reloading itself, starts
//      the wait for quiet again)
// The whole wait is capped at readyCapMs from the first byte. At the cap:
//   - nothing to show yet: { ok: false, empty: true, reason: STILL_EMPTY }
//   - still changing: ready anyway, with changing: true (a coverage line)
// No network-idle waits: busy pages never go idle.
export async function loadPage(page, url, { deadline }) {
  const commitTimeout = Math.max(1000, Math.min(config.load.commitTimeoutMs, deadline - Date.now()))
  let lastNavigation = Date.now()
  const onNavigate = (frame) => { if (frame === page.mainFrame()) lastNavigation = Date.now() }
  page.on('framenavigated', onNavigate)

  try {
    let response
    try {
      response = await page.goto(url, { waitUntil: 'commit', timeout: commitTimeout })
    } catch (err) {
      return { ok: false, reason: plainLoadFailure(err), detail: String(err?.message || err).slice(0, 300) }
    }
    const started = Date.now()
    const capAt = Math.min(started + config.load.readyCapMs, deadline)

    await page.waitForLoadState('load', { timeout: Math.max(0, Math.min(config.load.loadEventCapMs, capAt - Date.now())) }).catch(() => {})

    let lastChange = Date.now()
    let lastCount = null
    let hasContent = false
    let ready = false
    while (Date.now() < capAt) {
      // The page's own document can be replaced mid-read by a navigation;
      // that counts as a change.
      const state = await page.evaluate(contentState).catch(() => null)
      const now = Date.now()
      if (!state || state.changes !== lastCount || lastNavigation > lastChange) {
        lastChange = Math.max(now, lastNavigation)
        lastCount = state ? state.changes : null
      }
      hasContent = Boolean(state?.hasContent)
      if (hasContent && now - lastChange >= config.load.quietMs && now - lastNavigation >= config.load.noNavigationMs) {
        ready = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, config.load.readyPollMs))
    }

    let redirects = 0
    for (let r = response?.request().redirectedFrom(); r; r = r.redirectedFrom()) redirects++
    if (redirects > config.maxRedirects) {
      return { ok: false, reason: 'The page sent us through too many redirects, so we stopped.' }
    }
    if (!hasContent) return { ok: false, empty: true, reason: STILL_EMPTY, finalUrl: page.url(), readyMs: Date.now() - started }

    return {
      ok: true,
      status: response?.status() ?? null,
      redirects,
      finalUrl: page.url(),
      changing: !ready,
      readyMs: Date.now() - started
    }
  } finally {
    page.off('framenavigated', onNavigate)
  }
}
