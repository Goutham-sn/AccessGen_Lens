import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Bull from 'bull'
import { config } from './config.js'
import { createEgressProxy } from './egressProxy.js'
import { addLocalNetworks } from './blocklist.js'
import { launchBrowser, createSemaphore } from './browser.js'
import { runPersona } from './persona.js'
import { store } from './store.js'
import { progress } from './progress.js'

const here = path.dirname(fileURLToPath(import.meta.url))

async function main() {
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

  queue.process(config.jobConcurrency, async (job) => {
    const { runId, userId, sessions } = job.data
    console.log(`[runner] run ${runId}: ${sessions.length} persona(s) for ${job.data.url}`)
    try {
      const b = await getBrowser()
      // Personas in parallel; the semaphore caps live contexts.
      const results = await Promise.allSettled(sessions.map((s) => runPersona(job.data, s, {
        browser: b, sem, blockedHosts: proxy.blockedHosts, store, progress, profilesSource
      })))
      console.log(`[runner] run ${runId} done, peak contexts ${sem.peak}/${config.maxContexts}`)
      return results.map((r) => (r.status === 'fulfilled' ? r.value.sessionId : null))
    } finally {
      // Free the user's "one run at a time" slot, but only if it is ours.
      const key = `runs:active:${userId}`
      if ((await progress.redis.get(key)) === runId) await progress.redis.del(key)
    }
  })

  queue.on('failed', (job, err) => console.error(`[runner] job ${job.id} failed:`, err.message))
  console.log(`[runner] waiting for runs (max ${config.maxContexts} contexts, ${config.jobConcurrency} runs at once)`)

  const shutdown = async () => {
    await queue.close().catch(() => {})
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
