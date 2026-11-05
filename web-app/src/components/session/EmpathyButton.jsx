import { useState } from 'react'
import { Button } from '../shared/Button.jsx'
import { Modal } from '../shared/Modal.jsx'
import { logEmpathyMoment } from '../../services/extension-bridge.js'
import { api } from '../../services/api.js'

export const EMPATHY_LABELS = [
  'Got completely stuck here',
  'Could not find this',
  'Would have given up',
  'This took too long',
  'This makes no sense',
  'I felt excluded'
]

export function EmpathyButton({ sessionId, startedAt, onLogged }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [selectedLabel, setSelectedLabel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  async function log(label) {
    setSaving(true)
    try {
      // Ask the extension to capture the moment (screenshot + timestamp)…
      await logEmpathyMoment(label, note).catch(async () => {
        // …fall back to a direct API log if the extension isn't reachable.
        await api.post(`/sessions/${sessionId}/empathy-moments`, {
          label, note, timestampMs: Date.now() - (startedAt || Date.now())
        })
      })
      setConfirmation(`Logged: "${label}"`)
      setTimeout(() => setConfirmation(''), 3000)
      onLogged?.(label)
      setOpen(false)
      setNote('')
      setSelectedLabel(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="w-full !bg-ember-700 hover:!bg-rose-800"
      >
        ◉ I Felt This
      </Button>
      <p aria-live="polite" className="text-sm text-green-800 min-h-[20px] mt-1 text-center">
        {confirmation}
      </p>

      <Modal open={open} onClose={() => setOpen(false)} title="What just happened?">
        <div className="space-y-2" role="group" aria-label="Pick the feeling that fits">
          {EMPATHY_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              disabled={saving}
              onClick={() => setSelectedLabel(label)}
              aria-pressed={selectedLabel === label}
              className={`w-full text-left rounded-lg border px-4 py-3 text-sm font-medium transition-colors
                ${selectedLabel === label
                  ? 'border-rose-500 bg-ember-50 text-rose-900'
                  : 'border-rule text-ink-700 hover:border-ember-300 hover:bg-ember-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <label htmlFor="empathy-note" className="block text-sm font-medium text-ink-700 mb-1">
            Add a note <span className="text-ink-500 font-normal">(optional)</span>
          </label>
          <textarea
            id="empathy-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!selectedLabel || saving}
            onClick={() => log(selectedLabel)}
          >
            {saving ? 'Logging…' : 'Log this moment'}
          </Button>
        </div>
      </Modal>
    </>
  )
}
