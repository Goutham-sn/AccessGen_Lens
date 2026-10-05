import { useEffect, useRef } from 'react'
import { getSocket } from '../services/socket.js'
import { useAuthStore } from '../store/authStore.js'

// Joins a session room and wires event handlers; cleans up on unmount.
export function useSocket(sessionId, handlers = {}) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!sessionId) return
    const socket = getSocket(accessToken)
    socket.emit('join-session', { sessionId })

    const bound = {}
    for (const event of Object.keys(handlersRef.current)) {
      bound[event] = (payload) => handlersRef.current[event]?.(payload)
      socket.on(event, bound[event])
    }

    return () => {
      socket.emit('leave-session', { sessionId })
      for (const [event, fn] of Object.entries(bound)) socket.off(event, fn)
    }
  }, [sessionId, accessToken])
}
