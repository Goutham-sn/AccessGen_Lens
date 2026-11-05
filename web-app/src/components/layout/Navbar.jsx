import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { Logo } from '../brand/Logo.jsx'

export function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link to={user ? '/dashboard' : '/'} aria-label="AccessGen Lens home">
          <Logo />
        </Link>
        <nav aria-label="Account">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/start"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700"
              >
                <span aria-hidden="true">+</span> New experience
              </Link>
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800"
                title={user.name || user.email}
                aria-hidden="true"
              >
                {initial}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-ink-600 hover:text-ink-900 rounded-md px-2 py-1"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/onboarding" className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
