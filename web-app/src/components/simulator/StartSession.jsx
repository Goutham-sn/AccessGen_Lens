import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { useProfileStore } from '../../store/profileStore.js'
import { useExtensionStore } from '../../store/extensionStore.js'
import { useExploreStart } from '../../hooks/useExploreStart.js'
import { MissionField } from '../start/MissionField.jsx'

// Configure page: explore a page with the conditions chosen here, using the
// extension. Every other way to start (people, watching it happen) is on
// the /start page.
export function StartSession() {
  const { activeProfiles, persona, lastUrl } = useProfileStore()
  const { installed } = useExtensionStore()
  const explore = useExploreStart()

  const [modalOpen, setModalOpen] = useState(false)
  const [url, setUrl] = useState(lastUrl || '')
  const [message, setMessage] = useState(null)
  const [mission, setMission] = useState({ goal: '', firstAsMyself: true })

  const noProfiles = activeProfiles.length === 0

  async function handleStart(e) {
    e.preventDefault()
    setMessage(null)
    const result = await explore.start({ url, profiles: activeProfiles, persona, mission, firstAsMyself: mission.firstAsMyself })
    if (result) setMessage(result)
  }

  return (
    <>
      <div className="space-y-2">
        <Button size="lg" onClick={() => setModalOpen(true)} className="w-full">
          Explore with these conditions
        </Button>
        <p className="text-center text-sm">
          <Link to="/start" className="text-brand-700 underline">Or choose a person, or watch it happen</Link>
        </p>
        {installed === false && (
          <p role="alert" className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            The Chrome extension isn't detected. Load it from <code>extension/dist</code> at{' '}
            <code>chrome://extensions</code>, then reload this page.
          </p>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Which page should we experience?">
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
          <MissionField value={mission} onChange={setMission} idPrefix="configure-mission" />
          {noProfiles && (
            <p className="text-sm text-ink-700">Choose at least one condition on this page first.</p>
          )}
          {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={explore.starting || noProfiles}>
              {explore.starting ? 'Starting…' : 'Begin the experience'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
