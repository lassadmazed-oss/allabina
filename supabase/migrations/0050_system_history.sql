-- ============================================================
-- 0050_system_history.sql · تاريخ كلّ طريقة بناء، وإصلاح صفّ خُرِّب
-- ============================================================
-- مشكلتان في ملفّ واحد:
--
-- 1) صفّ BLOC_PPE كان يحمل اسم «البناء التقليدي» ونصّه كاملاً — تعديل
--    يدوي من اللوحة يوم 2026-09-12 طمس محتوى النظام. ترحيل البذر
--    (0031) فيه `on conflict (code) do nothing`، فإعادة تشغيله لا
--    تُرجع شيئاً: الإصلاح يستوجب update صريحاً. وsort_order صار 1 في
--    الصفّين، والصفحة تختار الأوّل حسب الترتيب — فالافتراضي كان
--    يتبدّل من تحميل إلى آخر بلا سبب ظاهر.
--
-- 2) الصفحة كانت تقول «شنوّة هالطريقة» ولا تقول «من وين جاءت». الحريف
--    اللي يُقال له «اختار بين طريقتين» يسأل: واحدة منهم جديدة علينا؟
--    التاريخ هو الجواب، وهو ما يفرّق بين طريقة عمرها قرن وطريقة
--    مُجرَّبة أمس.
--
-- المحطّات معطيات لا نصّ مسترسل: كلّ محطّة تحمل مرجعها في `src`،
-- فالسنة تُقرأ مع مصدرها أو لا تُعرض. نفس قاعدة بقيّة الصفحة.
-- ============================================================

alter table construction_systems
  add column if not exists history jsonb not null default '[]'::jsonb;

comment on column construction_systems.history is
  'محطّات تاريخية: [{year, ar, fr, src}] — السنة نصّ لأنّ منها مجالات («1855–1864») وحقبات («اليوم»).';

-- ---------- 1) إرجاع محتوى البلوك المطموس ----------
-- النصّ هو نفسه نصّ 0031 حرفاً بحرف: لا نكتب محتوى جديداً في ترحيل
-- إصلاح، وإلّا ما عرفنا بعدها أيّ نسخة هي الأصل.
update construction_systems set
  name_ar = 'البلوك الخرساني + سقف Poutrelles',
  name_fr = 'Bloc béton + plancher poutrelles',
  citizen_summary_ar = 'جدران ببلوك خرساني معياري 50×20 صم، وسقف بعناصر مسبقة الصنع تُركَّب في الموقع.',
  citizen_summary_fr = 'Murs en blocs béton modulaires 50×20 cm et plancher en éléments préfabriqués.',
  principle_ar = 'نظام يعتمد بلوكات خرسانية معيارية مجوّفة، مع بلوكات عادية وأخرى خاصّة بالربط والتقوية. تُملأ بعض التجاويف بخرسانة تُصبّ في الموقع. الأبعاد تسمح بتنسيق أبعاد بمضاعفات 25 صم. السقف عناصر مسبقة الصنع تُركَّب ثمّ يُستكمل التسليح والصبّة حسب الدراسة الفنّية.',
  sort_order = 2,
  updated_at = now()
where code = 'BLOC_PPE';

update construction_systems set sort_order = 1, updated_at = now() where code = 'TRAD';

-- ---------- 2) تاريخ الطريقة التقليدية ----------
-- أرقام المساكن من التعداد الوطني، لا من تقدير: الطريقة «العادية» هي
-- التي بُني بها هذا التوسّع كلّه، وهذا أقوى من أيّ وصف لها.
update construction_systems set history = $hist$[
  {
    "year": "الأصل",
    "ar": "جدران حاملة من الحجر المحلّي بمُلاط الجير، والسقف خشب وقصب أو أقباء. ما زال قائماً في المدن العتيقة وفي دار جربة التقليدية — حجر بحري ومُلاط جير، بلا إسمنت ولا حديد.",
    "fr": "Murs porteurs en moellons de pierre locale au mortier de chaux, planchers en bois et roseaux ou voûtes. Toujours visible dans les médinas et la maison traditionnelle de Djerba — travertin marin et mortier de chaux, sans ciment ni acier.",
    "src": "توثيق دار جربة (الحجر البحري ومُلاط الجير الهوائي)"
  },
  {
    "year": "النقلة",
    "ar": "دخلت الخرسانة المسلّحة فتبدّل توزيع الأدوار: الهيكل (أعمدة وجوائز) صار هو الحامل، والآجرّ المجوّف يسدّ بين الأعمدة ولا يحمل، والسقف يُصبّ في الموقع. هذا بالضبط ما تسمّيه الناس اليوم «البناء العادي» — وهو في الحقيقة أحدث من اسمه.",
    "fr": "L'arrivée du béton armé a redistribué les rôles : l'ossature (poteaux et poutres) porte, la brique creuse ne fait que remplir entre les poteaux, et le plancher est coulé sur place. C'est exactement ce que l'on appelle aujourd'hui « la construction ordinaire » — plus récente que son nom ne le laisse croire.",
    "src": null
  },
  {
    "year": "1975–2024",
    "ar": "عدد المساكن في تونس تضاعف أربع مرّات، ومساكن الغرفة الواحدة نزلت من 40,9٪ إلى 2,8٪. هذا التوسّع كلّه تقريباً بُني بهذه الطريقة: اليد العاملة التي تعرفها موجودة في كلّ معتمدية، وهذا سبب انتشارها لا جودتها.",
    "fr": "Le nombre de logements en Tunisie a quadruplé et les logements d'une seule pièce sont passés de 40,9 % à 2,8 %. Presque toute cette expansion a été bâtie ainsi : la main-d'œuvre qui la maîtrise existe dans chaque délégation — c'est la raison de sa diffusion, pas de sa qualité.",
    "src": "التعداد الوطني للسكان والسكنى"
  },
  {
    "year": "اليوم",
    "ar": "99,8٪ من المساكن جدرانها وسقوفها من الحجر والآجرّ والبلاطة والخرسانة. أمّا الجير التقليدي فخرج من الورشة العادية وصار في برامج حفظ التراث (القيروان)، والحجر ما بقاش يُستخرج للبناء اليومي.",
    "fr": "99,8 % des logements ont murs et toitures en pierre, brique, dalle et béton. La chaux traditionnelle, elle, a quitté le chantier courant : elle relève désormais des programmes de sauvegarde (Kairouan), et la pierre n'est plus extraite pour la construction quotidienne.",
    "src": "التعداد الوطني · برامج حفظ الجير (القيروان)"
  }
]$hist$::jsonb, updated_at = now() where code = 'TRAD';

