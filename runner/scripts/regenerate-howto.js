// Rewrites the "how to check by hand" column of a validation folder from
// what is already stored in it, without visiting any site. Only long-way
// rows change: each now says where the content was taken to start, the
// main landmark or, on a page with no main landmark, the first heading
// when it is an h1.
//
// What each long-way row is rebuilt from, all read from the folder:
//   presses      the step column of moments-detail.csv
//   anchor       the fact column ("Stop {n} is the first stop inside the
//                page's main landmark." or "... after the page's first
//                heading, ...")
//   name, role   the element named in the stored how-to ("look at “{name}”
//                ({role})" or "look at an unnamed {role}")
// A row that does not read as one of these stops the script; nothing is
// guessed.
//
// Lists the changes by default; --apply writes them into moments.csv and
// moments-detail.csv. Every other cell is written back as it was.
//
// Usage, from runner/:
//   node scripts/regenerate-howto.js validation/<folder> [--apply]
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { byHand } from '../src/copy.js'
import { BOM, row, parseCsv } from './csv.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const runnerRoot = path.join(here, '..')
const validationRoot = path.join(runnerRoot, 'validation')
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const folderArg = args.find((a) => !a.startsWith('--'))
if (!folderArg) {
  console.error('Usage: node scripts/regenerate-howto.js validation/<folder> [--apply]')
  process.exit(1)
}
const folder = path.resolve(runnerRoot, folderArg)
// Only ever writes inside runner/validation (kept out of git).
if (!folder.startsWith(validationRoot + path.sep)) {
  console.error(`Refusing ${folder}: the folder must be inside ${validationRoot}`)
  process.exit(1)
}

const read = async (name) => parseCsv(await fs.readFile(path.join(folder, name), 'utf8'))
const moments = await read('moments.csv')
const detail = await read('moments-detail.csv')
const col = (header, name) => {
  const i = header.indexOf(name)
  if (i < 0) throw new Error(`no "${name}" column`)
  return i
}
const M = { url: col(moments[0], 'url'), detector: col(moments[0], 'detector'), selector: col(moments[0], 'selector'), howTo: col(moments[0], 'how to check by hand') }
const D = { url: col(detail[0], 'url'), detector: col(detail[0], 'detector'), step: col(detail[0], 'step'), selector: col(detail[0], 'selector'), fact: col(detail[0], 'fact'), howTo: col(detail[0], 'how to check by hand') }
if (moments.length !== detail.length) throw new Error(`moments.csv has ${moments.length - 1} rows, moments-detail.csv has ${detail.length - 1}`)

// Element named in a stored how-to: “{name}” ({role}) or an unnamed {role}.
function storedElement(howTo) {
  const quoted = /, look at “(.*)” \(([^()]*)\)\. Is it /.exec(howTo)
  if (quoted) return { name: quoted[1], role: quoted[2] }
  const unnamed = /, look at an unnamed (.+?)\. Is it /.exec(howTo)
  if (unnamed) return { name: '', role: unnamed[1] }
  return null
}

function anchorFromFact(fact, step) {
  if (fact.startsWith(`Stop ${step} is the first stop inside the page's main landmark.`)) return 'main'
  if (fact.startsWith(`Stop ${step} is the first stop after the page's first heading, `)) return 'h1'
  return null
}

let changed = 0
for (let i = 1; i < detail.length; i++) {
  const d = detail[i]
  const m = moments[i]
  for (const key of ['url', 'detector', 'selector']) {
    if (d[D[key]] !== m[M[key]]) throw new Error(`row ${i}: ${key} differs between moments.csv and moments-detail.csv`)
  }
  if (d[D.howTo] !== m[M.howTo]) throw new Error(`row ${i}: the how-to differs between the two files`)
  if (d[D.detector] !== 'long-way') continue

  const url = d[D.url]
  const step = Number(d[D.step])
  const anchor = anchorFromFact(d[D.fact], step)
  const element = storedElement(d[D.howTo])
  if (!Number.isInteger(step) || step < 1) throw new Error(`row ${i} (${url}): no step`)
  if (!anchor) throw new Error(`row ${i} (${url}): the fact does not say which anchor was used`)
  if (!element) throw new Error(`row ${i} (${url}): the stored how-to does not name the element`)

  const howTo = `Open ${url}, ${byHand.longWay({ press: step, ...element, anchor })}`
  if (howTo === d[D.howTo]) continue
  changed++
  console.log(`${url} (anchor: ${anchor})\n  was: ${d[D.howTo]}\n  now: ${howTo}`)
  d[D.howTo] = howTo
  m[M.howTo] = howTo
}

const write = (name, rows) => fs.writeFile(path.join(folder, name), BOM + rows.map(row).join('\n') + '\n')
if (!changed) console.log('Nothing to change.')
else if (!apply) console.log(`\n${changed} row(s) would change. Run again with --apply to write them.`)
else {
  await write('moments.csv', moments)
  await write('moments-detail.csv', detail)
  console.log(`\nWrote ${changed} row(s) into moments.csv and moments-detail.csv in ${path.relative(runnerRoot, folder)}`)
}
