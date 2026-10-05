import { Team } from '../models/Team.js'
import { User } from '../models/User.js'

export async function myTeams(req, res, next) {
  try {
    res.json({ teams: await Team.findByUser(req.user.id) })
  } catch (err) { next(err) }
}

export async function createTeam(req, res, next) {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'A team name is required' })
    const team = await Team.create({ name, ownerId: req.user.id })
    await User.setTeam(req.user.id, team.id)
    res.status(201).json({ team })
  } catch (err) { next(err) }
}

export async function getMembers(req, res, next) {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ error: 'Team not found' })
    const members = await Team.members(team.id)
    if (!members.some((m) => m.id === req.user.id)) {
      return res.status(403).json({ error: 'You are not a member of this team' })
    }
    res.json({ team, members })
  } catch (err) { next(err) }
}

export async function inviteMember(req, res, next) {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ error: 'Team not found' })
    if (team.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the team owner can invite members' })
    }
    const { email } = req.body
    const invitee = await User.findByEmail(email || '')
    if (!invitee) return res.status(404).json({ error: 'No account exists with that email' })
    await Team.addMember(team.id, invitee.id)
    await User.setTeam(invitee.id, team.id)
    res.status(201).json({ members: await Team.members(team.id) })
  } catch (err) { next(err) }
}

export async function removeMember(req, res, next) {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ error: 'Team not found' })
    if (team.owner_id !== req.user.id && req.params.userId !== req.user.id) {
      return res.status(403).json({ error: 'Only the team owner can remove members' })
    }
    await Team.removeMember(team.id, req.params.userId)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
