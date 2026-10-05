import { useState } from 'react'
import { Modal } from './Modal.jsx'
import { Button } from './Button.jsx'
import { api } from '../../services/api.js'

export function ShareDialog({ open, onClose, sessionId }) {
  const [password, setPassword] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('')
  const [shareUrl, setShareUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  async function createLink() {
    setCreating(true)
    setError(null)
    try {
      const data = await api.post(`/share/sessions/${sessionId}`, {
        password: password || undefined,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined
      })
      setShareUrl(`${window.location.origin}/shared/${data.share.share_token}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Share this empathy report">
      {!shareUrl ? (
        <form onSubmit={(e) => { e.preventDefault(); createLink() }} className="space-y-4">
          <div>
            <label htmlFor="share-password" className="block text-sm font-medium text-ink-700 mb-1">
              Password <span className="text-ink-500 font-normal">(optional)</span>
            </label>
            <input
              id="share-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="share-expiry" className="block text-sm font-medium text-ink-700 mb-1">
              Expires after
            </label>
            <select
              id="share-expiry"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Never</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create link'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Anyone with this link can view the report{password ? ' after entering the password' : ''}.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Share link"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50"
              onFocus={(e) => e.target.select()}
            />
            <Button onClick={copy}>{copied ? 'Copied!' : 'Copy'}</Button>
          </div>
          <div aria-live="polite" className="sr-only">{copied ? 'Link copied to clipboard' : ''}</div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
