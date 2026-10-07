import http from 'node:http'
import net from 'node:net'
import dns from 'node:dns/promises'
import { isBlockedAddress } from './blocklist.js'

// Egress proxy for Chromium (--proxy-server). Every request the browser
// makes comes through here. The host is resolved once, every resolved
// address is checked against the blocklist (one blocked address refuses the
// whole answer, which is how a rebinding answer shows itself), and then the
// vetted addresses are tried in order, each for at most CONNECT_TIMEOUT_MS,
// so a site whose first address is unreachable still loads. There is no
// second lookup a DNS rebinding answer could slip into: connections go to
// the vetted IPs themselves, never to the name.

const ALLOWED_PORTS = new Set([80, 443])
const IDLE_TIMEOUT_MS = 30_000
// How long one address gets to accept the connection before the next is tried.
export const CONNECT_TIMEOUT_MS = 3000

function splitHostPort(authority, defaultPort) {
  if (authority.startsWith('[')) {
    const end = authority.indexOf(']')
    const host = authority.slice(1, end)
    const port = authority.slice(end + 2) || defaultPort
    return { host, port: Number(port) }
  }
  const i = authority.lastIndexOf(':')
  if (i === -1) return { host: authority, port: Number(defaultPort) }
  return { host: authority.slice(0, i), port: Number(authority.slice(i + 1)) }
}

const defaultLookup = async (host) =>
  (await dns.lookup(host, { all: true, verbatim: true })).map((a) => a.address)

