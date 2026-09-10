/**
 * مقترحات الحلول الموجّهة للحريف — دوال صافية بلا أثر جانبي.
 *
 * «الحوصلة» في صفحة المطلب مكتوبة للفريق: تنقيط، فجوة، «مرهون بجهة أخرى».
 * هنا نفس الأرقام بلغة الحريف — لهجة تونسية أو فرنسية حسب لغة مطلبه — بلا
 * تنقيط ولا حكم على قدرته، وبصيغة لا تَعِد: أرقام تقديرية، القرار له،
 * والتمويل للبنك. اللبنة ليست جهة تمويل.
 *
 * الفريق يختار الحلول ويبعث النصّ. صفحة المتابعة تعرض العناوين وحدها،
 * لذلك لا يحمل أيّ عنوان مبلغاً ولا رقماً.
 */
import { briefFacts, splitPhases, type BriefInput } from './brief'
import { formatMoney } from './format'
import type { Locale } from './i18n'

export type ProposalOption = { key: string; title: string; text: string }

export type ClientProposal = {
  locale: Locale
  greeting: string
  intro: string
  /** «هاذي الحلول الممكنة:» — لا يُكتب إن لم يُختر أيّ حلّ */
  lead: string
  options: ProposalOption[]
  docs: string | null
  closing: string
  signature: string
}

export const PROPOSAL_CHANNELS = ['tracking', 'whatsapp', 'copy'] as const
export type ProposalChannel = (typeof PROPOSAL_CHANNELS)[number]

export type ProposalContext = {
  refCode: string
  locale: Locale
  /** رابط صفحة المتابعة بلغة الحريف */
  trackUrl: string
  /** أسماء الوثائق الناقصة بلغة الحريف — بلا هذا تُستعمل أسماء الحوصلة العربية */
  docsMissing?: string[]
}

const WANT_AR = (area: string, where: string): Record<string, string> => ({
  build_on_land: `بناء دار${area} فوق أرضك${where}`,
  land_and_house: `أرض ودار${area}${where}`,
  apartment: `شقّة${area}${where}`,
  rent_to_own: `كراء مملّك${where}`,
  renovation: 'ترميم ولا توسعة',
  economic: `سكن اقتصادي${where}`,
  other: 'حلّ لمشكل سكني',
})

const WANT_FR = (area: string): Record<string, string> => ({
  build_on_land: `construction d’une maison${area} sur votre terrain`,
  land_and_house: `terrain et maison${area}`,
  apartment: `appartement${area}`,
  rent_to_own: 'location-accession',
  renovation: 'rénovation ou extension',
  economic: 'logement économique',
  other: 'solution de logement',
})

