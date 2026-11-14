import { frame, layout, type Sketch } from '@/lib/sketch'
import { isolateNumbers } from '@/lib/format'

/**
 * الرسم التصوّري — SVG يُبنى في الخادم، بلا جافاسكريبت ولا مكتبة.
 *
 * ألوانٌ هادئة ومسمّيات: الهدف أن تُقرأ النسب بالعين، لا أن يبدو
 * مخطّطاً معمارياً. فلا حيطان ولا أبواب ولا شبابيك — ما لا نعرفه لا
 * نرسمه.
 */
const FILL: Record<string, string> = {
  living: 'var(--color-brand-soft)',
  bedroom: 'var(--color-surface-2)',
  kitchen: 'var(--color-gold-soft)',
  bath: 'var(--color-surface-2)',
  circulation: 'var(--color-ground)',
}

export default function SketchPlan({
  sketch,
  surface,
  caption,
}: {
  sketch: Sketch
  surface: number
  caption: string
}) {
  if (!sketch.fits) return null

  const W = 100
  const H = 70
  const boxes = layout(sketch.zones, W, H)
  const f = frame(surface)

  return (
    <figure className="m-0">
      <svg
        viewBox={`-1 -1 ${W + 2} ${H + 2}`}
        className="w-full rounded border border-line bg-surface"
        role="img"
        aria-label={caption}
      >
        {boxes.map((b, i) => {
          // الاسم والمساحة يختفيان في الصناديق الصغيرة بدل أن يفيضا
          const roomy = b.w > 16 && b.h > 11
          const tiny = b.w < 9 || b.h < 7
          return (
            <g key={i}>
              <rect
                x={b.x + 0.5}
                y={b.y + 0.5}
                width={Math.max(0, b.w - 1)}
                height={Math.max(0, b.h - 1)}
                rx={0.8}
                fill={FILL[b.kind] ?? 'var(--color-surface-2)'}
                stroke="var(--color-line-strong)"
                strokeWidth={0.3}
              />
              {!tiny && (
                <text
                  x={b.x + b.w / 2}
                  y={b.y + b.h / 2 + (roomy ? -1 : 1)}
                  textAnchor="middle"
                  fontSize={roomy ? 3.4 : 2.9}
                  fill="var(--color-ink)"
                  style={{ fontWeight: 600 }}
                >
                  {b.label}
                </text>
              )}
              {roomy && (
                <text
                  x={b.x + b.w / 2}
                  y={b.y + b.h / 2 + 3.6}
                  textAnchor="middle"
                  fontSize={2.8}
                  fill="var(--color-muted)"
                >
                  ≈ {b.area} م²
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <figcaption className="mt-2 text-xs leading-6 text-faint">
        {caption} · <span className="num">{isolateNumbers(`${f.w}×${f.h}`)}</span> م تقريباً
      </figcaption>
    </figure>
  )
}
