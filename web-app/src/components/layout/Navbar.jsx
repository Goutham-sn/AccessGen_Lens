import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'

export function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2 font-semibold text-ink-900">
          <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-white text-sm">
            ◉
          </span>
          AccessGen Lens
        </Link>
        <nav aria-label="Account">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-600 hidden sm:inline">{user.name || user.email}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-ink-700 hover:text-ink-900 rounded-md px-2 py-1"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/onboarding" className="text-sm font-medium text-brand-700 hover:text-brand-800">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
