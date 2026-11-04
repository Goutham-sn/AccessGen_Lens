// The pre-check's text, colour and tunnel-vision signals (src/precheck.js,
// src/png.js), each checked against what the real run produces on the same page:
// the real filtered render for colour, the real taskWalk for the gaps.
// Needs Chromium, so run it in the runner container:
//   docker compose run --rm runner node --test test/precheck-signals.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import zlib from 'node:zlib'
import { chromium } from 'playwright'
import { serveFixtureDir, FIXTURE_HOST } from '../src/checks/fixtureServer.js'
import { precheckPage, textLevel, colourLevel, unseenLevel, unseenStops, landAxis, scanScript } from '../src/precheck.js'
import { decodePng, applyColourMatrix, changedShare, measuredShare } from '../src/png.js'
import { taskWalk } from '../src/task.js'
import { loadPage } from '../src/load.js'
import { applyProfiles } from '../src/pageScripts.js'
import { config } from '../src/config.js'
import { stick } from '../src/measuringStick.js'
import { Deuteranopia } from '../../extension/profiles/visual/Deuteranopia.js'
import { FIXTURES, readProfilesSource } from './helpers.js'

let browser
let profilesSource
before(async () => {
  browser = await chromium.launch({ chromiumSandbox: true })
  profilesSource = await readProfilesSource()
})
after(async () => { await browser?.close() })

async function open(file) {
  const context = await browser.newContext({ viewport: config.viewport })
  await serveFixtureDir(context, path.join(FIXTURES, 'precheck'))
  const page = await context.newPage()
  return { context, page, url: `${FIXTURE_HOST}/${file}` }
}
async function check(file, options = {}) {
  const { context, page, url } = await open(file)
  try { return await precheckPage(page, url, { deadline: Date.now() + config.precheck.deadlineMs, ...options }) } finally { await context.close() }
}

// ---- the PNG reader, on pictures built here with every kind of row filter

function encodePng(width, height, channels, pixels, filters) {
  const stride = width * channels
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    const type = filters[y % filters.length]
    raw[y * (stride + 1)] = type
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x
      const left = x >= channels ? pixels[at - channels] : 0
      const up = y > 0 ? pixels[at - stride] : 0
      const upLeft = y > 0 && x >= channels ? pixels[at - stride - channels] : 0
      let predict = 0
      if (type === 1) predict = left
      else if (type === 2) predict = up
      else if (type === 3) predict = (left + up) >> 1
      else if (type === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left); const pb = Math.abs(p - up); const pc = Math.abs(p - upLeft)
        predict = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
      }
      raw[y * (stride + 1) + 1 + x] = (pixels[at] - predict) & 255
    }
  }
  const chunk = (type, body) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(body.length, 0); head.write(type, 4, 'latin1')
    return Buffer.concat([head, body, Buffer.alloc(4)])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = channels === 3 ? 2 : 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

test('the PNG reader gives back the pixels, whatever filter each row used, with and without alpha', () => {
  for (const channels of [3, 4]) {
    const width = 13
    const height = 11
    const pixels = Buffer.alloc(width * height * channels)
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 37 + (i >> 3) * 11) & 255
    for (const filters of [[0], [1], [2], [3], [4], [0, 1, 2, 3, 4]]) {
      const image = decodePng(encodePng(width, height, channels, pixels, filters))
      assert.equal(image.width, width)
      assert.equal(image.height, height)
      assert.equal(image.channels, channels)
      assert.ok(image.data.equals(pixels), `channels ${channels}, filters ${filters}`)
    }
  }
})

test('the PNG reader refuses what it cannot read, with a plain error', () => {
  assert.throws(() => decodePng(Buffer.from('not a picture at all, just words and more words')), /not a PNG/)
  assert.throws(() => decodePng(Buffer.alloc(10)), /not a PNG/)
  const sixteen = encodePng(2, 2, 3, Buffer.alloc(12), [0])
  sixteen[24] = 16 // bit depth
  assert.throws(() => decodePng(sixteen), /unsupported PNG/)
})

// ---- colour

const MATRIX = new Deuteranopia(3).matrix

