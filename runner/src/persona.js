import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { config } from './config.js'
import { newSafeContext } from './browser.js'
import { loadPage, STILL_CHANGING } from './load.js'
import { tabWalk } from './walk.js'
import { taskWalk, readTask } from './task.js'
import { createTimings } from './timings.js'
import { WALK_PROFILES } from './walkProfiles.js'
import { detectorsFor } from './checks/index.js'
import { createEvidenceEngine, groupFindings, makeFinding } from './evidence.js'
import { measureCoverage } from './coverage.js'
import { measurePass } from './measure.js'
import { sampleBrowserMemory, hostSnapshot } from './memory.js'
import { checkStatus } from '../../backend/src/config/runnerCapabilities.js'
import { showSyncMark, readPageCorner, deliverVideo } from './videoSync.js'
import { pauseNote, coverageLines, taskNotFoundCopy } from './copy.js'
import { stick } from './measuringStick.js'
import { checkBotWall } from './botWall.js'
import {
  detectModal, installOverlay, overlayKeyChip, overlayHideChip,
  applyProfiles, setConditionAnchor, scrollStep, settle
} from './pageScripts.js'

const STOPPED_CHALLENGE = 'This page asked to confirm that a person is visiting, so we stopped there. We never try to get past these checks.'
const STOPPED_DIALOG = 'The page opened a browser message box as soon as it loaded, so we stopped there and left it untouched.'
const STOPPED_DIALOG_TASK = 'The page opened a browser message box after we pressed Enter, so we stopped there and left it untouched.'
const STOPPED_TIME = 'We reached the time limit for this run and kept what we had seen so far.'

// Streams a picture of the page to the Run page about once a second, so
// people watch their own site being used instead of a status line.
function startFrames(page, sessionId, progress, pass) {
  let busy = false
  let stopped = false
  const timer = setInterval(async () => {
    if (busy || stopped || page.isClosed()) return
    busy = true
    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 45, timeout: 2000 })
      if (!stopped) progress.frame?.(sessionId, buf.toString('base64'), pass)
    } catch { /* page navigating or closing */ } finally { busy = false }
  }, 1200)
  return () => { stopped = true; clearInterval(timer) }
}