// lookup, connect, isBlocked and connectTimeoutMs can be replaced, for tests
// that must not touch the network.
export function createEgressProxy({
  log = console,
  lookup = defaultLookup,
  connect = net.connect,
  isBlocked = isBlockedAddress,
  connectTimeoutMs = CONNECT_TIMEOUT_MS
} = {}) {
  const blockedHosts = new Set()
  const stats = { allowed: 0, blocked: 0, connectFailed: 0 }

  async function vet(host, port) {
    if (!ALLOWED_PORTS.has(port)) return { ok: false, reason: `port ${port} not allowed` }
    let addresses
    if (net.isIP(host)) {
      addresses = [host]
    } else {
      try {
        addresses = [...new Set(await lookup(host))]
      } catch (err) {
        return { ok: false, reason: `could not resolve (${err.code || err.message})` }
      }
    }
    if (addresses.length === 0) return { ok: false, reason: 'no addresses' }
    // If ANY answer is blocked, refuse all of them: a mixed answer is a
    // rebinding tell, and a blocked address is never tried, whatever else
    // in the answer fails to connect.
    const bad = addresses.find(isBlocked)
    if (bad) return { ok: false, reason: `blocked address ${bad}` }
    return { ok: true, address: addresses[0], addresses }
  }

  function connectOne(address, port) {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: address, port })
      let done = false
      const finish = (err) => {
        if (done) return
        done = true
        clearTimeout(timer)
        if (err) {
          socket.destroy()
          reject(err)
          return
        }
        socket.on('error', () => {}) // the caller adds its own handlers
        socket.setNoDelay(true)
        resolve(socket)
      }
      const timer = setTimeout(() => finish(Object.assign(new Error('connect timeout'), { code: 'ETIMEDOUT' })), connectTimeoutMs)
      socket.once('connect', () => finish(null))
      socket.once('error', (err) => finish(err))
    })
  }

  // The first address that accepts the connection, in the order given. An
  // address that fails the blocklist is never connected to, even here (vet
  // has already refused such answers; this is the second check).
  async function connectFirst(addresses, port) {
    let lastError = null
    for (const [i, address] of addresses.entries()) {
      if (isBlocked(address)) throw new Error(`blocked address ${address}`)
      try {
        return { socket: await connectOne(address, port), address }
      } catch (err) {
        lastError = err
        stats.connectFailed++
        if (i < addresses.length - 1) {
          log.warn?.(`[egress] ${address}:${port} did not connect (${err.code || err.message}), trying the next address`)
        }
      }
    }
    throw lastError || new Error('no addresses')
  }

  function refuse(host, reason) {
    stats.blocked++
    blockedHosts.add(host)
    log.warn?.(`[egress] blocked ${host}: ${reason}`)
  }

  const server = http.createServer(async (req, res) => {
    // Plain HTTP arrives in absolute form: GET http://host/path
    let target
    try { target = new URL(req.url) } catch {
      res.writeHead(400).end()
      return
    }
    if (target.protocol !== 'http:') {
      refuse(target.hostname, `scheme ${target.protocol}`)
      res.writeHead(403).end()
      return
    }
    const host = target.hostname.replace(/^\[|\]$/g, '')
    const port = Number(target.port || 80)
    const verdict = await vet(host, port)
    if (!verdict.ok) {
      refuse(host, verdict.reason)
      res.writeHead(403).end()
      return
    }
    stats.allowed++

    let connected
    try {
      connected = await connectFirst(verdict.addresses, port)
    } catch {
      if (!res.headersSent) res.writeHead(502)
      res.end()
      return
    }
    req.socket?.setNoDelay(true)

    const headers = { ...req.headers }
    delete headers['proxy-connection']
    delete headers['proxy-authorization']
    // No agent: with one, Node would open its own connection and ignore the
    // vetted socket. Without it, this request uses exactly the socket that
    // was just connected to a vetted address, and closes it afterwards.
    const upstream = http.request({
      createConnection: () => connected.socket,
      host: connected.address,
      port,
      method: req.method,
      path: target.pathname + target.search,
      headers,
      setHost: false,
      timeout: IDLE_TIMEOUT_MS
    }, (up) => {
      res.writeHead(up.statusCode || 502, up.headers)
      up.pipe(res)
    })
    upstream.on('timeout', () => upstream.destroy())
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
    req.pipe(upstream)
  })

  // HTTPS and WSS: CONNECT host:port
  server.on('connect', async (req, client, head) => {
    client.on('error', () => {})
    client.setNoDelay(true)
    const { host, port } = splitHostPort(req.url || '', 443)
    const verdict = await vet(host, port)
    if (!verdict.ok) {
      refuse(host, verdict.reason)
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n')
      return
    }
    stats.allowed++
    let upstream
    try {
      upstream = (await connectFirst(verdict.addresses, port)).socket
    } catch {
      client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
      return
    }
    if (client.destroyed) { upstream.destroy(); return }
    upstream.on('error', () => client.destroy())
    upstream.setTimeout(IDLE_TIMEOUT_MS, () => upstream.destroy())
    client.on('close', () => upstream.destroy())
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head?.length) upstream.write(head)
    upstream.pipe(client)
    client.pipe(upstream)
  })

  // Plain ws:// upgrades in absolute form
  server.on('upgrade', async (req, client, head) => {
    client.on('error', () => {})
    client.setNoDelay(true)
    let target
    try { target = new URL(req.url) } catch { client.destroy(); return }
    const host = target.hostname.replace(/^\[|\]$/g, '')
    const port = Number(target.port || 80)
    const verdict = target.protocol === 'http:' || target.protocol === 'ws:'
      ? await vet(host, port)
      : { ok: false, reason: `scheme ${target.protocol}` }
    if (!verdict.ok) {
      refuse(host, verdict.reason)
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n')
      return
    }
    stats.allowed++
    let upstream
    try {
      upstream = (await connectFirst(verdict.addresses, port)).socket
    } catch {
      client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
      return
    }
    if (client.destroyed) { upstream.destroy(); return }
    const lines = [`${req.method} ${target.pathname}${target.search} HTTP/1.1`]
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      if (/^proxy-/i.test(req.rawHeaders[i])) continue
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`)
    }
    upstream.on('error', () => client.destroy())
    client.on('close', () => upstream.destroy())
    upstream.write(lines.join('\r\n') + '\r\n\r\n')
    if (head?.length) upstream.write(head)
    upstream.pipe(client)
    client.pipe(upstream)
  })

  return {
    server,
    blockedHosts,
    stats,
    vet,
    connectFirst,
    listen() {
      return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server.address().port))
      })
    },
    close() {
      return new Promise((resolve) => server.close(() => resolve()))
    }
  }
}