test('the colour matrix is the real filter\'s: the one in the page after the run applies it', async () => {
  const { context, page, url } = await open('colour-little.html')
  try {
    await page.goto(url)
    await page.evaluate(profilesSource)
    await page.evaluate(applyProfiles, [{ id: 'deuteranopia', severity: 3 }])
    const inPage = await page.evaluate(() => document.querySelector('#accessgen-deuteranopia feColorMatrix').getAttribute('values'))
    assert.equal(inPage.trim().split(/\s+/).map(Number).join(' '), MATRIX.join(' '))
  } finally { await context.close() }
})

test('colour maths: nothing changes for grey and white, and red moves a long way', () => {
  for (const g of [0, 90, 180, 255]) {
    const out = applyColourMatrix(MATRIX, g, g, g)
    assert.ok(out.every((c) => Math.abs(c - g) < 2.5), `grey ${g} -> ${out}`)
  }
  const red = applyColourMatrix(MATRIX, 204, 34, 0)
  assert.ok(Math.max(...red.map((c, i) => Math.abs(c - [204, 34, 0][i]))) > stick('precheck', 'colourDelta'))
  // bytes in, bytes out, and never past either end
  for (const c of applyColourMatrix(MATRIX, 255, 0, 255)) assert.ok(c >= 0 && c <= 255)
})

// A real filtered render of the same page, and how much of the screen it changed.
async function realShare(file) {
  const { context, page, url } = await open(file)
  try {
    await page.goto(url)
    const plain = decodePng(await page.screenshot({ type: 'png' }))
    await page.evaluate(profilesSource)
    await page.evaluate(applyProfiles, [{ id: 'deuteranopia', severity: 3 }])
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const filtered = decodePng(await page.screenshot({ type: 'png' }))
    return { plain, real: measuredShare(plain, filtered, { delta: stick('precheck', 'colourDelta') }) }
  } finally { await context.close() }
}

for (const [file, level] of [['colour-little.html', 'little'], ['colour-some.html', 'some'], ['colour-lots.html', 'lots'], ['colour-space.html', 'lots']]) {
  test(`colour: ${file} is "${level}", and the predicted share matches what the real filter changes`, async () => {
    const result = await check(file)
    const { real } = await realShare(file)
    assert.equal(result.colourChange.level, level)
    assert.ok(Math.abs(result.colourChange.share - real) <= 0.015,
      `predicted ${result.colourChange.share}, the real filtered render changed ${real.toFixed(3)}`)
  })
}

test('colour levels follow the thresholds in the measuring stick', () => {
  assert.equal(colourLevel(0), 'little')
  assert.equal(colourLevel(stick('precheck', 'littleColourShare') - 0.001), 'little')
  assert.equal(colourLevel(stick('precheck', 'littleColourShare')), 'some')
  assert.equal(colourLevel(stick('precheck', 'lotsColourShare') - 0.001), 'some')
  assert.equal(colourLevel(stick('precheck', 'lotsColourShare')), 'lots')
})

test('without the picture the other signals still stand', async () => {
  const result = await check('few.html', { screenshotMs: 1 })
  assert.equal(result.ok, true)
  assert.equal(result.colourChange, undefined)
  assert.equal(result.reachableStops.count, 3)
  assert.ok(result.textAmount && result.unseenStops)
})

// ---- text

for (const [file, level] of [['text-none.html', 'none'], ['text-little.html', 'little'], ['text-plenty.html', 'plenty'], ['text-picture.html', 'unsure']]) {
  test(`text: ${file} is "${level}", and the count is the page's own text`, async () => {
    const { context, page, url } = await open(file)
    try {
      const result = await precheckPage(page, url, { deadline: Date.now() + config.precheck.deadlineMs })
      const asked = (await page.locator('body').innerText()).trim().length // asked of the browser a second way
      assert.equal(result.textAmount.chars, asked)
      assert.equal(result.textAmount.level, level)
    } finally { await context.close() }
  })
}

test('text levels follow the thresholds, and a picture or frame makes a short page unsure', () => {
  const t = (textChars, frames = 0, bigMedia = 0) => textLevel({ textChars, frames, bigMedia })
  assert.equal(t(stick('precheck', 'noTextChars')), 'none')
  assert.equal(t(stick('precheck', 'noTextChars') + 1), 'little')
  assert.equal(t(stick('precheck', 'littleTextChars') - 1), 'little')
  assert.equal(t(stick('precheck', 'littleTextChars')), 'plenty')
  assert.equal(t(100, 1), 'unsure')
  assert.equal(t(100, 0, 1), 'unsure')
  assert.equal(t(5000, 1, 1), 'plenty', 'plenty of text is plenty wherever else there is a frame')
})

