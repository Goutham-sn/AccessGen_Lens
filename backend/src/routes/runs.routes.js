import { Router } from 'express'
import { createRun, getRun, getCapabilities } from '../controllers/runs.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.post('/', createRun)
router.get('/capabilities', getCapabilities)
router.get('/:id', getRun)

export default router
