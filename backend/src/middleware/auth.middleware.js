import { verifyAccessToken } from '../utils/jwt.js'
import { getLocalUser } from '../config/localUser.js'

// No sign-in: a request with a valid token is that user (kept for older
// clients and the tests); every other request is the local user.
function userOf(req) {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) {
    try {
      const decoded = verifyAccessToken(token)
      return { id: decoded.sub, email: decoded.email, name: decoded.name }
    } catch { /* fall through to the local user */ }
  }
  return getLocalUser()
}

export function requireAuth(req, res, next) {
  req.user = userOf(req)
  if (!req.user) return res.status(503).json({ error: 'Starting up, please try again in a moment' })
  next()
}

export function optionalAuth(req, res, next) {
  req.user = userOf(req)
  next()
}
