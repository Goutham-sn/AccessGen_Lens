import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Bull from 'bull'
import { config, requireSecrets } from './config.js'
import { createEgressProxy } from './egressProxy.js'
import { addLocalNetworks } from './blocklist.js'
import { launchBrowser, createSemaphore } from './browser.js'
import { runPersona } from './persona.js'
import { runPrecheck } from './precheck.js'
import { store } from './store.js'
import { progress } from './progress.js'
import { capabilityGaps } from './checks/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  requireSecrets()

  // The capabilities file says what the runner can do. Refuse to start if a
  // live check has no module or a listed profile has no implementation.
  const gaps = capabilityGaps()
  if (gaps.length) {
    console.error(`[runner] Not starting: ${gaps.join('; ')}.`)
    process.exit(1)
  }
  const profilesSource = await fs.readFile(path.join(here, '../dist/profiles.js'), 'utf8')

  const blocked = await addLocalNetworks(config.internalServices)
  console.log(`[runner] also blocking local networks and services: ${blocked.join(', ') || 'none found'}`)

  const proxy = createEgressProxy()
  const proxyPort = await proxy.listen()
  console.log(`[runner] egress proxy on 127.0.0.1:${proxyPort}`)

  // One warm Chromium per worker, relaunched if it ever goes away.
  let browser = null
  async function getBrowser() {
    if (browser?.isConnected()) return browser
    browser = await launchBrowser(proxyPort)
    browser.on('disconnected', () => { browser = null })
    console.log('[runner] browser ready')
    return browser
  }
  await getBrowser()

  const sem = createSemaphore(config.maxContexts)
  const queue = new Bull('lens-runs', { redis: config.redisUrl })

  // A heartbeat, so the Run page can say plainly when no runner is up
  // (instead of a run that waits forever).
  const beat = () => progress.redis.set('runner:heartbeat', String(Date.now()), 'EX', 30).catch(() => {})
  beat()
  setInterval(beat, 5000).unref()

  queue.process(config.jobConcurrency, async (job) => {
    const { runId, userId, sessions, mode } = job.data
    console.log(`[runner] run ${runId}: ${sessions.length} persona(s) for ${job.data.url}${mode === 'task' ? ` (task, ${job.data.task?.intents?.length ?? 0} intent(s))` : ''}`)
    try {
      // A run is a regular run, or a task run (job.data.task). Anything else is
      // refused: it would otherwise be walked as a regular run by mistake.
      if (mode !== undefined && mode !== 'task') throw new Error(`unknown run mode: ${mode}`)
      // Stopped by the person before it started: nothing to do (the backend
      // has already ended its sessions).
      const cancelKey = `runs:cancel:${runId}`
      if (await progress.redis.get(cancelKey)) {
        console.log(`[runner] run ${runId} was stopped before it started`)
        return []
      }
      // Stopped while running: checked every second, and every persona's
      // browser closes at once.
      const stop = new AbortController()
      const watch = setInterval(async () => {
        if (!stop.signal.aborted && await progress.redis.get(cancelKey).catch(() => null)) {
          console.log(`[runner] run ${runId} stopped by the person`)
          stop.abort()
        }
      }, 1000)
      const b = await getBrowser()
      // Personas in parallel; the semaphore caps live contexts.
      const results = await Promise.allSettled(sessions.map((s) => runPersona(job.data, s, {
        browser: b, sem, blockedHosts: proxy.blockedHosts, store, progress, profilesSource, signal: stop.signal
      }))).finally(() => clearInterval(watch))
      console.log(`[runner] run ${runId} done, peak contexts ${sem.peak}/${config.maxContexts}`)
      return results.map((r) => (r.status === 'fulfilled' ? r.value.sessionId : null))
    } finally {
      // Free the user's "one run at a time" slot, but only if it is ours.
      const key = `runs:active:${userId}`
      if ((await progress.redis.get(key)) === runId) await progress.redis.del(key)
    }
  })

  queue.on('failed', (job, err) => console.error(`[runner] job ${job.id} failed:`, err.message))

  // The pre-check: a separate queue, concurrency and context cap, so a quick
  // look never waits behind a run and never takes a run's contexts.
  const precheckSem = createSemaphore(config.precheck.contexts)
  const precheckQueue = new Bull('lens-precheck', { redis: config.redisUrl })
  precheckQueue.process(config.precheck.concurrency, async (job) => {
    const { url, userId } = job.data
    try {
      return await runPrecheck(url, { browser: await getBrowser(), sem: precheckSem, blockedHosts: proxy.blockedHosts })
    } finally {
      // Free the user's "one check at a time" marker, but only if it is ours.
      const key = `precheck:active:${userId}`
      if ((await progress.redis.get(key)) === String(job.id)) await progress.redis.del(key)
    }
  })
  precheckQueue.on('failed', (job, err) => console.error(`[runner] precheck ${job.id} failed:`, err.message))
  console.log(`[runner] waiting for runs (max ${config.maxContexts} contexts, ${config.jobConcurrency} runs at once) and pre-checks (${config.precheck.contexts} contexts, ${config.precheck.concurrency} at once)`)

  const shutdown = async () => {
    await queue.close().catch(() => {})
    await precheckQueue.close().catch(() => {})
    await browser?.close().catch(() => {})
    await proxy.close().catch(() => {})
    await store.close().catch(() => {})
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('[runner] fatal startup error:', err)
  process.exit(1)
})
