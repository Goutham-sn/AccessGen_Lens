import { Router } from 'express'
import { createRun, getRun, getCapabilities, deleteRun, cancelRun } from '../controllers/runs.controller.js'
import { createPrecheck, getPrecheck } from '../controllers/precheck.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.post('/', createRun)
router.get('/capabilities', getCapabilities)
router.post('/precheck', createPrecheck)
router.get('/precheck/:id', getPrecheck)
router.get('/:id', getRun)
router.post('/:id/cancel', cancelRun)
router.delete('/:id', deleteRun)

export default router
