import { Router } from 'express'
import { createShare, listShares, viewShared, deleteShare } from '../controllers/share.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.post('/sessions/:id', requireAuth, createShare)
router.get('/sessions/:id', requireAuth, listShares)
router.delete('/:shareId', requireAuth, deleteShare)
router.get('/view/:token', viewShared) // public

export default router