// ---- tunnel-vision gaps, against the real run

// The real run's own verdict on every stop: taskWalk with tunnel vision, looking
// for something that is not there, so it goes through every place on the page.
async function realGaps(page) {
  const walk = await taskWalk(page, {
    intents: ['find a thing called zzqx that is not here'],
    profileIds: ['tunnel-vision'],
    deadline: Date.now() + 30000,
    budget: { stopsPerIntent: 500 }
  })
  const stops = walk.stops.filter((s) => s.kind === 'element')
  return { unseen: stops.filter((s) => s.perceived === false).length, of: stops.length }
}

const GAP_FIXTURES = [
  ['gaps-none.html', 'none'], ['gaps-edge.html', 'few'], ['gaps-skip.html', 'few'], ['gaps-some.html', 'few'], ['gaps-many.html', 'lots'], ['gaps-mixed.html', 'some'],
  // Exactly 3, 4, 7 and 8 out of view: either side of each bucket edge. The levels are written out here on purpose, so moving an edge fails these.
  ['gaps-out-3.html', 'few'], ['gaps-out-4.html', 'some'], ['gaps-out-7.html', 'some'], ['gaps-out-8.html', 'lots'],
  ['few.html', null], ['inline-box.html', null], ['many.html', null], ['tricky.html', null], ['late.html', null]
]
for (const [file, level] of GAP_FIXTURES) {
  test(`tunnel vision: ${file}: the pre-check counts the same places out of sight as the real run`, async () => {
    const { context, page, url } = await open(file)
    try {
      const result = await precheckPage(page, url, { deadline: Date.now() + config.precheck.deadlineMs })
      // The real walk goes on a fresh load: looking at skip links moves where Tab starts from,
      // which a page that is only looked at once never notices.
      const fresh = await context.newPage()
      await loadPage(fresh, url, { deadline: Date.now() + 20000 })
      const real = await realGaps(fresh)
      assert.deepEqual({ unseen: result.unseenStops.count, of: result.unseenStops.of }, real, `${file}: pre-check vs the real run`)
      if (level) assert.equal(result.unseenStops.level, level)
    } finally { await context.close() }
  })
}

test('tunnel vision: where the page lands decides the count, so one fixture is built to separate the rules', async () => {
  const r = await check('gaps-edge.html')
  // A corner, a place on screen near the bottom, and one nudged to the edge are out of sight; the one the page centres is not.
  assert.deepEqual({ unseen: r.unseenStops.count, of: r.unseenStops.of }, { unseen: 3, of: 4 })
})

test('tunnel vision: skip links that appear when focused are placed where they appear, not where they wait', async () => {
  const r = await check('gaps-skip.html')
  assert.deepEqual({ unseen: r.unseenStops.count, of: r.unseenStops.of }, { unseen: 1, of: 5 }, 'only the one that appears in the corner is out of sight')
})

test('tunnel vision: the gap fixtures really do differ (none, some, many out of sight)', async () => {
  const counts = {}
  for (const file of ['gaps-none.html', 'gaps-some.html', 'gaps-many.html']) counts[file] = (await check(file)).unseenStops
  assert.equal(counts['gaps-none.html'].count, 0)
  assert.ok(counts['gaps-some.html'].count > 0 && counts['gaps-some.html'].count < counts['gaps-some.html'].of, JSON.stringify(counts['gaps-some.html']))
  assert.ok(counts['gaps-many.html'].count >= 8, JSON.stringify(counts['gaps-many.html']))
})

test('the pre-check uses the real run\'s own definition of "made out", not a copy', async () => {
  // Same function and the same 300 px as scoreStop: change the stick and both move.
  const { madeOutNarrow } = await import('../src/task.js')
  const view = { width: 1280, height: 720 }
  const r = stick('task', 'tunnelRadiusPx')
  assert.equal(madeOutNarrow({ x: 640 + r, y: 360 }, null, view), true)
  assert.equal(madeOutNarrow({ x: 640 + r + 1, y: 360 }, null, view), false)
  assert.equal(madeOutNarrow({ x: 640 + r + 1, y: 360 }, { x: 640 + r + 1, y: 360 + r }, view), true, 'near the place before')
})

