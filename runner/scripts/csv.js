// CSV for the validation folders: written by validate-keyboard.js, read
// back by regenerate-howto.js.

// UTF-8 with a byte order mark, so spreadsheet apps show quotes and
// accented names as written.
export const BOM = String.fromCharCode(0xFEFF)

// A CSV cell: quoted, quotes doubled, and never read as a formula by a
// spreadsheet (page text could start with =, +, - or @).
export const cell = (v) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
export const row = (cells) => cells.map(cell).join(',')

// Rows of cells from CSV text as written above (every cell quoted, rows
// separated by newlines, a leading byte order mark allowed). Cells come
// back exactly as stored, so a formula guard stays in place.
export function parseCsv(text) {
  const src = text.startsWith(BOM) ? text.slice(1) : text
  const rows = []
  let cells = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { cells.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      cells.push(cur)
      rows.push(cells)
      cells = []
      cur = ''
    } else cur += ch
  }
  if (cur !== '' || cells.length) { cells.push(cur); rows.push(cells) }
  return rows
}
