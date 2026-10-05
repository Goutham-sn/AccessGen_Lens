import { useEffect } from 'react'
import { useSessionStore } from '../store/sessionStore.js'
import { useSocket } from './useSocket.js'
import { listenFromExtension } from '../services/extension-bridge.js'

// Live-session hook: subscribes to realtime updates from both the backend
// socket and the extension bridge, feeding the session store.
export function useSession() {
  const store = useSessionStore()
  const sessionId = store.currentSession?.id

  useSocket(sessionId, {
    'cognitive-load': (p) => store.setCognitiveLoad(p.score),
    'sr-announcement': (p) => store.addAnnouncement(p),
    'focus-change': (p) => store.addFocusChange(p),
    'empathy-moment': (p) => store.addLiveMoment(p)
  })

  useEffect(() => {
    // Extension may also relay events directly through the bridge when
    // the web app tab is open.
    return listenFromExtension((msg) => {
      if (!msg) return
      if (msg.event === 'cognitive-load') store.setCognitiveLoad(msg.score)
      if (msg.event === 'sr-announcement') store.addAnnouncement(msg)
      if (msg.event === 'focus-change') store.addFocusChange(msg)
      if (msg.event === 'empathy-moment') store.addLiveMoment(msg)

      // Real recording state from the extension.
      const liveId = useSessionStore.getState().currentSession?.id
      if (msg.sessionId && liveId && msg.sessionId !== liveId) return
      if (msg.event === 'recording-started') {
        store.setRecording({
          recordingState: 'recording', recordingError: null, recordingStartedAt: msg.recordingStartedAt
        })
      }
      if (msg.event === 'recording-failed') {
        store.setRecording({ recordingState: 'failed', recordingError: msg.reason || 'Unknown reason' })
      }
      if (msg.event === 'recording-uploaded') {
        store.setRecording({ recordingState: 'uploaded', recordingError: null })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return store
}
