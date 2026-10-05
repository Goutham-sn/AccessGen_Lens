import { config } from './config.js'
import { waitForDomQuiet } from './pageScripts.js'

// Plain words for the person running the tool. Never error codes.
function plainLoadFailure(err) {
  const msg = String(err?.message || '')
  if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|ERR_BLOCKED_BY_CLIENT|ERR_NAME_NOT_RESOLVED|ERR_ADDRESS_UNREACHABLE/.test(msg)) {
    return 'We could not open this page. It may be private, or not reachable from the public internet.'
  }
  if (/Timeout/i.test(msg)) return 'The page took too long to start loading, so we stopped.'
  return 'We could not open this page.'
}

// Load event (capped) plus a short moment of DOM quiet (capped). No
// network-idle waits: busy pages never go idle.
export async function loadPage(page, url, { deadline }) {
  const commitTimeout = Math.max(1000, Math.min(config.load.commitTimeoutMs, deadline - Date.now()))
  let response
  try {
    response = await page.goto(url, { waitUntil: 'commit', timeout: commitTimeout })
  } catch (err) {
    return { ok: false, reason: plainLoadFailure(err), detail: String(err?.message || err).slice(0, 300) }
  }

  const loadCap = Math.max(0, Math.min(config.load.loadEventCapMs, deadline - Date.now()))
  await page.waitForLoadState('load', { timeout: loadCap }).catch(() => {})
  await page.evaluate(waitForDomQuiet, {
    quietMs: config.load.domQuietMs,
    capMs: config.load.domQuietCapMs
  }).catch(() => {})

  let redirects = 0
  for (let r = response?.request().redirectedFrom(); r; r = r.redirectedFrom()) redirects++
  if (redirects > config.maxRedirects) {
    return { ok: false, reason: 'The page sent us through too many redirects, so we stopped.' }
  }

  return { ok: true, status: response?.status() ?? null, redirects, finalUrl: page.url() }
}
