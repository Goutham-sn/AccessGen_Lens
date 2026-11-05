import { NavLink } from 'react-router-dom'
import { Icon } from '../brand/Icon.jsx'

const LINKS = [
  { to: '/dashboard', label: 'Your experiences', icon: 'home' },
  { to: '/start', label: 'New experience', icon: 'play' },
  { to: '/personas', label: 'People', icon: 'people' },
  { to: '/team', label: 'Team', icon: 'team' }
]

export function Sidebar() {
  return (
    <nav aria-label="Main" className="w-60 shrink-0 px-3 py-6 hidden md:block">
      <ul className="space-y-1 sticky top-24">
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              className={({ isActive }) =>
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ' +
                (isActive
                  ? 'bg-white text-ink-900 shadow-soft'
                  : 'text-ink-600 hover:bg-black/[0.04] hover:text-ink-900')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={link.icon} size={18} className={isActive ? 'text-brand-600' : 'text-ink-500'} />
                  {link.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
