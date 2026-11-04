import zlib from 'node:zlib'

// A small PNG reader, enough for the screenshots Chromium makes (8 bits per
// channel, RGB or RGBA, not interlaced), so the pre-check can look at pixels
// without a new dependency.

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function decodePng(buffer) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG')
  let width = 0
  let height = 0
  let channels = 0
  const parts = []
  for (let at = 8; at + 8 <= buffer.length;) {
    const length = buffer.readUInt32BE(at)
    const type = buffer.toString('latin1', at + 4, at + 8)
    const body = buffer.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      const depth = body[8]
      const colourType = body[9]
      if (depth !== 8 || (colourType !== 2 && colourType !== 6) || body[12] !== 0) throw new Error('unsupported PNG')
      channels = colourType === 2 ? 3 : 4
    } else if (type === 'IDAT') {
      parts.push(body)
    } else if (type === 'IEND') {
      break
    }
    at += 12 + length
  }
  if (!width || !height || !parts.length) throw new Error('damaged PNG')

  const raw = zlib.inflateSync(Buffer.concat(parts))
  const stride = width * channels
  if (raw.length < height * (stride + 1)) throw new Error('damaged PNG')
  const data = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? data[row + x - channels] : 0
      const up = y > 0 ? data[row - stride + x] : 0
      const upLeft = y > 0 && x >= channels ? data[row - stride + x - channels] : 0
      let add = 0
      if (filter === 1) add = left
      else if (filter === 2) add = up
      else if (filter === 3) add = (left + up) >> 1
      else if (filter === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        add = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
      } else if (filter !== 0) throw new Error('damaged PNG')
      data[row + x] = (raw[src + x] + add) & 255
    }
  }
  return { width, height, channels, data }
}

// sRGB byte <-> linear light, the space an SVG colour matrix works in unless
// the filter says otherwise.
const TO_LINEAR = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
})
function toSrgbByte(linear) {
  const l = Math.min(1, Math.max(0, linear))
  return 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055)
}

// What a colour matrix (a 4x5 list, as an SVG feColorMatrix takes it) does to
// one colour: [r, g, b] in, [r, g, b] out, bytes.
export function applyColourMatrix(matrix, r, g, b) {
  const lr = TO_LINEAR[r]
  const lg = TO_LINEAR[g]
  const lb = TO_LINEAR[b]
  return [
    toSrgbByte(matrix[0] * lr + matrix[1] * lg + matrix[2] * lb + matrix[4]),
    toSrgbByte(matrix[5] * lr + matrix[6] * lg + matrix[7] * lb + matrix[9]),
    toSrgbByte(matrix[10] * lr + matrix[11] * lg + matrix[12] * lb + matrix[14])
  ]
}

// The share of the picture (0..1) whose colour the matrix changes by at least
// `delta` in some channel (out of 255), looking at every `step`th pixel each
// way. Presence only: it says how much of the screen looks different, not
// whether anything is wrong with it.
export function changedShare(image, matrix, { delta, step = 4 }) {
  const { width, height, channels, data } = image
  let seen = 0
  let changed = 0
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const out = applyColourMatrix(matrix, r, g, b)
      seen++
      if (Math.max(Math.abs(out[0] - r), Math.abs(out[1] - g), Math.abs(out[2] - b)) >= delta) changed++
    }
  }
  return seen === 0 ? 0 : changed / seen
}

// The same measure between two pictures of one page, taken with and without
// the filter: what a real filtered render actually changed. For checking the
// matrix-based number against the real thing.
export function measuredShare(plain, filtered, { delta, step = 4 }) {
  const { width, height, channels } = plain
  let seen = 0
  let changed = 0
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels
      const j = (y * filtered.width + x) * filtered.channels
      seen++
      const d = Math.max(
        Math.abs(plain.data[i] - filtered.data[j]),
        Math.abs(plain.data[i + 1] - filtered.data[j + 1]),
        Math.abs(plain.data[i + 2] - filtered.data[j + 2])
      )
      if (d >= delta) changed++
    }
  }
  return seen === 0 ? 0 : changed / seen
}
