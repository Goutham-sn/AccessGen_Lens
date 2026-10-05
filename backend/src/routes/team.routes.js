import { Router } from 'express'
import { myTeams, createTeam, getMembers, inviteMember, removeMember } from '../controllers/team.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/', myTeams)
router.post('/', createTeam)
router.get('/:id/members', getMembers)
router.post('/:id/members', inviteMember)
router.delete('/:id/members/:userId', removeMember)

export default router
