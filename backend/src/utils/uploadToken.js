import crypto from 'crypto'

// Per-session upload token. The raw token goes to the session's owner once,
// in the create response, and from there only to the extension. The server
// keeps nothing but its SHA-256 hash. Never log either.

export const UPLOAD_TOKEN_TTL_HOURS = 6
// After /end, the recording upload stays open this long, once.
export const RECORDING_GRACE_MINUTES = 10

export function newUploadToken() {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, hash: hashUploadToken(token) }
}

export function hashUploadToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

// Constant-time comparison of the presented token's hash with the stored
// hash. Both are 32-byte SHA-256 digests, so the lengths always match.
export function uploadTokenMatches(presented, storedHash) {
  if (typeof presented !== 'string' || !presented || typeof storedHash !== 'string' || storedHash.length !== 64) {
    return false
  }
  const a = Buffer.from(hashUploadToken(presented), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
