import { Session } from '../models/Session.js'
import { verifyAccessToken } from '../utils/jwt.js'
import { uploadTokenMatches } from '../utils/uploadToken.js'
import { getLocalUser } from '../config/localUser.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// One answer for every refusal (unknown session, malformed id, bad or
// expired token, closed window), so a caller cannot tell which it was.
function refuse(res) {
  return res.status(401).json({ error: 'Not allowed to upload to this session' })
}

// The owner's user id from the Authorization header, or null. An invalid or
// expired access token is treated exactly as if it were absent.
function ownerFromBearer(req) {
  const bearer = req.headers.authorization?.split(' ')[1]
  // No sign-in: the web app's own requests come without a token and are the
  // local user's. The extension still sends its per-session upload token.
  if (!bearer) return req.get('X-Upload-Token') ? null : getLocalUser()
  try {
    const decoded = verifyAccessToken(bearer)
    return { id: decoded.sub, email: decoded.email, name: decoded.name }
  } catch {
    return null
  }
}

// Who may write to a session: its owner (a valid access token), or the
// extension holding that session's upload token.
//
// kind 'frames' | 'moments' | 'end': the token works until /end closes uploads.
// kind 'recording': the token works until /end, then for a grace period
//   after /end, and only once (the controller claims it).
//
// Runs before multer, so nobody unauthorised gets a large body buffered.
export function sessionWriter(kind) {
  return async (req, res, next) => {
    try {
      if (!UUID.test(req.params.id || '')) return refuse(res)
      const auth = await Session.findUploadAuth(req.params.id)
      if (!auth) return refuse(res)

      const user = ownerFromBearer(req)
      if (user && auth.user_id != null && auth.user_id === user.id) {
        req.user = user
        req.writer = { via: 'owner' }
        return next()
      }

      const presented = req.get('X-Upload-Token')
      if (!presented || !uploadTokenMatches(presented, auth.upload_token_hash) || !auth.token_live) {
        return refuse(res)
      }
      if (kind === 'recording') {
        if (auth.recording_token_used || !auth.recording_window_open) return refuse(res)
      } else if (auth.uploads_closed) {
        return refuse(res)
      }

      req.writer = { via: 'upload-token' }
      next()
    } catch (err) { next(err) }
  }
}
