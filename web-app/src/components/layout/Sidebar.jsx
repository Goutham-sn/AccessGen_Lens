import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/configure', label: 'New Session', icon: '✦' },
  { to: '/personas', label: 'Personas', icon: '☺' },
  { to: '/team', label: 'Team', icon: '⚑' }
]

export function Sidebar() {
  return (
    <nav aria-label="Main" className="w-52 shrink-0 border-r border-gray-200 bg-white p-3 hidden md:block">
      <ul className="space-y-1">
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ` +
                (isActive
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-ink-700 hover:bg-gray-100 hover:text-ink-900')
              }
            >
              <span aria-hidden="true">{link.icon}</span>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
