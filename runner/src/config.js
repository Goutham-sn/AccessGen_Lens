// Secrets have no defaults. The worker calls this first thing, so a missing
// one stops the runner at startup with a message that names it. (It is not
// run on import, so tests and checks can load the plain modules.)
export function requireSecrets() {
  const missing = ['DATABASE_URL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'].filter((n) => !process.env[n])
  if (missing.length) {
    console.error(`[runner] Missing required setting(s): ${missing.join(', ')}. Set them in .env (see .env.example).`)
    process.exit(1)
  }
}

// Runner settings. Every number here has a reason next to it.
export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl: process.env.DATABASE_URL,
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET || 'accessgen-lens'
  },
  // Hard cap per persona, from first context to finalized session.
  personaCapMs: parseInt(process.env.RUNNER_PERSONA_CAP_MS || '90000', 10),
  // Live browser contexts per worker. Each persona holds at most one.
  maxContexts: parseInt(process.env.RUNNER_MAX_CONTEXTS || '4', 10),
  // Runs a worker takes from the queue at once.
  jobConcurrency: parseInt(process.env.RUNNER_JOB_CONCURRENCY || '2', 10),
  // Compose service names the browser must never reach.
  internalServices: (process.env.RUNNER_INTERNAL_SERVICES || 'postgres,redis,minio,backend,runner')
    .split(',').map((s) => s.trim()).filter(Boolean),
  viewport: { width: 1280, height: 720 },
  load: {
    commitTimeoutMs: 15000, // DNS + TLS + first byte on a slow site
    loadEventCapMs: 5000, // never wait longer than this for "load"
    domQuietMs: 300, // how long the DOM must stay still to call it settled
    domQuietCapMs: 1500 // ...but never wait longer than this for quiet
  },
  walk: {
    maxStops: 60,
    recordedPaceMs: 150 // slow enough that a person can follow the video
  },
  maxRedirects: 5
}
