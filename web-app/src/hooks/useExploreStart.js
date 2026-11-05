import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/sessionStore.js'
import { useProfileStore } from '../store/profileStore.js'
import { useAuthStore } from '../store/authStore.js'
import { getProfile } from '../data/profiles.js'
import { startSimulation } from '../services/extension-bridge.js'
import { saveChain, clearChain } from '../utils/missionChain.js'

// Who the tester is being, for the step-in screen in the page.
function personaForIntro(persona, profiles) {
  const line = profiles.map((p) => getProfile(p.id)?.name || p.id).join(' · ')
  if (!persona) return { name: '', line }
  return { name: persona.name, age: persona.age ?? null, line, story: persona.story || '' }
}

export function normalizeUrl(raw) {
  const target = (raw || '').trim()
  if (!target) return ''
  return /^https?:\/\//i.test(target) ? target : `https://${target}`
}

// Starts an "Explore it myself" session: creates the session, hands it to
// the extension with exactly the profiles given, and opens the Live page.
// Used by the /start cards (one card's profiles only) and by Configure
// (the conditions chosen there).
export function useExploreStart() {
  const navigate = useNavigate()
  const createSession = useSessionStore((s) => s.createSession)
  const setLastUrl = useProfileStore((s) => s.setLastUrl)
  const accessToken = useAuthStore((s) => s.accessToken)
  const [starting, setStarting] = useState(false)

  // Returns a plain message to show, or null when the session started.
  // mission: { goal } (optional). firstAsMyself: run the mission once with
  // no simulation, then as the person (the step-in page starts the second
  // run). baselineSessionId: this is that second run.
  async function start({ url, profiles, persona, mission = null, firstAsMyself = false, baselineSessionId = null }) {
    const target = normalizeUrl(url)
    if (!target) return 'Enter the address of the page you want to explore.'
    if (!profiles?.length) return 'Choose at least one condition first.'

    setStarting(true)
    const clickedAt = Date.now() // [timing]
    console.log('[timing] start clicked at', clickedAt) // [timing]
    try {
      // Names with the ids, so reports read naturally.
      const enriched = profiles.map((p) => ({ ...p, name: getProfile(p.id)?.name || p.id }))
      console.time('[timing] createSession') // [timing]
      const goal = mission?.goal?.trim() ? { goal: mission.goal.trim() } : null
      const baselineRun = Boolean(goal && firstAsMyself && !baselineSessionId)
      const { session, uploadToken } = await createSession({
        url: target,
        activeProfiles: baselineRun ? [] : enriched,
        persona: baselineRun ? null : persona,
        mission: goal,
        baselineSessionId
      })
      if (baselineRun) saveChain({ baselineSessionId: session.id, url: target, profiles, persona, mission: goal })
      else clearChain()
      console.timeEnd('[timing] createSession') // [timing]
      setLastUrl(target)
      console.time('[timing] extension ack') // [timing]
      await startSimulation({
        sessionId: session.id,
        url: target,
        profiles: baselineRun ? [] : enriched,
        mission: goal,
        persona: personaForIntro(persona, enriched),
        baseline: baselineRun,
        token: accessToken,
        uploadToken,
        apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
        clickedAt // [timing]
      })
      console.timeEnd('[timing] extension ack') // [timing]
      console.log(`[timing] web app done +${Date.now() - clickedAt}ms after click`) // [timing]
      navigate(`/session/${session.id}`)
      return null
    } catch (err) {
      return err.message === 'Extension not responding'
        ? 'The AccessGen Lens extension is not responding. Make sure it is installed and turned on, then reload this page.'
        : err.message
    } finally {
      setStarting(false)
    }
  }

  return { start, starting }
}
