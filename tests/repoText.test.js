// Every tracked text file is scanned for characters that hide or reorder
// text, and for the em dash. Run from the repo root:
//   npm test            (or: node --test tests/repoText.test.js)
// A failure lists each file and line.
//
// Forbidden:
//   - bidirectional controls and invisible characters: U+200B to U+200F,
//     U+202A to U+202E, U+2028, U+2029, U+2066 to U+2069, and also
//     U+2060 to U+2064, U+00AD, U+180E and U+FEFF (zero width, soft hyphen,
//     byte order mark inside a file)
//   - every other control character except tab, CR and LF (U+0000 to U+0008,
//     U+000B, U+000C, U+000E to U+001F, U+007F to U+009F)
//   - the em dash, U+2014
// Files that are not valid UTF-8 are reported too. Pictures, video, fonts and
// the like are skipped by extension. Spelling a forbidden character in code
// needs an escape sequence written as text (a backslash and u, then its
// four digits), never the character itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BINARY = /\.(png|jpe?g|gif|ico|webp|webm|mp4|pdf|woff2?|ttf|eot|zip|gz)$/i

// [first, last, what it is]
const FORBIDDEN = [
  [0x0000, 0x0008, 'control character'],
  [0x000b, 0x000c, 'control character'],
  [0x000e, 0x001f, 'control character'],
  [0x007f, 0x009f, 'control character'],
  [0x00ad, 0x00ad, 'soft hyphen'],
  [0x180e, 0x180e, 'Mongolian vowel separator'],
  [0x200b, 0x200f, 'zero width or direction mark'],
  [0x2014, 0x2014, 'em dash'],
  [0x2028, 0x2029, 'line or paragraph separator'],
  [0x202a, 0x202e, 'direction override'],
  [0x2060, 0x2064, 'invisible joiner or operator'],
  [0x2066, 0x2069, 'direction isolate'],
  [0xfeff, 0xfeff, 'byte order mark or zero width no-break space']
]

function forbiddenKind(codePoint) {
  for (const [first, last, what] of FORBIDDEN) if (codePoint >= first && codePoint <= last) return what
  return null
}

const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

// Every forbidden character in a text: [{ line, column, codePoint, what }].
export function scanText(text) {
  const found = []
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    let column = 0
    for (const ch of line) {
      column++
      const what = forbiddenKind(ch.codePointAt(0))
      if (what) found.push({ line: i + 1, column, codePoint: ch.codePointAt(0), what })
    }
  })
  return found
}

test('the scanner finds every forbidden kind and leaves ordinary text alone', () => {
  const forbidden = [
    0x0000, 0x0007, 0x000b, 0x000c, 0x001f, 0x007f, 0x0085, 0x009f, 0x00ad, 0x180e,
    0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2014, 0x2028, 0x2029,
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2060, 0x2064, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff
  ]
  for (const cp of forbidden) {
    assert.equal(scanText(`a${String.fromCodePoint(cp)}b`).length, 1, hex(cp))
  }
  // Tab, CR and LF are fine, and so are ordinary non-ASCII characters:
  // curly quotes, en dash, ellipsis, accented letters, emoji, a variation selector.
  const allowed = [0x0009, 0x000d, 0x0020, 0x00e9, 0x2013, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0xfe0f, 0x1f600]
  for (const cp of allowed) assert.deepEqual(scanText(`a${String.fromCodePoint(cp)}b`), [], hex(cp))
  // Where it is: second line, third character.
  assert.deepEqual(scanText(`ok\nab${String.fromCodePoint(0x2014)}`), [{ line: 2, column: 3, codePoint: 0x2014, what: 'em dash' }])
})

test('no tracked text file has hidden or direction-changing characters, control characters or em dashes', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\0').filter(Boolean)
  assert.ok(files.length > 100, `git listed only ${files.length} files`)

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const problems = []
  let scanned = 0
  for (const file of files) {
    if (BINARY.test(file)) continue
    const full = path.join(root, file)
    if (!fs.existsSync(full)) continue // deleted in the working tree
    let text
    try {
      text = decoder.decode(fs.readFileSync(full))
    } catch {
      problems.push(`${file}: not valid UTF-8`)
      continue
    }
    scanned++
    for (const f of scanText(text)) problems.push(`${file}:${f.line}:${f.column} ${hex(f.codePoint)} ${f.what}`)
  }
  assert.ok(scanned > 100, `scanned only ${scanned} files`)
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`)
})
