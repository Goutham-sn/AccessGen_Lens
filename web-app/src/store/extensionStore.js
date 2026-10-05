import { create } from 'zustand'
import { checkExtensionInstalled, getExtensionStatus } from '../services/extension-bridge.js'

export const useExtensionStore = create((set) => ({
  installed: null, // null = unknown, checking
  status: null,

  async check() {
    const installed = await checkExtensionInstalled()
    set({ installed })
    if (installed) {
      try {
        const status = await getExtensionStatus()
        set({ status })
      } catch { /* status optional */ }
    }
    return installed
  }
}))
