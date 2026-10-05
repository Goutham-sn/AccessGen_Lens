// The extension may upload a recording up to 10 minutes after the session
// ends (RECORDING_GRACE_MINUTES in backend/src/utils/uploadToken.js), so a
// missing video is only final once that window has passed.
const UPLOAD_GRACE_MS = 10 * 60 * 1000

// When a missing video becomes final, as a timestamp. Infinity while the
// session is still going; 0 when it can never arrive.
export function uploadWindowEndsAt(session) {
  if (!session) return Infinity
  // The runner uploads before it finishes, never later.
  if (session.source === 'runner') return session.processing_complete ? 0 : Infinity
  if (!session.end_time) return Infinity
  return new Date(session.end_time).getTime() + UPLOAD_GRACE_MS
}
