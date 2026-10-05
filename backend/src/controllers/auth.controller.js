import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { query } from '../config/database.js'
import {
  signAccessToken, signRefreshToken, verifyRefreshToken, hashToken
} from '../utils/jwt.js'

async function issueTokens(user) {
  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [user.id, hashToken(refreshToken)]
  )
  return { accessToken, refreshToken }
}

export async function register(req, res, next) {
  try {
    const { email, password, name } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const existing = await User.findByEmail(email)
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ email, name, passwordHash })
    const tokens = await issueTokens(user)
    res.status(201).json({ user, ...tokens })
  } catch (err) { next(err) }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body
    const user = await User.findByEmail(email || '')
    if (!user || !user.password_hash || !(await bcrypt.compare(password || '', user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password' })
    }
    await User.touchActivity(user.id)
    const tokens = await issueTokens(user)
    const { password_hash, google_id, ...safe } = user
    res.json({ user: safe, ...tokens })
  } catch (err) { next(err) }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' })

    let decoded
    try {
      decoded = verifyRefreshToken(refreshToken)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' })
    }

    const { rows } = await query(
      'SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
      [decoded.sub, hashToken(refreshToken)]
    )
    if (rows.length === 0) return res.status(401).json({ error: 'Refresh token revoked' })

    // Rotate: revoke old, issue new pair
    await query('DELETE FROM refresh_tokens WHERE id = $1', [rows[0].id])
    const user = await User.findById(decoded.sub)
    if (!user) return res.status(401).json({ error: 'User not found' })
    const tokens = await issueTokens(user)
    res.json({ user, ...tokens })
  } catch (err) { next(err) }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashToken(refreshToken)])
    }
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user })
  } catch (err) { next(err) }
}
