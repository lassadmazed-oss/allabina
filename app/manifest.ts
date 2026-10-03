import type { MetadataRoute } from 'next'

/**
 * بيان التطبيق: الموقع يُثبَّت على شاشة الهاتف بالمَعلَم نفسه، ويُفتح
 * بلا شريط متصفّح. ملفّ واحد لا يعرف اللغة — فالبداية على العربية،
 * ومن داخله يبدّل الحريف للفرنسية كالعادة.
 *
 * أيقونتان بنيّة «any» على أرضية بيضاء لأنّ الشفّاف يُرسم على خلفية
 * لا نتحكّم فيها، وثالثة «maskable» أصغر: أندرويد يقصّ الأطراف ليجعلها
 * دائرة أو مربّعاً مستديراً، فالمَعلَم يبقى داخل المنطقة الآمنة.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'اللَّبنة للبناء والإعمار',
    short_name: 'اللَّبنة',
    description: 'سجّل مطلب سكنك مرّة واحدة: دراسة وكلفة واضحة من الأوّل، ومرافقة إلى مفتاح الدار.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/ar',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4efe6',
    theme_color: '#f4efe6',
    categories: ['business', 'finance', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'سجّل مطلبك',
        short_name: 'مطلب جديد',
        url: '/ar/demande',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'تتبّع مطلبي',
        short_name: 'تتبّع',
        url: '/ar/suivi',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}
