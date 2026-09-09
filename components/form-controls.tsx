/**
 * عناصر الاستمارات المشتركة: مجموعة، رقيقة، بطاقة اختيار، عدّاد، حقل.
 *
 * كانت داخل استمارة المطلب وحدها، فاستمارة المساندة بنت نسختها من
 * القوائم المنسدلة. شكل واحد لكلّ ما يُختار في الموقع كلّه: من تعلّم
 * «هذا يُنقر» في استمارة تعلّمه في الأخرى.
 */
/**
 * مجموعة داخل خطوة.
 *
 * لماذا: الخطوة الرابعة كانت ستّ قوائم متطابقة الشكل في شبكة واحدة،
 * كلّها موسومة «اختياري». فيقع سؤال «وين تسكن؟» في نفس الصفّ مع
 * «كيفاش دخلك؟» — والاثنان شيئان مختلفان: الأوّل وضعية سكن والثاني
 * استقرار دخل. من يقرأ بسرعة يخلطهما. العنوان والفاصل يقولان أين
 * ينتهي موضوع ويبدأ آخر.
 */
export function Group({
  title,
  lede,
  aside,
  children,
}: {
  title: string
  lede?: string
  /** عنصر في طرف العنوان — رابط شرح مثلاً */
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-6 border-t border-line pt-4 first:mt-0 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {aside}
      </div>
      {lede && <p className="mt-0.5 text-xs leading-6 text-muted">{lede}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  )
}


/**
 * خيار يُنقر.
 *
 * كانت الخيارات مستطيلات رمادية بحدّ رفيع لا تقول إن كانت أزراراً أو
 * عناوين. الشكل الواحد لكلّ ما يُختار — حدّ واضح، امتلاء عند الاختيار،
 * علامة صحّ حين يكون الاختيار متعدّداً — يجعل «هذا يُنقر» بديهياً.
 */
export function Chip({
  on,
  onClick,
  block = false,
  check = false,
  children,
}: {
  on: boolean
  onClick: () => void
  /** يملأ عرض خانته في شبكة */
  block?: boolean
  /** علامة صحّ — للاختيار المتعدّد حيث «مختار» لا يعني «الوحيد» */
  check?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3.5 text-sm transition active:scale-[0.98] ${
        block ? 'w-full justify-start text-start' : ''
      } ${
        on
          ? 'border-brand bg-brand text-white shadow-sm'
          : 'border-line bg-surface text-ink hover:border-brand/50 hover:bg-brand-soft/60'
      }`}
    >
      {check && (
        <span
          className={`flex size-4 shrink-0 items-center justify-center rounded border ${
            on ? 'border-white/70 bg-white/20' : 'border-line-strong'
          }`}
          aria-hidden="true"
        >
          {on && (
            <svg viewBox="0 0 12 12" className="size-3">
              <path fill="currentColor" d="M10.3 2.3 4.8 7.8 1.7 4.7.3 6.1l4.5 4.5 7-7z" />
            </svg>
          )}
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </button>
  )
}

/**
 * بطاقة اختيار بعنوان وسطر شرح — نفس شكل بطاقات الخطوة الأولى.
 * الاختيار الفرديّ radio والمتعدّد checkbox: المتصفّح يبعث القيمة بنفسه.
 */
export function Choice({
  name,
  value,
  on,
  onChange,
  title,
  hint,
  meta,
  multi = false,
}: {
  name: string
  value: string
  on: boolean
  onChange: () => void
  title: string
  hint?: string
  /** سطر بارز تحت العنوان — سعر مثلاً */
  meta?: React.ReactNode
  multi?: boolean
}) {
  return (
    <label
      className={`relative flex cursor-pointer gap-2.5 rounded-xl border p-3 transition ${
        on
          ? 'border-brand bg-brand-soft shadow-[0_1px_0_0_var(--color-brand)]'
          : 'border-line bg-surface hover:border-brand/40 hover:bg-brand-soft/40'
      }`}
    >
      <input
        type={multi ? 'checkbox' : 'radio'}
        name={name}
        value={value}
        checked={on}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center border transition ${
          multi ? 'rounded' : 'rounded-full'
        } ${
          on ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface'
        }`}
        aria-hidden="true"
      >
        {on && (
          <svg viewBox="0 0 12 12" className="size-3">
            <path fill="currentColor" d="M10.3 2.3 4.8 7.8 1.7 4.7.3 6.1l4.5 4.5 7-7z" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-6">{title}</span>
        {meta && <span className="mt-0.5 block text-sm">{meta}</span>}
        {hint && <span className="mt-0.5 block text-xs leading-5 text-muted">{hint}</span>}
      </span>
    </label>
  )
}

/**
 * عدّاد − n +.
 *
 * خانة رقم فارغة لعدد الحمّامات تُقرأ كسؤال بلا جواب. زرّان واضحان
 * والرقم بينهما يقولان «اضغط» — ومن يفضّل الكتابة يكتب في الوسط.
 */
export function Stepper({
  name,
  value,
  min,
  max,
  onChange,
}: {
  name: string
  value: string | boolean | undefined
  min: number
  max: number
  onChange: (v: string) => void
}) {
  const n = Number(value || 0)
  const cls =
    'flex size-10 shrink-0 items-center justify-center text-lg text-muted transition hover:bg-brand-soft hover:text-brand disabled:opacity-30'
  return (
    <div className="inline-flex h-10 items-stretch overflow-hidden rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(min, n - 1)))}
        disabled={n <= min}
        className={cls}
        aria-label="−"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        name={name}
        min={min}
        max={max}
        value={value ? String(value) : ''}
        onChange={(e) => onChange(e.target.value)}
        className="num w-14 border-x border-line bg-transparent text-center text-[15px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        placeholder="—"
      />
      <button
        type="button"
        onClick={() => onChange(String(Math.min(max, (n || min - 1) + 1)))}
        disabled={n >= max}
        className={cls}
        aria-label="+"
      >
        +
      </button>
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: {
  label: string
  hint?: string
  error?: string
  /** نجمة حمراء: «لازم». كلّ ما عداها اختياري بلا أن نكرّر الكلمة */
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label
      className={`block ${
        error
          ? '[&_input]:border-[#c0796b] [&_select]:border-[#c0796b] [&_textarea]:border-[#c0796b]'
          : ''
      }`}
    >
      <span className="mb-1.5 flex items-baseline gap-2 text-sm font-medium">
        {label}
        {required && <span className="text-[#8c2f22]">*</span>}
        {hint && <span className="text-xs font-normal text-faint">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-sm text-[#8c2f22]">{error}</span>}
    </label>
  )
}
