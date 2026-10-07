// The egress proxy tries every vetted address in order, 3 seconds each in
// production (shortened here), and never connects to an address that fails
// the blocklist. The lookup and the connections are faked, so no test here
// touches the network:
//   docker compose run --rm runner node --test test/egressFallback.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { createEgressProxy, CONNECT_TIMEOUT_MS } from '../src/egressProxy.js'

const quiet = { warn() {} }
let echoServer
let echoPort
let webServer
let webPort
let closedPort

before(async () => {
  echoServer = net.createServer((sock) => { sock.on('error', () => {}); sock.pipe(sock) })
  await new Promise((resolve) => echoServer.listen(0, '127.0.0.1', resolve))
  echoPort = echoServer.address().port
  webServer = http.createServer((req, res) => res.end(`reached ${req.headers.host}`))
  await new Promise((resolve) => webServer.listen(0, '127.0.0.1', resolve))
  webPort = webServer.address().port
  // A port nothing listens on, so a connection to it is refused at once.
  const probe = net.createServer()
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
  closedPort = probe.address().port
  await new Promise((resolve) => probe.close(resolve))
})
after(async () => {
  echoServer.close()
  webServer.close()
})

// A proxy whose lookup answers `answer` and whose connections are faked per
// address: 'hang' never answers, 'refuse' is refused at once, 'echo' reaches
// the echo server, 'web' reaches the web server.
async function makeProxy(answer, behaviour, connectTimeoutMs = 150) {
  const attempts = []
  const noDelay = []
  const connect = ({ host }) => {
    attempts.push(host)
    const how = behaviour[host] || 'refuse'
    let socket
    if (how === 'hang') socket = new net.Socket()
    else if (how === 'refuse') socket = net.connect(closedPort, '127.0.0.1')
    else socket = net.connect(how === 'web' ? webPort : echoPort, '127.0.0.1')
    const original = socket.setNoDelay.bind(socket)
    socket.setNoDelay = (value) => { noDelay.push({ host, value }); return original(value) }
    return socket
  }
  const proxy = createEgressProxy({ log: quiet, lookup: async () => answer, connect, connectTimeoutMs })
  const clientNoDelay = []
  proxy.server.prependListener('connection', (socket) => {
    const original = socket.setNoDelay.bind(socket)
    socket.setNoDelay = (value) => { clientNoDelay.push(value); return original(value) }
  })
  const port = await proxy.listen()
  const stop = () => { proxy.server.closeAllConnections?.(); proxy.server.close() }
  return { proxy, port, attempts, noDelay, clientNoDelay, stop }
}

