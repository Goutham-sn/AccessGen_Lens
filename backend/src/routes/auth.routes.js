import { Router } from 'express'
import { register, login, refresh, logout, me } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { rateLimitAuth } from '../middleware/rateLimit.middleware.js'

const router = Router()

router.post('/register', rateLimitAuth, register)
router.post('/login', rateLimitAuth, login)
router.post('/refresh', rateLimitAuth, refresh)
router.post('/logout', logout)
router.get('/me', requireAuth, me)

export default router
