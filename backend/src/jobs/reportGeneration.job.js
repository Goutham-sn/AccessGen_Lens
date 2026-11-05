import puppeteer from 'puppeteer'
import { lookedAt, noMomentsText } from '../utils/lookedAt.js'
import { SIMULATION_INTRO, SNAPSHOT_NOTE, ranOnLine, UNVERIFIED_LABEL } from '../config/copy.js'
import { Session } from '../models/Session.js'
import { EmpathyMoment } from '../models/EmpathyMoment.js'
import { getObjectBuffer, putBuffer } from '../utils/storage.js'
import { durationText, isAutoMoment } from '../utils/duration.js'

// Everything shown in the PDF that came from a page or a person (titles,
// names, moment text) goes through this, so it is text, never markup.
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
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
  const cover = await imageDataUrl(session.page_thumbnail)
  const images = {}
  for (const m of moments) images[m.id] = await imageDataUrl(m.screenshot_url)

  const { pdf } = await renderPdf(buildReportHtml({ session, moments, cover, images }))
  await putBuffer(`sessions/${sessionId}/report.pdf`, Buffer.from(pdf), 'application/pdf')
  console.log(`[report] PDF generated for session ${sessionId}`)
}

// The report's HTML. Pictures are data: URLs, so the page needs nothing
// from the network. images: { [momentId]: dataUrl }.
// What a run looked at and could not look at, above the moments.
function lookedAtHtml(looked) {
  if (!looked) return ''
  const list = (items) => `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
  const u = looked.unverified
  return `<h2>What we looked at</h2>${looked.noItems ? `<p>${esc(looked.noItems)}</p>` : list(looked.items)}` +
    (u ? `<p><span class="unverified">${esc(u.label)}</span> ${u.moments} ${u.moments === 1 ? 'moment' : 'moments'} from these checks.</p>${list(u.items)}` : '') +
    (looked.gaps.length ? `<h2>What we could not look at</h2>${list(looked.gaps)}` : '')
}

export function buildReportHtml({ session, moments, cover = null, images = {} }) {
  const looked = lookedAt(session, moments.length)
  const persona = session.persona_snapshot
  const who = persona?.name || 'A visitor'
  const duration = durationText(session.duration_seconds)
  const noticed = moments.filter(isAutoMoment).length
  const profiles = (session.active_profiles || []).map((p) => p.name || p.id)

  const momentCards = moments.map((m) => {
    const img = images[m.id] && String(images[m.id]).startsWith('data:image/') ? images[m.id] : null
    const t = Math.floor(m.timestamp_ms / 1000)
    return `
      <div class="moment">
        ${img ? `<img src="${img}" alt="" />` : ''}
        <div class="moment-body">
          <p class="moment-time">${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} into the session</p>
          ${m.unverified ? `<p><span class="unverified">${esc(UNVERIFIED_LABEL)}</span></p>` : ''}
          ${isAutoMoment(m) ? '<p><span class="auto">Noticed by the simulation</span></p>' : ''}
          <h3>${isAutoMoment(m) ? esc(m.label) : `"${esc(m.label)}"`}</h3>
          ${m.note ? `<p class="${isAutoMoment(m) ? 'detail' : 'note'}">${esc(m.note)}</p>` : ''}
        </div>
      </div>`
  })

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
    .snapshot { font-size: 14px; color: #475467; }
    .unverified { display: inline-block; border: 1px solid #b54708; background: #fffaeb; color: #93370d;
                  border-radius: 6px; padding: 1px 8px; font-size: 13px; font-weight: bold; }
    .auto { display: inline-block; background: #fef3c7; color: #78350f; border-radius: 6px; padding: 1px 8px; font-size: 12px; font-weight: bold; }
    .detail { color: #475467; }
    .intro { font-size: 16px; background: #f2f4f7; border-radius: 12px; padding: 16px 20px; }
  </style></head><body>
    <div class="page cover">
      <h1>${esc(who)}'s experience of ${esc(session.page_title || session.url)}</h1>
      <p class="meta">${esc(session.url)} · ${esc(new Date(session.start_time).toLocaleDateString())} · ${esc(duration)}</p>
      <div>${profiles.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div>
      ${cover && String(cover).startsWith('data:image/') ? `<img src="${cover}" alt="" />` : ''}
    </div>
    <div class="page">
      <p class="intro">${esc(SIMULATION_INTRO)}</p>
      <p class="snapshot">${esc(ranOnLine(session.start_time))} ${esc(SNAPSHOT_NOTE)}</p>
      <h2>The experience in numbers</h2>
      <div class="numbers">
        <div class="num"><span class="big">${esc(duration)}</span>time spent</div>
        <div class="num"><span class="big">${moments.length - noticed}</span>moments felt</div>
        <div class="num"><span class="big">${noticed}</span>struggles noticed</div>
        <div class="num"><span class="big">${session.event_count || 0}</span>interactions needed</div>
      </div>
      ${persona?.story ? `<p>${esc(persona.story)}</p>` : ''}
      ${lookedAtHtml(looked)}
      <h2>Where the experience broke down</h2>
      ${momentCards.join('') || `<p>${esc(noMomentsText(session, 0) || '')}</p>`}
      <h2>What this means</h2>
      <p>None of this is about compliance. It is about whether ${esc(who)} can do what they came to do.
      Each moment above is a place where a real person would slow down, get lost, or give up entirely.</p>
    </div>
  </body></html>`
  return html
}

// Prints HTML to PDF with JavaScript off and the network blocked: only the
// embedded data: pictures load. Returns the PDF and any request that was
// refused, so tests can see nothing got out.
export async function renderPdf(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })
  const blocked = []
  try {
    const page = await browser.newPage()
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const url = req.url()
      if (url.startsWith('data:') || url === 'about:blank') req.continue()
      else { blocked.push(url); req.abort('blockedbyclient') }
    })
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    return { pdf, blocked }
  } finally {
    await browser.close()
  }
}
