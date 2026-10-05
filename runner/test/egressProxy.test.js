import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { createEgressProxy } from '../src/egressProxy.js'

const quiet = { warn() {} }

function connectThrough(port, authority) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`)
    })
    let data = ''
    sock.on('data', (d) => { data += d; if (data.includes('\r\n\r\n')) { sock.destroy(); resolve(data.split('\r\n')[0]) } })
    sock.on('error', reject)
  })
}

function getThrough(port, url) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: url, headers: { host: new URL(url).host } }, (res) => {
      res.resume()
      resolve(res.statusCode)
    })
    req.on('error', reject)
    req.end()
  })
}

test('refuses CONNECT and plain HTTP to blocked targets', async () => {
  const proxy = createEgressProxy({ log: quiet })
  const port = await proxy.listen()
  try {
    for (const authority of ['127.0.0.1:443', '[::1]:443', '169.254.169.254:443', '10.0.0.1:443', '100.64.0.1:443', 'localhost:443']) {
      assert.match(await connectThrough(port, authority), /403/, authority)
    }
    for (const url of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://10.0.0.1/']) {
      assert.equal(await getThrough(port, url), 403, url)
    }
    // Only 80 and 443, even for a name that would otherwise be fine.
    assert.match(await connectThrough(port, 'example.com:5432'), /403/)
    assert.ok(proxy.stats.blocked >= 11)
  } finally {
    await proxy.close()
  }
})

test('refuses a host that resolves to a private address', async () => {
  const proxy = createEgressProxy({ log: quiet })
  try {
    // localhost resolves to loopback on every machine.
    const verdict = await proxy.vet('localhost', 443)
    assert.equal(verdict.ok, false)
  } finally {
    proxy.server.close()
  }
})
