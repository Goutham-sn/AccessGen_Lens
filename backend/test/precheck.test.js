// The pre-check endpoints with a fake Redis and a fake queue:
//   docker compose exec backend node --test test/precheck.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makePrecheckHandlers, cleanResult, cacheKeyFor } from '../src/utils/precheck.js'
import { checkUrl } from '../src/utils/runUrl.js'

// Just enough Redis: get, set with EX and NX, incr, expire, del. Expiry is
// recorded, not run, so a test can say "the safety net would have cleared it".
function fakeRedis() {
  const data = new Map()
  const ttl = new Map()
  return {
    data,
    ttl,
    async get(k) { return data.has(k) ? data.get(k) : null },
    async set(k, v, ...opts) {
      if (opts.includes('NX') && data.has(k)) return null
      data.set(k, String(v))
      const i = opts.indexOf('EX')
      if (i !== -1) ttl.set(k, opts[i + 1])
      return 'OK'
    },
    async incr(k) { const n = Number(data.get(k) || 0) + 1; data.set(k, String(n)); return n },
    async expire(k, s) { ttl.set(k, s); return 1 },
    async del(k) { return data.delete(k) ? 1 : 0 }
  }
}

function fakeQueue() {
  const jobs = new Map()
  return {
    jobs,
    async add(data, opts) {
      const job = { id: opts.jobId, data, state: 'waiting', returnvalue: undefined, async getState() { return this.state } }
      jobs.set(job.id, job)
      return job
    },
    async getJob(id) { return jobs.get(id) || null }
  }
}

function setup(over = {}) {
  const redis = fakeRedis()
  const queue = fakeQueue()
  let n = 0
  const handlers = makePrecheckHandlers({
    redis, queue, dailyLimit: 3,
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    today: () => '2026-11-01',
    ...over
  })
  return { redis, queue, ...handlers }
}

function call(handler, { user = 'u1', body, params } = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this },
      json(b) { resolve({ status: this.statusCode, body: b }); return this }
    }
    handler({ user: { id: user }, body, params }, res, reject)
  })
}

const GOOD = { ok: true, checkedAt: '2026-11-01T10:00:00.000Z', reachableStops: { count: 3, level: 'few' } }

test('an address that is not a public web address is refused before anything is queued', async () => {
  const { createPrecheck, queue, redis } = setup()
  for (const url of ['ftp://example.com/', 'javascript:alert(1)', 'https://user:pw@example.com/', 'https://example.com:8080/', 'not a url', '', undefined, 42, 'https://example.com/' + 'a'.repeat(2100)]) {
    const r = await call(createPrecheck, { body: { url } })
    assert.equal(r.status, 400, String(url).slice(0, 40))
    assert.match(r.body.error, /public web address/)
  }
  assert.equal(queue.jobs.size, 0)
  assert.equal(redis.data.size, 0, 'no marker, no count')
})

test('a good address is queued and answered at once with its id', async () => {
  const { createPrecheck, queue } = setup()
  const r = await call(createPrecheck, { body: { url: ' https://example.com/page#top ' } })
  assert.equal(r.status, 202)
  assert.equal(r.body.status, 'checking')
  assert.match(r.body.id, /^[0-9a-f-]{36}$/)
  const job = queue.jobs.get(r.body.id)
  assert.deepEqual(job.data, { url: 'https://example.com/page', userId: 'u1' }, 'tidied: no fragment, no spaces')
})

test('one check at a time for a person, and it is free again once it finishes', async () => {
  const { createPrecheck, getPrecheck, queue } = setup()
  const first = await call(createPrecheck, { body: { url: 'https://example.com/' } })
  const second = await call(createPrecheck, { body: { url: 'https://other.example/' } })
  assert.equal(second.status, 429)
  assert.match(second.body.error, /already in progress/)
  assert.equal(queue.jobs.size, 1)
  // someone else is not held up
  assert.equal((await call(createPrecheck, { user: 'u2', body: { url: 'https://other.example/' } })).status, 202)
  // finish the first and read it: the marker goes
  queue.jobs.get(first.body.id).state = 'completed'
  queue.jobs.get(first.body.id).returnvalue = GOOD
  await call(getPrecheck, { params: { id: first.body.id } })
  assert.equal((await call(createPrecheck, { body: { url: 'https://other.example/' } })).status, 202)
})

test('the marker has a safety expiry, in case the runner never frees it', async () => {
  const { createPrecheck, redis } = setup()
  await call(createPrecheck, { body: { url: 'https://example.com/' } })
  assert.equal(redis.ttl.get('precheck:active:u1'), 20)
})

