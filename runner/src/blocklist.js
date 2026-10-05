import net from 'node:net'
import os from 'node:os'
import dns from 'node:dns/promises'

// Addresses the browser must never reach. Checked by the egress proxy on
// every resolved address of every request.
const V4 = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, includes 169.254.169.254 cloud metadata
  ['172.16.0.0', 12], // private, includes Docker's default bridge networks
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4] // reserved, includes 255.255.255.255
]
const V6 = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64, can embed any IPv4 address
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4, can embed any IPv4 address
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8] // multicast
]

const list = new net.BlockList()
for (const [addr, prefix] of V4) list.addSubnet(addr, prefix, 'ipv4')
for (const [addr, prefix] of V6) list.addSubnet(addr, prefix, 'ipv6')

// IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) forms are
// checked as the IPv4 address they carry.
function unwrapV4(address) {
  const m = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (m) return m[1]
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address)
  if (hex) {
    const hi = parseInt(hex[1], 16)
    const lo = parseInt(hex[2], 16)
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  }
  return null
}

export function isBlockedAddress(address) {
  const family = net.isIP(address)
  if (family === 0) return true // not an IP at all: refuse
  if (family === 6) {
    const v4 = unwrapV4(address.split('%')[0])
    if (v4) return list.check(v4, 'ipv4')
    return list.check(address.split('%')[0], 'ipv6')
  }
  return list.check(address, 'ipv4')
}

// The container's own networks and the compose services, whatever ranges
// Docker gave them, so the browser cannot reach Postgres, Redis, MinIO or
// the backend even on a custom network.
export async function addLocalNetworks(serviceNames = []) {
  const added = []
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const a of iface || []) {
      if (!a.cidr) continue
      const [addr, prefix] = a.cidr.split('/')
      const family = a.family === 'IPv6' || a.family === 6 ? 'ipv6' : 'ipv4'
      try {
        list.addSubnet(addr, Number(prefix), family)
        added.push(a.cidr)
      } catch { /* odd interface, skip */ }
    }
  }
  for (const name of serviceNames) {
    try {
      for (const { address, family } of await dns.lookup(name, { all: true })) {
        list.addAddress(address, family === 6 ? 'ipv6' : 'ipv4')
        added.push(`${name}=${address}`)
      }
    } catch { /* service not resolvable from here, nothing to add */ }
  }
  return added
}
