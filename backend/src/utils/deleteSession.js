import { Session } from '../models/Session.js'
import { listKeys, removeKeys } from './storage.js'

// Deletes a session and everything it stored. Objects go first, then the
// row, so a failure part way can simply be tried again. Everything a
// session stores lives under sessions/<id>/ (video, frames, moment
// pictures, report PDF, and the remux job's temporary and original keys
// when it exists); keys its rows point at elsewhere are removed too.
export async function deleteSessionAndMedia(sessionId) {
  const keys = [
    ...(await listKeys(`sessions/${sessionId}/`)),
    ...(await Session.mediaKeys(sessionId))
  ]
  const removed = await removeKeys(keys)
  await Session.delete(sessionId)
  return { removed }
}
