import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './routes/auth.routes.js'
import sessionRoutes from './routes/session.routes.js'
import framesRoutes from './routes/frames.routes.js'
import playbackRoutes from './routes/playback.routes.js'
import shareRoutes from './routes/share.routes.js'
import reportRoutes from './routes/report.routes.js'
import personaRoutes from './routes/persona.routes.js'
import teamRoutes from './routes/team.routes.js'
import runsRoutes from './routes/runs.routes.js'
import { notFound, errorHandler } from './middleware/error.middleware.js'
import { rateLimitApi } from './middleware/rateLimit.middleware.js'

export function createApp() {
  const app = express()

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({
    origin: [process.env.WEB_APP_URL || 'http://localhost:5173', /^chrome-extension:\/\//],
    credentials: true,
    // X-Upload-Token: the extension's per-session upload token.
    // X-Share-Password: password-protected shared reports.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Upload-Token', 'X-Share-Password', 'Range']
  }))
  // Frame batches carry base64 screenshots, so allow large bodies.
  app.use(express.json({ limit: '50mb' }))
  app.use(rateLimitApi)

  app.get('/health', (req, res) => res.json({ ok: true }))

  app.use('/api/auth', authRoutes)
  app.use('/api/sessions', sessionRoutes)
  app.use('/api', framesRoutes) // /api/sessions/:id/frames + /api/media/*
  app.use('/api/playback', playbackRoutes)
  app.use('/api/share', shareRoutes)
  app.use('/api/reports', reportRoutes)
  app.use('/api/personas', personaRoutes)
  app.use('/api/teams', teamRoutes)
  app.use('/api/runs', runsRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
