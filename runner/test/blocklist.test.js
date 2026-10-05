import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isBlockedAddress } from '../src/blocklist.js'

test('blocks loopback, private, link-local, CGNAT, metadata and reserved IPv4', () => {
  for (const ip of [
    '127.0.0.1', '127.255.255.254', '10.0.0.1', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '169.254.169.254', '169.254.0.1', '100.64.0.1', '100.127.255.255',
    '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1'
  ]) {
    assert.equal(isBlockedAddress(ip), true, ip)
  }
})

test('blocks IPv6 loopback, unique local, link-local and IPv4 embeddings', () => {
  for (const ip of [
    '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1%eth0',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '::ffff:a9fe:a9fe',
    '64:ff9b::a9fe:a9fe', '2002:a9fe:a9fe::1', 'ff02::1'
  ]) {
    assert.equal(isBlockedAddress(ip), true, ip)
  }
})

test('allows public addresses', () => {
  for (const ip of ['93.184.215.14', '1.1.1.1', '8.8.8.8', '2606:4700:4700::1111', '::ffff:1.1.1.1']) {
    assert.equal(isBlockedAddress(ip), false, ip)
  }
})

test('refuses things that are not IP addresses', () => {
  assert.equal(isBlockedAddress('localhost'), true)
  assert.equal(isBlockedAddress(''), true)
})
