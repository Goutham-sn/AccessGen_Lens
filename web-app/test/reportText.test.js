// Text from a page (a button's name, a page title) reaches the web report as
// plain text, never as markup:  npm test  (in web-app)
// The report components are rendered to HTML on the server through Vite, the
// same JSX the browser runs.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const EVIL = '<img src=x onerror=alert(1)>'
const ESCAPED = '&lt;img src=x onerror=alert(1)&gt;'

let vite
const render = (el) => renderToStaticMarkup(React.createElement(...el))
before(async () => {
  vite = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
})
after(async () => { await vite?.close() })

const session = {
  url: 'https://example.com/',
  page_title: `Shop ${EVIL}`,
  start_time: '2026-10-05T10:00:00Z',
  duration_seconds: 30,
  active_profiles: [{ id: 'keyboard-only', name: 'Keyboard Only' }],
  persona_snapshot: { name: 'David' }
}
const moments = [{
  id: 'm1',
  timestamp_ms: 4000,
  label: `David would press Tab and see no sign of where it went (${EVIL}).`,
  note: `After Tab moved to “${EVIL}” (button), stop 3, nothing within 24 px of it changed on screen.`,
  active_profiles: []
}]

function assertPlainText(html, where) {
  assert.ok(!html.includes('<img src=x'), `${where}: no raw tag from the page`)
  assert.ok(html.includes(ESCAPED), `${where}: the name is shown as text`)
}

test('moments list shows a button name as plain text', async () => {
  const { EmpathyMoments } = await vite.ssrLoadModule('/src/components/report/EmpathyMoments.jsx')
  assertPlainText(render([EmpathyMoments, { empathyMoments: moments, personaName: 'David' }]), 'EmpathyMoments')
})

test('report cover shows a page title as plain text', async () => {
  const { ReportCover } = await vite.ssrLoadModule('/src/components/report/ReportCover.jsx')
  assertPlainText(render([ReportCover, { session, empathyMoments: moments }]), 'ReportCover')
})

test('playback sidebar shows a button name as plain text', async () => {
  const { EmpathySidebar } = await vite.ssrLoadModule('/src/components/playback/EmpathySidebar.jsx')
  const html = render([EmpathySidebar, {
    empathyMoments: moments, onJump: () => {}, currentTime: 0, sessionMsToVideoSeconds: (ms) => ms / 1000
  }])
  assertPlainText(html, 'EmpathySidebar')
})
