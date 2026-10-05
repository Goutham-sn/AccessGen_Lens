// Socket.io CORS/config shared between server bootstrap and tests.
export const socketConfig = {
  cors: {
    origin: [process.env.WEB_APP_URL || 'http://localhost:5173', /^chrome-extension:\/\//],
    credentials: true
  }
}
