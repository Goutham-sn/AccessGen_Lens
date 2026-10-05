import { Router } from 'express'
import {
  createSession, listSessions, getSession, endSession, logEmpathyMoment, deleteSession
} from '../controllers/session.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { sessionWriter } from '../middleware/sessionWriter.js'

const router = Router()

// Writes the extension makes: the owner, or the session's upload token
// (which outlives the 15 minute access token).
router.post('/:id/end', sessionWriter('end'), endSession)
router.post('/:id/empathy-moments', sessionWriter('moments'), logEmpathyMoment)

// Everything else needs a signed-in user. An expired token gets a 401,
// which is what makes the web app refresh it and retry. Attached per route,
// not with router.use: this router is mounted at /api/sessions ahead of the
// frames router, and a router-wide guard would also catch
// /api/sessions/:id/frames and /recording before their own checks run.
router.post('/', requireAuth, createSession)
router.get('/', requireAuth, listSessions)
router.get('/:id', requireAuth, getSession)
router.delete('/:id', requireAuth, deleteSession)

export default router
