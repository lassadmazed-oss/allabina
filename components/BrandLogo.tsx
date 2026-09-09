/**
 * شعار اللَّبنة: المَعلَم + الاسم نصّاً.
 *
 * كان الرأس يعرض ملفّ الشعار الكامل — الاسم مرسوم داخل الصورة — بارتفاع
 * 52 بكسل: الاسم يصير لطخة، وتركيب المَعلَم المائل (مصباح أسفل اليسار،
 * مبانٍ أعلى اليمين) يُقرأ ميلاً في الصورة كلّها. هنا المَعلَم وحده في
 * مربّع ثابت، والاسم نصّ حقيقي بخطّ الموقع: حادّ في كلّ مقاس، على خطّ
 * قاعدة واحد، ويُترجَم.
 */
export default function BrandLogo({
  brand,
  sub,
  size = 40,
  tone = 'light',
  subFrom,
}: {
  brand: string
  sub?: string
  /** ارتفاع المَعلَم بالبكسل — الاسم يتناسب معه */
  size?: number
  /** على أرضية فاتحة (الرأس) أو داكنة (التذييل) */
  tone?: 'light' | 'dark'
  /** الاسم الفرعي يظهر من هذا المقاس فما فوق — تحته يكفي الاسم وحده */
  subFrom?: 'xl'
}) {
  const ink = tone === 'dark' ? 'text-white' : 'text-brand-deep'
  const muted = tone === 'dark' ? 'text-white/70' : 'text-muted'
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/logo-mark.png"
          alt=""
          className="max-h-full max-w-full object-contain"
          decoding="async"
        />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <b
          className={`display font-semibold ${ink}`}
          style={{ fontSize: Math.round(size * 0.5), lineHeight: 1.1 }}
        >
          {brand}
        </b>
        {sub && (
          <small
            className={`mt-0.5 ${muted} ${subFrom === 'xl' ? 'hidden xl:block' : ''}`}
            style={{ fontSize: Math.max(10, Math.round(size * 0.26)), lineHeight: 1.2 }}
          >
            {sub}
          </small>
        )}
      </span>
    </span>
  )
}
