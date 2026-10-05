import { Persona } from '../models/Persona.js'
import { User } from '../models/User.js'

export async function listPersonas(req, res, next) {
  try {
    const user = await User.findById(req.user.id)
    const personas = await Persona.findVisibleTo(req.user.id, user?.team_id ?? null)
    res.json({ personas })
  } catch (err) { next(err) }
}

export async function createPersona(req, res, next) {
  try {
    const { name, age, story, profiles, isPublic, teamId } = req.body
    if (!name) return res.status(400).json({ error: 'A name is required' })
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return res.status(400).json({ error: 'At least one profile is required' })
    }
    const persona = await Persona.create({
      userId: req.user.id, name, age, story, profiles, isPublic, teamId
    })
    res.status(201).json({ persona })
  } catch (err) { next(err) }
}

export async function updatePersona(req, res, next) {
  try {
    const persona = await Persona.update(req.params.id, req.user.id, req.body)
    if (!persona) return res.status(404).json({ error: 'Persona not found or not editable' })
    res.json({ persona })
  } catch (err) { next(err) }
}

export async function deletePersona(req, res, next) {
  try {
    const ok = await Persona.delete(req.params.id, req.user.id)
    if (!ok) return res.status(404).json({ error: 'Persona not found or not deletable' })
    res.json({ ok: true })
  } catch (err) { next(err) }
}
