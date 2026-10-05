import { stick } from './measuringStick.js'
import { overlayCall, locateAndDescribe, settle } from './pageScripts.js'
import { cleanPageText } from './copy.js'

// The evidence engine. Every detector hands its findings to this one module,
// so every moment is captured the same way:
//   1. scroll the element into view and read its rect
//   1b. persona-view screenshot: the page as the persona sees it, filter on
//   2. clean viewport screenshot (overlay hidden, persona filter paused)
//   3. draw the highlight: magenta ring with white strokes, numbered label
//   4. highlighted screenshot and a close-up (element plus padding)
//   5. caption lower third in the video, for the first few moments only,
//      with a note that the persona's filter is paused while it shows
//   6. remove the overlay, put the key chip and the filter back
// Measuring always happens before this is called; the overlay never exists
// while anything is measured.

export function formatVideoTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const REQUIRED = ['detector', 'profile', 'headline', 'fact', 'forTeam', 'selector']

// The one shape every finding has. Detectors fill in the measured facts;
// the engine adds what happened on camera.
export function makeFinding(raw) {
  const missing = REQUIRED.filter((k) => !raw?.[k])
  if (missing.length) throw new Error(`finding from ${raw?.detector || 'unknown detector'} is missing ${missing.join(', ')}`)
  return {
    tier: 'observed',
    step: null,
    evidence: {},
    patternKey: null,
    internalRef: null,
    ...raw
  }
}

// Repeated findings of the same kind become one moment with a count and a
// few examples (for example 40 icon buttons with no name).
export function groupFindings(findings) {
  const groups = new Map()
  for (const f of findings) {
    const key = `${f.detector}|${f.patternKey ?? f.selector}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(f)
  }
  return [...groups.values()].map((list) => {
    list.sort((a, b) => (a.step ?? Infinity) - (b.step ?? Infinity))
    return {
      ...list[0],
      pattern: {
        count: list.length,
        examples: list.slice(0, stick('evidence', 'maxExamples')).map((f) => ({
          selector: f.selector, step: f.step, evidence: f.evidence
        }))
      }
    }
  })
}

function clampClip(rect, pad, vp) {
  const x = Math.max(0, Math.floor(rect.x - pad))
  const y = Math.max(0, Math.floor(rect.y - pad))
  const right = Math.min(vp.width, Math.ceil(rect.x + rect.width + pad))
  const bottom = Math.min(vp.height, Math.ceil(rect.y + rect.height + pad))
  if (right - x < 2 || bottom - y < 2) return null
  return { x, y, width: right - x, height: bottom - y }
}

const call = (page, method, ...args) => page.evaluate(overlayCall, { method, args })

// One engine per recorded pass. videoMs counts from `readyAt`; the persona
// flow maps it onto the delivered video (see videoSync.js). `pauseNote` is
// the caption line shown while the filter is paused, for example "Showing
// the page without David's red-green colour blindness so it is readable."
// `captionZeroAt` is the wall time the delivered video will start (just
// after the timing mark), so the caption's clock matches the player's to
// within a frame or two; the exact mapping for markers is done afterwards.
export function createEvidenceEngine({ page, readyAt, captionZeroAt = readyAt, now = Date.now, onMoment, pauseNote = null }) {
  let holds = 0
  let number = 0
  const moments = []

  async function capture(finding) {
    // 1. Where it is, before anything is drawn.
    const element = await page.evaluate(locateAndDescribe, finding.selector)
    if (!element) return null
    await page.evaluate(settle)

    // 1b. The persona's view, before the filter is paused (only when a
    // filter is on; otherwise it would be the same as the clean shot).
    await call(page, 'hideAll')
    const filtered = await page.evaluate(() => document.documentElement.style.filter !== '')
    let persona = null
    if (filtered) {
      await page.evaluate(settle)
      persona = await page.screenshot({ type: 'jpeg', quality: 80 })
    }

    // 2. Clean shot.
    await call(page, 'pauseFilter')
    await page.evaluate(settle)
    const clean = await page.screenshot({ type: 'jpeg', quality: 80 })

    // 3. Highlight.
    number++
    const vp = element.viewport
    const area = element.rect.width * element.rect.height
    const large = area > stick('evidence', 'largeElementShare') * vp.width * vp.height
    const drawn = await call(page, 'highlight', { rect: element.rect, number, large })
    await page.evaluate(settle)
    const videoMs = Math.max(0, now() - readyAt)

    // 4. Highlighted shot and close-up.
    const shot = await page.screenshot({ type: 'jpeg', quality: 80 })
    const clip = clampClip(element.rect, stick('evidence', 'closeupPaddingPx'), vp)
    const closeup = clip ? await page.screenshot({ type: 'jpeg', quality: 85, clip }) : null

    // 5. Caption and hold, for the first few moments only.
    const held = holds < stick('evidence', 'maxHolds')
    if (held) {
      holds++
      await call(page, 'caption', finding.headline, formatVideoTime(now() - captionZeroAt), filtered ? pauseNote : null)
      await page.waitForTimeout(stick('evidence', 'holdMs'))
    }

    // 6. Clean up.
    await call(page, 'clearMoment')
    await call(page, 'restoreChip')
    await call(page, 'resumeFilter')

    const moment = {
      ...finding,
      number,
      videoMs,
      held,
      large,
      confirmed: true,
      // Page-derived text is cleaned and capped before it is stored. The html
      // is kept as evidence only; it is never rendered as markup anywhere.
      element: {
        selector: element.selector,
        role: cleanPageText(element.role),
        name: cleanPageText(element.name),
        rect: element.rect,
        html: element.html
      },
      overlay: drawn,
      closeupClip: clip,
      pauseNote: filtered ? pauseNote : null,
      shots: { persona, clean, shot, closeup }
    }
    moments.push(moment)
    onMoment?.(moment)
    return moment
  }

  return {
    capture,
    moments,
    get holds() { return holds }
  }
}
