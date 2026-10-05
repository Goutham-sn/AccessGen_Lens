import { Router } from 'express'
import { listPersonas, createPersona, updatePersona, deletePersona } from '../controllers/persona.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/', listPersonas)
router.post('/', createPersona)
router.patch('/:id', updatePersona)
router.delete('/:id', deletePersona)

export default router
