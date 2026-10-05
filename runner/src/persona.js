import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { config } from './config.js'
import { newSafeContext } from './browser.js'
import { loadPage } from './load.js'
import { tabWalk } from './walk.js'
import { createTimings } from './timings.js'
import { WALK_PROFILES } from './walkProfiles.js'
import { detectorsFor } from './checks/index.js'
import { createEvidenceEngine, makeFinding, groupFindings } from './evidence.js'
import { measureCoverage } from './coverage.js'
import { showSyncMark, readPageCorner, deliverVideo } from './videoSync.js'
import { pauseNote } from './copy.js'
import {
  detectChallenge, detectModal, installOverlay, overlayKeyChip, overlayHideChip,
  applyProfiles, scrollStep, settle
} from './pageScripts.js'

const STOPPED_CHALLENGE = 'This page asked to confirm that a person is visiting, so we stopped there. We never try to get past these checks.'
const STOPPED_DIALOG = 'The page opened a browser message box as soon as it loaded, so we stopped there and left it untouched.'
const STOPPED_TIME = 'We reached the time limit for this run and kept what we had seen so far.'

// Runs one persona: a hidden measure pass, then the recorded pass that
// produces the video. Every exit path finalizes the session.
//
// Measure pass: no video, no overlay, no filter. Coverage is read, the Tab
// walk runs, and each live detector measures (at each stop through
// onStop, and once after the walk through measure). Their findings are
// only candidates.
//
// Recorded pass: the same walk on camera. A candidate is confirmed from
// this fresh state (same element at the same stop, plus the detector's own
// re-check, all before anything is drawn) and only then handed to the
// evidence engine. Candidates that do not reproduce go to the debug list.
//
// deps: { browser, sem, blockedHosts, store, progress, profilesSource, extraRoute, detectors }
// extraRoute(context) lets tests serve fixtures from a fake host, and
// `detectors` lets tests supply their own instead of the live registry.
export async function runPersona(job, s, deps) {
  const { browser, sem, blockedHosts, store, progress, profilesSource, extraRoute } = deps
  const label = `${s.persona.name} ${s.sessionId.slice(0, 8)}`
  const timings = createTimings(label)
  const deadline = Date.now() + config.personaCapMs
  const profileIds = s.profiles.map((p) => p.id)
  const walks = profileIds.some((id) => WALK_PROFILES.has(id))
  const detectors = deps.detectors ?? detectorsFor(profileIds)

  const coverage = {
    viewport: `${config.viewport.width}x${config.viewport.height}`,
    profilesSimulated: profileIds
  }
  const debug = { mismatches: [], dropped: [], detectorProblems: [] }
  const candidates = []
  let videoKey = null
  let durationSeconds = null
  let recordingOffsetMs = null
  let syncTimings = null
  let moments = []

  const session = await store.getSession(s.sessionId)
  await store.markRunning(s.sessionId)
  progress.phase(s.sessionId, 'queued')

  try {
    // The backend only accepts http and https; refuse anything else here too.
    const scheme = (() => { try { return new URL(job.url).protocol } catch { return '' } })()
    if (scheme !== 'http:' && scheme !== 'https:') {
      throw Object.assign(new Error('unsupported scheme'), { plain: 'We can only visit public web pages (http or https).' })
    }

    // ---------------------------------------------------- measure pass
    let measured = null
    await sem.acquire(`${label} measure`)
    timings.skip()
    let mContext
    try {
      mContext = await newSafeContext(browser, { blockedHosts })
      if (extraRoute) await extraRoute(mContext)
      const page = await mContext.newPage()
      timings.mark('measureLaunch')
      progress.phase(s.sessionId, 'opening')
      const loaded = await loadPage(page, job.url, { deadline })
      timings.mark('measureLoad')
      if (!loaded.ok) {
        // If the page cannot be opened once, do not pay for a second try
        // in the recorded pass: finalize now with the plain reason.
        coverage.stoppedReason = loaded.reason
        debug.loadFailure = loaded.detail || null
      } else {
        Object.assign(coverage, await measureCoverage(page))
        const ctx = { page, persona: s, profileIds }
        if (walks) {
          const walk = await tabWalk(page, {
            deadline,
            onStop: async (stop, n) => {
              for (const d of detectors) {
                if (!d.onStop) continue
                try {
                  for (const f of (await d.onStop({ ...ctx, stop, step: n })) || []) candidates.push(makeFinding({ ...f, step: n }))
                } catch (err) {
                  debug.detectorProblems.push({ detector: d.id, step: n, message: String(err?.message || err).slice(0, 300) })
                }
              }
            }
          })
          measured = walk.stops
          timings.mark('measureWalk')
        }
        for (const d of detectors) {
          if (!d.measure) continue
          try {
            for (const f of (await d.measure({ ...ctx, stops: measured })) || []) candidates.push(makeFinding(f))
          } catch (err) {
            debug.detectorProblems.push({ detector: d.id, message: String(err?.message || err).slice(0, 300) })
          }
        }
        timings.mark('measureDetect')
      }
    } finally {
      await mContext?.close().catch(() => {})
      sem.release(`${label} measure`)
    }

    // --------------------------------------------------- recorded pass
    if (coverage.stoppedReason) {
      // The measure pass could not open the page. Nothing to record.
    } else if (Date.now() >= deadline) {
      coverage.stoppedReason = STOPPED_TIME
    } else {
      const videoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lens-video-'))
      await sem.acquire(`${label} record`)
      timings.skip()
      let context
      let page
      let videoStart
      let videoEnd
      // Video time of "page ready" (loaded, filters on, overlay in place).
      // Everything before it is a blank or unfiltered page and is trimmed.
      let readyAt = null
      // The timing mark (see videoSync.js) and the page's corner before it.
      let mark = null
      let pageCorner = null
      let watchdog
      try {
        context = await newSafeContext(browser, { blockedHosts, recordVideoDir: videoDir })
        if (extraRoute) await extraRoute(context)
        // The video starts with the page, so this is video time zero.
        videoStart = Date.now()
        page = await context.newPage()
        timings.mark('launch')

        // Hard stop: close the context if anything below hangs past the cap.
        watchdog = setTimeout(() => {
          coverage.stoppedReason = STOPPED_TIME
          context.close().catch(() => {})
        }, Math.max(0, deadline - Date.now()) + 2000)

        // A native alert/confirm at load: never dismiss or accept it.
        let dialogSeen = false
        page.on('dialog', () => { dialogSeen = true })

        progress.phase(s.sessionId, 'opening')
        const loaded = await loadPage(page, job.url, { deadline })
        timings.mark('load')
        readyAt = Date.now()

        if (!loaded.ok) {
          coverage.stoppedReason = loaded.reason
          debug.loadFailure = loaded.detail || null
        } else if (dialogSeen) {
          coverage.stoppedReason = STOPPED_DIALOG
        } else if (await page.evaluate(detectChallenge).catch(() => null)) {
          coverage.stoppedReason = STOPPED_CHALLENGE
        } else {
          coverage.modalOpenAtLoad = await page.evaluate(detectModal).catch(() => false)

          // Filters only on camera, never in the measure pass.
          await page.evaluate(profilesSource)
          coverage.filtersApplied = await page.evaluate(applyProfiles, s.profiles)
          await page.evaluate(installOverlay)
          await page.evaluate(settle)
          // Video zero after trimming; every moment is stamped from here.
          readyAt = Date.now()
          pageCorner = await readPageCorner(browser, page)
          mark = await showSyncMark(page)

          const engine = createEvidenceEngine({
            page,
            readyAt,
            // The delivered video starts just after the mark.
            captionZeroAt: mark.off + 80,
            pauseNote: pauseNote(s.persona.name, s.profiles),
            onMoment: (m) => progress.moment(s.sessionId, m)
          })
          const byId = Object.fromEntries(detectors.map((d) => [d.id, d]))
          const groups = groupFindings(candidates)
          const atStep = new Map()
          const later = []
          for (const g of groups) {
            if (g.step != null && walks) {
              if (!atStep.has(g.step)) atStep.set(g.step, [])
              atStep.get(g.step).push(g)
            } else {
              later.push(g)
            }
          }

          // Confirm from this fresh state, before anything is drawn, then capture.
          const confirmAndCapture = async (group, stop) => {
            if (Date.now() >= deadline) return
            let reason = null
            if (stop && stop.selector !== group.selector) reason = 'not at the same stop'
            const d = byId[group.detector]
            if (!reason && d?.confirm) {
              // A detector may answer with a plain boolean or a promise.
              const ok = await Promise.resolve()
                .then(() => d.confirm({ page, finding: group, stop, persona: s }))
                .catch(() => false)
              if (!ok) reason = 'did not happen again'
            }
            if (!reason && !(await engine.capture(group))) reason = 'element no longer on the page'
            if (reason) debug.dropped.push({ detector: group.detector, selector: group.selector, step: group.step, reason })
          }

          let stopsSeen = 0
          if (walks) {
            progress.phase(s.sessionId, 'walking')
            const walk = await tabWalk(page, {
              deadline,
              paceMs: config.walk.recordedPaceMs,
              onStop: async (stop, n) => {
                stopsSeen = n
                // Confirm against the measure pass at the same position.
                const expected = measured?.[n - 1]
                if (!expected || expected.selector !== stop.selector || expected.name !== stop.name) {
                  debug.mismatches.push({ step: n, expected: expected?.selector ?? null, actual: stop.selector })
                }
                for (const g of atStep.get(n) || []) await confirmAndCapture(g, stop)
                await page.evaluate(overlayKeyChip, { label: 'Tab', count: n })
              }
            })
            coverage.stopsVisited = walk.stops.length
            coverage.walkEnded = walk.ended
            coverage.framesReached = walk.stops.filter((x) => x.kind === 'frame').length
            if (walk.ended === 'time') coverage.stoppedReason = STOPPED_TIME
            timings.mark('walk')
          } else {
            progress.phase(s.sessionId, 'looking')
            let steps = 0
            while (steps < 12 && Date.now() < deadline) {
              const atBottom = await page.evaluate(scrollStep, Math.round(config.viewport.height * 0.6))
              steps++
              await page.waitForTimeout(400)
              if (atBottom) break
            }
            coverage.scrollSteps = steps
            timings.mark('scroll')
          }

          // Steps the recorded walk never reached could not be confirmed.
          for (const [step, list] of atStep) {
            if (step > stopsSeen) for (const g of list) debug.dropped.push({ detector: g.detector, selector: g.selector, step, reason: 'the recorded walk did not reach this stop' })
          }
          // Page-level findings, after the walk or scroll.
          for (const g of later) await confirmAndCapture(g, null)
          moments = engine.moments
          if (moments.length) timings.mark('evidence')

          await page.evaluate(overlayHideChip).catch(() => {})
          await page.waitForTimeout(500) // a short still at the end of the video
        }
      } finally {
        clearTimeout(watchdog)
        await context?.close().catch(() => {}) // finalizes the video file
        videoEnd = Date.now()
        sem.release(`${label} record`)
      }

      // --------------------------------------------------------- upload
      progress.phase(s.sessionId, 'saving')
      // Wall time of a moment, mapped onto the delivered video once known.
      let toVideoMs = null
      const sessionStart = new Date(session.start_time).getTime()
      const videoPath = await page?.video()?.path().catch(() => null)
      if (videoPath) {
        const stat = await fs.stat(videoPath).catch(() => null)
        if (stat && stat.size > 0) {
          if (mark) {
            // Find the mark, correct the timing, and cut the video to start
            // just after it: no loading screen and no mark in what is shown.
            const delivered = await deliverVideo({ browser, rawPath: videoPath, videoStart, readyAt, mark, pageCorner })
            syncTimings = delivered.sync
            if (!delivered.sync.found) console.log(`[runner] ${label} timing mark not found; no correction applied`)
            else if (!delivered.sync.applied) console.log(`[runner] ${label} timing correction ${delivered.sync.measuredMs} ms is over the limit; not applied`)
            timings.mark('trim')
            videoKey = await store.putVideo(s.sessionId, delivered.file)
            durationSeconds = Math.max(1, Math.round(delivered.toVideoMs(videoEnd) / 1000))
            recordingOffsetMs = Math.max(0, delivered.zeroWallMs - sessionStart)
            toVideoMs = delivered.toVideoMs
          } else {
            // Stopped before the page was ready (no mark): keep the video whole.
            videoKey = await store.putVideo(s.sessionId, videoPath)
            durationSeconds = Math.max(1, Math.round((videoEnd - videoStart) / 1000))
            recordingOffsetMs = Math.max(0, videoStart - sessionStart)
          }
        }
      }
      await fs.rm(videoDir, { recursive: true, force: true }).catch(() => {})

      // Moments: pictures, then rows. The engine stamps moments from readyAt;
      // here they move onto the delivered video's own clock.
      for (const m of moments) {
        const base = `sessions/${s.sessionId}/moments/${String(m.number).padStart(2, '0')}`
        const shotKeys = {
          persona: m.shots.persona ? await store.putImage(`${base}-persona.jpg`, m.shots.persona) : null,
          clean: await store.putImage(`${base}-clean.jpg`, m.shots.clean),
          shot: await store.putImage(`${base}-shot.jpg`, m.shots.shot),
          closeup: m.shots.closeup ? await store.putImage(`${base}-closeup.jpg`, m.shots.closeup) : null
        }
        const wall = readyAt + m.videoMs
        const videoMs = toVideoMs ? Math.max(0, Math.round(toVideoMs(wall))) : m.videoMs
        await store.saveMoment(s.sessionId, { ...m, videoMs }, {
          // Session time, so timestamp_ms - recording_offset_ms is the video position.
          timestampMs: recordingOffsetMs !== null ? recordingOffsetMs + videoMs : Math.max(0, wall - sessionStart),
          shotKeys,
          profiles: s.profiles
        })
      }
      timings.mark('upload')
    }
  } catch (err) {
    console.error(`[runner] ${label} failed:`, err)
    coverage.stoppedReason = coverage.stoppedReason || err.plain || 'Something went wrong while visiting this page, so we stopped.'
    debug.error = String(err?.stack || err).slice(0, 2000)
  }

  const timingResult = timings.done()
  // How the video's timing was settled, kept with the timings so a missing
  // mark or an ignored correction is visible later.
  if (syncTimings) timingResult.sync = syncTimings
  await store.finalize(s.sessionId, {
    videoKey, durationSeconds, recordingOffsetMs, coverage, timings: timingResult, debug
  })
  progress.done(s.sessionId, { videoUrl: videoKey, stoppedReason: coverage.stoppedReason || null })
  return { sessionId: s.sessionId, videoKey, coverage, timings: timingResult, debug, moments }
}
