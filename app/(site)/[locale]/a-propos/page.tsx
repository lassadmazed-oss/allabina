import Link from 'next/link'
import '@/app/landing.css'
import '@/app/landing-pages.css'
import { getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { IcArrow } from '@/components/landing/icons'

export const dynamic = 'force-static'

/**
 * من نحن — نصّ الشركة كما كتبه صاحبها: شركة مقاولات خاصة مستقلة تنطلق من
 * حاجة الحريف، تجمع الشبكة حول المشروع، وتوضّح أنّها ليست جهة تمويل.
 * لا سياسة ولا وعود: الكلفة والخطوات والدور واضحة قبل أيّ التزام.
 */
const AR = {
  eyebrow: 'من نحن',
  title: 'اللَّبنة للبناء والإعمار',
  intro:
    'شركة تونسية خاصة للمقاولات، تنطلق من حاجة الحريف إلى السكن أو البناء وتعمل على تحويلها إلى حلّ واقعي قابل للتنفيذ.',
  principles: [
    ['شركة خاصة مستقلة', 'شركة تونسية خاصة مستقلة، هدفها حلول عملية وخدمة باحتراف وجودة عالية.'],
    ['الشفافية أولاً', 'نوضّح لك كل شيء: الكلفة، الخطوات، ودورنا، قبل أي التزام.'],
    ['بلا وعود', 'لا نعد بشيء لا نملكه: تفهم بالضبط كل خطوة قبل ما تدخل في أي حاجة.'],
    ['الربح من الخدمة والتنفيذ', 'ما نكسبه يجي من الخدمة والتنفيذ، لا من الكلام.'],
  ],
  startTitle: 'نبدأ من الحريف، لا من الأشغال',
  startText: 'نحن لا نقتصر على تنفيذ أشغال البناء، بل ننطلق أولاً من فهم وضعية الحريف:',
  questions: ['شنوّة يحب يعمل؟', 'شنوّة الإمكانيات المتوفرة؟', 'شنوّة العوائق اللي تمنعه من الوصول إلى مشروعه؟'],
  networkTitle: 'شبكة حول كل مشروع',
  networkText:
    'ومن هنا، تجمع اللَّبنة حول كل مشروع ما يحتاجه من خبرات وحلول، بالتعاون مع شبكة من:',
  network: [
    'المهندسين',
    'المعماريين',
    'الفنيين',
    'الحرفيين',
    'الصناعيين',
    'مزوّدي مواد البناء',
    'الباعثين العقاريين',
    'أصحاب العقارات',
    'الجهات المختصة',
  ],
  networkEnd: 'للوصول إلى الحل الأنسب لكل حالة.',
  solutionsTitle: 'قد يكون الحل',
  solutions: [
    ['البناء على أرض الحريف', '/demande?type=build_on_land'],
    ['اقتناء أرض والبناء عليها', '/demande?type=land_and_house'],
    ['اقتناء مسكن', '/demande?type=apartment'],
    ['تحسين أو توسعة مسكن قائم', '/demande?type=renovation'],
    ['تطوير مشروع عقاري أو إنشائي', '/demande?type=other'],
  ],
  financeTitle: 'التمويل، بوضوح',
  financeText:
    'وعندما يكون المشروع في حاجة إلى تمويل، يمكن للّبنة دراسة الملف والمساعدة على إعداده وتوجيهه ومتابعته مع البنوك أو الجهات المموّلة.',
  financeNote:
    'اللَّبنة ليست جهة تمويل، ولا تضمن تمويلاً ولا تعد به: قرار التمويل وشروطه من اختصاص الجهة المموّلة وحدها.',
  financeRole:
    'دورنا تنسيق وتجهيز الملف حتى تزيد فرص الموافقة ويمشي الموضوع بسلاسة مع البنك أو الجهة المختصة، كما يساعدك المحاسب في ترتيب أوراقك من غير ما يكون هو من يموّل. إنت اللي تقرّر، والبنك هو اللي يموّل.',
  buildTitle: 'من الدراسة إلى التسليم',
  buildText:
    'وبصفتنا شركة مقاولات، عندما يكون الحل هو البناء، تستطيع اللَّبنة الانتقال من دراسة الحل إلى التسعير والتعاقد والتنفيذ ومتابعة الأشغال وصولاً إلى التسليم، حسب طبيعة كل مشروع والعقد المتفق عليه.',
  steps: ['دراسة الحل', 'التسعير', 'التعاقد', 'التنفيذ ومتابعة الأشغال', 'التسليم'],
  goalTitle: 'هدفنا بسيط',
  goalText:
    'الحريف ما يجيش للّبنة باش نبيعوه حاجة جاهزة؛ يجي بحاجة أو مشروع أو مشكلة، ودورنا ندرسها ونبحث معاه عن أفضل طريق عملي لتنفيذها.',
  slogan: 'نفهم حاجتك، نلقى الحل، ونبنيه معاك.',
  cta: 'سجّل مطلبك',
  cases: 'شوف الحالات المنجزة',
}

const FR: typeof AR = {
  eyebrow: 'Qui sommes-nous',
  title: 'AL-LUBNA — Construction & Développement',
  intro:
    "Une entreprise tunisienne privée de construction. Elle part du besoin du client — se loger ou construire — et travaille à le transformer en une solution réaliste et réalisable.",
  principles: [
    ['Entreprise privée indépendante', 'Une entreprise tunisienne privée et indépendante, tournée vers des solutions pratiques et un service professionnel de qualité.'],
    ["La transparence d'abord", 'Nous vous expliquons tout : coûts, étapes et notre rôle, avant tout engagement.'],
    ['Sans promesses', 'Nous ne promettons rien que nous ne maîtrisons pas : vous comprenez exactement chaque étape avant de vous engager.'],
    ["Le service et l'exécution", "Ce que nous gagnons vient du service et de l'exécution, pas des discours."],
  ],
  startTitle: 'Nous partons du client, pas des travaux',
  startText: 'Nous ne nous limitons pas à exécuter des travaux : nous commençons par comprendre la situation du client :',
  questions: ['Que veut-il faire ?', 'Quels moyens a-t-il ?', "Quels obstacles l'empêchent d'arriver à son projet ?"],
  networkTitle: 'Un réseau autour de chaque projet',
  networkText:
    'À partir de là, AL-LUBNA réunit autour de chaque projet les compétences et solutions nécessaires, avec un réseau de :',
  network: [
    'ingénieurs',
    'architectes',
    'techniciens',
    'artisans',
    'industriels',
    'fournisseurs de matériaux',
    'promoteurs immobiliers',
    'propriétaires de biens',
    'organismes compétents',
  ],
  networkEnd: 'pour trouver la solution la plus adaptée à chaque cas.',
  solutionsTitle: 'La solution peut être',
  solutions: [
    ['Construire sur le terrain du client', '/demande?type=build_on_land'],
    ['Acquérir un terrain et y construire', '/demande?type=land_and_house'],
    ['Acquérir un logement', '/demande?type=apartment'],
    ['Améliorer ou agrandir un logement existant', '/demande?type=renovation'],
    ['Développer un projet immobilier ou de construction', '/demande?type=other'],
  ],
  financeTitle: 'Le financement, en clair',
  financeText:
    "Lorsque le projet a besoin d'un financement, AL-LUBNA peut étudier le dossier, aider à le préparer, l'orienter et le suivre auprès des banques ou organismes de financement.",
  financeNote:
    "AL-LUBNA n'est pas un organisme de financement, ne garantit ni ne promet aucun financement : la décision et les conditions relèvent uniquement de l'organisme financeur.",
  financeRole:
    "Notre rôle est de coordonner et de préparer le dossier pour augmenter les chances d'accord et fluidifier la démarche avec la banque ou l'organisme compétent — comme un comptable qui met vos papiers en ordre sans être celui qui finance. Vous décidez, la banque finance.",
  buildTitle: "De l'étude à la livraison",
  buildText:
    "En tant qu'entreprise de construction, lorsque la solution est de bâtir, AL-LUBNA peut passer de l'étude à la tarification, au contrat, à l'exécution et au suivi des travaux jusqu'à la livraison, selon la nature de chaque projet et le contrat convenu.",
  steps: ["Étude de la solution", 'Devis', 'Contrat', 'Exécution et suivi des travaux', 'Livraison'],
  goalTitle: 'Notre objectif est simple',
  goalText:
    "Le client ne vient pas chez AL-LUBNA pour qu'on lui vende quelque chose de tout fait ; il vient avec un besoin, un projet ou un problème, et notre rôle est de l'étudier et de chercher avec lui le meilleur chemin pratique pour le réaliser.",
  slogan: 'Nous comprenons votre besoin, trouvons la solution et la bâtissons avec vous.',
  cta: 'Déposer ma demande',
  cases: 'Voir les réalisations',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const l: Locale = isLocale(locale) ? locale : 'ar'
  const t = getDictionary(l)
  const c = l === 'fr' ? FR : AR
  return { title: `${c.eyebrow} — ${t.nav.brand}`, description: c.intro }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const c = locale === 'fr' ? FR : AR
  const p = (s = '') => path(locale, s)

  return (
    <div className="lp">
      <section className="wrap phero">
        <span className="eyebrow">{c.eyebrow}</span>
        <h1>{c.title}</h1>
        <p className="lead">{c.intro}</p>
        <ul className="principles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {c.principles.map(([h, b]) => (
            <li key={h}>
              <b style={{ display: 'block', color: 'var(--lp-navy)' }}>{h}</b>
              {b}
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap">
        {/* نبدأ من الحريف */}
        <div className="panel">
          <h2>{c.startTitle}</h2>
          <p className="lead" style={{ marginTop: 6 }}>
            {c.startText}
          </p>
          <div className="story" style={{ marginTop: 14 }}>
            {c.questions.map((q, i) => (
              <div className="story__item is-navy" key={q}>
                <h3>{String(i + 1).padStart(2, '0')}</h3>
                <p style={{ fontWeight: 700 }}>{q}</p>
              </div>
            ))}
          </div>
        </div>

        {/* الشبكة */}
        <div className="panel panel--soft">
          <h2>{c.networkTitle}</h2>
          <p className="lead" style={{ marginTop: 6 }}>
            {c.networkText}
          </p>
          <div className="chips">
            {c.network.map((n) => (
              <span className="chip" key={n}>
                {n}
              </span>
            ))}
          </div>
          <p className="lead" style={{ marginTop: 12 }}>
            {c.networkEnd}
          </p>
        </div>

        {/* الحلول الممكنة */}
        <div className="panel">
          <h2>{c.solutionsTitle}</h2>
          <div className="chips">
            {c.solutions.map(([label, href]) => (
              <Link key={href} href={p(href)} className="chip">
                {label}
                <IcArrow className="arr" style={{ width: 14, height: 14 }} />
              </Link>
            ))}
          </div>
        </div>

        {/* التمويل */}
        <div className="panel">
          <h2>{c.financeTitle}</h2>
          <p className="lead" style={{ marginTop: 6 }}>
            {c.financeText}
          </p>
          <p className="note" style={{ fontWeight: 700 }}>
            {c.financeNote}
          </p>
          <p className="lead" style={{ marginTop: 12 }}>
            {c.financeRole}
          </p>
        </div>

        {/* من الدراسة إلى التسليم */}
        <div className="panel">
          <h2>{c.buildTitle}</h2>
          <p className="lead" style={{ marginTop: 6 }}>
            {c.buildText}
          </p>
          <ol className="steps" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {c.steps.map((s, i) => (
              <li className="step" key={s} style={{ boxShadow: 'none', background: 'var(--lp-cream-2)' }}>
                <span className="step__n">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s}</h3>
              </li>
            ))}
          </ol>
        </div>

        {/* الهدف والشعار */}
        <div className="cta-band" style={{ display: 'block' }}>
          <span className="eyebrow" style={{ color: 'var(--lp-gold-light)' }}>
            {c.goalTitle}
          </span>
          <p style={{ marginTop: 8, fontSize: '1.05rem', lineHeight: 1.85 }}>{c.goalText}</p>
          <h2 style={{ marginTop: 18, fontSize: '1.6rem' }}>{c.slogan}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
            <Link href={p('/demande')} className="btn btn--gold">
              {c.cta}
              <IcArrow className="arr" />
            </Link>
            <Link href={p('/realisations')} className="btn btn--ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)', background: 'transparent' }}>
              {c.cases}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
