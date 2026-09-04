export const LOCALES = ['ar', 'fr'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ar'

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v)
export const dirOf = (l: Locale) => (l === 'ar' ? 'rtl' : 'ltr')
export const otherLocale = (l: Locale): Locale => (l === 'ar' ? 'fr' : 'ar')

/** بادئة المسار: /ar/demande — préfixe de chemin */
export const path = (l: Locale, p = '') => `/${l}${p}`

/** استبدال {مفتاح} في نصوص الترجمة — remplacement de {clé} */
export const fmt = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

const ar = {
    dirLabel: 'rtl',
    langName: 'العربية',
    otherLangName: 'Français',
    nav: {
        brand: 'اللَّبنة',
        brandSub: 'للبناء والإعمار',
        simulator: 'محاكي التمويل',
        track: 'تتبّع مطلبي',
        cta: 'سجّل مطلبك'
    },
    footer: {
        about: 'منصة وطنية لتنظيم طلبات السكن في تونس وربط المواطن بحلول البناء والعقار والتمويل المناسبة لقدرته. المرحلة التجريبية: ولاية صفاقس.',
        request: 'تسجيل مطلب سكن',
        simulator: 'محاكي التمويل',
        track: 'تتبّع مطلب',
        privacy: 'حماية المعطيات',
        legal: 'ALLABINA Construction & Développement — نسخة تجريبية'
    },
    home: {
        badge: 'منصة وطنية لطلبات السكن — المرحلة التجريبية: ولاية صفاقس',
        title: 'اللَّبنة… نبنيو على قدّك',
        lede: 'سجّل مطلب سكنك مرّة وحدة، ونحنا نلقاو لك الحلّ اللي يناسب ميزانيتك والمنطقة اللي تحبّها: بناء فوق أرضك، أرض ودار، ولا شقة — مع دراسة واضحة لقدرتك على التمويل.',
        cta1: 'سجّل مطلبك مجّاناً',
        cta2: 'احسب ميزانيتك',
        heroNote: 'من طلب السكن إلى مفتاح الدار — بلا معاليم على المواطن.',
        pathsTitle: 'شنوّة تحبّ تعمل؟',
        pathsLede: 'اختار المسار اللي يشبهلك، والاستمارة تتبدّل حسب اختيارك.',
        pathStart: 'ابدا ←',
        paths: {
            build_on_land: 'عندك أرض؟ ندرسو وضعيتها ونقترحو عليك نموذج بناء يناسب مساحتها وميزانيتك.',
            land_and_house: 'عرض متكامل: أرض في المنطقة اللي تحبّها ودار مبنية عليها، بعقد واضح.',
            apartment: 'نطابقو مطلبك مع المشاريع القانونية الجاهزة أو في طور الإنجاز.',
            rent_to_own: 'ما عندكش تسبقة كبيرة؟ نسجّلو مطلبك وندرسو قدرتك على صيغة الكراء المملّك.'
        } as Record<string, string>,
        howTitle: 'كيفاش تخدم اللَّبنة',
        steps: [
            {
                t: 'سجّل مطلبك',
                b: 'خمس خطوات، أقلّ من ثلاث دقائق، من التلفون.'
            },
            {
                t: 'ندرسو قدرتك',
                b: 'نحسبو ميزانيتك التقديرية والقسط الشهري الممكن.'
            },
            {
                t: 'نلقاو لك العرض',
                b: 'مشروع ولا شركة بناء تناسب منطقتك وقدرتك.'
            },
            {
                t: 'نتابعو معاك',
                b: 'من الموعد الأوّل إلى مفتاح الدار.'
            }
        ],
        pricesTitle: 'تكلفة البناء — بوضوح',
        pricesLede: 'ما نفرضوش نموذج موحّد. تختار مستوى البناء والتشطيب حسب ميزانيتك ورغبتك، ويتعدّ لك devis تفصيلي قبل انطلاق الأشغال.',
        pricesNote: 'الأسعار دون احتساب الأداءات (HT) وما تشملش ثمن الأرض ولا مصاريف الدراسات والرخص. السعر المرجعي المعتمد في الدراسات:',
        audience: {
            citizen: {
                title: 'للمواطن',
                items: [
                    'تسجيل مطلب سكن ولا بناء فوق أرضك',
                    'اختيار المساحة: 60 · 80 · 100 م²',
                    'محاكاة القدرة على التمويل',
                    'متابعة المطلب برمز خاصّ'
                ]
            },
            builders: {
                title: 'لشركات البناء والباعثين',
                items: [
                    'معرفة عدد الحرفاء الجديين',
                    'المناطق الأكثر طلباً',
                    'النموذج والمساحة المطلوبة فعلاً',
                    'تقليص مصاريف التسويق'
                ]
            },
            banks: {
                title: 'للبنوك والممولين',
                items: [
                    'ملفّات أوّلية مرتّبة',
                    'تقدير القدرة المالية للحريف',
                    'مطابقة الحريف بالتمويل المناسب',
                    'متابعة مراحل المشروع'
                ]
            }
        },
        ctaTitle: 'مطلبك يبدا اليوم',
        ctaBody: 'التسجيل مجّاني وما يلزمكش حساب. تعمّر الاستمارة، تاخو رمز مطلبك، ونحنا نتّصلو بيك.'
    },
    form: {
        pageTitle: 'سجّل مطلب سكنك',
        pageLede: 'أقلّ من ثلاث دقائق. ما يلزمكش حساب، وتنجّم ترجع لمطلبك برمز خاصّ.',
        stepOf: 'الخطوة {i} من {n}',
        stepNames: [
            'نوع المطلب',
            'المكان والمساحة',
            'الأرض',
            'القدرة المالية',
            'الاتصال'
        ],
        back: 'رجوع',
        next: 'التالي',
        submit: 'أرسل مطلبي',
        submitting: 'جاري الإرسال…',
        genericError: 'فمّا معطيات ناقصة ولا غير صحيحة.',
        optional: 'اختياري',
        choose: '— اختار —',
        s1Title: 'شنوّة تحبّ تعمل؟',
        s1Lede: 'اختار المسار اللي يشبهلك.',
        s2Title: 'وين وبقدّاش؟',
        s2Lede: 'المرحلة التجريبية مفتوحة على ولاية صفاقس. تنجّم تسجّل من ولاية أخرى وباش نتّصلو بيك كي نوسّعو.',
        governorate: 'الولاية',
        comingSoon: '(قريباً)',
        delegation: 'المعتمدية',
        imada: 'العمادة',
        landLocation: 'موقع الأرض أو المنطقة',
        landLocationHint: 'اختياري — حيّ، نهج، معلم قريب',
        landLocationPlaceholder: 'مثال: حيّ النور، قرب المستوصف…',
        area: 'المساحة المطلوبة',
        otherArea: 'مساحة أخرى',
        bedrooms: 'عدد الغرف',
        horizon: 'وقتاش تحبّ تبدا؟',
        standingTitle: 'مستوى البناء والتشطيب',
        standingLede: 'ما نفرضوش عليك نموذج موحّد. اختار المستوى اللي يناسب ميزانيتك، والكلفة النهائية تتحدّد في devis تفصيلي قبل انطلاق الأشغال.',
        costFor: 'كلفة البناء التقديرية لـ {area} م² بمستوى {tier}:',
        costNote: 'الأسعار دون احتساب الأداءات (HT)، وما تشملش ثمن الأرض ولا مصاريف الدراسات والرخص.',
        s3Title: 'الأرض متاعك',
        s3Lede: 'هالمعطيات تخلّينا نعرفو شنوّة ينجّم يتبنى فوقها.',
        landArea: 'مساحة الأرض (م²)',
        titleStatus: 'الوضعية العقارية',
        hasWater: 'مربوطة بالماء',
        hasPower: 'مربوطة بالكهرباء',
        hasRoad: 'عندها منفذ على الطريق',
        hasPermit: 'عندها رخصة بناء',
        s4Title: 'قدرتك المالية',
        s4Lede: 'هالمعطيات تبقى محفوظة عندنا وتستعمل باش نقدّرو ميزانيتك. أقرب ما تكون للحقيقة، أدقّ يكون العرض.',
        income: 'الدخل الشهري الصافي (د.ت)',
        spouseIncome: 'دخل القرين (د.ت)',
        otherIncome: 'دخل آخر (د.ت)',
        existingLoans: 'مجموع الأقساط الجارية (د.ت/شهر)',
        existingLoansHint: 'قروض حالية',
        downPayment: 'المساهمة الذاتية المتوفّرة (د.ت)',
        maxMonthly: 'القسط الشهري اللي تنجّم تخلّص (د.ت)',
        employment: 'نوع النشاط',
        seniority: 'الأقدمية في العمل (بالأشهر)',
        isExpat: 'أنا تونسي مقيم بالخارج',
        expatCountry: 'بلد الإقامة',
        estimateTitle: 'تقدير أوّلي حسب معطياتك',
        maxPayment: 'القسط الشهري الممكن',
        maxLoan: 'مبلغ التمويل التقديري',
        maxBudget: 'الميزانية الجملية',
        s5Title: 'كيفاش نتّصلو بيك؟',
        s5Lede: 'آخر خطوة. باش تاخو رمز مطلبك في الصفحة الجاية.',
        fullName: 'الاسم واللقب',
        phone: 'رقم الهاتف',
        phoneHint: 'مثال: 20123456 أو +33…',
        email: 'البريد الإلكتروني',
        consent: 'نوافق على أنّ اللَّبنة تجمع معطياتي وتستعملها لدراسة مطلبي، وتنجّم تمرّرها لشركة بناء أو باعث عقاري أو بنك في إطار هذا المطلب. نجّم نطلب الاطّلاع عليها أو حذفها في أيّ وقت.',
        errors: {
            banner: 'فمّا حقول ناقصة ولا غير صحيحة. رجّعناك للخطوة اللي فيها المشكل.',
            rateLimited: 'عدد المحاولات كثير. عاود بعد شويّة.',
            server: 'صار مشكل تقني في التسجيل. عاود المحاولة.',
            fallback: 'هالحقل فيه مشكل.',
            requestType: 'اختار نوع المطلب.',
            govCode: 'اختار الولاية.',
            horizon: 'اختار وقتاش تحبّ تبدا.',
            desiredAreaM2: 'المساحة لازم تكون بين 40 و400 م².',
            bedrooms: 'عدد الغرف بين 1 و6.',
            landAreaM2: 'مساحة الأرض لازم تكون بين 50 و5000 م².',
            monthlyIncome: 'عمّر الدخل الشهري الصافي.',
            employment: 'اختار نوع النشاط.',
            fullName: 'الاسم واللقب مطلوب (3 أحرف على الأقلّ).',
            phone: 'رقم الهاتف غير صحيح. مثال: 20123456 ولا +33...',
            email: 'البريد الإلكتروني غير صحيح.',
            consentRequired: 'لازم توافق على معالجة المعطيات باش نكمّلو.'
        } as Record<string, string>
    },
    proprietaire: {
        navCta: 'عندك عقار؟',
        pageTitle: 'عندك عقار للبيع؟ سجّلو مع اللَّبنة',
        title: 'عندك عقار للبيع؟ سجّلو مع اللَّبنة',
        lede: 'سجّل عقارك عندنا. ما يظهرش للعموم: يوصل لفريق اللَّبنة، نراجعوه، وإذا لقينا حريف مطلبه يناسب عقارك نتّصلو بيك.',
        howTitle: 'كيفاش تخدم',
        how: [
            'تعمّر معطيات العقار — أقلّ من دقيقتين.',
            'الفريق يراجع العرض ويتثبّت من المعطيات.',
            'كي يجي مطلب حريف يناسب عقارك، نتّصلو بيك.'
        ],
        notPublic: 'عقارك ما يتنشرش آلياً في الموقع. يبقى عند الفريق، ويُعرض على الحرفاء المعنيين وحدهم.',
        sectionProperty: 'معطيات العقار',
        sectionOwner: 'معطياتك',
        kind: 'نوع العقار',
        kinds: {
            land: 'أرض',
            house: 'دار',
            apartment: 'شقة',
            building: 'عمارة',
            other: 'أخرى'
        } as Record<string, string>,
        governorate: 'الولاية',
        delegation: 'المعتمدية',
        imada: 'العمادة',
        address: 'العنوان أو المنطقة',
        addressHint: 'حيّ، نهج، معلم قريب',
        coords: 'الإحداثيات (GPS)',
        coordsHint: 'اختياري — من خرائط قوقل',
        lat: 'خط العرض',
        lng: 'خط الطول',
        areaM2: 'مساحة الأرض (م²)',
        builtAreaM2: 'المساحة المبنية (م²)',
        rooms: 'عدد الغرف',
        price: 'الثمن المطلوب (د.ت)',
        negotiable: 'الثمن قابل للتفاوض',
        legalStatus: 'الوضعية القانونية',
        legalStatuses: {
            titled: 'رسم عقاري',
            in_progress: 'في طور التسوية',
            undivided: 'على الشياع',
            unregistered: 'غير مسجّل',
            other: 'أخرى'
        } as Record<string, string>,
        description: 'وصف العقار',
        descriptionHint: 'اختياري — كل ما تحبّ تزيده',
        ownerName: 'الاسم واللقب',
        ownerPhone: 'رقم الهاتف',
        ownerEmail: 'البريد الإلكتروني',
        ownerNote: 'ملاحظاتك',
        mediaNote: 'الصور والفيديو والوثائق: الفريق باش يطلبهم منك في المكالمة. رفع الملفّات في الموقع يجي في مرحلة جاية.',
        consent: 'نوافق على أنّ اللَّبنة تسجّل معطيات عقاري وتتّصل بيا، وتنجّم تعرض العقار على حرفاء مطالبهم تناسبه.',
        submit: 'سجّل عقاري',
        submitting: 'جاري التسجيل…',
        thanksTitle: 'وصلنا عرضك 🎉',
        thanksBody: 'الفريق باش يراجع المعطيات ويتّصل بيك. احفظ رمز العرض — يفيدك كي تتّصل بينا.',
        refLabel: 'رمز العرض',
        backHome: 'رجوع للرئيسية',
        errors: {
            banner: 'فمّا حقول ناقصة ولا غير صحيحة.',
            rateLimited: 'عدد المحاولات كثير. عاود بعد شويّة.',
            server: 'صار مشكل تقني. عاود المحاولة.',
            fallback: 'هالحقل فيه مشكل.',
            kind: 'اختار نوع العقار.',
            govCode: 'اختار الولاية.',
            ownerName: 'الاسم واللقب مطلوب (3 أحرف على الأقلّ).',
            ownerPhone: 'رقم الهاتف غير صحيح.',
            ownerEmail: 'البريد الإلكتروني غير صحيح.',
            consent: 'لازم توافق باش نسجّلو العرض.',
            priceTnd: 'الثمن لازم يكون رقماً صحيحاً.',
            areaM2: 'المساحة لازم تكون رقماً صحيحاً.'
        } as Record<string, string>
    },
    cases: {
        navLink: 'حالات تمّ إنجازها',
        pageTitle: 'حالات تمّ إنجازها — اللَّبنة',
        title: 'حالات تمّ إنجازها',
        lede: 'ملفّات ساهمت اللَّبنة في حلّها. كل حالة منشورة بموافقة صاحبها، وبلا أسماء.',
        empty: 'مازال ما فمّاش حالة منشورة. أوّل الحالات المنجزة باش تظهر هنا.',
        mapTitle: 'صفاقس حسب المعتمديات',
        mapLede: 'أعداد فقط: حالات منجزة، ملفّات في الطريق، وعروض عقارية متاحة. بلا أيّ معطى شخصي.',
        mapCompleted: 'منجزة',
        mapActive: 'في الطريق',
        mapProperties: 'عروض متاحة',
        mapEmpty: 'ما فمّاش نشاط مسجّل في هالمعتمدية توّا.',
        allDelegations: 'كلّ المعتمديات',
        kinds: {
            build_on_land: 'بناء فوق أرض الحريف',
            land_and_house: 'أرض وبناء',
            apartment: 'شراء شقة',
            house: 'شراء منزل',
            renovation: 'ترميم أو توسعة',
            other: 'حالة أخرى'
        } as Record<string, string>,
        problemLabel: 'المشكلة',
        solutionLabel: 'الحلّ',
        resultLabel: 'النتيجة',
        durationLabel: 'مدّة الإنجاز',
        months: 'شهر',
        areaLabel: 'المساحة',
        beforeLabel: 'قبل',
        afterLabel: 'بعد',
        consentNote: 'كل حالة تُنشر بموافقة صاحبها، ومجهّلة الهوية ما لم يطلب غير ذلك.',
        disclaimer: 'نعمل على دراسة كل ملف والبحث عن الحلول الممكنة بالتنسيق مع الأطراف المعنية.',
        ctaTitle: 'ملفّك ينجّم يكون الحالة الجاية',
        ctaBody: 'سجّل مطلبك وخلّي الفريق يدرسه.'
    },
    sim: {
        title: 'محاكي التمويل',
        lede: 'عمّر دخلك والمساهمة الذاتية اللي عندك، وشوف قدّاش تنجّم توصّل ميزانيتك وقدّاش يجي القسط الشهري. كل شي يتحسب في التوّ.',
        scenarioWarn: 'هذا سيناريو، موش عرض تمويل.',
        scenarioBody: 'اللَّبنة ما تثبّتش نسبة ولا سقف استدانة ولا مصاريف: تبدّل الفرضيات تحت وتشوف النتيجة. الشروط الحقيقية تجي من البنك.',
        yourData: 'معطياتك',
        income: 'الدخل الشهري الصافي',
        spouse: 'دخل القرين',
        loans: 'الأقساط الجارية',
        down: 'المساهمة الذاتية',
        perMonth: 'د.ت/شهر',
        tnd: 'د.ت',
        assumptionsTitle: 'فرضيات التمويل',
        assumptionsLede: 'قيم انطلاق للتجربة — عدّلها كيف ما تحبّ. ما تعكسش شروط أيّ بنك.',
        years: 'مدّة التمويل',
        yearsUnit: '{n} سنة',
        rate: 'نسبة التمويل السنوية (هامش الربح)',
        dti: 'سقف الاستدانة من الدخل',
        productsTitle: 'صيغ تمويل مرجعية',
        productsLede: 'للاستئناس. النسب والمدد والشروط النهائية تُحدَّد من البنك حسب ملفّك.',
        upTo: 'إلى',
        ofCost: 'من الكلفة',
        yearsWord: 'سنة',
        unverified: 'معطى في طور التثبّت مع البنك.',
        buildTitle: 'شنوّة تنجّم تبني بهالميزانية؟',
        buildLede: 'المساحة التقريبية حسب مستوى التشطيب. الأسعار دون احتساب الأداءات (HT) وما تشملش ثمن الأرض ولا مصاريف الدراسات والرخص.',
        range: 'نطاق',
        refPrice: 'السعر المرجعي المعتمد في الدراسات:',
        refPriceEnd: 'الكلفة النهائية لكل مسكن تتحدّد في devis تفصيلي حسب المواصفات الفنية والمعمارية.',
        resultTitle: 'الميزانية الجملية في هذا السيناريو',
        monthly: 'القسط الشهري',
        loanAmount: 'مبلغ التمويل',
        ownShare: 'المساهمة الذاتية',
        duration: 'المدّة',
        resultCta: 'سجّل مطلبك بهالميزانية',
        forIndividuals: 'الأفراد',
        forProfessionals: 'المهنيين'
    },
    merci: {
        title: 'تسجّل مطلبك يا {name} 🎉',
        fallbackMsg: 'باش نتّصلو بيك قريب.',
        refLabel: 'رمز مطلبك — احفظه',
        refBody: 'بهالرمز مع رقم تلفونك تنجّم تتابع مطلبك في أيّ وقت من صفحة',
        trackLink: 'تتبّع مطلبي',
        buildCost: 'كلفة البناء التقديرية — مستوى',
        buildCostNote: 'الأسعار دون احتساب الأداءات (HT) وما تشملش ثمن الأرض ولا مصاريف الدراسات والرخص. الكلفة النهائية تتحدّد في devis تفصيلي حسب المواصفات الفنية والمعمارية.',
        summary: 'ملخّص مطلبك',
        type: 'نوع المطلب',
        gov: 'الولاية',
        areaWanted: 'المساحة المطلوبة',
        standing: 'مستوى التشطيب',
        status: 'الحالة',
        undefined: 'غير محدّدة',
        home: 'رجوع للرئيسية',
        trySim: 'جرّب محاكي التمويل'
    },
    suivi: {
        pageTitle: 'متابعة مطالب الحرفاء — اللَّبنة',
        title: 'متابعة مطالب الحرفاء',
        intro: 'في اللَّبنة، كل مطلب يتم دراسته ومتابعته. بعض الحرفاء تمكّنّا من إيجاد حلول لملفاتهم، وملفات أخرى مازالت بصدد المعالجة. فريقنا يواصل العمل على كل حالة حسب خصوصيتها.',
        disclaimer: 'نعمل على دراسة كل ملف والبحث عن الحلول الممكنة بالتنسيق مع الأطراف المعنية.',
        statesTitle: 'حالات الملفّات',
        states: {
            resolved: 'تمّ حلّ الإشكال',
            in_progress: 'بصدد المعالجة',
            waiting: 'في انتظار معطيات أو وثائق',
            closed: 'ملفّ مغلق حالياً'
        } as Record<string, string>,
        stateDesc: {
            resolved: 'لقينا حلّاً للملفّ وتواصلنا مع الحريف بخصوصه.',
            in_progress: 'الملفّ تحت الدراسة، والفريق يخدم عليه.',
            waiting: 'ننتظر من الحريف معطيات أو وثائق باش نكمّلو.',
            closed: 'بالمعطيات الحالية ما لقيناش حلّاً ممكناً. الملفّ يبقى محفوظاً ونعاودو نقيّموه كي تتبدّل الظروف.'
        } as Record<string, string>,
        lookupTitle: 'شوف وضعية ملفّك',
        lookupLede:
            'عمّر رمز المطلب ورقم التلفون اللي سجّلت بيه. الزوز مع بعضهم باش ما يطّلعش على ملفّك كان صاحبه.',
        refCode: 'رمز المطلب',
        phone: 'رقم الهاتف',
        and: 'و',
        submit: 'شوف وضعية ملفّي',
        notFound: 'ما لقيناش ملفّ بهالمعطيات.',
        notFoundEnd: 'تثبّت من الرمز والرقم، ولا',
        newRequest: 'سجّل مطلب جديد',
        tooMany: 'محاولات كثيرة. عاود بعد شويّة.',
        needInput: 'عمّر رمز المطلب ورقم الهاتف معاً.',
        statusLabel: 'الحالة',
        lastUpdate: 'آخر تحيين',
        nextStep: 'المرحلة القادمة',
        noUpdateYet: 'ما فمّاش تحيين مكتوب بعد — الملفّ في دوره.',
        nextStepDefault: 'التواصل مع الحريف حسب دور الملفّ.',
        registeredOn: 'مسجّل في',
        updatedOn: 'آخر تحيين في',
        statsTitle: 'صورة عامّة على الخدمة',
        statsLede: 'أعداد فقط، بلا أيّ معطى شخصي.',
        statsReceived: 'مطالب مستلمة',
        statsResolved: 'ملفّات لقات حلولاً',
        statsInProgress: 'ملفّات قيد المعالجة',
        statsWaiting: 'في انتظار وثائق أو معلومات',
        privacyNote: 'ما نعرضوش في هذي الصفحة أيّ اسم ولا رقم هاتف ولا مبلغ. وضعية ملفّك ما تظهرش كان بالرمز ورقم الهاتف معاً — الرمز وحدو ما يكفيش.'
    },
    privacy: {
        title: 'حماية المعطيات الشخصية',
        lede: 'اللَّبنة تجمع معطيات شخصية ومالية باش تدرس مطلبك. هذي الصفحة تشرح شنوّة نجمعو، علاش، ولمن ينجّم يوصل.',
        s1: 'شنوّة نجمعو',
        s1items: [
            'اسمك ورقم تلفونك وبريدك الإلكتروني إن عمّرته.',
            'الولاية والمعتمدية والعمادة ونوع المطلب والمساحة المطلوبة.',
            'معطيات مالية صرّحت بيها: الدخل، المساهمة الذاتية، الأقساط الجارية، نوع النشاط.',
            'إن كان مطلبك بناء فوق أرضك: معطيات على الأرض ووضعيتها.'
        ],
        s1end: 'ما نجمعوش رقم بطاقة التعريف ولا وثائق رسمية في هذي المرحلة.',
        s2: 'علاش نجمعوها',
        s2body: 'باش نقدّرو قدرتك على التمويل، ونرتّبو مطلبك حسب جاهزيته، ونلقاو لك عرضاً يناسب ميزانيتك والمنطقة اللي تحبّها. النتيجة تقديرية ولا تمثّل عرض تمويل ولا التزاماً من أيّ مؤسّسة بنكية.',
        s3: 'لمن تنجّم توصل',
        s3body: 'في إطار مطلبك وحدو: لفريق اللَّبنة، ولشركة بناء أو باعث عقاري أو مؤسّسة تمويل معنيّة بمطلبك. ما نبيعوش معطياتك ولا نستعملوها في إشهار لطرف ثالث.',
        s4: 'قدّاش تتحفظ',
        s4body: '24 شهراً من آخر تحيين لمطلبك. بعدها تُجهَّل المعطيات (يتشال منها كل ما يدلّ على هويتك) وتبقى إحصائيات فقط.',
        s5: 'حقوقك',
        s5body: 'تنجّم في أيّ وقت تطلب الاطّلاع على معطياتك أو تصحيحها أو حذفها. يكفي تتّصل بينا بالرمز متاع مطلبك. معالجة المعطيات الشخصية في تونس خاضعة للقانون عدد 63 لسنة 2004 وللهيئة الوطنية لحماية المعطيات الشخصية.',
        note: 'ملاحظة: هذي نسخة تجريبية من المنصة. النصّ القانوني النهائي لهذه الصفحة يُضبط مع مختصّ قانوني قبل الإطلاق العلني.'
    },
    labels: {
        requestType: {
            build_on_land: 'نحبّ نبني فوق أرضي',
            land_and_house: 'نحبّ أرض ودار',
            apartment: 'نحبّ شقة',
            economic: 'سكن اقتصادي',
            rent_to_own: 'كراء مملّك'
        } as Record<string, string>,
        employment: {
            public: 'وظيفة عمومية',
            private: 'قطاع خاص',
            self_employed: 'عمل مستقلّ (حرفي، تاجر، مهنة حرّة)',
            informal: 'دخل غير قارّ',
            retired: 'متقاعد',
            expat: 'تونسي مقيم بالخارج',
            other: 'أخرى'
        } as Record<string, string>,
        horizon: {
            now: 'فوراً',
            '6m': 'في حدود 6 أشهر',
            '12m': 'في حدود سنة',
            '24m': 'في حدود سنتين'
        } as Record<string, string>,
        titleStatus: {
            titled: 'رسم عقاري (مسجّلة)',
            in_progress: 'في طور التسوية',
            undivided: 'على الشياع',
            other: 'أخرى'
        } as Record<string, string>,
        standing: {
            standard: 'عادي',
            mid: 'متوسّط ومحسّن',
            premium: 'Haut Standing'
        } as Record<string, string>,
        standingDesc: {
            standard: 'بناء ومواد بمواصفات عادية، تشطيب بسيط.',
            mid: 'مواد وتجهيزات أرقى، تشطيب محسّن.',
            premium: 'مواد وتجهيزات فاخرة، تشطيب عالي.'
        } as Record<string, string>,
        status: {
            new: 'جديد',
            contacted: 'تمّ الاتصال',
            qualified: 'مؤهّل',
            matched: 'مطابَق بعرض',
            appointment: 'موعد محدّد',
            contract: 'عقد',
            on_hold: 'في الانتظار',
            rejected: 'مرفوض'
        } as Record<string, string>,
        citizenMsg: {
            A: 'ملفّك جاهز. باش نتّصلو بيك في ظرف 48 ساعة بعرض يناسب قدرتك.',
            B: 'ملفّك قابل للتمويل مع تعديل بسيط في المساهمة الذاتية أو المدّة. باش نتّصلو بيك للمرافقة.',
            C: 'نجّمو نلقاو لك حلّ بمساحة أو منطقة مختلفة، ولا بخطّة ادخار قصيرة. باش نتّصلو بيك.',
            D: 'مطلبك تسجّل. بالمعطيات الحالية التمويل صعيب توّا، أمّا نعاودو نقيّمو ملفّك كي تتبدّل ظروفك.'
        } as Record<string, string>
    }
};
export type Dictionary = typeof ar

