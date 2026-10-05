import puppeteer from 'puppeteer'
import { SIMULATION_INTRO } from '../config/copy.js'
import { Session } from '../models/Session.js'
import { EmpathyMoment } from '../models/EmpathyMoment.js'
import { getObjectBuffer, putBuffer } from '../utils/storage.js'

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function imageDataUrl(key) {
  if (!key) return null
  const buf = await getObjectBuffer(key).catch(() => null)
  return buf ? `data:image/jpeg;base64,${buf.toString('base64')}` : null
}

// Renders a warm, human, non-technical PDF empathy report via Puppeteer.
export async function processReportGeneration(sessionId) {
  const session = await Session.findById(sessionId)
  if (!session) return
  const moments = await EmpathyMoment.findBySession(sessionId)

  const persona = session.persona_snapshot
  const who = persona?.name || 'A visitor'
  const minutes = Math.max(1, Math.round((session.duration_seconds || 0) / 60))
  const profiles = (session.active_profiles || []).map((p) => p.name || p.id)
  const cover = await imageDataUrl(session.page_thumbnail)

  const momentCards = await Promise.all(moments.map(async (m) => {
    const img = await imageDataUrl(m.screenshot_url)
    const t = Math.floor(m.timestamp_ms / 1000)
    return `
      <div class="moment">
        ${img ? `<img src="${img}" alt="" />` : ''}
        <div class="moment-body">
          <p class="moment-time">${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} into the session</p>
          <h3>"${esc(m.label)}"</h3>
          ${m.note ? `<p class="note">${esc(m.note)}</p>` : ''}
        </div>
      </div>`
  }))

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a2e; margin: 0; }
    .page { padding: 60px 70px; }
    .cover { background: #101828; color: #fff; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
    .cover h1 { font-size: 42px; line-height: 1.2; margin: 0 0 16px; }
    .cover .meta { color: #98a2b3; font-size: 15px; }
    .cover img { max-width: 100%; border-radius: 12px; margin-top: 32px; opacity: .9; }
    .chip { display: inline-block; background: #1d2939; border: 1px solid #344054; color: #d0d5dd;
            border-radius: 999px; padding: 4px 14px; margin: 4px 6px 4px 0; font-size: 13px; }
    h2 { font-size: 26px; margin: 40px 0 12px; }
    p { font-size: 15px; line-height: 1.7; }
    .numbers { display: flex; gap: 24px; margin: 24px 0; }
    .num { flex: 1; background: #f2f4f7; border-radius: 12px; padding: 20px; text-align: center; }
    .num .big { font-size: 34px; font-weight: bold; display: block; }
    .moment { display: flex; gap: 20px; border: 1px solid #eaecf0; border-radius: 12px; padding: 18px; margin: 14px 0; page-break-inside: avoid; }
    .moment img { width: 260px; height: auto; border-radius: 8px; object-fit: cover; }
    .moment h3 { margin: 4px 0 8px; font-size: 18px; }
    .moment-time { color: #667085; font-size: 12px; margin: 0; }
    .note { font-style: italic; color: #475467; }
    .intro { font-size: 16px; background: #f2f4f7; border-radius: 12px; padding: 16px 20px; }
  </style></head><body>
    <div class="page cover">
      <h1>${esc(who)}'s experience of ${esc(session.page_title || session.url)}</h1>
      <p class="meta">${esc(session.url)} · ${new Date(session.start_time).toLocaleDateString()} · ${minutes} minute${minutes === 1 ? '' : 's'}</p>
      <div>${profiles.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div>
      ${cover ? `<img src="${cover}" alt="" />` : ''}
    </div>
    <div class="page">
      <p class="intro">${esc(SIMULATION_INTRO)}</p>
      <h2>The experience in numbers</h2>
      <div class="numbers">
        <div class="num"><span class="big">${minutes}m</span>time spent</div>
        <div class="num"><span class="big">${moments.length}</span>moments of struggle</div>
        <div class="num"><span class="big">${session.event_count || 0}</span>interactions needed</div>
      </div>
      ${persona?.story ? `<p>${esc(persona.story)}</p>` : ''}
      <h2>Where the experience broke down</h2>
      ${momentCards.join('') || '<p>No breakdown moments were flagged during this session.</p>'}
      <h2>What this means</h2>
      <p>None of this is about compliance. It is about whether ${esc(who)} can do what they came to do.
      Each moment above is a place where a real person would slow down, get lost, or give up entirely.</p>
    </div>
  </body></html>`

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    await putBuffer(`sessions/${sessionId}/report.pdf`, Buffer.from(pdf), 'application/pdf')
    console.log(`[report] PDF generated for session ${sessionId}`)
  } finally {
    await browser.close()
  }
}
