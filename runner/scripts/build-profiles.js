// Bundles the extension's profile classes into one script the runner can
// evaluate in a page. The chrome.runtime communicator is swapped for a shim.
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const swapCommunicator = {
  name: 'swap-communicator',
  setup(b) {
    b.onResolve({ filter: /content-scripts\/communicator\.js$/ }, () => ({
      path: path.join(root, 'src/inject/communicatorShim.js')
    }))
  }
}

await build({
  entryPoints: [path.join(root, 'src/inject/profilesEntry.js')],
  outfile: path.join(root, 'dist/profiles.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  minify: false,
  legalComments: 'none',
  plugins: [swapCommunicator]
})

console.log('[build] dist/profiles.js written')
