// AccessGen Lens: simulation controller (injected into the target page).
// Receives INIT with the profile configuration, instantiates each profile
// in layer order, mounts the control panel, and handles hot-swapping and
// teardown.

import { setSession, send } from './communicator.js'
import { mountControlPanel } from '../overlay/ControlPanel.js'

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
  const onFriction = (e) => panel?.noteFriction(e.detail.headline)
  window.addEventListener('accessgen-friction', onFriction)

  function destroyAll() {
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
