// مولّد PNG بلا مكتبات خارجية — zlib وحدها كافية.
// نستعمله لتوليد رسوم توضيحية للبيانات التجريبية: لا نستورد صوراً من
// الإنترنت (حقوق)، ولا نضع صور بيوت أناس آخرين على أنّها إنجاز اللَّبنة.
import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** لوحة رسم بسيطة: RGB خام، أصل الإحداثيات أعلى اليسار */
export class Canvas {
  constructor(width, height) {
    this.w = width
    this.h = height
    this.px = new Uint8Array(width * height * 3)
  }

  set(x, y, r, g, b) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 3
    this.px[i] = r
    this.px[i + 1] = g
    this.px[i + 2] = b
  }

  /** مزج مع ما تحته — alpha بين 0 و1 */
  blend(x, y, r, g, b, a = 1) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 3
    this.px[i] = this.px[i] * (1 - a) + r * a
    this.px[i + 1] = this.px[i + 1] * (1 - a) + g * a
    this.px[i + 2] = this.px[i + 2] * (1 - a) + b * a
  }

  rect(x, y, w, h, [r, g, b], a = 1) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.blend(xx, yy, r, g, b, a)
  }

  /** تدرّج عمودي بين لونين */
  verticalGradient(y0, y1, top, bottom) {
    for (let y = y0; y < y1; y++) {
      const k = (y - y0) / Math.max(1, y1 - y0 - 1)
      const r = top[0] + (bottom[0] - top[0]) * k
      const g = top[1] + (bottom[1] - top[1]) * k
      const b = top[2] + (bottom[2] - top[2]) * k
      for (let x = 0; x < this.w; x++) this.set(x, y, r, g, b)
    }
  }

  disc(cx, cy, radius, [r, g, b], a = 1) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d <= radius) this.blend(x, y, r, g, b, a * Math.min(1, radius - d + 1))
      }
    }
  }

  line(x0, y0, x1, y1, [r, g, b], thickness = 1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      const half = thickness / 2
      for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) this.set(x + dx, y + dy, r, g, b)
    }
  }

  /** مثلّث ممتلئ — للأسقف */
  triangle(ax, ay, bx, by, cx, cy, [r, g, b]) {
    const minX = Math.floor(Math.min(ax, bx, cx))
    const maxX = Math.ceil(Math.max(ax, bx, cx))
    const minY = Math.floor(Math.min(ay, by, cy))
    const maxY = Math.ceil(Math.max(ay, by, cy))
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
    if (area === 0) return
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((bx - ax) * (y - ay) - (x - ax) * (by - ay)) / area
        const w1 = ((x - ax) * (cy - ay) - (cx - ax) * (y - ay)) / area
        if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) this.set(x, y, r, g, b)
      }
    }
  }

  /** حبيبات خفيفة حتى لا تبدو الصورة مسطّحة تماماً */
  grain(amount, rand) {
    for (let i = 0; i < this.px.length; i += 3) {
      const n = (rand() - 0.5) * amount
      this.px[i] = Math.max(0, Math.min(255, this.px[i] + n))
      this.px[i + 1] = Math.max(0, Math.min(255, this.px[i + 1] + n))
      this.px[i + 2] = Math.max(0, Math.min(255, this.px[i + 2] + n))
    }
  }

  toPNG() {
    const raw = Buffer.alloc(this.h * (this.w * 3 + 1))
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 3 + 1)] = 0 // مرشّح None
      Buffer.from(this.px.buffer, y * this.w * 3, this.w * 3).copy(
        raw,
        y * (this.w * 3 + 1) + 1
      )
    }

    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(this.w, 0)
    ihdr.writeUInt32BE(this.h, 4)
    ihdr[8] = 8 // عمق البت
    ihdr[9] = 2 // RGB
    ihdr[10] = 0
    ihdr[11] = 0
    ihdr[12] = 0

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  }
}

/** مولّد عشوائي ثابت البذرة: نفس الحالة تعطي نفس الصور في كلّ تشغيل */
export function seededRandom(seed) {
  let s = 0
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  s = s || 1
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}
