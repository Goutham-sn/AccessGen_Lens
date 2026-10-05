import { serveFixtureDir, FIXTURE_HOST } from './fixtureServer.js'
import { applyProfiles, settle } from '../pageScripts.js'

// Check 'filter-video': the persona's visual filter is applied in the
// recorded pass. The fixture is a solid pure green page; for each profile
// the centre pixel must move by at least MIN_DELTA on some colour channel
// once the filter is on, measured from real screenshots.
const MIN_DELTA = 40 // well above JPEG or rendering noise, well below any real filter change

async function centrePixel(page) {
  const png = await page.screenshot({ clip: { x: 630, y: 350, width: 20, height: 20 } })
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(10, 10, 1, 1).data
    return [d[0], d[1], d[2]]
  }, png.toString('base64'))
}

export default {
  id: 'filter-video',
  async runFixture(browser, { fixtureDir, expected, profilesSource }) {
    const result = {}
    for (const profile of Object.keys(expected)) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      try {
        await serveFixtureDir(context, fixtureDir)
        const page = await context.newPage()
        await page.goto(`${FIXTURE_HOST}/solid-green.html`)
        const before = await centrePixel(page)
        await page.evaluate(profilesSource)
        await page.evaluate(applyProfiles, [{ id: profile, severity: 3 }])
        await page.evaluate(settle)
        const after = await centrePixel(page)
        const delta = Math.max(...before.map((v, i) => Math.abs(v - after[i])))
        result[profile] = { changed: delta >= MIN_DELTA }
      } finally {
        await context.close()
      }
    }
    return result
  }
}
