import type { Locale } from '@/lib/i18n'

/**
 * نصوص صفحة الاستقبال v2 — عربي فصيح (كما في هوية اللبنة) وفرنسي.
 * كلّ رابط نسبي يُسبق باللغة في الصفحة نفسها.
 */
const AR = {
  nav: {
    home: 'الرئيسية',
    about: 'من نحن',
    services: 'خدماتنا',
    projects: 'مشاريعنا',
    track: 'تتبّع مطلبي',
    cta: 'سجّل مطلبك',
    lang: 'FR',
    langName: 'Français',
    menuTitle: 'القائمة',
    menuOpen: 'افتح القائمة',
    menuClose: 'أغلق القائمة',
    group: 'الصفحات',
  },
  hero: {
    title: 'إلى مستقبل أجمل',
    sub: 'اللبنة للبناء والإعمار',
    text: 'نبنيو الدار على قدّ إمكانياتك، بكلفة واضحة من الأوّل وخطوات تعرفها. سجّل مطلب سكنك مرّة واحدة، ونرافقك من الدراسة إلى مفتاح الدار.',
    cta1: 'ابدأ مشروعك الآن',
    cta2: 'تعرّف على خدماتنا',
    free: 'التسجيل بدون معاليم — ما ناخذو حتّى مليم من الحريف',
    alt: 'بيوت بيضاء وأبواب زرقاء تحت شمس تونس',
  },
  stats: [
    { n: '0', l: 'معاليم على المواطن' },
    { n: '16', l: 'معتمدية في صفاقس' },
    { n: '5', l: 'مستويات تشطيب' },
    { n: '', l: 'تنمية مستدامة' },
  ],
  services: {
    eyebrow: 'خدماتنا',
    title: 'حلول متكاملة لبناء حياة أفضل',
    text: 'من الفكرة إلى التسليم، نرافقك في كل مرحلة لنحقق معًا مسكنًا يليق بك وبعائلتك.',
    cta: 'ابدأ مطلبك — بدون معاليم',
    items: [
      { t: 'بناء المساكن', d: 'بناء فوق أرضك بمواصفات تختارها بنفسك', href: '/demande?type=build_on_land' },
      { t: 'التطوير العقاري', d: 'أرض ودار، أو شقة في مشروع قانوني', href: '/demande?type=land_and_house' },
      { t: 'بناء مستدام', d: 'طرق بناء مدروسة بمواد محلية وجودة مراقبة', href: '/systemes' },
      { t: 'مرافقة شاملة', d: 'من الدراسة إلى التسليم، خطوة بخطوة', href: '/suivi' },
    ],
  },
  about: {
    eyebrow: 'من نحن',
    title: 'اللبنة للبناء والإعمار',
    text: 'شركة تونسية خاصة مستقلة للمقاولات. ننطلق من حاجتك للسكن أو البناء، ندرس وضعيتك وإمكانياتك، ونجمع حول مشروعك الخبرات والحلول المناسبة، من الدراسة إلى التنفيذ والتسليم. كل شيء واضح من البداية: الكلفة، الخطوات، ودورنا.',
    tagline: 'نفهم حاجتك، نلقى الحل، ونبنيه معاك.',
    feats: ['شركة خاصة مستقلة', 'شفافية في الكلفة والخطوات', 'لسنا جهة تمويل'],
    cta: 'اقرأ من نحن',
    script: 'Tunis\nalways a better\ntomorrow',
    photoCta: 'شاهد الحالات المنجزة',
    mapTitle: 'كل مشروع لبنة لبناء المستقبل',
    mapSub: 'صفاقس · المرحلة التجريبية',
    mapFrameTitle: 'خريطة تونس — صفاقس',
    mapOpen: 'افتحها في خرائط Google',
    alt: 'بيت أبيض بباب أزرق يطلّ على البحر',
  },
  how: {
    eyebrow: 'كيف نعمل',
    title: 'أربع خطوات… من الطلب إلى المفتاح',
    steps: [
      { t: 'سجّل طلبك', d: 'خمس خطوات من الهاتف، في أقل من ثلاث دقائق وبلا حساب.' },
      { t: 'ندرس قدرتك', d: 'ميزانية تقديرية وقسط شهري ممكن، ورمز خاص لمتابعة ملفك.' },
      { t: 'نجد لك العرض', d: 'مشروع أو أرض أو شركة بناء تناسب منطقتك وميزانيتك.' },
      { t: 'نرافقك حتى المفتاح', d: 'من الموعد الأول إلى تسليم الدار.' },
    ],
  },
  projects: {
    eyebrow: 'مشاريعنا',
    title: 'قصص حقيقية … لمستقبل أجمل',
    text: 'نحوّل الأفكار إلى واقع. اكتشف الحالات المنجزة، المنشورة بموافقة أصحابها.',
    all: 'عرض جميع الحالات',
    items: [
      { t: 'بناء فوق أرضك', l: 'صفاقس', href: '/demande?type=build_on_land' },
      { t: 'شقق في مشاريع قانونية', l: 'صفاقس الكبرى', href: '/demande?type=apartment' },
      { t: 'أرض ودار', l: 'بعقد واحد واضح', href: '/demande?type=land_and_house' },
    ],
  },
  sticky: { cta: 'سجّل مطلبك — بدون معاليم' },
  footer: {
    tagline: 'Same roots · Brighter tomorrows',
    legal: 'اللبنة للبناء والإعمار · AL-LUBNA — نسخة تجريبية',
    privacy: 'حماية المعطيات',
  },
}