const fr: Dictionary = {
    dirLabel: 'ltr',
    langName: 'Français',
    otherLangName: 'العربية',
    nav: {
        brand: 'ALLABINA',
        brandSub: 'Construction & Développement',
        simulator: 'Simulateur',
        track: 'Suivre ma demande',
        cta: 'Déposer ma demande'
    },
    footer: {
        about: "Plateforme nationale qui structure la demande de logement en Tunisie et met le citoyen en relation avec les solutions de construction, d'immobilier et de financement adaptées à ses moyens. Phase pilote : gouvernorat de Sfax.",
        request: 'Déposer une demande',
        simulator: 'Simulateur de financement',
        track: 'Suivre une demande',
        privacy: 'Protection des données',
        legal: 'ALLABINA Construction & Développement — version pilote'
    },
    home: {
        badge: 'Plateforme nationale de la demande de logement — pilote : gouvernorat de Sfax',
        title: 'ALLABINA — on bâtit à votre mesure',
        lede: "Déposez votre demande une seule fois : nous cherchons la solution qui correspond à votre budget et à la zone que vous visez — construire sur votre terrain, un terrain avec maison, ou un appartement — avec une lecture claire de votre capacité de financement.",
        cta1: 'Déposer ma demande — gratuit',
        cta2: 'Calculer mon budget',
        heroNote: "De la demande de logement aux clés de la maison — sans frais pour le citoyen.",
        pathsTitle: 'Que souhaitez-vous faire ?',
        pathsLede: 'Choisissez votre parcours : le formulaire s’adapte à votre choix.',
        pathStart: 'Commencer →',
        paths: {
            build_on_land: 'Vous avez un terrain ? Nous étudions sa situation et proposons un modèle adapté à sa surface et à votre budget.',
            land_and_house: 'Une offre complète : un terrain dans la zone souhaitée et une maison construite dessus, sous contrat clair.',
            apartment: 'Nous rapprochons votre demande des projets légaux, livrés ou en cours.',
            rent_to_own: "Peu d'apport ? Nous enregistrons votre demande et étudions votre capacité en location-vente."
        } as Record<string, string>,
        howTitle: 'Comment fonctionne ALLABINA',
        steps: [
            {
                t: 'Déposez votre demande',
                b: 'Cinq étapes, moins de trois minutes, depuis le téléphone.'
            },
            {
                t: 'Nous étudions votre capacité',
                b: 'Budget estimatif et mensualité possible.'
            },
            {
                t: 'Nous trouvons l’offre',
                b: 'Un projet ou une entreprise adaptée à votre zone et à vos moyens.'
            },
            {
                t: 'Nous vous accompagnons',
                b: 'Du premier rendez-vous jusqu’aux clés.'
            }
        ],
        pricesTitle: 'Coût de construction — en clair',
        pricesLede: 'Aucun modèle imposé. Vous choisissez le niveau de construction et de finition selon votre budget, et un devis détaillé est établi avant le démarrage des travaux.',
        pricesNote: "Prix hors taxes (HT), hors prix du terrain, études et autorisations. Prix de référence retenu dans les études :",
        audience: {
            citizen: {
                title: 'Pour le citoyen',
                items: [
                    'Demande de logement ou de construction sur votre terrain',
                    'Surfaces : 60 · 80 · 100 m²',
                    'Simulation de la capacité de financement',
                    'Suivi de la demande par code'
                ]
            },
            builders: {
                title: 'Pour les constructeurs et promoteurs',
                items: [
                    'Nombre de clients réellement engagés',
                    'Zones les plus demandées',
                    'Modèle et surface réellement recherchés',
                    'Coûts de commercialisation réduits'
                ]
            },
            banks: {
                title: 'Pour les banques et financeurs',
                items: [
                    'Dossiers préliminaires structurés',
                    'Estimation de la capacité financière',
                    'Rapprochement client / solution de financement',
                    'Suivi des étapes du projet'
                ]
            }
        },
        ctaTitle: 'Votre demande commence aujourd’hui',
        ctaBody: 'Le dépôt est gratuit et sans compte. Remplissez le formulaire, recevez votre code de demande, nous vous rappelons.'
    },
    form: {
        pageTitle: 'Déposer votre demande de logement',
        pageLede: 'Moins de trois minutes. Sans compte : vous suivez votre demande avec un code.',
        stepOf: 'Étape {i} sur {n}',
        stepNames: [
            'Type de demande',
            'Lieu et surface',
            'Terrain',
            'Capacité financière',
            'Contact'
        ],
        back: 'Retour',
        next: 'Suivant',
        submit: 'Envoyer ma demande',
        submitting: 'Envoi…',
        genericError: 'Des informations sont manquantes ou invalides.',
        optional: 'facultatif',
        choose: '— Choisir —',
        s1Title: 'Que souhaitez-vous faire ?',
        s1Lede: 'Choisissez le parcours qui vous correspond.',
        s2Title: 'Où et quelle surface ?',
        s2Lede: 'La phase pilote couvre le gouvernorat de Sfax. Vous pouvez déposer depuis un autre gouvernorat : nous vous contacterons à l’ouverture.',
        governorate: 'Gouvernorat',
        comingSoon: '(bientôt)',
        delegation: 'Délégation',
        imada: 'Imada',
        landLocation: 'Emplacement du terrain ou zone',
        landLocationHint: 'facultatif — quartier, rue, repère',
        landLocationPlaceholder: 'Ex. : quartier Ennour, près du dispensaire…',
        area: 'Surface souhaitée',
        otherArea: 'Autre surface',
        bedrooms: 'Nombre de chambres',
        horizon: 'Quand souhaitez-vous démarrer ?',
        standingTitle: 'Niveau de construction et de finition',
        standingLede: 'Aucun modèle imposé. Choisissez le niveau adapté à votre budget ; le coût final est fixé dans un devis détaillé avant le démarrage des travaux.',
        costFor: 'Coût de construction estimé pour {area} m² en niveau {tier} :',
        costNote: 'Prix hors taxes (HT), hors prix du terrain, études et autorisations.',
        s3Title: 'Votre terrain',
        s3Lede: 'Ces informations nous disent ce qui peut y être construit.',
        landArea: 'Surface du terrain (m²)',
        titleStatus: 'Situation foncière',
        hasWater: 'Raccordé à l’eau',
        hasPower: 'Raccordé à l’électricité',
        hasRoad: 'Accès à la voirie',
        hasPermit: 'Permis de bâtir obtenu',
        s4Title: 'Votre capacité financière',
        s4Lede: 'Ces données servent à estimer votre budget et restent confidentielles. Plus elles sont exactes, plus l’offre sera juste.',
        income: 'Revenu mensuel net (DT)',
        spouseIncome: 'Revenu du conjoint (DT)',
        otherIncome: 'Autres revenus (DT)',
        existingLoans: 'Total des mensualités en cours (DT/mois)',
        existingLoansHint: 'crédits en cours',
        downPayment: 'Apport personnel disponible (DT)',
        maxMonthly: 'Mensualité que vous pouvez payer (DT)',
        employment: 'Type d’activité',
        seniority: 'Ancienneté (en mois)',
        isExpat: 'Je suis Tunisien résidant à l’étranger',
        expatCountry: 'Pays de résidence',
        estimateTitle: 'Estimation préliminaire selon vos données',
        maxPayment: 'Mensualité possible',
        maxLoan: 'Montant de financement estimé',
        maxBudget: 'Budget global',
        s5Title: 'Comment vous joindre ?',
        s5Lede: 'Dernière étape. Vous recevrez votre code de demande à la page suivante.',
        fullName: 'Nom et prénom',
        phone: 'Téléphone',
        phoneHint: 'Ex. : 20123456 ou +33…',
        email: 'E-mail',
        consent: "J'accepte qu'ALLABINA collecte mes données et les utilise pour étudier ma demande, et puisse les transmettre à une entreprise de construction, un promoteur ou une banque dans ce cadre. Je peux demander leur accès ou leur suppression à tout moment.",
        errors: {
            banner: "Des champs sont manquants ou invalides. Nous vous avons ramené à l'étape concernée.",
            rateLimited: 'Trop de tentatives. Réessayez dans quelques instants.',
            server: "Une erreur technique est survenue. Merci de réessayer.",
            fallback: 'Ce champ est invalide.',
            requestType: 'Choisissez le type de demande.',
            govCode: 'Choisissez le gouvernorat.',
            horizon: 'Indiquez quand vous souhaitez démarrer.',
            desiredAreaM2: 'La surface doit être comprise entre 40 et 400 m².',
            bedrooms: 'Le nombre de chambres doit être compris entre 1 et 6.',
            landAreaM2: 'La surface du terrain doit être comprise entre 50 et 5 000 m².',
            monthlyIncome: 'Renseignez votre revenu mensuel net.',
            employment: "Choisissez votre type d'activité.",
            fullName: 'Nom et prénom requis (3 caractères minimum).',
            phone: 'Numéro invalide. Ex. : 20123456 ou +33…',
            email: 'Adresse e-mail invalide.',
            consentRequired: 'Votre accord est nécessaire pour continuer.'
        } as Record<string, string>
    },
    proprietaire: {
        navCta: 'Un bien à vendre ?',
        pageTitle: 'Un bien à vendre ? Enregistrez-le avec ALLABINA',
        title: 'Un bien à vendre ? Enregistrez-le avec ALLABINA',
        lede: "Enregistrez votre bien chez nous. Il n'est pas publié : il parvient à l'équipe ALLABINA, nous l'examinons, et si la demande d'un client correspond à votre bien, nous vous contactons.",
        howTitle: 'Comment ça marche',
        how: [
            'Vous renseignez les informations du bien — moins de deux minutes.',
            "L'équipe examine l'offre et vérifie les informations.",
            "Dès qu'une demande correspond à votre bien, nous vous appelons."
        ],
        notPublic: "Votre bien n'est pas publié automatiquement sur le site. Il reste auprès de l'équipe et n'est présenté qu'aux clients concernés.",
        sectionProperty: 'Informations sur le bien',
        sectionOwner: 'Vos coordonnées',
        kind: 'Type de bien',
        kinds: {
            land: 'Terrain',
            house: 'Maison',
            apartment: 'Appartement',
            building: 'Immeuble',
            other: 'Autre'
        } as Record<string, string>,
        governorate: 'Gouvernorat',
        delegation: 'Délégation',
        imada: 'Imada',
        address: 'Adresse ou zone',
        addressHint: 'quartier, rue, repère',
        coords: 'Coordonnées (GPS)',
        coordsHint: 'facultatif — depuis Google Maps',
        lat: 'Latitude',
        lng: 'Longitude',
        areaM2: 'Surface du terrain (m²)',
        builtAreaM2: 'Surface bâtie (m²)',
        rooms: 'Nombre de pièces',
        price: 'Prix demandé (DT)',
        negotiable: 'Prix négociable',
        legalStatus: 'Situation juridique',
        legalStatuses: {
            titled: 'Titre foncier',
            in_progress: 'En cours de régularisation',
            undivided: 'En indivision',
            unregistered: 'Non enregistré',
            other: 'Autre'
        } as Record<string, string>,
        description: 'Description du bien',
        descriptionHint: 'facultatif',
        ownerName: 'Nom et prénom',
        ownerPhone: 'Téléphone',
        ownerEmail: 'E-mail',
        ownerNote: 'Vos remarques',
        mediaNote: "Photos, vidéos et documents : l'équipe vous les demandera lors de l'appel. Le dépôt de fichiers en ligne arrivera dans une prochaine étape.",
        consent: "J'accepte qu'ALLABINA enregistre les informations de mon bien, me contacte, et puisse présenter ce bien à des clients dont la demande y correspond.",
        submit: 'Enregistrer mon bien',
        submitting: 'Enregistrement…',
        thanksTitle: 'Nous avons bien reçu votre offre 🎉',
        thanksBody: "L'équipe va examiner les informations et vous contacter. Conservez le code de l'offre : il vous servira lors de nos échanges.",
        refLabel: "Code de l'offre",
        backHome: "Retour à l'accueil",
        errors: {
            banner: 'Des champs sont manquants ou invalides.',
            rateLimited: 'Trop de tentatives. Réessayez dans quelques instants.',
            server: 'Une erreur technique est survenue. Merci de réessayer.',
            fallback: 'Ce champ est invalide.',
            kind: 'Choisissez le type de bien.',
            govCode: 'Choisissez le gouvernorat.',
            ownerName: 'Nom et prénom requis (3 caractères minimum).',
            ownerPhone: 'Numéro de téléphone invalide.',
            ownerEmail: 'Adresse e-mail invalide.',
            consent: 'Votre accord est nécessaire pour enregistrer le bien.',
            priceTnd: 'Le prix doit être un nombre valide.',
            areaM2: 'La surface doit être un nombre valide.'
        } as Record<string, string>
    },
    cases: {
        navLink: 'Réalisations',
        pageTitle: 'Cas traités — ALLABINA',
        title: 'Cas traités',
        lede: "Des dossiers qu'ALLABINA a contribué à résoudre. Chaque cas est publié avec l'accord de son titulaire, sans noms.",
        empty: "Aucun cas publié pour le moment. Les premières réalisations apparaîtront ici.",
        mapTitle: 'Sfax par délégation',
        mapLede: "Des nombres uniquement : cas réalisés, dossiers en cours et biens disponibles. Aucune donnée personnelle.",
        mapCompleted: 'réalisés',
        mapActive: 'en cours',
        mapProperties: 'biens disponibles',
        mapEmpty: "Aucune activité enregistrée dans cette délégation pour l'instant.",
        allDelegations: 'Toutes les délégations',
        kinds: {
            build_on_land: 'Construction sur terrain du client',
            land_and_house: 'Terrain et construction',
            apartment: "Achat d'appartement",
            house: "Achat de maison",
            renovation: 'Rénovation ou extension',
            other: 'Autre cas'
        } as Record<string, string>,
        problemLabel: 'Le problème',
        solutionLabel: 'La solution',
        resultLabel: 'Le résultat',
        durationLabel: 'Durée de réalisation',
        months: 'mois',
        areaLabel: 'Surface',
        beforeLabel: 'Avant',
        afterLabel: 'Après',
        consentNote: "Chaque cas est publié avec l'accord de son titulaire, et anonymisé sauf demande contraire.",
        disclaimer: 'Nous étudions chaque dossier et recherchons les solutions possibles en coordination avec les parties concernées.',
        ctaTitle: 'Votre dossier peut être le prochain cas',
        ctaBody: "Déposez votre demande et laissez l'équipe l'étudier."
    },
    sim: {
        title: 'Simulateur de financement',
        lede: 'Saisissez vos revenus et votre apport : vous voyez immédiatement le budget atteignable et la mensualité correspondante.',
        scenarioWarn: 'Ceci est un scénario, pas une offre de financement.',
        scenarioBody: "ALLABINA ne fixe ni taux, ni plafond d'endettement, ni frais : modifiez les hypothèses ci-dessous et observez le résultat. Les conditions réelles sont fixées par la banque.",
        yourData: 'Vos données',
        income: 'Revenu mensuel net',
        spouse: 'Revenu du conjoint',
        loans: 'Mensualités en cours',
        down: 'Apport personnel',
        perMonth: 'DT/mois',
        tnd: 'DT',
        assumptionsTitle: 'Hypothèses de financement',
        assumptionsLede: "Valeurs de départ, à ajuster librement. Elles ne reflètent les conditions d'aucune banque.",
        years: 'Durée du financement',
        yearsUnit: '{n} ans',
        rate: 'Taux annuel / marge bénéficiaire',
        dti: 'Plafond d’endettement',
        productsTitle: 'Formules de financement de référence',
        productsLede: 'À titre indicatif. Les taux, durées et conditions définitifs sont fixés par la banque selon votre dossier.',
        upTo: "jusqu'à",
        ofCost: 'du coût',
        yearsWord: 'ans',
        unverified: 'Donnée en cours de vérification auprès de la banque.',
        buildTitle: 'Que pouvez-vous construire avec ce budget ?',
        buildLede: 'Surface approximative selon le niveau de finition. Prix hors taxes (HT), hors terrain, études et autorisations.',
        range: 'fourchette',
        refPrice: 'Prix de référence retenu dans les études :',
        refPriceEnd: 'Le coût final de chaque logement est fixé dans un devis détaillé selon les spécifications techniques et architecturales.',
        resultTitle: 'Budget global dans ce scénario',
        monthly: 'Mensualité',
        loanAmount: 'Montant financé',
        ownShare: 'Apport personnel',
        duration: 'Durée',
        resultCta: 'Déposer ma demande avec ce budget',
        forIndividuals: 'Particuliers',
        forProfessionals: 'Professionnels'
    },
    merci: {
        title: 'Votre demande est enregistrée, {name} 🎉',
        fallbackMsg: 'Nous vous contactons prochainement.',
        refLabel: 'Votre code de demande — conservez-le',
        refBody: 'Avec ce code et votre numéro, vous suivez votre demande à tout moment depuis la page',
        trackLink: 'Suivre ma demande',
        buildCost: 'Coût de construction estimé — niveau',
        buildCostNote: 'Prix hors taxes (HT), hors prix du terrain, études et autorisations. Le coût final est fixé dans un devis détaillé selon les spécifications techniques et architecturales.',
        summary: 'Récapitulatif',
        type: 'Type de demande',
        gov: 'Gouvernorat',
        areaWanted: 'Surface souhaitée',
        standing: 'Niveau de finition',
        status: 'Statut',
        undefined: 'non précisée',
        home: 'Retour à l’accueil',
        trySim: 'Essayer le simulateur'
    },
    suivi: {
        pageTitle: 'Suivi des demandes — ALLABINA',
        title: 'Suivi des demandes',
        intro: "Chez ALLABINA, chaque demande est étudiée et suivie. Pour certains clients, nous avons pu trouver une solution ; d'autres dossiers sont encore en cours de traitement. Notre équipe poursuit le travail sur chaque cas selon sa spécificité.",
        disclaimer: 'Nous étudions chaque dossier et recherchons les solutions possibles en coordination avec les parties concernées.',
        statesTitle: 'États des dossiers',
        states: {
            resolved: 'Solution trouvée',
            in_progress: 'En cours de traitement',
            waiting: 'En attente de données ou de documents',
            closed: 'Dossier clos pour le moment'
        } as Record<string, string>,
        stateDesc: {
            resolved: 'Une solution a été trouvée et le client a été contacté à ce sujet.',
            in_progress: "Le dossier est à l'étude, l'équipe y travaille.",
            waiting: 'Nous attendons des données ou des documents du client pour poursuivre.',
            closed: "En l'état actuel des données, aucune solution n'a pu être trouvée. Le dossier est conservé et sera réévalué si la situation évolue."
        } as Record<string, string>,
        lookupTitle: 'Consulter votre dossier',
        lookupLede:
            'Saisissez le code de votre demande et le numéro de téléphone utilisé lors du dépôt : les deux sont nécessaires pour que seul le titulaire accède à son dossier.',
        refCode: 'Code de demande',
        phone: 'Téléphone',
        and: 'et',
        submit: 'Voir mon dossier',
        notFound: 'Aucun dossier ne correspond à ces informations.',
        notFoundEnd: 'Vérifiez le code et le numéro, ou',
        newRequest: 'déposez une nouvelle demande',
        tooMany: 'Trop de tentatives. Réessayez dans quelques instants.',
        needInput: 'Saisissez à la fois le code de demande et le numéro de téléphone.',
        statusLabel: 'État',
        lastUpdate: 'Dernière mise à jour',
        nextStep: 'Étape suivante',
        noUpdateYet: "Pas encore de mise à jour publiée — le dossier suit son tour.",
        nextStepDefault: 'Prise de contact selon le tour du dossier.',
        registeredOn: 'déposée le',
        updatedOn: 'mise à jour le',
        statsTitle: 'Aperçu général du service',
        statsLede: 'Des nombres uniquement, sans aucune donnée personnelle.',
        statsReceived: 'demandes reçues',
        statsResolved: 'dossiers avec solution',
        statsInProgress: 'dossiers en traitement',
        statsWaiting: 'en attente de documents',
        privacyNote: "Cette page n'affiche aucun nom, numéro ni montant. L'état d'un dossier ne s'affiche qu'avec le code ET le numéro de téléphone : le code seul ne suffit pas."
    },
    privacy: {
        title: 'Protection des données personnelles',
        lede: 'ALLABINA collecte des données personnelles et financières pour étudier votre demande. Cette page explique ce que nous collectons, pourquoi, et à qui ces données peuvent être transmises.',
        s1: 'Ce que nous collectons',
        s1items: [
            'Vos nom, téléphone et e-mail si vous le renseignez.',
            'Gouvernorat, délégation, imada, type de demande et surface souhaitée.',
            'Données financières déclarées : revenus, apport, mensualités en cours, type d’activité.',
            'Pour une construction sur votre terrain : les informations relatives au terrain.'
        ],
        s1end: "Nous ne collectons ni numéro de CIN complet ni documents officiels à ce stade.",
        s2: 'Pourquoi',
        s2body: "Pour estimer votre capacité de financement, classer votre demande selon son degré de maturité, et vous proposer une offre adaptée. Le résultat est une estimation et ne constitue ni une offre de financement ni un engagement d'un établissement bancaire.",
        s3: 'Destinataires',
        s3body: "Dans le seul cadre de votre demande : l'équipe ALLABINA, et une entreprise de construction, un promoteur ou un établissement de financement concerné. Vos données ne sont ni vendues ni utilisées à des fins publicitaires par des tiers.",
        s4: 'Durée de conservation',
        s4body: '24 mois à compter de la dernière mise à jour de votre demande. Au-delà, les données sont anonymisées et ne subsistent que sous forme de statistiques.',
        s5: 'Vos droits',
        s5body: "Vous pouvez à tout moment demander l'accès, la rectification ou la suppression de vos données, en nous contactant avec votre code de demande. Le traitement des données personnelles en Tunisie est régi par la loi n° 2004-63 et relève de l'INPDP.",
        note: "Note : version pilote de la plateforme. Le texte juridique définitif de cette page sera arrêté avec un conseil juridique avant le lancement public."
    },
    labels: {
        requestType: {
            build_on_land: 'Construire sur mon terrain',
            land_and_house: 'Terrain + maison',
            apartment: 'Appartement',
            economic: 'Logement économique',
            rent_to_own: 'Location-vente'
        } as Record<string, string>,
        employment: {
            public: 'Fonction publique',
            private: 'Secteur privé',
            self_employed: 'Indépendant (artisan, commerçant, profession libérale)',
            informal: 'Revenu non régulier',
            retired: 'Retraité',
            expat: 'Tunisien résidant à l’étranger',
            other: 'Autre'
        } as Record<string, string>,
        horizon: {
            now: 'Immédiatement',
            '6m': 'Sous 6 mois',
            '12m': 'Sous un an',
            '24m': 'Sous deux ans'
        } as Record<string, string>,
        titleStatus: {
            titled: 'Titre foncier',
            in_progress: 'En cours de régularisation',
            undivided: 'En indivision',
            other: 'Autre'
        } as Record<string, string>,
        standing: {
            standard: 'Standing ordinaire',
            mid: 'Standing moyen / amélioré',
            premium: 'Haut standing'
        } as Record<string, string>,
        standingDesc: {
            standard: 'Matériaux et prestations courants, finition simple.',
            mid: 'Matériaux et équipements supérieurs, finition améliorée.',
            premium: 'Matériaux et équipements haut de gamme, finition soignée.'
        } as Record<string, string>,
        status: {
            new: 'Nouvelle',
            contacted: 'Contactée',
            qualified: 'Qualifiée',
            matched: 'Offre proposée',
            appointment: 'Rendez-vous fixé',
            contract: 'Contrat',
            on_hold: 'En attente',
            rejected: 'Rejetée'
        } as Record<string, string>,
        citizenMsg: {
            A: 'Votre dossier est prêt. Nous vous contactons sous 48 heures avec une offre adaptée.',
            B: 'Votre dossier est finançable moyennant un ajustement de l’apport ou de la durée. Nous vous accompagnons.',
            C: 'Nous pouvons chercher une solution avec une autre surface ou une autre zone, ou un plan d’épargne court. Nous vous rappelons.',
            D: 'Votre demande est enregistrée. En l’état, le financement est difficile ; nous réévaluons votre dossier dès que votre situation évolue.'
        } as Record<string, string>
    }
};
export const dictionaries: Record<Locale, Dictionary> = { ar, fr }
export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale] ?? dictionaries.ar