-- ---------- 3) تاريخ البلوك والسقف المسبق ----------
-- المحطّات ببراءاتها: البلوك المجوّف ليس «الطريقة الجديدة»، عمره أكثر
-- من قرن. وهذه هي المعلومة التي تهمّ حريفاً يخاف من التجريب عليه.
update construction_systems set history = $hist$[
  {
    "year": "1852",
    "ar": "في فرنسا يقترح François Coignet جدراناً من «béton aggloméré» ويقدّمها أرخص من البناء بالحجر. كنيسة Le Vésinet (1855–1864) أوّل شاهد كبير عليها. الفكرة إذن أوروبية وأقدم من البلوك نفسه.",
    "fr": "En France, François Coignet propose des murs en « béton aggloméré », présentés comme moins chers que la maçonnerie de pierre. L'église du Vésinet (1855-1864) en est le premier grand témoin. L'idée est donc européenne, et plus ancienne que le bloc lui-même.",
    "src": "Bertrand Lemoine — AFGC, L'invention du béton"
  },
  {
    "year": "1889",
    "ar": "في Chattanooga بالولايات المتحدة يسجّل Harmon S. Palmer براءة آلة تصنع بلوكاً خرسانياً مصمتاً. المصمت ثقيل ومكلّف، فلم ينتشر.",
    "fr": "À Chattanooga, aux États-Unis, Harmon S. Palmer brevette une machine à fabriquer un bloc de béton plein. Trop lourd et trop coûteux, le bloc plein ne se diffuse pas.",
    "src": "براءة أمريكية — Palmer, 1889"
  },
  {
    "year": "1899",
    "ar": "نفس الرجل يسجّل قالباً للبلوك المجوّف (براءة 674,874 سنة 1901). هذه النسخة هي التي نجحت: أخفّ، وأرخص، وتجويفها نفسه هو ما يسمح بتمرير الحديد وصبّ الربط داخله — وهو عين ما نستعمله اليوم.",
    "fr": "Le même homme brevette un moule pour le bloc creux (brevet 674,874, 1901). C'est cette version qui s'imposera : plus légère, moins chère, et dont les alvéoles permettent précisément de passer les armatures et de couler les chaînages — exactement l'usage actuel.",
    "src": "US patent 674,874 (1901)"
  },
  {
    "year": "1907",
    "ar": "في الولايات المتحدة وحدها قرابة ألف صانع بلوك مجوّف: الصناعة انتشرت في أقلّ من عشر سنوات. البلوك لم يكن تجربة، كان جواباً على حاجة إلى بناء سريع ورخيص.",
    "fr": "Aux États-Unis seuls, près d'un millier de fabricants de blocs creux : l'industrie s'est répandue en moins de dix ans. Le bloc n'était pas une expérimentation, mais une réponse au besoin de bâtir vite et à bas coût.",
    "src": "تاريخ صناعة البلوك الخرساني (CMU)"
  },
  {
    "year": "1942",
    "ar": "في فرنسا تُسجَّل براءة لعنصر سقف يُركَّب بين الـpoutrelles (FR979974A، أولويّتها 1942 ونُشرت 1951). هذا أصل سقف «poutrelles + entrevous»: عناصر تُصنع في المعمل وتُركَّب في الموقع بدل قوالب خشب تُبنى ثمّ تُهدم.",
    "fr": "En France, un brevet porte sur un élément de remplissage posé entre les poutrelles (FR979974A, priorité 1942, publié en 1951). C'est l'origine du plancher « poutrelles + entrevous » : des éléments faits en usine et posés sur place, au lieu d'un coffrage en bois monté puis démonté.",
    "src": "FR979974A — أولوية 1942، نشر 1951"
  },
  {
    "year": "اليوم",
    "ar": "الـpoutrelle خرسانة مسبقة الإجهاد (précontrainte par pré-tension)، والبلوك والـentrevous يُصنعان في تونس بـAvis Technique له مرجعه وتاريخه. كلّ رقم في هذه الصفحة — البحور والكمّيات والأبعاد — مأخوذ من تلك الوثائق.",
    "fr": "La poutrelle est en béton précontraint par pré-tension, et blocs comme entrevous sont fabriqués en Tunisie sous Avis Technique référencé et daté. Chaque chiffre de cette page — portées, quantités, dimensions — provient de ces documents.",
    "src": "Avis Technique DRISS AGGLO (2023)"
  }
]$hist$::jsonb, updated_at = now() where code = 'BLOC_PPE';
