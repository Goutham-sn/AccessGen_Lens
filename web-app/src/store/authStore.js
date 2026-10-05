import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, configureApi } from '../services/api.js'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      loading: false,
      error: null,

      async register(email, password, name) {
        set({ loading: true, error: null })
        try {
          const data = await api.post('/auth/register', { email, password, name })
          set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, loading: false })
          return true
        } catch (err) {
          set({ error: err.message, loading: false })
          return false
        }
      },

      async login(email, password) {
        set({ loading: true, error: null })
        try {
          const data = await api.post('/auth/login', { email, password })
          set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, loading: false })
          return true
        } catch (err) {
          set({ error: err.message, loading: false })
          return false
        }
      },

      async logout() {
        const { refreshToken } = get()
        try { await api.post('/auth/logout', { refreshToken }) } catch { /* best effort */ }
        set({ user: null, accessToken: null, refreshToken: null })
      },

      setTokens({ user, accessToken, refreshToken }) {
        set({ user: user ?? get().user, accessToken, refreshToken })
      },

      clearAuth() {
        set({ user: null, accessToken: null, refreshToken: null })
      }
    }),
    { name: 'accessgen-auth' }
  )
)

configureApi({
  tokens: () => ({
    accessToken: useAuthStore.getState().accessToken,
    refreshToken: useAuthStore.getState().refreshToken
  }),
  refreshed: (data) => useAuthStore.getState().setTokens(data),
  failure: () => useAuthStore.getState().clearAuth()
})
