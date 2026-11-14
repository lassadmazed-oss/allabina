/**
 * الروابط بلا لغة.
 *
 * الموقع كلّه تحت /ar و/fr، فـ/suivi وحده كان يردّ 404 — والرابط الذي
 * يكتبه الناس ويقولونه في الهاتف هو القصير بلا لغة. والوسيط لا يراه:
 * matcher متاعه ['/', '/admin/:path*'] فقط، وتوسيعه يعني نداء مصادقة
 * في كلّ طلب. فالتحويل هنا: ثابت، بلا كلفة تشغيل، ولا يمسّ الأصول.
 *
 * 307 لا 308: اللغة الافتراضية قد تتبدّل، والدائم يُخزَّن في المتصفّح
 * إلى الأبد.
 */
const PUBLIC_SEGMENTS = [
  'a-propos',
  'compte',
  'confidentialite',
  'demande',
  'mentions-legales',
  'merci',
  'proprietaire',
  'realisations',
  'reseau',
  'simulateur',
  'soutien',
  'standing',
  'suivi',
  'systemes',
]

const DEFAULT_LOCALE = 'ar'

const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  // 16mb: وثيقة حتى 15 MiB (حدّ مخزن الوثائق) مع هامش لبقيّة الحقول
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
  // مدخلان لكلّ صفحة لا مدخل واحد: `:rest*` الفارغ يُنتج `/ar/suivi/`
  // بشرطة أخيرة، فيزيد Next قفزة ثالثة ليشيلها. والرابط يُفتح في رسالة
  // قصيرة على شبكة هاتف — كلّ قفزة تُحسب.
  async redirects() {
    return PUBLIC_SEGMENTS.flatMap((seg) => [
      { source: `/${seg}`, destination: `/${DEFAULT_LOCALE}/${seg}`, permanent: false },
      { source: `/${seg}/:rest+`, destination: `/${DEFAULT_LOCALE}/${seg}/:rest+`, permanent: false },
    ])
  },
}

export { PUBLIC_SEGMENTS, DEFAULT_LOCALE }
export default nextConfig
