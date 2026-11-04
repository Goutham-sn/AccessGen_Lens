// Syntax and scheme only. The real network guard is the runner's egress
// proxy, which resolves every host and refuses private addresses. Used by
// every request that makes the runner open a page: runs and pre-checks.
export function checkUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  let url
  try { url = new URL(raw.trim()) } catch { return null }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (url.port && url.port !== '80' && url.port !== '443') return null
  url.hash = ''
  return url.toString()
}

export const BAD_URL_MESSAGE = 'Enter a public web address that starts with http:// or https://.'
