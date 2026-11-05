import { create } from 'zustand'
import { api, configureApi } from '../services/api.js'

// There is no sign-in: AccessGen Lens runs on your own machine, and the
// backend treats every request as its one local user. This store only
// holds that user's name for the greeting. Tokens are gone; the fields
// stay null so older callers keep working.
export const useAuthStore = create((set) => ({
  user: { id: 'local', name: 'You', email: null },
  accessToken: null,
  refreshToken: null,
  async load() {
    try {
      const data = await api.get('/auth/me')
      if (data?.user) set({ user: data.user })
    } catch { /* keep the placeholder */ }
  }
}))

configureApi({
  tokens: () => ({ accessToken: null, refreshToken: null }),
  refreshed: () => {},
  failure: () => {}
})

// Old sessions kept tokens in local storage; they are not needed any more.
try { localStorage.removeItem('accessgen-auth') } catch { /* private mode */ }
