// Generates the extension icons (brand-blue rounded square with a white
// "lens" ring) as real PNGs using only Node builtins.
import { deflateSync } from 'zlib'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function makePng(size) {
  // RGBA raster
  const raster = Buffer.alloc(size * size * 4)
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const corner = size * 0.2
  const ringOuter = size * 0.32
  const ringInner = size * 0.2
  const dot = size * 0.1

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // rounded-rect mask
      const dx = Math.max(corner - x, x - (size - 1 - corner), 0)
      const dy = Math.max(corner - y, y - (size - 1 - corner), 0)
      const inside = Math.hypot(dx, dy) <= corner
      if (!inside) continue // transparent

      const d = Math.hypot(x - cx, y - cy)
      let r = 0x1d, g = 0x3f, b = 0xd8 // brand blue
      if ((d <= ringOuter && d >= ringInner) || d <= dot) {
        r = g = b = 0xff // white ring + centre dot
      }
      raster[i] = r
      raster[i + 1] = g
      raster[i + 2] = b
      raster[i + 3] = 255
    }
  }

  // Add filter byte 0 per scanline
  const rows = []
  for (let y = 0; y < size; y++) {
    rows.push(Buffer.from([0]))
    rows.push(raster.subarray(y * size * 4, (y + 1) * size * 4))
  }
  const idat = deflateSync(Buffer.concat(rows))

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), makePng(size))
  console.log(`icons/icon${size}.png`)
}
