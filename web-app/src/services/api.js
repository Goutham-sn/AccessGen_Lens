const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

let getTokens = () => ({ accessToken: null, refreshToken: null })
let onTokensRefreshed = () => {}
let onAuthFailure = () => {}

// Called once by authStore to wire token storage into the client.
export function configureApi({ tokens, refreshed, failure }) {
  getTokens = tokens
  onTokensRefreshed = refreshed
  onAuthFailure = failure
}

async function rawRequest(path, options = {}, accessToken) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const res = await fetch(`${API_URL}/api${path}`, { ...options, headers })
  return res
}

// Refresh tokens are single-use — the backend deletes and reissues one on
// every call. If two requests hit a 401 around the same time (easy to
// trigger: React StrictMode double-invokes effects in dev, or two calls
// just happen to land near token expiry) and each independently POSTed to
// /auth/refresh with the same token, the first would rotate it and the
// second would arrive with an already-dead token, get its own 401 back,
// and wipe the whole session via onAuthFailure — even though the user's
// login was perfectly fine. Sharing one in-flight refresh across every
// concurrent caller avoids that.
let refreshPromise = null

function refreshTokens(refreshToken) {
  if (!refreshPromise) {
    refreshPromise = rawRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    })
      .then(async (res) => (res.ok ? { ok: true, data: await res.json() } : { ok: false }))
      .catch(() => ({ ok: false }))
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

async function request(path, options = {}) {
  const { accessToken, refreshToken } = getTokens()
  let res = await rawRequest(path, options, accessToken)

  // Access token expired — try one refresh, then replay the request.
  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshTokens(refreshToken)
    if (refreshed.ok) {
      onTokensRefreshed(refreshed.data)
      res = await rawRequest(path, options, refreshed.data.accessToken)
    } else {
      onAuthFailure()
    }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' })
}

export function mediaUrl(key) {
  if (!key) return null
  return `${API_URL}/api/media/${key}`
}

export { API_URL }