// "link 'Pricing'", "button with no name", for the live log.
function describeStop(stop) {
  if (!stop || stop.kind === 'body') return 'the page itself (nothing has focus)'
  const what = stop.role || stop.tag || 'element'
  return stop.name ? `${what} "${String(stop.name).slice(0, 60)}"` : `${what} with no name`
}

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
// Task Mode (job.mode === 'task', job.task = { goal, intents }): the same two
// passes, but the walk is taskWalk (task.js) and no detector runs. The measure
// pass runs the task with nothing drawn and produces the structured failure
// as a candidate. The recorded pass runs it again on camera; a failure is
// confirmed only when it happens again at the same intent for the same reason
// (otherwise it goes to debug.dropped), and then becomes a moment and, after
// the moment is saved, a task_failures row linked to it. A failure that is the
// run's own time limit gets the row but no moment. Enter is pressed in both
// passes, so both stop at a bot wall or a browser message box first.
//
// deps: { browser, sem, blockedHosts, store, progress, profilesSource, extraRoute, detectors }
// extraRoute(context) lets tests serve fixtures from a fake host, and
// `detectors` lets tests supply their own instead of the live registry.
export async function runPersona(job, s, deps) {
  const { browser, sem, blockedHosts, store, progress, profilesSource, extraRoute } = deps
  const label = `${s.persona.name} ${s.sessionId.slice(0, 8)}`
  const timings = createTimings(label)
  // Peak browser memory for run_timings. The browser is shared, so with more
  // than one live context this includes the other personas running alongside.
  const memory = sampleBrowserMemory()
  // How loaded the machine was when this run began (free memory, load average).
  const hostAtStart = hostSnapshot()
  const deadline = Date.now() + config.personaCapMs
  const profileIds = s.profiles.map((p) => p.id)
  const taskMode = job.mode === 'task'
  // Task Mode walks with Tab whoever the persona is (tunnel vision has no
  // walk of its own), and runs no detectors: there is nothing to audit.
  const walks = taskMode || profileIds.some((id) => WALK_PROFILES.has(id))
  const detectors = taskMode ? [] : (deps.detectors ?? detectorsFor(profileIds))

  const coverage = {
    viewport: `${config.viewport.width}x${config.viewport.height}`,
    profilesSimulated: profileIds
  }
  // Checks that run only because the dev-only unverified mode is on. Their
  // moments are labelled wherever they are shown; coverage says so too.
  const unverifiedChecks = detectors.filter((d) => checkStatus(d.id) === 'unverified').map((d) => d.id)
  if (unverifiedChecks.length) coverage.unverifiedChecks = unverifiedChecks
  const debug = { mismatches: [], dropped: [], detectorProblems: [] }
  const candidates = []
  let videoKey = null
  let durationSeconds = null
  let recordingOffsetMs = null
  let syncTimings = null
  let moments = []
  let task = null
  let taskMeasured = null // taskWalk result of the measure pass
  let taskFailure = null // the structured failure, once confirmed (or the time limit)
  let taskFailureMoment = null // number of the moment made for it
  const momentIds = new Map() // moment number -> row id

  const session = await store.getSession(s.sessionId)
  await store.markRunning(s.sessionId)
  progress.phase(s.sessionId, 'queued')

  try {
    // The backend only accepts http and https; refuse anything else here too.
    const scheme = (() => { try { return new URL(job.url).protocol } catch { return '' } })()
    if (scheme !== 'http:' && scheme !== 'https:') {
      throw Object.assign(new Error('unsupported scheme'), { plain: 'We can only visit public web pages (http or https).' })
    }

    if (taskMode) {
      task = readTask(job.task)
      coverage.task = { intents: task.intents.length, reached: 0, ended: null }
    }

    // ---------------------------------------------------- measure pass
    let measured = null
    await sem.acquire(`${label} measure`)
    timings.skip()
    let mContext
    let measureWatchdog
    try {
      mContext = await newSafeContext(browser, { blockedHosts })
      if (extraRoute) await extraRoute(mContext)
      const page = await mContext.newPage()
      timings.mark('measureLaunch')
      const stopMeasureFrames = startFrames(page, s.sessionId, progress, 'measure')
      mContext.on('close', stopMeasureFrames)
      // Task Mode presses Enter in this pass, so a message box that opens
      // stops it, left untouched. Before the walk starts nothing is listening,
      // as in every measure pass, and the browser dismisses it.
      let measureArmed = false
      let measureDialog = false
      if (taskMode) {
        page.on('dialog', (dialog) => {
          if (!measureArmed) { dialog.dismiss().catch(() => {}); return }
          measureDialog = true
          mContext.close().catch(() => {})
        })
        measureWatchdog = setTimeout(() => mContext.close().catch(() => {}), Math.max(0, deadline - Date.now()) + 2000)
      }
      progress.phase(s.sessionId, 'opening')
      progress.log?.(s.sessionId, `Opening ${job.url} as ${s.persona.name}`)
      const loaded = await loadPage(page, job.url, { deadline })
      timings.mark('measureLoad')
      if (loaded.ok) progress.log?.(s.sessionId, 'The page loaded. Reading it the way the person would.')
      if (!loaded.ok) {
        // If the page cannot be opened once, do not pay for a second try
        // in the recorded pass: finalize now with the plain reason.
        coverage.stoppedReason = loaded.reason
        debug.loadFailure = loaded.detail || null
      } else {
        Object.assign(coverage, await measureCoverage(page))
        if (taskMode) {
          // Never press anything on a page that is checking for a person.
          const wall = await checkBotWall(page, loaded.status)
          if (wall.evidence) debug.botWall = wall.evidence
          if (wall.wall) {
            coverage.stoppedReason = STOPPED_CHALLENGE
          } else {
            measureArmed = true
            try {
              taskMeasured = await taskWalk(page, { intents: task.intents, profileIds, deadline })
            } catch (err) {
              if (!measureDialog) throw err
              coverage.stoppedReason = STOPPED_DIALOG_TASK
            }
          }
          timings.mark('measureWalk')
          measured = taskMeasured?.stops ?? null
          coverage.notes = [
            ...(loaded.changing ? [STILL_CHANGING] : []),
            ...(coverage.closedShadowRoots ? [coverageLines.closedSections(coverage.closedShadowRoots)] : [])
          ]
          if (taskMeasured?.failure?.reason === 'budget-time') {
            // Our limit, not the persona's: the row is kept, a moment is not made.
            coverage.walkIncomplete = true
            coverage.notes.push(coverageLines.taskOutOfTime(taskMeasured.failure.intent))
            taskFailure = taskMeasured.failure
          }
        } else {
          progress.log?.(s.sessionId, walks
            ? 'First pass: pressing Tab through every place on the page and measuring each one'
            : 'First pass: looking through the page')
          const run = await measurePass(page, {
            detectors, deadline, persona: s, profileIds, walks,
            onWalked: () => {
              timings.mark('measureWalk')
              progress.log?.(s.sessionId, 'Checking the whole page against every rule of the accessibility rules engine')
            },
            onStop: (stop, n) => progress.log?.(s.sessionId, `Tab ${n}: ${describeStop(stop)}`, { kind: 'step', step: n, pass: 'measure' })
          })
          measured = run.walk?.stops ?? null
          // A walk cut short by the time limit is never summarised as a normal result.
          if (run.walk?.ended === 'time') coverage.walkIncomplete = true
          candidates.push(...run.candidates)
          {
            const audit = run.candidates.filter((c) => c.detector === 'page-audit')
            const elements = audit.reduce((n, c) => n + (c.evidence?.count || 1), 0)
            const other = run.candidates.length - audit.length
            progress.log?.(s.sessionId, `Found ${audit.length} accessibility rule${audit.length === 1 ? '' : 's'} broken on ${elements} element${elements === 1 ? '' : 's'}` +
              (walks ? `, and ${other} keyboard problem${other === 1 ? '' : 's'} along the way` : ''), { kind: 'summary' })
            progress.log?.(s.sessionId, 'Second pass: doing it again on camera, with the person\'s view, and showing each problem as it is confirmed')
          }
          debug.detectorProblems.push(...run.problems)
          // What we could not look at, in plain words.
          coverage.notes = [
            ...(loaded.changing ? [STILL_CHANGING] : []),
            ...(coverage.closedShadowRoots ? [coverageLines.closedSections(coverage.closedShadowRoots)] : []),
            ...run.notes
          ]
        }
        timings.mark('measureDetect')
      }
    } finally {
      clearTimeout(measureWatchdog)
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
        const stopRecordFrames = startFrames(page, s.sessionId, progress, 'record')
        context.on('close', stopRecordFrames)

        // Hard stop: close the context if anything below hangs past the cap.
        watchdog = setTimeout(() => {
          coverage.stoppedReason = STOPPED_TIME
          context.close().catch(() => {})
        }, Math.max(0, deadline - Date.now()) + 2000)

        // A native alert/confirm at load: never dismiss or accept it.
        let dialogSeen = false
        // In Task Mode a message box that opens while walking ends the walk
        // (left untouched): the page cannot be read while it is open.
        let taskWalking = false
        page.on('dialog', () => {
          dialogSeen = true
          if (taskWalking) context.close().catch(() => {})
        })

        progress.phase(s.sessionId, 'opening')
        const loaded = await loadPage(page, job.url, { deadline })
        timings.mark('load')
        readyAt = Date.now()

        // A sign of a bot wall is kept with the run (debug.botWall), whether
        // or not the page was a wall, so every stop can be checked later.
        const botWall = loaded.ok && !dialogSeen ? await checkBotWall(page, loaded.status) : null
        if (botWall?.evidence) debug.botWall = botWall.evidence

        if (!loaded.ok) {
          coverage.stoppedReason = loaded.reason
          debug.loadFailure = loaded.detail || null
        } else if (dialogSeen) {
          coverage.stoppedReason = STOPPED_DIALOG
        } else if (botWall.wall) {
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

          // The recorded walk, once it has run: page-level confirms read it.
          let recordedWalk = null

          // Confirm from this fresh state, before anything is drawn, then capture.
          const confirmAndCapture = async (group, stop) => {
            if (Date.now() >= deadline) return
            let reason = null
            // stopSelector: where focus is at this stop, when the moment
            // highlights something else (focus-lost names the element that
            // had focus for a moment while focus sits on the page itself).
            if (stop && stop.selector !== (group.stopSelector ?? group.selector)) reason = 'not at the same stop'
            const d = byId[group.detector]
            if (!reason && d?.confirm) {
              // A detector may answer with a plain boolean or a promise.
              const ok = await Promise.resolve()
                .then(() => d.confirm({ page, finding: group, stop, persona: s, walk: recordedWalk }))
                .catch(() => false)
              if (!ok) reason = 'did not happen again'
            }
            if (!reason && !(await engine.capture(group))) reason = 'element no longer on the page'
            if (reason) debug.dropped.push({ detector: group.detector, selector: group.selector, step: group.step, reason })
          }

          let stopsSeen = 0
          if (taskMode) {
            progress.phase(s.sessionId, 'walking')
            const measuredFailure = taskMeasured?.failure ?? null
            let confirmed = false
            let dropped = false
            taskWalking = true
            let walk = null
            try {
              walk = await taskWalk(page, {
                intents: task.intents,
                profileIds,
                deadline,
                paceMs: config.walk.recordedPaceMs,
                onStop: async (stop, n) => {
                  stopsSeen = n
                  const expected = measured?.[n - 1]
                  if (!expected || expected.selector !== stop.selector || expected.name !== stop.name) {
                    debug.mismatches.push({ step: n, expected: expected?.selector ?? null, actual: stop.selector })
                  }
                  await page.evaluate(overlayKeyChip, { label: 'Tab', count: stop.press })
                },
                onActivate: async (stop, count) => {
                  await page.evaluate(overlayKeyChip, { label: 'Enter', count })
                },
                // Conditions that follow where the person just was (tunnel
                // vision) move on as each Tab is pressed.
                onBeforePress: (previous) => page.evaluate(setConditionAnchor, previous),
                // Enter loaded a new page: the persona's view and the overlay
                // are put on it again, or the rest of the video would show a
                // plain page and a failure there would have no ring.
                onDocument: async () => {
                  await page.evaluate(profilesSource)
                  await page.evaluate(applyProfiles, s.profiles)
                  await page.evaluate(installOverlay)
                  await page.evaluate(settle)
                },
                onIntent: async (outcome) => {
                  if (outcome.status !== 'failed' || outcome.reason === 'budget-time') return
                  if (!measuredFailure || measuredFailure.intentIndex !== outcome.index || measuredFailure.reason !== outcome.reason) {
                    dropped = true
                    debug.dropped.push({ detector: 'task-find', selector: outcome.stop?.selector ?? null, step: null, reason: 'did not happen again' })
                    return
                  }
                  confirmed = true
                  taskFailure = measuredFailure
                  const copy = taskNotFoundCopy({
                    persona: s.persona.name,
                    profile: measuredFailure.profile,
                    intent: outcome.intent,
                    intentNumber: outcome.index + 1,
                    intentCount: task.intents.length,
                    reason: outcome.reason,
                    stopsAttempted: outcome.stopsAttempted,
                    lastStop: measuredFailure.lastStop,
                    missed: outcome.missed,
                    radiusPx: stick('task', 'tunnelRadiusPx')
                  })
                  if (!copy) return
                  // The walk has moved on by now. Show the page as it was when the
                  // place that could not be made out was reached.
                  if (outcome.missed) await page.evaluate(setConditionAnchor, outcome.missed.from)
                  // The place to show: the one that was out of sight, else the last one reached.
                  const selector = outcome.missed?.stop?.selector ?? outcome.stop?.selector ?? 'body'
                  const moment = await engine.capture(makeFinding({
                    detector: 'task-find',
                    profile: measuredFailure.profile,
                    selector,
                    headline: copy.headline,
                    fact: copy.fact,
                    forTeam: copy.forTeam,
                    evidence: { intentNumber: outcome.index + 1, intentCount: task.intents.length, stopsAttempted: outcome.stopsAttempted }
                  }))
                  if (moment) taskFailureMoment = moment.number
                  else debug.dropped.push({ detector: 'task-find', selector, step: null, reason: 'element no longer on the page' })
                }
              })
            } catch (err) {
              if (!dialogSeen) throw err
              coverage.stoppedReason = STOPPED_DIALOG_TASK
            }
            taskWalking = false
            if (walk) {
              recordedWalk = walk
              coverage.stopsVisited = walk.stops.length
              coverage.presses = walk.tabs
              coverage.walkEnded = walk.ended
              coverage.framesReached = walk.stops.filter((x) => x.kind === 'frame').length
              if (walk.failure?.reason === 'budget-time') {
                coverage.stoppedReason = STOPPED_TIME
                coverage.walkIncomplete = true
                const line = coverageLines.taskOutOfTime(walk.failure.intent)
                if (!coverage.notes?.includes(line)) coverage.notes = [...(coverage.notes || []), line]
              } else if (walk.failure && !measuredFailure) {
                debug.mismatches.push({ step: null, expected: 'every intent reached', actual: `intent ${walk.failure.intentIndex + 1} not reached` })
              } else if (measuredFailure && measuredFailure.reason !== 'budget-time' && !confirmed && !dropped) {
                debug.dropped.push({ detector: 'task-find', selector: measuredFailure.lastStop?.selector ?? null, step: null, reason: 'did not happen again' })
              }
            }
            timings.mark('walk')
          } else if (walks) {
            progress.phase(s.sessionId, 'walking')
            const walk = await tabWalk(page, {
              deadline,
              paceMs: config.walk.recordedPaceMs,
              onStop: async (stop, n) => {
                stopsSeen = n
                progress.log?.(s.sessionId, `Tab ${n}: ${describeStop(stop)}`, { kind: 'step', step: n, pass: 'record' })
                // Confirm against the measure pass at the same position.
                const expected = measured?.[n - 1]
                if (!expected || expected.selector !== stop.selector || expected.name !== stop.name) {
                  debug.mismatches.push({ step: n, expected: expected?.selector ?? null, actual: stop.selector })
                }
                for (const g of atStep.get(n) || []) await confirmAndCapture(g, stop)
                await page.evaluate(overlayKeyChip, { label: 'Tab', count: n })
              }
            })
            recordedWalk = walk
            coverage.stopsVisited = walk.stops.length
            coverage.presses = walk.presses
            coverage.walkEnded = walk.ended
            coverage.framesReached = walk.stops.filter((x) => x.kind === 'frame').length
            if (walk.ended === 'time') {
              coverage.stoppedReason = STOPPED_TIME
              coverage.walkIncomplete = true
              const line = coverageLines.outOfTime(walk.stops.length)
              if (!coverage.notes?.includes(line)) coverage.notes = [...(coverage.notes || []), line]
            }
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
          if (unverifiedChecks.length) coverage.unverifiedMoments = moments.filter((m) => m.unverified).length
          if (moments.length) timings.mark('evidence')

          await page.evaluate(overlayHideChip).catch(() => {})
          await page.waitForTimeout(500).catch(() => {}) // a short still at the end of the video
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
        const momentId = await store.saveMoment(s.sessionId, { ...m, videoMs }, {
          // Session time, so timestamp_ms - recording_offset_ms is the video position.
          timestampMs: recordingOffsetMs !== null ? recordingOffsetMs + videoMs : Math.max(0, wall - sessionStart),
          shotKeys,
          profiles: s.profiles
        })
        momentIds.set(m.number, momentId ?? null)
      }
      timings.mark('upload')
    }

    // Task Mode: what the run found, and the structured failure, written
    // after the moment it belongs to so the row can link to it.
    if (taskMode && taskMeasured) {
      const reached = taskMeasured.outcomes.filter((o) => o.status === 'reached')
      coverage.task = { intents: task.intents.length, reached: reached.length, ended: taskMeasured.ended }
      // A found place that was not pressed is the runner's limit; say so, and
      // never read a run like that as a normal end.
      if (taskMeasured.ended === 'stopped' && !coverage.stoppedReason) {
        coverage.stoppedReason = coverageLines.taskNotFollowed(reached[reached.length - 1].intent, taskMeasured.stoppedBecause)
      }
    }
    if (taskFailure) {
      const momentId = taskFailureMoment != null ? (momentIds.get(taskFailureMoment) ?? null) : null
      await store.saveTaskFailure(s.sessionId, taskFailure, { momentId })
    }
  } catch (err) {
    console.error(`[runner] ${label} failed:`, err)
    coverage.stoppedReason = coverage.stoppedReason || err.plain || 'Something went wrong while visiting this page, so we stopped.'
    debug.error = String(err?.stack || err).slice(0, 2000)
  }

  const timingResult = timings.done()
  timingResult.browserPeakMb = await memory.stop()
  timingResult.hostAtStart = hostAtStart
  // How the video's timing was settled, kept with the timings so a missing
  // mark or an ignored correction is visible later.
  if (syncTimings) timingResult.sync = syncTimings
  await store.finalize(s.sessionId, {
    videoKey, durationSeconds, recordingOffsetMs, coverage, timings: timingResult, debug
  })
  progress.done(s.sessionId, { videoUrl: videoKey, stoppedReason: coverage.stoppedReason || null })
  return { sessionId: s.sessionId, videoKey, coverage, timings: timingResult, debug, moments }
}
