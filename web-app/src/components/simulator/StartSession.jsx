import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { useProfileStore } from '../../store/profileStore.js'
import { useSessionStore } from '../../store/sessionStore.js'
import { useExtensionStore } from '../../store/extensionStore.js'
import { getProfile } from '../../data/profiles.js'
import { startSimulation } from '../../services/extension-bridge.js'
import { useAuthStore } from '../../store/authStore.js'
import { WatchForm } from './WatchForm.jsx'

export function StartSession() {
  const navigate = useNavigate()
  const { activeProfiles, persona, lastUrl, setLastUrl } = useProfileStore()
  const createSession = useSessionStore((s) => s.createSession)
  const { installed } = useExtensionStore()
  const { accessToken } = useAuthStore()

  const [modalOpen, setModalOpen] = useState(false)
  // 'explore': the tester browses with the extension. 'watch': the runner
  // visits the page as a persona and records it.
  const [mode, setMode] = useState('explore')
  const [url, setUrl] = useState(lastUrl || '')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)

  // Only exploring needs profiles chosen on this page; watching picks a
  // persona inside the dialog.
  const noProfiles = activeProfiles.length === 0

  async function handleStart(e) {
    e.preventDefault()
    setError(null)

    let target = url.trim()
    if (!target) { setError('Enter the address of the page you want to experience.'); return }
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`

    setStarting(true)
    try {
      // Enrich profile ids with names so reports read naturally.
      const enriched = activeProfiles.map((ap) => ({
        ...ap, name: getProfile(ap.id)?.name || ap.id
      }))

      const { session, uploadToken } = await createSession({ url: target, activeProfiles: enriched, persona })
      setLastUrl(target)

      await startSimulation({
        sessionId: session.id,
        url: target,
        profiles: enriched,
        token: accessToken,
        uploadToken,
        apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001'
      })

      setModalOpen(false)
      navigate(`/session/${session.id}`)
    } catch (err) {
      setError(err.message === 'Extension not responding'
        ? 'The AccessGen Lens extension is not responding. Make sure it is installed and enabled, then reload this page.'
        : err.message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <>
      <div className="space-y-2">
        <Button size="lg" onClick={() => setModalOpen(true)} className="w-full">
          Start Simulation
        </Button>
        {installed === false && (
          <p role="alert" className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            The Chrome extension isn't detected. Load it from <code>extension/dist</code> at{' '}
            <code>chrome://extensions</code>, then reload this page.
          </p>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="How should we experience this page?">
        <fieldset className="mb-4">
          <legend className="sr-only">Choose how to experience the page</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['explore', 'Explore it myself', 'You browse the page with the simulation on, using the Chrome extension.'],
              ['watch', 'Watch it happen', 'A browser on our side moves through the page as the person you choose, and records it.']
            ].map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm
                  ${mode === value ? 'border-brand-700 bg-brand-50' : 'border-gray-300 hover:border-brand-500'}`}
              >
                <input
                  type="radio"
                  name="experience-mode"
                  value={value}
                  className="mt-1 h-4 w-4"
                  checked={mode === value}
                  onChange={() => { setMode(value); setError(null) }}
                />
                <span>
                  <span className="block font-medium text-ink-900">{label}</span>
                  <span className="block text-xs text-ink-600">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === 'watch' ? (
          <WatchForm url={url} setUrl={setUrl} onCancel={() => setModalOpen(false)} />
        ) : (
        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label htmlFor="session-url" className="block text-sm font-medium text-ink-700 mb-1">
              Page address
            </label>
            <input
              id="session-url"
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {noProfiles && (
            <p className="text-sm text-ink-700">Choose at least one profile on this page first.</p>
          )}
          {installed === false && (
            <p className="text-sm text-amber-800">The Chrome extension isn't detected, so exploring won't start yet.</p>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={starting || noProfiles}>
              {starting ? 'Starting…' : 'Begin the experience'}
            </Button>
          </div>
        </form>
        )}
      </Modal>
    </>
  )
}
