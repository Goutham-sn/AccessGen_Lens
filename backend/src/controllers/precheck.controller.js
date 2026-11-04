import { redis } from '../config/redis.js'
import { precheckQueue } from '../jobs/queue.js'
import { DAILY_RUN_LIMIT } from '../config/runLimits.js'
import { makePrecheckHandlers } from '../utils/precheck.js'

export const { createPrecheck, getPrecheck } = makePrecheckHandlers({
  redis,
  queue: precheckQueue,
  dailyLimit: DAILY_RUN_LIMIT
})
