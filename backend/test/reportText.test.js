// Text from a page (a button's name, a page title) is shown as text in the
// PDF, never run or loaded as markup:
//   docker compose exec backend node --test test/reportText.test.js
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { buildReportHtml, renderPdf, esc } from '../src/jobs/reportGeneration.job.js'
import { closeAppPool } from './cleanup.js'

const EVIL = '<img src=x onerror=alert(1)>'

after(async () => { await closeAppPool() })

async function pdfText(pdf) {
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => it.str).join('') + '\n'
  }
  return text
}

const session = {
  url: 'https://example.com/',
  page_title: `Shop ${EVIL}`,
  start_time: new Date().toISOString(),
  duration_seconds: 30,
  active_profiles: [{ id: 'keyboard-only', name: 'Keyboard Only' }],
  persona_snapshot: { name: 'David', story: 'A story.' }
}
const moments = [{
  id: 'm1',
  timestamp_ms: 4000,
  label: `David would press Tab and see no sign of where it went (${EVIL}).`,
  note: `After Tab moved to “${EVIL}” (button), stop 3, nothing within 24 px of it changed on screen.`
}]

test('esc turns every markup character into text', () => {
  assert.equal(esc(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
})

test('the report HTML carries a button name as escaped text, never as an element', () => {
  const html = buildReportHtml({ session, moments })
  assert.ok(!html.includes('<img src=x'), 'no raw tag from the page')
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'escaped instead')
})

test('the PDF shows the button name as plain text', async () => {
  const { pdf, blocked } = await renderPdf(buildReportHtml({ session, moments }))
  const text = await pdfText(pdf)
  assert.ok(text.includes(EVIL), `the literal name is in the PDF text: ${text.slice(0, 400)}`)
  assert.deepEqual(blocked, [], 'the report itself asks for nothing from the network')
})

test('the PDF browser runs no JavaScript', async () => {
  const html = '<!doctype html><html><body><p id="t">static text</p>' +
    "<script>document.getElementById('t').textContent = 'script ran'</script></body></html>"
  const text = await pdfText((await renderPdf(html)).pdf)
  assert.ok(text.includes('static text'))
  assert.ok(!text.includes('script ran'))
})

test('the PDF browser loads nothing from the network', async () => {
  const html = '<!doctype html><html><head><link rel="stylesheet" href="https://example.com/s.css"></head>' +
    '<body><img src="http://example.com/a.png" alt=""><p>page</p></body></html>'
  const { blocked } = await renderPdf(html)
  assert.ok(blocked.includes('https://example.com/s.css'), `stylesheet refused: ${blocked}`)
  assert.ok(blocked.includes('http://example.com/a.png'), `image refused: ${blocked}`)
})
