import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Configuration state for the next session: which profiles are active,
// at what severity, and whether a persona drove the selection.
export const useProfileStore = create(
  persist(
    (set, get) => ({
      activeProfiles: [], // [{ id, severity }]
      persona: null,      // persona object when selection came from a persona
      lastUrl: '',

      toggleProfile(id, hasSeverity) {
        const { activeProfiles } = get()
        const exists = activeProfiles.find((p) => p.id === id)
        set({
          persona: null,
          activeProfiles: exists
            ? activeProfiles.filter((p) => p.id !== id)
            : [...activeProfiles, { id, severity: hasSeverity ? 2 : 3 }]
        })
      },

      setSeverity(id, severity) {
        set({
          activeProfiles: get().activeProfiles.map((p) =>
            p.id === id ? { ...p, severity } : p
          )
        })
      },

      applyPersona(persona) {
        set({
          persona,
          activeProfiles: persona.profiles.map((p) => ({ ...p }))
        })
      },

      clearAll() {
        set({ activeProfiles: [], persona: null })
      },

      setLastUrl(url) {
        set({ lastUrl: url })
      }
    }),
    { name: 'accessgen-profiles' }
  )
)