// CONNECT through the proxy; when it says 200, send "ping" and wait for it
// to come back from the echo server.
function tunnel(port, authority) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`)
    })
    let data = ''
    let status = null
    sock.on('data', (chunk) => {
      data += chunk
      if (status === null && data.includes('\r\n\r\n')) {
        status = data.split('\r\n')[0]
        if (!status.includes(' 200 ')) { sock.destroy(); resolve({ status, ms: Date.now() - started }); return }
        data = data.slice(data.indexOf('\r\n\r\n') + 4)
        sock.write('ping')
      }
      if (status !== null && data.includes('ping')) { sock.destroy(); resolve({ status, echoed: true, ms: Date.now() - started }) }
    })
    sock.on('error', reject)
    sock.on('close', () => { if (status === null) resolve({ status: null, ms: Date.now() - started }) })
  })
}

function getThrough(port, url) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: url, headers: { host: new URL(url).host } }, (res) => {
      let body = ''
      res.on('data', (d) => { body += d })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

test('the connect timeout is 3 seconds in production', () => {
  assert.equal(CONNECT_TIMEOUT_MS, 3000)
})

test('first address does not answer, second does: the tunnel opens on the second', async () => {
  const t = await makeProxy(['8.8.8.1', '8.8.8.2'], { '8.8.8.1': 'hang', '8.8.8.2': 'echo' })
  try {
    const result = await tunnel(t.port, 'example.test:443')
    assert.match(result.status, / 200 /)
    assert.equal(result.echoed, true, 'data goes through to the second address')
    assert.deepEqual(t.attempts, ['8.8.8.1', '8.8.8.2'], 'in order')
    assert.ok(result.ms >= 140, `waited for the timeout first (${result.ms} ms)`)
    assert.equal(t.proxy.stats.connectFailed, 1)
  } finally { t.stop() }
})

test('first address is refused at once, second answers', async () => {
  const t = await makeProxy(['8.8.8.1', '8.8.8.2'], { '8.8.8.1': 'refuse', '8.8.8.2': 'echo' })
  try {
    const result = await tunnel(t.port, 'example.test:443')
    assert.equal(result.echoed, true)
    assert.deepEqual(t.attempts, ['8.8.8.1', '8.8.8.2'])
    assert.ok(result.ms < 140, `no timeout to wait for (${result.ms} ms)`)
  } finally { t.stop() }
})

test('the same address twice in an answer is tried once', async () => {
  const t = await makeProxy(['8.8.8.1', '8.8.8.1', '8.8.8.2', '8.8.8.2'], { '8.8.8.1': 'refuse', '8.8.8.2': 'echo' })
  try {
    assert.equal((await tunnel(t.port, 'example.test:443')).echoed, true)
    assert.deepEqual(t.attempts, ['8.8.8.1', '8.8.8.2'])
  } finally { t.stop() }
})

test('every address fails: a plain 502, each tried once, in order', async () => {
  const t = await makeProxy(['8.8.8.1', '8.8.8.2', '8.8.8.3'], { '8.8.8.1': 'refuse', '8.8.8.2': 'hang', '8.8.8.3': 'refuse' })
  try {
    const result = await tunnel(t.port, 'example.test:443')
    assert.match(result.status, / 502 /)
    assert.deepEqual(t.attempts, ['8.8.8.1', '8.8.8.2', '8.8.8.3'])
  } finally { t.stop() }
})

test('an address that fails the blocklist is never tried, even if the others fail', async () => {
  for (const answer of [
    ['8.8.8.1', '10.0.0.5', '8.8.8.2'], // blocked in the middle
    ['8.8.8.1', '8.8.8.2', '169.254.169.254'], // blocked last, after others that fail
    ['10.0.0.5'], // only a blocked one
    ['8.8.8.1', '127.0.0.1'] // loopback after one that fails
  ]) {
    const t = await makeProxy(answer, {}) // every address would be refused
    try {
      const result = await tunnel(t.port, 'example.test:443')
      assert.match(result.status, / 403 /, answer.join(','))
      assert.deepEqual(t.attempts, [], `nothing is connected to for ${answer.join(',')}`)
      assert.equal(t.proxy.stats.blocked, 1)
    } finally { t.stop() }
  }
})

test('connectFirst checks the blocklist again and never connects to a blocked address', async () => {
  const t = await makeProxy([], { '8.8.8.1': 'refuse', '8.8.8.2': 'echo' })
  try {
    // Blocked after one that fails: the failing one is tried, the blocked one never.
    await assert.rejects(t.proxy.connectFirst(['8.8.8.1', '10.0.0.5', '8.8.8.2'], 443), /blocked address 10\.0\.0\.5/)
    assert.deepEqual(t.attempts, ['8.8.8.1'])
    // Blocked first: nothing at all is connected to, not even the good one after it.
    t.attempts.length = 0
    await assert.rejects(t.proxy.connectFirst(['10.0.0.5', '8.8.8.2'], 443), /blocked address 10\.0\.0\.5/)
    assert.deepEqual(t.attempts, [])
  } finally { t.stop() }
})

test('plain HTTP falls through to the second address too', async () => {
  const t = await makeProxy(['8.8.8.1', '8.8.8.2'], { '8.8.8.1': 'hang', '8.8.8.2': 'web' })
  try {
    const result = await getThrough(t.port, 'http://example.test/page')
    assert.equal(result.status, 200)
    assert.equal(result.body, 'reached example.test')
    assert.deepEqual(t.attempts, ['8.8.8.1', '8.8.8.2'])
  } finally { t.stop() }
})

test('plain HTTP with every address failing is a 502', async () => {
  const t = await makeProxy(['8.8.8.1', '8.8.8.2'], {})
  try {
    assert.equal((await getThrough(t.port, 'http://example.test/')).status, 502)
    assert.deepEqual(t.attempts, ['8.8.8.1', '8.8.8.2'])
  } finally { t.stop() }
})

test('setNoDelay is on for both sockets of a tunnel', async () => {
  const t = await makeProxy(['8.8.8.2'], { '8.8.8.2': 'echo' })
  try {
    assert.equal((await tunnel(t.port, 'example.test:443')).echoed, true)
    assert.ok(t.clientNoDelay.includes(true), 'the browser side')
    assert.deepEqual(t.noDelay, [{ host: '8.8.8.2', value: true }], 'the site side')
  } finally { t.stop() }
})
