import { create } from 'zustand'
import { api } from '../services/api.js'
import { personaIdOf, snapshotOf } from '../utils/personaRecord.js'

export const useSessionStore = create((set, get) => ({
  // Live session state
  currentSession: null,
  isRecording: false,
  cognitiveLoad: 0,
  announcements: [], // screen reader log
  focusPath: [],     // keyboard focus history
  liveMoments: [],
  startedAt: null,
  // Real tab video state, driven by extension events (not by a timer):
  // 'waiting' | 'recording' | 'failed' | 'uploaded'
  recordingState: 'waiting',
  recordingError: null,
  recordingStartedAt: null,
  recordShortcut: '',

  // Session list
  sessions: [],
  sessionsLoading: false,

  async createSession({ url, activeProfiles, persona }) {
    const data = await api.post('/sessions', {
      url,
      activeProfiles,
      personaId: personaIdOf(persona),
      personaSnapshot: snapshotOf(persona)
    })
    set({
      currentSession: data.session,
      isRecording: true,
      cognitiveLoad: 0,
      announcements: [],
      focusPath: [],
      liveMoments: [],
      startedAt: Date.now(),
      recordingState: 'waiting',
      recordingError: null,
      recordingStartedAt: null
    })
    // The upload token is handed straight to the extension by the caller.
    // It is not kept in this store.
    return { session: data.session, uploadToken: data.uploadToken }
  },

  async endSession() {
    const { currentSession } = get()
    if (!currentSession) return null
    const data = await api.post(`/sessions/${currentSession.id}/end`)
    set({ isRecording: false, currentSession: data.session })
    return data.session
  },

  clearLiveSession() {
    set({
      currentSession: null, isRecording: false, cognitiveLoad: 0,
      announcements: [], focusPath: [], liveMoments: [], startedAt: null,
      recordingState: 'waiting', recordingError: null, recordingStartedAt: null
    })
  },

  setRecording(patch) {
    set(patch)
  },

  setCognitiveLoad(score) {
    set({ cognitiveLoad: score })
  },

  addAnnouncement(a) {
    set({ announcements: [...get().announcements.slice(-199), { ...a, at: Date.now() }] })
  },

  addFocusChange(f) {
    set({ focusPath: [...get().focusPath.slice(-199), f] })
  },

  addLiveMoment(m) {
    set({ liveMoments: [...get().liveMoments, m] })
  },

  async fetchSessions() {
    set({ sessionsLoading: true })
    try {
      const data = await api.get('/sessions')
      set({ sessions: data.sessions, sessionsLoading: false })
    } catch {
      set({ sessionsLoading: false })
    }
  },

  async deleteSession(id) {
    await api.delete(`/sessions/${id}`)
    set({ sessions: get().sessions.filter((s) => s.id !== id) })
  }
}))