test('where a stop lands when scrolled into view: the rule measured on Chromium', () => {
  assert.equal(landAxis(100, 24, 0, 720, 9280), 0, 'wholly on screen: no scroll')
  assert.equal(landAxis(700, 24, 0, 720, 9280), 4, 'partly below: to the nearest edge')
  assert.equal(landAxis(1300, 24, 4, 720, 9280), 952, 'wholly off screen: centred')
  assert.equal(landAxis(2600, 400, 952, 720, 9280), 2440, 'a tall one off screen: centred')
  assert.equal(landAxis(2600, 400, 2652, 720, 9280), 2600, 'partly above: to the top edge')
  assert.equal(landAxis(9990, 10, 0, 720, 9280), 9280, 'never past the end of the page')
  assert.equal(landAxis(10, 10, 5000, 720, 9280), 0, 'never before the start')
})

test('tunnel vision: the bucket edges are 3 and 8 out of view, by count and not by share', async () => {
  assert.equal(stick('precheck', 'fewOutOfSight'), 3, 'if the edge is moved on purpose, move the fixtures and these levels with it')
  assert.equal(stick('precheck', 'lotsOutOfSight'), 8)
  const level = (unseen, of = 100) => unseenLevel({ unseen, of, frames: 0, truncated: false })
  assert.deepEqual([0, 1, 3, 4, 7, 8, 40].map((n) => level(n)), ['none', 'few', 'few', 'some', 'some', 'lots', 'lots'])
  // By count: one place of one is "few", and eight of a thousand is "lots", whatever the share.
  assert.equal(level(1, 1), 'few')
  assert.equal(level(8, 1000), 'lots')
  assert.equal(level(3, 3), 'few')
  // The pages themselves: exactly that many out of view, and the real run says the same.
  for (const [file, n] of [['gaps-out-3.html', 3], ['gaps-out-4.html', 4], ['gaps-out-7.html', 7], ['gaps-out-8.html', 8]]) {
    const r = await check(file)
    assert.deepEqual({ unseen: r.unseenStops.count, of: r.unseenStops.of }, { unseen: n, of: n + 4 }, file)
  }
})

test('levels for the gaps: a page with nothing to go between, or a frame, is unsure', () => {
  assert.equal(unseenLevel({ unseen: 0, of: 4, frames: 0, truncated: false }), 'none')
  assert.equal(unseenLevel({ unseen: 2, of: 4, frames: 0, truncated: false }), 'few')
  assert.equal(unseenLevel({ unseen: 0, of: 0, frames: 0, truncated: false }), 'unsure')
  assert.equal(unseenLevel({ unseen: 0, of: 4, frames: 1, truncated: false }), 'unsure')
  assert.equal(unseenLevel({ unseen: 0, of: 4, frames: 0, truncated: true }), 'unsure')
  assert.deepEqual(unseenStops([], { view: { w: 1280, h: 720 }, scrollMax: { x: 0, y: 0 } }), { unseen: 0, of: 0 })
})

// ---- signals together

test('a long grey page with nothing to reach: text plenty, colour little, nothing to go between', async () => {
  const r = await check('mix-text-only.html')
  assert.equal(r.textAmount.level, 'plenty')
  assert.equal(r.colourChange.level, 'little')
  assert.deepEqual(r.reachableStops, { count: 0, level: 'none' })
  assert.equal(r.unseenStops.level, 'unsure')
})

test('a bright page with next to no text and many places spread over the screen', async () => {
  const r = await check('mix-colour-links.html')
  assert.equal(r.textAmount.level, 'little')
  assert.equal(r.colourChange.level, 'lots')
  assert.equal(r.reachableStops.level, 'plenty')
  assert.equal(r.unseenStops.level, 'lots')
})

test('the scan keeps what the signals need and nothing more', async () => {
  const { context, page, url } = await open('few.html')
  try {
    await page.goto(url)
    const seen = await page.evaluate(scanScript, { bigMediaPx: stick('precheck', 'bigMediaPx'), maxStops: 1000 })
    assert.deepEqual(Object.keys(seen).sort(), ['bigMedia', 'count', 'frames', 'scrollMax', 'stops', 'textChars', 'truncated', 'view'])
    assert.equal(seen.stops.length, 3)
    assert.equal(seen.stops[0].length, 6)
  } finally { await context.close() }
})
