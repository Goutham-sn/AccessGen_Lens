import { Router } from 'express'
import { getReport, requestPdf, downloadPdf } from '../controllers/report.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/:id', getReport)
router.post('/:id/pdf', requestPdf)
router.get('/:id/pdf', downloadPdf)

export default router
