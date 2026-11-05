// AccessGen Lens: simulation controller (injected into the target page).
// Receives INIT with the profile configuration, instantiates each profile
// in layer order, mounts the control panel, and handles hot-swapping and
// teardown.

import { setSession, send } from './communicator.js'
import { mountControlPanel, KEYBOARD_HINTS } from '../overlay/ControlPanel.js'
import { showIntro } from '../overlay/Intro.js'
import { showWhere } from '../overlay/ShowWhere.js'
import { startAuditor } from './auditor.js'
import { scanForKeyboard } from '../profiles/motor/keyboardScan.js'

import { Deuteranopia } from '../profiles/visual/Deuteranopia.js'
import { Achromatopsia } from '../profiles/visual/Achromatopsia.js'
import { Protanopia } from '../profiles/visual/Protanopia.js'
import { Tritanopia } from '../profiles/visual/Tritanopia.js'
import { Cataracts } from '../profiles/visual/Cataracts.js'
import { LowVision } from '../profiles/visual/LowVision.js'
import { TunnelVision } from '../profiles/visual/TunnelVision.js'
import { MacularDegeneration } from '../profiles/visual/MacularDegeneration.js'
import { KeyboardOnly } from '../profiles/motor/KeyboardOnly.js'
import { Tremor } from '../profiles/motor/Tremor.js'
import { SwitchAccess } from '../profiles/motor/SwitchAccess.js'
import { Dyslexia } from '../profiles/cognitive/Dyslexia.js'
import { ADHD } from '../profiles/cognitive/ADHD.js'
import { Deaf } from '../profiles/hearing/Deaf.js'
import { ScreenReader } from '../profiles/screen-reader/ScreenReader.js'

