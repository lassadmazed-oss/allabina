// رسوم توضيحية لمراحل الورشة: قبل · أثناء · بعد.
// ليست صوراً فوتوغرافية ولا تدّعي ذلك — البيانات التجريبية موسومة في
// الواجهة بشارة «بيانات تجريبية»، والرسم هنا يوضّح المرحلة لا أكثر.
import { Canvas, seededRandom } from './png.mjs'

const W = 800
const H = 600

// ألوان قريبة من هوية اللَّبنة وضوء صفاقس
const SKY_TOP = [176, 205, 228]
const SKY_LOW = [232, 236, 242]
const SUN = [247, 239, 223]
const GROUND = [196, 184, 160]
const GROUND_DARK = [168, 156, 132]
const CONCRETE = [178, 178, 172]
const CONCRETE_DARK = [148, 148, 142]
const BRICK = [176, 122, 84]
const BRICK_DARK = [150, 100, 68]
const WALL = [238, 234, 226]
const WALL_SHADE = [214, 209, 199]
const ROOF = [140, 96, 60]
const WOOD = [166, 122, 74]
const DOOR = [29, 58, 95]
const GLASS = [124, 158, 186]
const GLASS_LIT = [240, 214, 150]
const STEEL = [110, 116, 124]
const GREEN = [122, 146, 96]

function backdrop(c, rand, { warm = false } = {}) {
  c.verticalGradient(0, Math.round(H * 0.62), SKY_TOP, warm ? [246, 232, 210] : SKY_LOW)
  c.disc(Math.round(W * 0.8), Math.round(H * 0.16), 46, SUN, 0.85)

  // خطّ أفق المدينة بعيداً
  let x = 0
  while (x < W) {
    const bw = 30 + Math.floor(rand() * 60)
    const bh = 24 + Math.floor(rand() * 54)
    const y = Math.round(H * 0.62) - bh
    c.rect(x, y, bw, bh, [206, 208, 210], 0.55)
    x += bw + 6 + Math.floor(rand() * 14)
  }

  c.rect(0, Math.round(H * 0.62), W, H, GROUND)
  c.rect(0, Math.round(H * 0.62), W, 6, GROUND_DARK)
}

function rubble(c, rand, count) {
  for (let i = 0; i < count; i++) {
    const x = 40 + rand() * (W - 120)
    const y = H * 0.66 + rand() * (H * 0.28)
    const s = 6 + rand() * 16
    c.rect(x, y, s, s * 0.6, rand() > 0.5 ? BRICK : CONCRETE_DARK, 0.9)
  }
}

function windows(c, x, y, w, h, cols, rows, colour) {
  const gapX = w / (cols + 1)
  const gapY = h / (rows + 1)
  const ww = gapX * 0.62
  const wh = gapY * 0.58
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const wx = x + gapX * (col + 1) - ww / 2
      const wy = y + gapY * (r + 1) - wh / 2
      c.rect(wx, wy, ww, wh, colour)
      c.rect(wx, wy, ww, 2, [255, 255, 255], 0.5)
      c.line(wx + ww / 2, wy, wx + ww / 2, wy + wh, [255, 255, 255], 1)
    }
  }
}

/** قبل: أرض وجدران واطئة وركام — الحالة كما وجدها الفريق */
function sceneBefore(c, rand) {
  backdrop(c, rand)
  const baseY = Math.round(H * 0.62)
  const wallH = 70 + rand() * 40
  const x0 = Math.round(W * 0.2)
  const w = Math.round(W * 0.58)

  // أساسات مكشوفة
  c.rect(x0 - 14, baseY + 26, w + 28, 16, CONCRETE_DARK)
  // جدران غير مكتملة بارتفاعات متفاوتة
  let x = x0
  while (x < x0 + w) {
    const seg = Math.min(40 + rand() * 50, x0 + w - x)
    const h = wallH * (0.55 + rand() * 0.45)
    const topY = baseY + 26 - h
    c.rect(x, topY, seg, h, rand() > 0.4 ? BRICK : BRICK_DARK)
    // صفوف الآجرّ داخل حدود القطعة وحدها — لا خطوط معلّقة في السماء
    for (let y = topY + 6; y < baseY + 26; y += 11) c.line(x, y, x + seg, y, BRICK_DARK, 1)
    x += seg
  }

  rubble(c, rand, 26)
  c.grain(2, rand)
}

