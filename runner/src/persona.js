import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { config } from './config.js'
import { newSafeContext } from './browser.js'
import { loadPage } from './load.js'
import { tabWalk } from './walk.js'
import { createTimings } from './timings.js'
import { trimStart } from './trim.js'
import {
  detectChallenge, detectModal, installOverlay, overlayKeyChip, overlayHideChip,
  applyProfiles, scrollStep, settle
} from './pageScripts.js'

const STOPPED_CHALLENGE = 'This page asked to confirm that a person is visiting, so we stopped there. We never try to get past these checks.'
const STOPPED_DIALOG = 'The page opened a browser message box as soon as it loaded, so we stopped there and left it untouched.'
const STOPPED_TIME = 'We reached the time limit for this run and kept what we had seen so far.'

const WALK_PROFILES = new Set(['keyboard-only', 'screen-reader'])

// Runs one persona: a hidden measure pass, then the recorded pass that
// produces the video. Every exit path finalizes the session.
//
// deps: { browser, sem, blockedHosts, store, progress, profilesSource, extraRoute }
// extraRoute(context) lets tests serve fixtures from a fake host before the
// request ever reaches the network.
export async function runPersona(job, s, deps) {
  const { browser, sem, blockedHosts, store, progress, profilesSource, extraRoute } = deps
  const label = `${s.persona.name} ${s.sessionId.slice(0, 8)}`
  const timings = createTimings(label)
  const deadline = Date.now() + config.personaCapMs
  const profileIds = s.profiles.map((p) => p.id)
  const walks = profileIds.some((id) => WALK_PROFILES.has(id))

  const coverage = {
    viewport: `${config.viewport.width}x${config.viewport.height}`,
    profilesSimulated: profileIds
  }
  const debug = { mismatches: [] }
  let videoKey = null
  let durationSeconds = null
  let recordingOffsetMs = null

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
    // Hidden, no video, no overlays, no filters. Later phases run the
    // detectors here; for now it records the tab order to confirm against.
    let measured = null
    if (walks) {
      await sem.acquire(`${label} measure`)
      timings.skip()
      let context
      try {
        context = await newSafeContext(browser, { blockedHosts })
        if (extraRoute) await extraRoute(context)
        const page = await context.newPage()
        timings.mark('measureLaunch')
        progress.phase(s.sessionId, 'opening')
        const loaded = await loadPage(page, job.url, { deadline })
        timings.mark('measureLoad')
        if (loaded.ok) {
          const walk = await tabWalk(page, { deadline })
          measured = walk.stops
          timings.mark('measureWalk')
        } else {
          // If the page cannot be opened once, do not pay for a second try
          // in the recorded pass: finalize now with the plain reason.
          coverage.stoppedReason = loaded.reason
          debug.loadFailure = loaded.detail || null
        }
      } finally {
        await context?.close().catch(() => {})
        sem.release(`${label} measure`)
      }
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
          // Video zero after trimming. Later phases stamp moments with
          // videoMs = Date.now() - readyAt so markers line up.
          readyAt = Date.now()

          if (walks) {
            progress.phase(s.sessionId, 'walking')
            const walk = await tabWalk(page, {
              deadline,
              paceMs: config.walk.recordedPaceMs,
              onStop: async (stop, n) => {
                // Confirm against the measure pass at the same position.
                const expected = measured?.[n - 1]
                if (!expected || expected.selector !== stop.selector || expected.name !== stop.name) {
                  debug.mismatches.push({ step: n, expected: expected?.selector ?? null, actual: stop.selector })
                }
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
      const videoPath = await page?.video()?.path().catch(() => null)
      if (videoPath) {
        const stat = await fs.stat(videoPath).catch(() => null)
        if (stat && stat.size > 0) {
          // Cut the loading seconds so the video opens on the ready page.
          let trimMs = readyAt ? Math.max(0, readyAt - videoStart) : 0
          let uploadPath = videoPath
          if (trimMs > 300) {
            const trimmed = await trimStart(videoPath, trimMs).catch((err) => {
              debug.trimError = String(err?.message || err).slice(0, 300)
              return null
            })
            if (trimmed) uploadPath = trimmed
            else trimMs = 0
          } else {
            trimMs = 0
          }
          debug.trimmedMs = trimMs
          timings.mark('trim')

          videoKey = await store.putVideo(s.sessionId, uploadPath)
          durationSeconds = Math.max(1, Math.round((videoEnd - videoStart - trimMs) / 1000))
          // Session time at which the (trimmed) video starts, so
          // timestamp_ms - recording_offset_ms is the position in the video.
          recordingOffsetMs = Math.max(0, videoStart + trimMs - new Date(session.start_time).getTime())
        }
      }
      await fs.rm(videoDir, { recursive: true, force: true }).catch(() => {})
      timings.mark('upload')
    }
  } catch (err) {
    console.error(`[runner] ${label} failed:`, err)
    coverage.stoppedReason = coverage.stoppedReason || err.plain || 'Something went wrong while visiting this page, so we stopped.'
    debug.error = String(err?.stack || err).slice(0, 2000)
  }

  const timingResult = timings.done()
  await store.finalize(s.sessionId, {
    videoKey, durationSeconds, recordingOffsetMs, coverage, timings: timingResult, debug
  })
  progress.done(s.sessionId, { videoUrl: videoKey, stoppedReason: coverage.stoppedReason || null })
  return { sessionId: s.sessionId, videoKey, coverage, timings: timingResult, debug }
}
