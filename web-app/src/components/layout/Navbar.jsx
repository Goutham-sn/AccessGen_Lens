import { Link, NavLink } from 'react-router-dom'
import { Logo } from '../brand/Logo.jsx'

const LINKS = [
  { to: '/dashboard', label: 'Sessions' },
  { to: '/start', label: 'New session' },
  { to: '/personas', label: 'People' },
  { to: '/lens', label: 'Try the lens' }
]

// The one bar at the top. No sign-in: this runs on your own machine.
export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-5">
        <Link to="/dashboard" aria-label="AccessGen Lens, your sessions"><Logo /></Link>
        <nav aria-label="Main" className="flex h-full items-stretch gap-1 overflow-x-auto">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center whitespace-nowrap border-b-2 px-2.5 text-sm ${isActive ? 'border-ink-900 font-medium text-ink-900' : 'border-transparent text-ink-600 hover:text-ink-900'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
