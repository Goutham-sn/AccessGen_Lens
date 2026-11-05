import { useEffect, useState } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { Button } from '../components/shared/Button.jsx'
import { Badge } from '../components/shared/Badge.jsx'
import { api } from '../services/api.js'
import { useAuthStore } from '../store/authStore.js'

export default function Team() {
  const user = useAuthStore((s) => s.user)
  const [teams, setTeams] = useState([])
  const [members, setMembers] = useState([])
  const [activeTeam, setActiveTeam] = useState(null)
  const [teamName, setTeamName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function loadTeams() {
    try {
      const d = await api.get('/teams')
      setTeams(d.teams)
      if (d.teams.length > 0) {
        const t = d.teams[0]
        setActiveTeam(t)
        const m = await api.get(`/teams/${t.id}/members`)
        setMembers(m.members)
      }
    } catch { /* not on a team yet */ }
  }

  useEffect(() => { loadTeams() }, [])

  async function createTeam(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/teams', { name: teamName })
      setTeamName('')
      setMessage('Team created.')
      await loadTeams()
    } catch (err) { setError(err.message) }
  }

  async function invite(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      const d = await api.post(`/teams/${activeTeam.id}/members`, { email: inviteEmail })
      setMembers(d.members)
      setMessage(`Invited ${inviteEmail}.`)
      setInviteEmail('')
    } catch (err) { setError(err.message) }
  }

  async function remove(memberId) {
    if (!window.confirm('Remove this member from the team?')) return
    await api.delete(`/teams/${activeTeam.id}/members/${memberId}`)
    setMembers((m) => m.filter((x) => x.id !== memberId))
  }

  return (
    <PageWrapper title="Team">
      <div aria-live="polite" className="min-h-[20px] text-sm text-green-800 mb-2">{message}</div>
      {error && <p role="alert" className="text-sm text-red-700 mb-2">{error}</p>}

      {!activeTeam ? (
        <section aria-labelledby="create-team-heading" className="max-w-md card p-6">
          <h2 id="create-team-heading" className="font-semibold text-ink-900">Create a team</h2>
          <p className="mt-1 text-sm text-ink-600">
            Share personas and empathy reports with the people you build with.
          </p>
          <form onSubmit={createTeam} className="mt-4 flex gap-2">
            <div className="flex-1">
              <label htmlFor="team-name" className="sr-only">Team name</label>
              <input
                id="team-name" type="text" required value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Design Systems Guild"
                className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </section>
      ) : (
        <div className="space-y-6 max-w-2xl">
          <section aria-labelledby="members-heading" className="card p-6">
            <h2 id="members-heading" className="font-semibold text-ink-900">{activeTeam.name}</h2>
            <ul className="mt-4 divide-y divide-gray-100">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{m.name || m.email}</p>
                    <p className="text-xs text-ink-500">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>{m.role}</Badge>
                    {activeTeam.owner_id === user?.id && m.id !== user?.id && (
                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        className="text-sm text-ink-600 hover:text-red-800 underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {activeTeam.owner_id === user?.id && (
            <section aria-labelledby="invite-heading" className="card p-6">
              <h2 id="invite-heading" className="font-semibold text-ink-900">Invite someone</h2>
              <p className="mt-1 text-sm text-ink-600">They need an AccessGen Lens account first.</p>
              <form onSubmit={invite} className="mt-4 flex gap-2">
                <div className="flex-1">
                  <label htmlFor="invite-email" className="sr-only">Email address</label>
                  <input
                    id="invite-email" type="email" required value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
                  />
                </div>
                <Button type="submit">Invite</Button>
              </form>
            </section>
          )}
        </div>
      )}
    </PageWrapper>
  )
}
