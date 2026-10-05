import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/sessionStore.js'
import { useProfileStore } from '../store/profileStore.js'
import { useAuthStore } from '../store/authStore.js'
import { getProfile } from '../data/profiles.js'
import { startSimulation } from '../services/extension-bridge.js'

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
  async function start({ url, profiles, persona }) {
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
      const { session, uploadToken } = await createSession({ url: target, activeProfiles: enriched, persona })
      console.timeEnd('[timing] createSession') // [timing]
      setLastUrl(target)
      console.time('[timing] extension ack') // [timing]
      await startSimulation({
        sessionId: session.id,
        url: target,
        profiles: enriched,
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
