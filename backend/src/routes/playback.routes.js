import { Router } from 'express'
import { getPlayback } from '../controllers/playback.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.get('/:id', requireAuth, getPlayback)

export default router
