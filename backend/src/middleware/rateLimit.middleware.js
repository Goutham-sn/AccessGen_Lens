import { RateLimiterMemory } from 'rate-limiter-flexible'

const apiLimiter = new RateLimiterMemory({ points: 300, duration: 60 })
const authLimiter = new RateLimiterMemory({ points: 20, duration: 60 })

function makeMiddleware(limiter) {
  return async (req, res, next) => {
    try {
      await limiter.consume(req.ip)
      next()
    } catch {
      res.status(429).json({ error: 'Too many requests, please slow down' })
    }
  }
}

export const rateLimitApi = makeMiddleware(apiLimiter)
export const rateLimitAuth = makeMiddleware(authLimiter)
