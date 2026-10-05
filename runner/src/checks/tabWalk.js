import path from 'node:path'
import { tabWalk } from '../walk.js'
import { serveFixtureDir, FIXTURE_HOST } from './fixtureServer.js'

// Check 'tab-walk': press Tab through the page and record each stop.
// The fixture run returns, per page, how many stops there were and why the
// walk ended, which is what expected.json pins down.
export default {
  id: 'tab-walk',
  async runFixture(browser, { fixtureDir, expected }) {
    const result = {}
    for (const page of Object.keys(expected)) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      try {
        await serveFixtureDir(context, path.resolve(fixtureDir, path.dirname(page)))
        const tab = await context.newPage()
        await tab.goto(`${FIXTURE_HOST}/${path.basename(page)}`)
        const walk = await tabWalk(tab, { deadline: Date.now() + 20000 })
        result[page] = { stops: walk.stops.length, ended: walk.ended }
      } finally {
        await context.close()
      }
    }
    return result
  }
}