export function buildClientProposal(i: BriefInput, ctx: ProposalContext): ClientProposal {
  const fr = ctx.locale === 'fr'
  const f = briefFacts(i)
  const money = (v: number) => formatMoney(Math.round(v), ctx.locale)
  const m2 = fr ? 'm²' : 'م²'
  const options: ProposalOption[] = []
  const push = (key: string, ar: [string, string], frc: [string, string]) =>
    options.push({ key, title: fr ? frc[0] : ar[0], text: fr ? frc[1] : ar[1] })

  const isBuild = i.requestType === 'build_on_land'
  const seeksProperty = ['land_and_house', 'apartment', 'economic'].includes(i.requestType)
  const d = i.devis
  const budget = f.budget
  const cap = f.cap

  // ---------- الكلفة مقابل الميزانية ----------
  if (d && budget > 0 && f.gap > 0) {
    if (f.fitArea !== null) {
      const rooms = i.bedrooms ? i.bedrooms : null
      push(
        'shrink',
        [
          'تصغير المساحة شويّة',
          `بـ${d.surface} ${m2} الكلفة التقديرية ${money(d.total)}، يعني أكثر من ميزانيتك بقرابة ${money(f.gap)}. كان نصغّرو المساحة لحوالي ${f.fitArea} ${m2} بنفس مستوى التشطيب، الكلفة تولّي في حدود ميزانيتك${
            rooms ? `، وتنجّم تحافظ على ${rooms} غرف بمساحات أصغر` : ''
          }.`,
        ],
        [
          'Réduire un peu la surface',
          `Avec ${d.surface} ${m2}, le coût estimatif est de ${money(d.total)}, soit environ ${money(f.gap)} au-dessus de votre budget. En ramenant la surface à environ ${f.fitArea} ${m2} avec le même niveau de finition, le coût entre dans votre budget${
            rooms ? `, en gardant ${rooms} chambres de taille plus réduite` : ''
          }.`,
        ]
      )
    }

    const ph = d.lots.length ? splitPhases(d.lots) : null
    // مرحلتان لا تكونان حلّاً إلّا إذا دخلت المرحلة الأولى وحدها في الميزانية
    if (ph && ph.shell > 0 && ph.finishing > 0 && ph.shell <= budget) {
      const asked = f.flex.has('phased')
      push(
        'phased',
        [
          'البناء على مرحلتين',
          `نبداو بالهيكل والضروري (الدراسات، الأساسات، الهيكل، البناء، الماء والكهرباء) بكلفة تقديرية قرابة ${money(ph.shell)}، وهي في حدود ميزانيتك. والتشطيب (الفرش، الألمنيوم، النجارة، الدهن، المطبخ — قرابة ${money(ph.finishing)}) يجي من بعد كي تتيسّر${
            asked ? '، كيف ما ذكرت في مطلبك' : ''
          }.`,
        ],
        [
          'Construire en deux étapes',
          `D’abord le gros œuvre et l’essentiel (études, fondations, structure, maçonnerie, plomberie et électricité) pour environ ${money(ph.shell)}, dans les limites de votre budget ; puis les finitions (sols, menuiseries, peinture, cuisine — environ ${money(ph.finishing)}) plus tard, quand c’est possible${
            asked ? ', comme vous l’avez indiqué' : ''
          }.`,
        ]
      )
    }

    if (f.flex.has('standing')) {
      push(
        'standing',
        [
          'تشطيب أبسط بنفس المساحة',
          'كيف ما ذكرت في مطلبك، ننجّمو نخفّفو في مستوى التشطيب (الفرش، الألمنيوم، الدهن، المطبخ) ونحافظو على المساحة والهيكل، ونحضّرولك مقارنة بين المستويين.',
        ],
        [
          'Des finitions plus simples, même surface',
          'Comme vous l’avez indiqué, nous pouvons alléger le niveau de finition (sols, menuiseries, peinture, cuisine) en gardant la surface et la structure, et vous préparer une comparaison entre les deux niveaux.',
        ]
      )
    }

    push(
      'topup',
      [
        'الزيادة في المساهمة الذاتية',
        `كان تنجّم توفّر قرابة ${money(f.gap)} زيادة (ادّخار ولا مساهمة من العائلة)، يتسكّر الفرق بين الكلفة والميزانية وتحافظ على المواصفات اللي طلبتها.`,
      ],
      [
        'Augmenter votre apport',
        `Si vous pouvez réunir environ ${money(f.gap)} de plus (épargne ou aide familiale), l’écart entre le coût et votre budget est comblé et vous gardez les caractéristiques demandées.`,
      ]
    )
  } else if (d && budget > 0) {
    push(
      'fits',
      [
        'مشروعك في حدود ميزانيتك',
        `الكلفة التقديرية ${money(d.total)} والميزانية التقديرية قرابة ${money(budget)}. الخطوة الجاية نثبّتو معاك المواصفات ونبداو في ملفّ التمويل والإجراءات.`,
      ],
      [
        'Votre projet entre dans votre budget',
        `Le coût estimatif est de ${money(d.total)} pour un budget estimatif d’environ ${money(budget)}. Prochaine étape : fixer ensemble les caractéristiques et lancer le dossier de financement et les démarches.`,
      ]
    )
  } else if (isBuild && !d) {
    push(
      'devis',
      [
        'عرض تقديري لمشروعك',
        'نحضّرولك عرض تقديري مفصّل حسب المساحة ومستوى التشطيب اللي اخترتهم، باش تعرف الكلفة قبل ما تقرّر.',
      ],
      [
        'Un devis estimatif pour votre projet',
        'Nous vous préparons un devis estimatif détaillé selon la surface et le niveau de finition choisis, pour connaître le coût avant de décider.',
      ]
    )
  }

  // ---------- الأرض والرخص ----------
  if (isBuild && i.land) {
    if (i.land.titleStatus && i.land.titleStatus !== 'titled') {
      const undivided = i.land.titleStatus === 'undivided'
      push(
        'title',
        [
          'تسوية وضعية الأرض',
          `البنوك ما تموّلش البناء على أرض ${undivided ? 'على الشياع' : 'بلا رسم عقاري نهائي'}. أوّل خطوة نشوفو معاك كيفاش تتسوّى الوضعية${
            undivided ? ' (قسمة ولا موافقة الشركاء)' : ''
          } قبل الدراسة الفنية.`,
        ],
        [
          'Régulariser la situation du terrain',
          `Les banques ne financent pas une construction sur un terrain ${undivided ? 'en indivision' : 'sans titre foncier définitif'}. Première étape : voir avec vous comment régulariser la situation${
            undivided ? ' (partage ou accord des copropriétaires)' : ''
          } avant l’étude technique.`,
        ]
      )
    }
    if (!i.land.hasPermit) {
      const noPlans = i.land.hasPlans === false
      push(
        'permit',
        [
          noPlans ? 'الأمثلة الهندسية ورخصة البناء' : 'رخصة البناء',
          `قبل أيّ تمويل ولا أشغال، يلزم ${noPlans ? 'أمثلة هندسية من مهندس معماري ثمّ ' : ''}رخصة بناء من البلدية. نعاونوك تحضّر الملفّ ونتّبعو معاك الإجراءات.`,
        ],
        [
          noPlans ? 'Plans et permis de bâtir' : 'Permis de bâtir',
          `Avant tout financement ou travaux, il faut ${noPlans ? 'des plans établis par un architecte, puis ' : ''}un permis de bâtir délivré par la municipalité. Nous vous aidons à préparer le dossier et à suivre les démarches.`,
        ]
      )
    }
  }

  // ---------- التمويل ----------
  const financingOpen = !i.financingState || i.financingState === 'not_started' || i.financingState === 'studying'
  if (cap && !i.cashReady && cap.maxPayment > 0 && financingOpen) {
    const rent = i.isRenting && i.rentTnd ? i.rentTnd : null
    push(
      'loan',
      [
        'ملفّ القرض',
        `حسب دخلك والأقساط اللي عندك، القسط الشهري الممكن قرابة ${money(cap.maxPayment)}، وهذا يسمح بقرض تقديري في حدود ${money(f.loan)} على ${cap.years} سنة${
          rent ? ` (توّا تخلّص ${money(rent)} كراء في الشهر)` : ''
        }. نحضّرو معاك الملفّ ونرافقوك عند البنك، والقرار النهائي يرجع للبنك.`,
      ],
      [
        'Le dossier de crédit',
        `Selon vos revenus et vos crédits en cours, la mensualité possible est d’environ ${money(cap.maxPayment)}, ce qui permet un crédit estimatif d’environ ${money(f.loan)} sur ${cap.years} ans${
          rent ? ` (vous payez aujourd’hui ${money(rent)} de loyer par mois)` : ''
        }. Nous préparons le dossier avec vous et vous accompagnons auprès de la banque ; la décision finale revient à la banque.`,
      ]
    )
  }

  if (i.foprolosInterest || i.isFirstHome) {
    const ar: string[] = []
    const frr: string[] = []
    if (i.isFirstHome) {
      ar.push('أوّل مسكن')
      frr.push('premier logement')
    }
    if (i.cnssAffiliated) {
      ar.push('انخراط في الضمان الاجتماعي')
      frr.push('affiliation à la sécurité sociale')
    }
    push(
      'social',
      [
        'برنامج السكن المدعّم',
        `ممكن يكون عندك حقّ في برنامج سكن مدعّم${ar.length ? ` (${ar.join('، ')})` : ''}. الشروط وسقف الدخل تتثبّت عند الجهة المعنية، ونعاونوك تحضّر الوثائق.`,
      ],
      [
        'Programme de logement aidé',
        `Vous pourriez être éligible à un programme de logement aidé${frr.length ? ` (${frr.join(', ')})` : ''}. Les conditions et le plafond de revenus sont vérifiés par l’organisme concerné ; nous vous aidons à préparer les documents.`,
      ]
    )
  }

  // ---------- لمن يبحث عن عقار ----------
  if (seeksProperty) {
    if (i.matchesCount > 0) {
      push(
        'offers',
        [
          'عروض عقارية تناسب مطلبك',
          `لقينا ${i.matchesCount === 1 ? 'عرض مراجَع' : `${i.matchesCount} عروض مراجَعة`} في ولايتك وفي حدود ميزانيتك. نحبّو نرتّبو معاك موعد باش تزورها.`,
        ],
        [
          'Des biens adaptés à votre demande',
          `Nous avons trouvé ${i.matchesCount === 1 ? 'une offre vérifiée' : `${i.matchesCount} offres vérifiées`} dans votre gouvernorat et dans votre budget. Nous aimerions organiser une visite avec vous.`,
        ]
      )
    } else {
      const zone = f.flex.has('zone')
      push(
        'wider',
        [
          'توسيع البحث',
          `توّا ما فمّاش عرض يطابق مطلبك بالضبط. ${
            zone
              ? 'كيف ما ذكرت إنّك تقبل منطقة أخرى، نوسّعو البحث للمعتمديات القريبة.'
              : 'كان تقبل معتمديات قريبة، نوسّعو البحث ونتّصلو بيك كي يظهر عرض مناسب.'
          }`,
        ],
        [
          'Élargir la recherche',
          `Aucune offre ne correspond exactement à votre demande pour le moment. ${
            zone
              ? 'Comme vous acceptez une autre zone, nous élargissons la recherche aux délégations voisines.'
              : 'Si vous acceptez des délégations voisines, nous pouvons élargir la recherche et vous recontacter dès qu’une offre convient.'
          }`,
        ]
      )
    }
  }

  // ---------- المقدّمة والخاتمة ----------
  const name = i.fullName.trim()
  const areaAr = i.desiredAreaM2 ? ` ${i.desiredAreaM2} ${m2}` : ''
  const whereAr = i.delegation ? ` في ${i.delegation.trim()}` : ''
  const areaFr = i.desiredAreaM2 ? ` de ${i.desiredAreaM2} ${m2}` : ''
  const want = fr
    ? WANT_FR(areaFr)[i.requestType] ?? 'solution de logement'
    : WANT_AR(areaAr, whereAr)[i.requestType] ?? 'حلّ لمشكل سكني'

  let intro: string
  if (fr) {
    intro = `Nous avons étudié votre demande ${ctx.refCode} : ${want}.`
    if (i.cashReady) intro += ' Votre financement étant disponible, aucun crédit n’est nécessaire.'
    else if (budget > 0) intro += ` D’après les informations transmises, votre budget estimatif est d’environ ${money(budget)}.`
  } else {
    intro = `درسنا مطلبك رقم ${ctx.refCode}: ${want}.`
    if (i.cashReady) intro += ' وبما إنّ التمويل حاضر عندك، ما يلزمش قرض.'
    else if (budget > 0) intro += ` بالمعطيات اللي عطيتنا، الميزانية التقديرية اللي تنجّم توصلها قرابة ${money(budget)}.`
  }

  const docsList = ctx.docsMissing ?? i.docsMissing
  const docs = docsList.length
    ? fr
      ? `Pour poursuivre l’étude de votre dossier, il nous faut : ${docsList.join(', ')}.`
      : `باش نكمّلو دراسة ملفّك، يلزمنا: ${docsList.join('، ')}.`
    : null

  const closing = fr
    ? `Ces montants sont des estimations préliminaires, sans engagement, à confirmer après étude et documents. La décision vous appartient ; le financement relève de la banque.\nSouhaitez-vous en discuter ? Répondez à ce message ou appelez-nous.\nSuivi de votre dossier avec le code ${ctx.refCode} et votre numéro de téléphone :\n${ctx.trackUrl}`
    : `هاذي أرقام تقديرية أوّلية موش التزام، تتدقّق بعد الدراسة والوثائق. القرار ليك، والتمويل يرجع للبنك.\nتحبّ نحكيو فيها؟ جاوبنا هنا ولا اتّصل بينا.\nتنجّم تتابع ملفّك بالرمز ${ctx.refCode} ورقم هاتفك في صفحة المتابعة:\n${ctx.trackUrl}`

  return {
    locale: ctx.locale,
    greeting: fr ? (name ? `Bonjour ${name},` : 'Bonjour,') : name ? `عسلامة ${name}،` : 'عسلامة،',
    intro,
    lead: fr ? 'Voici les solutions possibles :' : 'هاذي الحلول الممكنة:',
    options,
    docs,
    closing,
    signature: fr ? 'L’équipe AL-LUBNA — Construction & Développement' : 'فريق اللَّبنة للبناء والإعمار',
  }
}

/**
 * النصّ الجاهز للإرسال: الحلول المختارة وحدها، مرقّمة من جديد بترتيبها في المقترح.
 * whatsapp: العناوين بين نجمتين فيعرضها الواتساب بخطّ غليظ.
 */
export function proposalText(
  p: ClientProposal,
  selected: readonly string[],
  opts: { whatsapp?: boolean } = {}
): string {
  const chosen = p.options.filter((o) => selected.includes(o.key))
  const sep = p.locale === 'fr' ? '.' : '-'
  const bold = (s: string) => (opts.whatsapp ? `*${s}*` : s)
  const blocks = [p.greeting, chosen.length ? `${p.intro}\n${p.lead}` : p.intro]
  chosen.forEach((o, k) => blocks.push(`${bold(`${k + 1}${sep} ${o.title}`)}\n${o.text}`))
  if (p.docs) blocks.push(p.docs)
  blocks.push(`${p.closing}\n\n${p.signature}`)
  return blocks.join('\n\n')
}
