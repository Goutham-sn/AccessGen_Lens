import { PROFILES, PROFILE_CATEGORIES } from '../../data/profiles.js'
import { useProfileStore } from '../../store/profileStore.js'
import { SeveritySlider } from './SeveritySlider.jsx'

function ProfileCard({ profile }) {
  const { activeProfiles, toggleProfile, setSeverity } = useProfileStore()
  const active = activeProfiles.find((p) => p.id === profile.id)

  return (
    <div className={`rounded-xl border p-4 transition-colors
      ${active ? 'border-brand-400 bg-brand-50' : 'border-rule bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-ink-900">{profile.name}</h3>
          <p className="text-sm text-ink-600 mt-0.5">{profile.tagline}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(active)}
          aria-label={`${profile.name}: ${profile.tagline}`}
          onClick={() => toggleProfile(profile.id, profile.hasSeverity)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors
            ${active ? 'bg-brand-700' : 'bg-gray-300'}`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all
              ${active ? 'left-[22px]' : 'left-0.5'}`}
          />
        </button>
      </div>
      {active && (
        <>
          <p className="text-sm text-ink-600 mt-3">{profile.description}</p>
          {profile.hasSeverity && (
            <SeveritySlider
              profileId={profile.id}
              profileName={profile.name}
              value={active.severity}
              onChange={(sev) => setSeverity(profile.id, sev)}
            />
          )}
        </>
      )}
    </div>
  )
}

export function ProfileSelector() {
  const categories = Object.values(PROFILE_CATEGORIES)

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <section key={category} aria-labelledby={`cat-${category}`}>
          <h2 id={`cat-${category}`} className="text-sm font-semibold uppercase tracking-wide text-ink-500 mb-3">
            {category}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROFILES.filter((p) => p.category === category).map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
