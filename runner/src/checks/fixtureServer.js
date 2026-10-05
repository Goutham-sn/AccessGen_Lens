import fs from 'node:fs/promises'
import path from 'node:path'

// Serves fixture pages from fake hosts through route.fulfill, so check
// fixtures never touch the network or the egress proxy. OTHER_SITE serves
// the same folder under a different origin, for frames from another site.
export const FIXTURE_HOST = 'https://fixtures.lens.test'
export const OTHER_SITE = 'https://other-site.lens.test'

export async function serveFixtureDir(context, dir) {
  const serve = async (route) => {
    const name = path.basename(new URL(route.request().url()).pathname)
    const body = await fs.readFile(path.join(dir, name), 'utf8').catch(() => null)
    return body == null
      ? route.fulfill({ status: 404, body: 'not found' })
      : route.fulfill({ status: 200, contentType: 'text/html', body })
  }
  await context.route(`${FIXTURE_HOST}/**`, serve)
  await context.route(`${OTHER_SITE}/**`, serve)
}
