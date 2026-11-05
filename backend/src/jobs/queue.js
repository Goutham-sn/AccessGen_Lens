import Bull from 'bull'
import { processReportGeneration } from './reportGeneration.job.js'
import { processSession } from './sessionProcessing.job.js'
import { finalizeIfStillPending } from './finalizeSession.job.js'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
// Building a long session's video can take more than Bull's default 30 s
// lock, and a job that outlives its lock is run a second time alongside.
const opts = {
  redis: REDIS_URL,
  defaultJobOptions: { attempts: 2, removeOnComplete: 100, removeOnFail: 100 },
  settings: { lockDuration: 5 * 60 * 1000 }
}

export const reportQueue = new Bull('report-generation', opts)
export const sessionQueue = new Bull('session-processing', opts)
export const finalizeQueue = new Bull('session-finalize', opts)
// Produced here, consumed only by the runner service (runner/src/worker.js).
// Never retried automatically: a retry would visit the site again.
export const runQueue = new Bull('lens-runs', {
  redis: REDIS_URL,
  defaultJobOptions: { attempts: 1, removeOnComplete: 100, removeOnFail: 100 }
})

// A quick look at a page before a run. Its own queue, so a short check never
// waits behind runs that last a minute or more. Consumed only by the runner.
export const precheckQueue = new Bull('lens-precheck', {
  redis: REDIS_URL,
  defaultJobOptions: { attempts: 1, removeOnComplete: 200, removeOnFail: 200 }
})

export function startWorkers(io) {
  sessionQueue.process(async (job) => processSession(job.data.sessionId, job.data, io))
  reportQueue.process(async (job) => processReportGeneration(job.data.sessionId))
  finalizeQueue.process(async (job) => finalizeIfStillPending(job.data.sessionId, io))

  for (const q of [reportQueue, sessionQueue, finalizeQueue]) {
    q.on('failed', (job, err) => console.error(`[queue:${q.name}] job ${job.id} failed:`, err.message))
  }
  console.log('[queue] workers started')
}

export async function enqueueSessionProcessing(sessionId, { recordingExpected = true } = {}) {
  await sessionQueue.add({ sessionId, recordingExpected })
}

export async function enqueueReportGeneration(sessionId) {
  await reportQueue.add({ sessionId }, { timeout: 5 * 60 * 1000 })
}

// The real recording is uploaded independently by the extension's
// offscreen document, on its own timeline, after /end has already marked
// the session "processing". If that upload never arrives (permission
// denied, tabCapture unsupported, browser closed mid-upload), the session
// would otherwise sit at "processing" forever. This gives it 90 seconds,
// then finalizes with whatever we have (video or not) rather than leaving
// the user staring at a stuck report.
export async function enqueueFinalizeCheck(sessionId) {
  await finalizeQueue.add({ sessionId }, { delay: 90 * 1000 })
}