test('the daily limit counts queued checks, and a refused one gives the marker back', async () => {
  const { createPrecheck, redis, queue } = setup()
  for (let i = 0; i < 3; i++) {
    const r = await call(createPrecheck, { body: { url: `https://example.com/${i}` } })
    assert.equal(r.status, 202)
    redis.data.delete('precheck:active:u1') // the runner freed it
  }
  const over = await call(createPrecheck, { body: { url: 'https://example.com/3' } })
  assert.equal(over.status, 429)
  assert.match(over.body.error, /all the page checks for today/)
  assert.equal(queue.jobs.size, 3)
  assert.equal(redis.data.has('precheck:active:u1'), false, 'not left blocking the person')
  assert.equal(redis.ttl.get('precheck:day:u1:2026-11-01'), 24 * 60 * 60)
  // another person has their own count
  assert.equal((await call(createPrecheck, { user: 'u2', body: { url: 'https://example.com/9' } })).status, 202)
})

test('a page looked at recently is answered from the cache: no visit, no count, no marker', async () => {
  const { createPrecheck, getPrecheck, queue, redis } = setup()
  const first = await call(createPrecheck, { body: { url: 'https://example.com/' } })
  queue.jobs.get(first.body.id).state = 'completed'
  queue.jobs.get(first.body.id).returnvalue = GOOD
  const done = await call(getPrecheck, { params: { id: first.body.id } })
  assert.deepEqual(done.body, { status: 'done', result: GOOD })
  assert.equal(redis.ttl.get(cacheKeyFor('https://example.com/')), 600, 'about ten minutes')

  const again = await call(createPrecheck, { user: 'u2', body: { url: 'https://example.com/#other-fragment' } })
  assert.equal(again.status, 200)
  assert.deepEqual(again.body, { status: 'done', result: GOOD })
  assert.equal(queue.jobs.size, 1, 'nothing queued')
  assert.equal(redis.data.has('precheck:active:u2'), false)
  assert.equal(redis.data.has('precheck:day:u2:2026-11-01'), false)
})

test('a look that did not work is not kept, so the next try looks again', async () => {
  const { createPrecheck, getPrecheck, queue, redis } = setup()
  const first = await call(createPrecheck, { body: { url: 'https://example.com/' } })
  queue.jobs.get(first.body.id).state = 'completed'
  queue.jobs.get(first.body.id).returnvalue = { ok: false, reason: 'This page asks visitors to prove they are human, so we could not look at it ahead of time.' }
  const done = await call(getPrecheck, { params: { id: first.body.id } })
  assert.equal(done.body.result.ok, false)
  assert.equal(redis.data.has(cacheKeyFor('https://example.com/')), false)
  assert.equal((await call(createPrecheck, { body: { url: 'https://example.com/' } })).status, 202)
})

test('a check is readable only by the person who started it', async () => {
  const { createPrecheck, getPrecheck, queue } = setup()
  const mine = await call(createPrecheck, { body: { url: 'https://example.com/' } })
  queue.jobs.get(mine.body.id).state = 'completed'
  queue.jobs.get(mine.body.id).returnvalue = GOOD
  const theirs = await call(getPrecheck, { user: 'u2', params: { id: mine.body.id } })
  assert.equal(theirs.status, 404)
  assert.deepEqual(theirs.body, (await call(getPrecheck, { user: 'u2', params: { id: '00000000-0000-4000-8000-00000000ffff' } })).body, 'the same as one that does not exist')
  assert.equal((await call(getPrecheck, { params: { id: mine.body.id } })).status, 200)
})

test('an id that is not an id never reaches the queue', async () => {
  let asked = 0
  const { getPrecheck: spy } = makePrecheckHandlers({ redis: fakeRedis(), dailyLimit: 1, queue: { async getJob() { asked++; return null } } })
  for (const id of ['../../x', '1', 'a'.repeat(300), '', 'null', undefined]) {
    assert.equal((await call(spy, { params: { id } })).status, 404)
  }
  assert.equal(asked, 0)
})

test('waiting and running checks read as checking; a job that failed reads as a plain miss', async () => {
  const { createPrecheck, getPrecheck, queue } = setup()
  const r = await call(createPrecheck, { body: { url: 'https://example.com/' } })
  for (const state of ['waiting', 'active', 'delayed']) {
    queue.jobs.get(r.body.id).state = state
    assert.deepEqual((await call(getPrecheck, { params: { id: r.body.id } })).body, { status: 'checking' })
  }
  queue.jobs.get(r.body.id).state = 'failed'
  const failed = await call(getPrecheck, { params: { id: r.body.id } })
  assert.deepEqual(failed.body, { status: 'done', result: { ok: false, reason: 'We could not check this page ahead of time.' } })
})

test('a queue that is down gives the marker back and is passed on as an error', async () => {
  const { createPrecheck, redis } = setup({ queue: { async add() { throw new Error('redis down') } } })
  await assert.rejects(call(createPrecheck, { body: { url: 'https://example.com/' } }), /redis down/)
  assert.equal(redis.data.has('precheck:active:u1'), false)
})

