import { Router } from 'express'
import { createRun, getRun } from '../controllers/runs.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.post('/', createRun)
router.get('/:id', getRun)

export default router