export type LandingCopy = typeof AR

const FR: LandingCopy = {
  nav: {
    home: 'Accueil',
    about: 'Qui sommes-nous',
    services: 'Services',
    projects: 'Projets',
    track: 'Suivre ma demande',
    cta: 'Déposer ma demande',
    lang: 'AR',
    langName: 'العربية',
    menuTitle: 'Menu',
    menuOpen: 'Ouvrir le menu',
    menuClose: 'Fermer le menu',
    group: 'Pages',
  },
  hero: {
    title: 'vers un avenir meilleur',
    sub: 'AL-LUBNA — Construction & Développement',
    text: 'Nous construisons votre maison à la mesure de vos moyens, avec un coût clair dès le départ et des étapes connues. Déposez votre demande de logement une seule fois : nous vous accompagnons de l’étude jusqu’aux clés.',
    cta1: 'Commencer mon projet',
    cta2: 'Découvrir nos services',
    free: "Dépôt sans frais — nous ne prenons rien au citoyen",
    alt: 'Maisons blanches et portes bleues sous le soleil tunisien',
  },
  stats: [
    { n: '0', l: 'frais pour le citoyen' },
    { n: '16', l: 'délégations à Sfax' },
    { n: '5', l: 'niveaux de finition' },
    { n: '', l: 'Développement durable' },
  ],
  services: {
    eyebrow: 'Nos services',
    title: 'Des solutions complètes pour une vie meilleure',
    text: 'De l’idée à la livraison, nous vous accompagnons à chaque étape pour un logement à votre mesure.',
    cta: 'Déposer ma demande — sans frais',
    items: [
      { t: 'Construction', d: 'Construire sur votre terrain, selon vos choix', href: '/demande?type=build_on_land' },
      { t: 'Développement immobilier', d: 'Terrain + maison, ou appartement dans un projet légal', href: '/demande?type=land_and_house' },
      { t: 'Construction durable', d: 'Méthodes étudiées, matériaux locaux, qualité contrôlée', href: '/systemes' },
      { t: 'Accompagnement complet', d: 'De l’étude à la livraison, étape par étape', href: '/suivi' },
    ],
  },
  about: {
    eyebrow: 'Qui sommes-nous',
    title: 'AL-LUBNA',
    text: "Entreprise tunisienne privée et indépendante de construction. Nous partons de votre besoin de logement ou de construction, étudions votre situation et vos moyens, puis réunissons autour de votre projet les compétences et solutions adaptées, de l'étude à l'exécution et à la livraison. Tout est clair dès le départ : coûts, étapes et notre rôle.",
    tagline: 'Nous comprenons votre besoin, trouvons la solution et la bâtissons avec vous.',
    feats: ['Entreprise privée indépendante', 'Transparence sur coûts et étapes', 'Pas un organisme de financement'],
    cta: 'Qui sommes-nous',
    script: 'Tunis\nalways a better\ntomorrow',
    photoCta: 'Voir les réalisations',
    mapTitle: "Chaque projet est une brique pour bâtir l'avenir",
    mapSub: 'Sfax · phase pilote',
    mapFrameTitle: 'Carte de la Tunisie — Sfax',
    mapOpen: 'Ouvrir dans Google Maps',
    alt: 'Maison blanche à porte bleue face à la mer',
  },
  how: {
    eyebrow: 'Comment ça marche',
    title: 'Quatre étapes… de la demande aux clés',
    steps: [
      { t: 'Déposez votre demande', d: 'Cinq étapes depuis le téléphone, moins de trois minutes, sans compte.' },
      { t: 'Nous étudions votre capacité', d: 'Budget estimatif, mensualité possible et un code privé pour suivre votre dossier.' },
      { t: 'Nous trouvons l’offre', d: 'Un projet, un terrain ou un constructeur adapté à votre zone et à votre budget.' },
      { t: 'Nous vous accompagnons', d: 'Du premier rendez-vous jusqu’à la remise des clés.' },
    ],
  },
  projects: {
    eyebrow: 'Nos projets',
    title: 'Des histoires vraies… pour un avenir meilleur',
    text: 'Nous transformons les idées en réalité. Découvrez les cas résolus, publiés avec l’accord de leurs propriétaires.',
    all: 'Voir toutes les réalisations',
    items: [
      { t: 'Construire sur votre terrain', l: 'Sfax', href: '/demande?type=build_on_land' },
      { t: 'Appartements dans des projets légaux', l: 'Grand Sfax', href: '/demande?type=apartment' },
      { t: 'Terrain + maison', l: 'Un seul contrat clair', href: '/demande?type=land_and_house' },
    ],
  },
  sticky: { cta: 'Déposer ma demande — sans frais' },
  footer: {
    tagline: 'Same roots · Brighter tomorrows',
    legal: 'AL-LUBNA — Construction & Développement — version pilote',
    privacy: 'Protection des données',
  },
}

export const landingCopy: Record<Locale, LandingCopy> = { ar: AR, fr: FR }
