import fs from 'node:fs/promises'
import path from 'node:path'

// Serves fixture pages from a fake host through route.fulfill, so check
// fixtures never touch the network or the egress proxy.
export const FIXTURE_HOST = 'https://fixtures.lens.test'

export async function serveFixtureDir(context, dir) {
  await context.route(`${FIXTURE_HOST}/**`, async (route) => {
    const name = path.basename(new URL(route.request().url()).pathname)
    const body = await fs.readFile(path.join(dir, name), 'utf8').catch(() => null)
    return body == null
      ? route.fulfill({ status: 404, body: 'not found' })
      : route.fulfill({ status: 200, contentType: 'text/html', body })
  })
}