test('only the known fields of a result are passed on', () => {
  assert.deepEqual(cleanResult({ ...GOOD, secret: 'x', reachableStops: { count: 3, level: 'few', extra: 1 } }), GOOD)
  assert.deepEqual(cleanResult({ ok: false, reason: 'Plain.', stack: 'at x' }), { ok: false, reason: 'Plain.' })
  assert.deepEqual(cleanResult(null), { ok: false, reason: 'We could not check this page ahead of time.' })
  assert.deepEqual(cleanResult({ ok: true, checkedAt: 'now', reachableStops: { count: 3, level: 'weird' } }), { ok: false, reason: 'We could not check this page ahead of time.' })
  assert.deepEqual(cleanResult({ ok: true, checkedAt: 'now', reachableStops: { count: -1, level: 'few' } }), { ok: false, reason: 'We could not check this page ahead of time.' })
  assert.equal(cleanResult({ ok: false, reason: 'x'.repeat(500) }).reason.length, 200)
})

const FULL = {
  ok: true,
  checkedAt: '2026-11-01T10:00:00.000Z',
  reachableStops: { count: 3, level: 'few' },
  textAmount: { chars: 412, level: 'little' },
  colourChange: { share: 0.013, level: 'little' },
  unseenStops: { count: 0, of: 3, level: 'none' }
}

test('all four signals are passed on, and only their known fields', () => {
  assert.deepEqual(cleanResult(FULL), FULL)
  const noisy = {
    ...FULL, extra: 1,
    textAmount: { ...FULL.textAmount, words: 70 },
    colourChange: { ...FULL.colourChange, pixels: [1, 2, 3] },
    unseenStops: { ...FULL.unseenStops, selectors: ['a'] }
  }
  assert.deepEqual(cleanResult(noisy), FULL)
  assert.equal(cleanResult({ ...FULL, colourChange: { share: 0.0126, level: 'little' } }).colourChange.share, 0.013, 'tidied to three places')
})

test('a signal that is not well formed is left out on its own, and the rest stand', () => {
  const broken = {
    ...FULL,
    textAmount: { chars: -4, level: 'little' },
    colourChange: { share: 1.4, level: 'little' },
    unseenStops: { count: 5, of: 3, level: 'some' }
  }
  assert.deepEqual(cleanResult(broken), { ok: true, checkedAt: FULL.checkedAt, reachableStops: FULL.reachableStops })
  for (const bad of [{ textAmount: { chars: 10, level: 'weird' } }, { colourChange: { share: 'lots', level: 'lots' } }, { unseenStops: { count: 1, of: 2, level: 'many' } }, { textAmount: null }]) {
    const out = cleanResult({ ...FULL, ...bad })
    assert.equal(out.ok, true)
    assert.deepEqual(out.reachableStops, FULL.reachableStops)
    assert.equal(Object.keys(out).length, 3 + 2, JSON.stringify(bad))
  }
})

test('a result from before these signals still reads as a good look, with the signals it has', () => {
  assert.deepEqual(cleanResult(GOOD), GOOD)
})

test('a result is cached under a version that older results do not have', () => {
  assert.match(cacheKeyFor('https://example.com/'), /^precheck:v3:[0-9a-f]{64}$/)
})

test('every level of the out-of-view count is passed on, and one that is not a level is left out', () => {
  for (const level of ['none', 'few', 'some', 'lots', 'unsure']) {
    assert.deepEqual(cleanResult({ ...FULL, unseenStops: { count: 2, of: 9, level } }).unseenStops, { count: 2, of: 9, level })
  }
  for (const level of ['many', 'little', '', undefined]) assert.equal(cleanResult({ ...FULL, unseenStops: { count: 2, of: 9, level } }).unseenStops, undefined)
})

test('a full result is kept for ten minutes and handed to the next person whole', async () => {
  const { createPrecheck, getPrecheck, queue } = setup()
  const first = await call(createPrecheck, { body: { url: 'https://example.com/' } })
  queue.jobs.get(first.body.id).state = 'completed'
  queue.jobs.get(first.body.id).returnvalue = { ...FULL, secret: 'x' }
  assert.deepEqual((await call(getPrecheck, { params: { id: first.body.id } })).body, { status: 'done', result: FULL })
  const again = await call(createPrecheck, { user: 'u2', body: { url: 'https://example.com/' } })
  assert.deepEqual(again.body, { status: 'done', result: FULL })
})

test('the address check is the one runs use', () => {
  assert.equal(checkUrl('https://Example.com/a#b'), 'https://example.com/a')
  assert.equal(checkUrl('http://example.com:80/'), 'http://example.com/')
  assert.equal(checkUrl('https://example.com:444/'), null)
})
