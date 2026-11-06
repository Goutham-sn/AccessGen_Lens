// Every file the runner imports from outside runner/ must be copied into
// its image by the Dockerfile. A missing one crashes the worker at start,
// and then no run ever starts (this happened with extension/issues).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const runnerDir = path.resolve(here, '..')
const repo = path.resolve(runnerDir, '..')

async function files(dir) {
  const out = []
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...await files(p))
    else if (p.endsWith('.js')) out.push(p)
  }
  return out
}

test('every import from outside runner/ is copied into the image', async () => {
  const dockerfile = await fs.readFile(path.join(runnerDir, 'Dockerfile'), 'utf8')
  const copied = [...dockerfile.matchAll(/^COPY\s+(\S+)\s+/gm)].map((m) => m[1].replace(/\/$/, ''))
  const seen = new Set()
  const queue = [...await files(path.join(runnerDir, 'src')), ...await files(path.join(runnerDir, 'scripts'))]
  const missing = []
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const src = await fs.readFile(file, 'utf8').catch(() => '')
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*'(\.[^']+)'/g)) {
      const target = path.resolve(path.dirname(file), m[1])
      const rel = path.relative(repo, target)
      if (!rel.startsWith('runner' + path.sep)) {
        const ok = copied.some((c) => rel === c || rel.startsWith(c + path.sep))
        if (!ok) missing.push(`${path.relative(repo, file)} imports ${rel}`)
      }
      if (target.endsWith('.js')) queue.push(target)
    }
  }
  assert.deepEqual(missing, [], 'add a COPY line to runner/Dockerfile for these')
})