// Guard against double injection (navigation re-injection race).
(() => {
  if (globalThis.__accessgenController) return
  globalThis.__accessgenController = true

  try {
    if (globalThis.__accessgenControllerBootstrapped) return
    globalThis.__accessgenControllerBootstrapped = true
  } catch {
    // Ignore if the page context is already torn down.
  }

  const REGISTRY = {
    deuteranopia: Deuteranopia,
    achromatopsia: Achromatopsia,
    protanopia: Protanopia,
    tritanopia: Tritanopia,
    cataracts: Cataracts,
    'low-vision': LowVision,
    'tunnel-vision': TunnelVision,
    'macular-degeneration': MacularDegeneration,
    'keyboard-only': KeyboardOnly,
    tremor: Tremor,
    'switch-access': SwitchAccess,
    dyslexia: Dyslexia,
    adhd: ADHD,
    deaf: Deaf,
    'screen-reader': ScreenReader
  }

  // Application order: visual filters → motor/event interception →
  // cognitive overlays → hearing → screen reader (announcement layer).
  const LAYER_ORDER = [
    'deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia',
    'cataracts', 'low-vision', 'tunnel-vision', 'macular-degeneration',
    'keyboard-only', 'tremor', 'switch-access',
    'dyslexia', 'adhd',
    'deaf',
    'screen-reader'
  ]

  const active = new Map() // profileId -> instance
  let panel = null
  let profileConfig = []

  function applyProfiles(profiles) {
    profileConfig = profiles

    const wanted = new Map(profiles.map((p) => [p.id, p]))

    // Remove profiles no longer wanted.
    for (const [id, instance] of active) {
      if (!wanted.has(id)) {
        instance.destroy()
        active.delete(id)
      }
    }

    // Add or update, in layer order.
    for (const id of LAYER_ORDER) {
      const config = wanted.get(id)
      if (!config) continue
      const severity = config.severity || 2
      if (active.has(id)) {
        active.get(id).update(severity)
      } else {
        const ProfileClass = REGISTRY[id]
        if (!ProfileClass) continue
        try {
          const instance = new ProfileClass(severity)
          instance.init()
          active.set(id, instance)
        } catch (err) {
          console.warn(`[accessgen] profile "${id}" failed to init:`, err)
        }
      }
    }

    panel?.setProfiles(profiles)
  }

  // Struggles the profiles notice on their own (see friction.js): shown on
  // the panel and logged as automatic moments by the recorder.
  const onFriction = (e) => panel?.noteFriction(e.detail.headline, e.detail)
  window.addEventListener('accessgen-friction', onFriction)

  let stopAuditor = null

  function destroyAll() {
    stopAuditor?.()
    stopAuditor = null
    window.removeEventListener('accessgen-friction', onFriction)
    for (const instance of active.values()) {
      try { instance.destroy() } catch { /* keep tearing down */ }
    }
    active.clear()
    panel?.remove()
    panel = null
    globalThis.__accessgenController = false
  }

  function initPanel() {
    panel = mountControlPanel()
    if (!panel) return

    panel.addEventListener('empathy-moment', (e) => {
      // Ask the recorder to capture screenshot + timestamp for this moment.
      window.dispatchEvent(new CustomEvent('accessgen-empathy', {
        detail: { label: e.detail.label, note: e.detail.note || null, activeProfiles: profileConfig }
      }))
    })

    panel.addEventListener('show-where', (e) => showWhere(e.detail))

    panel.addEventListener('mission-outcome', (e) => {
      chrome.runtime.sendMessage({ type: 'ACCESSGEN_MISSION_OUTCOME', payload: { outcome: e.detail.outcome } }).catch(() => {
        panel?.setStopping(false)
      })
    })

    panel.addEventListener('stop-simulation', () => {
      chrome.runtime.sendMessage({ type: 'ACCESSGEN_STOP_SIMULATION' }).catch(() => {
        // Background worker unreachable: let the user try again rather
        // than leaving the button stuck in "Ending session…".
        panel?.setStopping(false)
      })
    })
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message || {}

    if (type === 'ACCESSGEN_INIT') {
      setSession(payload.sessionId)
      if (!panel) initPanel()
      panel?.setStartedAt(payload.startedAt)
      console.time('[timing] profiles applied to first filtered frame') // [timing]
      applyProfiles(payload.profiles || [])
      requestAnimationFrame(() => requestAnimationFrame(() => console.timeEnd('[timing] profiles applied to first filtered frame'))) // [timing]
      panel?.setRecording(payload.videoRecording === true)
      panel?.setMission(payload.mission, { baseline: payload.baseline, startedAt: payload.missionStartedAt })
      // Every page is checked against every rule, whatever the conditions:
      // nothing the rules engine can find is left out. Not in the "as
      // yourself" first run of a mission, which is only the baseline.
      const startLooking = () => {
        if (payload.baseline || stopAuditor) return
        stopAuditor = startAuditor({ profileIds: (payload.profiles || []).map((p) => p.id) })
        // Things only a mouse can use, hover-only menus, a forced Tab order
        // and no skip link hurt keyboard, switch and screen reader users
        // whatever conditions this session simulates, so they are always
        // looked for (the rules engine cannot see click handlers).
        const scans = [setTimeout(() => scanForKeyboard('keyboard-only'), 1300), setTimeout(() => scanForKeyboard('keyboard-only'), 6500)]
        const stop = stopAuditor
        stopAuditor = () => { scans.forEach(clearTimeout); stop() }
      }
      // Not while the step-in screen covers the page: the pictures would
      // show the screen, not the page.
      if (!payload.showIntro) startLooking()
      if (payload.showIntro) {
        const profiles = payload.profiles || []
        const hints = profiles.map((p) => KEYBOARD_HINTS[p.id]).filter(Boolean)
        panel?.host.style.setProperty('visibility', 'hidden', 'important')
        showIntro({ persona: payload.persona, profiles, hints, mission: payload.mission, baseline: payload.baseline })
          .then(() => {
            panel?.host.style.setProperty('visibility', 'visible', 'important')
            setTimeout(startLooking, 1300)
            return chrome.runtime.sendMessage({ type: 'ACCESSGEN_MISSION_START' })
          })
          .then((reply) => panel?.startMission(reply?.missionStartedAt))
          .catch(() => panel?.startMission(Date.now()))
      }
      send('session-event', { event: { type: 'simulation-started', url: location.href } })
      sendResponse({ ok: true })
    }

    if (type === 'ACCESSGEN_PROFILE_UPDATE') {
      applyProfiles(payload.profiles || [])
      sendResponse({ ok: true })
    }

    if (type === 'ACCESSGEN_RECORDING') {
      panel?.setRecording(payload.on)
      sendResponse({ ok: true })
    }

    // Real tab video state from the background (the dot only, no banner).
    if (type === 'ACCESSGEN_VIDEO_STATE') {
      panel?.setRecording(payload.on)
    }

    if (type === 'ACCESSGEN_CAPTURE_MOMENT') {
      window.dispatchEvent(new CustomEvent('accessgen-empathy', {
        detail: { label: payload.label, note: payload.note, activeProfiles: profileConfig }
      }))
      sendResponse({ ok: true })
    }

    if (type === 'ACCESSGEN_DESTROY') {
      destroyAll()
      sendResponse({ ok: true })
    }

    return false
  })
})()