/** أثناء: هيكل وأعمدة وسقالات ورافعة */
function sceneProgress(c, rand, floors = 2) {
  backdrop(c, rand)
  const baseY = Math.round(H * 0.62) + 26
  const x0 = Math.round(W * 0.18)
  const w = Math.round(W * 0.56)
  const floorH = 96

  c.rect(x0 - 16, baseY, w + 32, 16, CONCRETE_DARK)

  for (let f = 0; f < floors; f++) {
    const top = baseY - floorH * (f + 1)
    // بلاطة
    c.rect(x0 - 8, top, w + 16, 14, CONCRETE)
    c.rect(x0 - 8, top + 12, w + 16, 3, CONCRETE_DARK)
    // أعمدة
    const cols = 4
    for (let i = 0; i <= cols; i++) {
      const cx = x0 + (w / cols) * i - 9
      c.rect(cx, top + 14, 18, floorH - 14, CONCRETE)
      c.rect(cx + 14, top + 14, 4, floorH - 14, CONCRETE_DARK)
    }
    // جدران جزئية في الطابق الأسفل
    if (f === 0) {
      c.rect(x0 + 30, top + 30, w * 0.3, floorH - 44, BRICK)
      for (let y = top + 30; y < top + floorH - 14; y += 11) {
        c.line(x0 + 30, y, x0 + 30 + w * 0.3, y, BRICK_DARK, 1)
      }
    }
  }

  // حديد تسليح ناتئ من السطح
  const topY = baseY - floorH * floors
  for (let i = 0; i < 14; i++) {
    const rx = x0 + rand() * w
    c.line(rx, topY, rx + (rand() - 0.5) * 8, topY - 16 - rand() * 14, STEEL, 2)
  }

  // سقالات
  const sx = x0 + w + 22
  c.line(sx, baseY, sx, topY - 20, WOOD, 4)
  c.line(sx + 34, baseY, sx + 34, topY - 20, WOOD, 4)
  for (let y = topY; y < baseY; y += 42) c.line(sx, y, sx + 34, y, WOOD, 3)

  // رافعة
  const cranX = Math.round(W * 0.9)
  c.line(cranX, baseY, cranX, 70, STEEL, 6)
  c.line(cranX - 150, 70, cranX + 40, 70, STEEL, 5)
  c.line(cranX - 110, 70, cranX - 110, 132, STEEL, 2)
  c.rect(cranX - 124, 132, 28, 20, [186, 142, 60])

  rubble(c, rand, 14)
  c.grain(2, rand)
}

/** بعد: مسكن مكتمل — الحالة كما سُلّمت */
function sceneAfter(c, rand, { floors = 2, pitchedRoof = true } = {}) {
  backdrop(c, rand, { warm: true })
  const baseY = Math.round(H * 0.62) + 26
  const x0 = Math.round(W * 0.22)
  const w = Math.round(W * 0.52)
  const floorH = 104
  const top = baseY - floorH * floors

  c.rect(x0 - 12, baseY, w + 24, 14, CONCRETE_DARK)
  c.rect(x0, top, w, floorH * floors, WALL)
  c.rect(x0 + w - 26, top, 26, floorH * floors, WALL_SHADE)

  if (pitchedRoof) {
    c.triangle(x0 - 26, top, x0 + w + 26, top, x0 + w / 2, top - 74, ROOF)
  } else {
    c.rect(x0 - 18, top - 16, w + 36, 18, CONCRETE)
    // سور السطح
    for (let x = x0 - 18; x < x0 + w + 18; x += 26) c.rect(x, top - 34, 12, 20, WALL_SHADE)
  }

  for (let f = 0; f < floors; f++) {
    const fy = top + floorH * f
    windows(c, x0 + 16, fy + 14, w - 32, floorH - 34, 3, 1, f === 0 ? GLASS : GLASS_LIT)
    if (f > 0) c.line(x0, fy, x0 + w, fy, WALL_SHADE, 2)
  }

  // باب ومدخل
  const dw = 54
  const dx = x0 + w / 2 - dw / 2
  c.rect(dx, baseY - 96, dw, 96, DOOR)
  c.rect(dx + dw - 12, baseY - 56, 5, 5, [222, 200, 140])
  c.rect(dx - 12, baseY - 8, dw + 24, 10, CONCRETE)

  // شجيرات
  for (let i = 0; i < 5; i++) {
    const gx = x0 - 70 + rand() * (w + 140)
    if (Math.abs(gx - (x0 + w / 2)) < 70) continue
    c.disc(gx, baseY + 8 + rand() * 20, 12 + rand() * 10, GREEN, 0.9)
  }

  c.grain(2, rand)
}

/**
 * ثلاث لقطات لكلّ حالة: قبل، أثناء (طابق أو طابقان)، بعد.
 * البذرة من معرّف الحالة حتى تبقى الصور ذاتها عند إعادة التوليد.
 */
export function renderStages(seed) {
  const rand = seededRandom(seed)
  const floors = rand() > 0.45 ? 2 : 1
  const pitched = rand() > 0.5

  const before = new Canvas(W, H)
  sceneBefore(before, seededRandom(seed + ':before'))

  const progress = new Canvas(W, H)
  sceneProgress(progress, seededRandom(seed + ':progress'), floors)

  const after = new Canvas(W, H)
  sceneAfter(after, seededRandom(seed + ':after'), { floors, pitchedRoof: pitched })

  return [
    { stage: 'before', png: before.toPNG() },
    { stage: 'progress', png: progress.toPNG() },
    { stage: 'after', png: after.toPNG() },
  ]
}
