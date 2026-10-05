import { verifyAccessToken } from '../utils/jwt.js'

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorised' })

  try {
    const decoded = verifyAccessToken(token)
    req.user = { id: decoded.sub, email: decoded.email, name: decoded.name }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Attaches req.user when a valid token is present, but never rejects.
export function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) {
    try {
      const decoded = verifyAccessToken(token)
      req.user = { id: decoded.sub, email: decoded.email, name: decoded.name }
    } catch {
      /* anonymous */
    }
  }
  next()
}
