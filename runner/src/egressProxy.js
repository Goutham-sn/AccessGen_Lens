import http from 'node:http'
import net from 'node:net'
import dns from 'node:dns/promises'
import { isBlockedAddress } from './blocklist.js'

// Egress proxy for Chromium (--proxy-server). Every request the browser
// makes comes through here. The host is resolved once, every resolved
// address is checked, and the connection goes to the vetted IP itself, so
// there is no second lookup a DNS rebinding answer could slip into.

const ALLOWED_PORTS = new Set([80, 443])
const IDLE_TIMEOUT_MS = 30_000

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

export function createEgressProxy({ log = console } = {}) {
  const blockedHosts = new Set()
  const stats = { allowed: 0, blocked: 0 }

  async function vet(host, port) {
    if (!ALLOWED_PORTS.has(port)) return { ok: false, reason: `port ${port} not allowed` }
    let addresses
    if (net.isIP(host)) {
      addresses = [host]
    } else {
      try {
        addresses = (await dns.lookup(host, { all: true, verbatim: true })).map((a) => a.address)
      } catch (err) {
        return { ok: false, reason: `could not resolve (${err.code || err.message})` }
      }
    }
    if (addresses.length === 0) return { ok: false, reason: 'no addresses' }
    // If ANY answer is private, refuse: a mixed answer is a rebinding tell.
    const bad = addresses.find(isBlockedAddress)
    if (bad) return { ok: false, reason: `blocked address ${bad}` }
    return { ok: true, address: addresses[0] }
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

    const headers = { ...req.headers }
    delete headers['proxy-connection']
    delete headers['proxy-authorization']
    const upstream = http.request({
      host: verdict.address,
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
    const { host, port } = splitHostPort(req.url || '', 443)
    const verdict = await vet(host, port)
    if (!verdict.ok) {
      refuse(host, verdict.reason)
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n')
      return
    }
    stats.allowed++
    const upstream = net.connect({ host: verdict.address, port }, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head?.length) upstream.write(head)
      upstream.pipe(client)
      client.pipe(upstream)
    })
    upstream.setTimeout(IDLE_TIMEOUT_MS, () => upstream.destroy())
    upstream.on('error', () => client.destroy())
    client.on('close', () => upstream.destroy())
  })

  // Plain ws:// upgrades in absolute form
  server.on('upgrade', async (req, client, head) => {
    client.on('error', () => {})
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
    const upstream = net.connect({ host: verdict.address, port }, () => {
      const lines = [`${req.method} ${target.pathname}${target.search} HTTP/1.1`]
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        if (/^proxy-/i.test(req.rawHeaders[i])) continue
        lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`)
      }
      upstream.write(lines.join('\r\n') + '\r\n\r\n')
      if (head?.length) upstream.write(head)
      upstream.pipe(client)
      client.pipe(upstream)
    })
    upstream.on('error', () => client.destroy())
    client.on('close', () => upstream.destroy())
  })

  return {
    server,
    blockedHosts,
    stats,
    vet,
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
