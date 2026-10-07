import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'
import { Navbar } from '../components/layout/Navbar.jsx'
import { Button } from '../components/shared/Button.jsx'
import { useExtension } from '../hooks/useExtension.js'

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, login, register, loading, error } = useAuthStore()
  const { installed, recheck } = useExtension()
  const [mode, setMode] = useState('register')
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  if (user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    const ok = mode === 'register'
      ? await register(form.email, form.password, form.name)
      : await login(form.email, form.password)
    if (ok) navigate('/dashboard')
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar />
      <main id="main-content" className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold text-ink-900">
          {mode === 'register' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          {mode === 'register'
            ? 'A local account so your sessions and reports have a home.'
            : 'Sign in to pick up where you left off.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink-700 mb-1">Name</label>
              <input
                id="name" type="text" value={form.name} onChange={set('name')}
                autoComplete="name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-1">Email</label>
            <input
              id="email" type="email" required value={form.email} onChange={set('email')}
              autoComplete="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink-700 mb-1">
              Password {mode === 'register' && <span className="text-ink-500 font-normal">(at least 8 characters)</span>}
            </label>
            <input
              id="password" type="password" required minLength={8} value={form.password} onChange={set('password')}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? 'One moment…' : mode === 'register' ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-ink-600">
          {mode === 'register' ? 'Already have an account?' : 'New here?'}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
            className="font-medium text-brand-700 hover:text-brand-800 underline"
          >
            {mode === 'register' ? 'Sign in' : 'Create an account'}
          </button>
        </p>

        <section aria-labelledby="ext-heading" className="mt-12 rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="ext-heading" className="font-semibold text-ink-900">The extension</h2>
          <p className="mt-1 text-sm text-ink-600">
            The Chrome extension is the simulation engine: the part that transforms real pages.
          </p>
          <p className="mt-3 text-sm" aria-live="polite">
            {installed === null && <span className="text-ink-500">Checking for the extension…</span>}
            {installed === true && <span className="font-medium text-green-800">✓ Extension detected. You're ready.</span>}
            {installed === false && (
              <span className="text-amber-800">
                Not detected yet. Load <code>extension/dist</code> as an unpacked extension at{' '}
                <code>chrome://extensions</code>, then{' '}
                <button type="button" onClick={recheck} className="underline font-medium">check again</button>.
              </span>
            )}
          </p>
        </section>
      </main>
    </div>
  )
}
