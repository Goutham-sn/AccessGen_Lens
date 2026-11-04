import crypto from 'crypto'
import { checkUrl, BAD_URL_MESSAGE } from './runUrl.js'

// The pre-check endpoints, with everything they touch passed in (Redis, the
// queue, the limits), so they run without either in tests. The wiring to the
// real ones is controllers/precheck.controller.js.
//
// A pre-check opens the page once in the runner and counts what is on it.
//   POST  { url }  ->  200 { status: 'done', result }       (answered from the cache)
//                      202 { id, status: 'checking' }       (queued)
//                      400 / 429 with { error }
//   GET   :id      ->  { status: 'checking' } or { status: 'done', result }
// result is { ok: true, checkedAt, reachableStops, textAmount, colourChange,
// unseenStops } (each signal is { ...numbers, level }) or { ok: false, reason },
// and nothing else.

const LEVELS = new Set(['none', 'few', 'unsure', 'plenty'])
const TEXT_LEVELS = new Set(['none', 'little', 'unsure', 'plenty'])
const COLOUR_LEVELS = new Set(['little', 'some', 'lots'])
const GAP_LEVELS = new Set(['none', 'few', 'some', 'lots', 'unsure'])
const whole = (n) => Number.isInteger(n) && n >= 0
const COULD_NOT_CHECK = 'We could not check this page ahead of time.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Only what the page is told, whatever the runner sent back.
export function cleanResult(raw) {
  if (raw && raw.ok === true) {
    const stops = raw.reachableStops
    if (whole(stops?.count) && LEVELS.has(stops.level) && typeof raw.checkedAt === 'string') {
      const out = { ok: true, checkedAt: raw.checkedAt.slice(0, 40), reachableStops: { count: stops.count, level: stops.level } }
      // The other signals are each kept only if they are well formed; one that is not is left out.
      const text = raw.textAmount
      if (whole(text?.chars) && TEXT_LEVELS.has(text.level)) out.textAmount = { chars: text.chars, level: text.level }
      const colour = raw.colourChange
      if (typeof colour?.share === 'number' && colour.share >= 0 && colour.share <= 1 && COLOUR_LEVELS.has(colour.level)) {
        out.colourChange = { share: Math.round(colour.share * 1000) / 1000, level: colour.level }
      }
      const gaps = raw.unseenStops
      if (whole(gaps?.count) && whole(gaps?.of) && gaps.count <= gaps.of && GAP_LEVELS.has(gaps.level)) {
        out.unseenStops = { count: gaps.count, of: gaps.of, level: gaps.level }
      }
      return out
    }
    return { ok: false, reason: COULD_NOT_CHECK }
  }
  const reason = typeof raw?.reason === 'string' && raw.reason.trim() ? raw.reason.trim().slice(0, 200) : COULD_NOT_CHECK
  return { ok: false, reason }
}

// v3: a result from before the gaps were graded is not served (its levels differ).
export const cacheKeyFor = (url) => `precheck:v3:${crypto.createHash('sha256').update(url).digest('hex')}`

export function makePrecheckHandlers({
  redis,
  queue,
  dailyLimit,
  cacheSeconds = 10 * 60,
  activeSeconds = 20, // longer than the runner's whole look; a safety net if the runner never frees it
  newId = () => crypto.randomUUID(),
  today = () => new Date().toISOString().slice(0, 10)
}) {
  const activeKey = (userId) => `precheck:active:${userId}`

  async function createPrecheck(req, res, next) {
    try {
      const url = checkUrl(req.body?.url)
      if (!url) return res.status(400).json({ error: BAD_URL_MESSAGE })

      // A page looked at a few minutes ago is not visited again, by anyone.
      const cached = await redis.get(cacheKeyFor(url))
      if (cached) {
        try { return res.json({ status: 'done', result: cleanResult(JSON.parse(cached)) }) } catch { /* unreadable: look again */ }
      }

      const userId = req.user.id
      const id = newId()
      if (!(await redis.set(activeKey(userId), id, 'EX', activeSeconds, 'NX'))) {
        return res.status(429).json({ error: 'A check is already in progress. Please wait a moment.' })
      }
      const dayKey = `precheck:day:${userId}:${today()}`
      const count = await redis.incr(dayKey)
      if (count === 1) await redis.expire(dayKey, 24 * 60 * 60)
      if (count > dailyLimit) {
        await redis.del(activeKey(userId))
        return res.status(429).json({ error: 'That is all the page checks for today. You can still start a run.' })
      }

      try {
        await queue.add({ url, userId }, { jobId: id })
      } catch (err) {
        await redis.del(activeKey(userId))
        throw err
      }
      return res.status(202).json({ id, status: 'checking' })
    } catch (err) { next(err) }
  }

  async function getPrecheck(req, res, next) {
    try {
      const id = String(req.params.id || '')
      const job = UUID.test(id) ? await queue.getJob(id) : null
      // Someone else's check looks the same as one that does not exist.
      if (!job || job.data?.userId !== req.user.id) return res.status(404).json({ error: 'Check not found' })

      const state = await job.getState()
      if (state !== 'completed' && state !== 'failed') return res.json({ status: 'checking' })

      const mine = activeKey(req.user.id)
      if ((await redis.get(mine)) === id) await redis.del(mine)
      const result = cleanResult(state === 'completed' ? job.returnvalue : null)
      // Only a look that worked is kept; a failure is tried again next time.
      if (result.ok) await redis.set(cacheKeyFor(job.data.url), JSON.stringify(result), 'EX', cacheSeconds)
      return res.json({ status: 'done', result })
    } catch (err) { next(err) }
  }

  return { createPrecheck, getPrecheck }
}
