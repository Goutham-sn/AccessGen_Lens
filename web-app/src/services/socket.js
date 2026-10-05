import { io } from 'socket.io-client'
import { API_URL } from './api.js'

let socket = null

export function getSocket(accessToken) {
  if (socket?.connected) return socket
  if (socket) socket.disconnect()
  socket = io(API_URL, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling']
  })
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
