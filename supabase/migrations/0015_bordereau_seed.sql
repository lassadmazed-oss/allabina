-- ============================================================
-- 0015_bordereau_seed.sql · بذرة بوردرو الأسعار
-- ============================================================
-- البوردرو كان فارغاً: عشرون Lot بلا مقال واحد، فلا يتولّد أيّ عرض.
-- هذي البذرة تعطي الفريق بوردرواً شغّالاً من اليوم الأوّل، يعدّله من
-- الـBack-office ولا يعيد بناءه.
--
-- ⚠ الأسعار استرشادية، مبنية على نطاقات معقولة للسوق التونسي، وليست
--   عروضاً متثبَّتاً منها. قبل أوّل عرض يخرج لحريف: راجعوها مع مزوّد
--   ومقاول. كلّ تغيير يُسجَّل في article_price_history.
--
-- المعايرة: مشروع مرجعي 120 م² · RDC · 3 غرف · صالون · مطبخ · حمّامان
-- · جراج، بمستوى B03، يعطي نحو 192 ألف دينار HT — أي 1 600 د/م²،
-- وهو بالضبط سعر B03 في standing_levels. الشبكتان متّسقتان بالبناء:
-- سعر المتر المربّع يقول «قدّاش»، والبوردرو يقول «على شنوّة».
--
-- كلّ مقال له نسخة لكلّ مستوى، حتى الهيكل: الأساسات والخرسانة والسباكة
-- تختلف فعلاً بين اقتصادي وHaut Standing (جرعة الخرسانة، كمّية الحديد،
-- نوعية التجهيزات الصحّية). النسخة تُحسب من سعر B03 مضروباً في نسبة
-- إنفاق المستوى على اللوط إلى إنفاق B03 عليه، مأخوذة من
-- standing_lot_shares نفسها.
--
-- الفائدة: مجموع العرض التفصيلي يساوي بالضبط سعر المتر المربّع المعلن
-- في standing_levels. الشبكتان ما تتناقضاش، والمحاكي والعرض يقولوا
-- نفس الرقم.
-- ============================================================

-- ---------- تنظيف بذرة أولى ----------
-- النسخة الأولى بذرت مقالات الهيكل بلا مستوى (standing = null) بسعر B03،
-- فانحرف مجموع العرض عن سعر المتر المعلن في بقيّة المستويات. تُحذف هنا
-- ما دامت لم تُستعمل في أيّ عرض ولم تُعدَّل يدوياً.
delete from articles a
where a.standing is null
  and a.code in (
    'ET-01','ET-02','ET-03','TR-01','TR-02','TR-03','FO-01','FO-02','FO-03',
    'BA-01','BA-02','BA-03','BA-04','MA-01','MA-02','MA-03','MA-04',
    'EN-01','EN-02','EN-03','IS-01','IS-02','IS-03',
    'PL-01','PL-02','PL-03','PL-04','PL-05',
    'EL-01','EL-02','EL-03','EL-04','EL-05','NE-01','NE-02','NE-03'
  )
  and not exists (select 1 from devis_lines dl where dl.article_id = a.id)
  and not exists (select 1 from article_price_history h where h.article_id = a.id);

-- ---------- كلّ المقالات، نسخة لكلّ مستوى ----------
with tmpl(lot_code, code, ar, fr, unit, formula, pu_total, mo_pct) as (values
  -- 1 · الدراسات والتحضير
  (1,  'ET-01', 'دراسة معمارية ومخطّطات التنفيذ', 'Étude architecturale & plans', 'forfait', '1', 1800.0, 0.15),
  (1,  'ET-02', 'دراسة هيكلية للخرسانة المسلّحة', 'Étude béton armé', 'forfait', '1', 1000.0, 0.10),
  (1,  'ET-03', 'رخصة بناء ومصاريف إدارية', 'Permis de bâtir & frais administratifs', 'forfait', '1', 560.0, 0.00),

  -- 2 · الحفر والتسوية
  (2,  'TR-01', 'تنظيف الأرض وتسوية سطح البناء', 'Nettoyage & nivellement', 'm2', 'surface * 1.2', 5.2, 0.85),
  (2,  'TR-02', 'حفر الأساسات', 'Fouilles en rigole', 'm3', 'surface * 0.45', 28.0, 0.85),
  (2,  'TR-03', 'ردم وتصفيف', 'Remblai & réglage', 'm3', 'surface * 0.30', 25.0, 0.85),

  -- 3 · الأساسات
  (3,  'FO-01', 'خرسانة نظافة', 'Béton de propreté', 'm3', 'surface * 0.10', 190.0, 0.45),
  (3,  'FO-02', 'قواعد وأعمدة الأساس', 'Semelles & amorces poteaux', 'm3', 'surface * 0.13', 430.0, 0.45),
  (3,  'FO-03', 'حزام الأساس', 'Longrines', 'ml', 'surface * 0.55', 31.0, 0.45),

  -- 4 · الخرسانة المسلّحة والهيكل
  (4,  'BA-01', 'أعمدة وجسور خرسانة مسلّحة', 'Poteaux & poutres BA', 'm3', 'surface * levels * 0.16', 520.0, 0.40),
  (4,  'BA-02', 'سقف hourdis 16+5', 'Plancher corps creux 16+5', 'm2', 'surface * levels * 1.05', 132.0, 0.40),
  (4,  'BA-03', 'درج خرسانة مسلّحة', 'Escalier BA', 'ml', '(levels - 1) * 5', 240.0, 0.40),
  (4,  'BA-04', 'قوالب وحديد تسليح إضافي', 'Coffrage & aciers complémentaires', 'm2', 'surface * levels', 34.0, 0.40),

  -- 5 · البناء
  (5,  'MA-01', 'جدران خارجية آجرّ 20', 'Murs extérieurs brique 20', 'm2', 'surface * 1.15', 46.0, 0.45),
  (5,  'MA-02', 'جدران داخلية آجرّ 12', 'Cloisons brique 12', 'm2', 'surface * 1.35', 38.0, 0.45),
  (5,  'MA-03', 'أعتاب وتقوية الفتحات', 'Linteaux & renforts', 'ml', 'surface * 0.45', 28.0, 0.45),
  (5,  'MA-04', 'خرسانة الأرضية', 'Dallage', 'm2', 'surface', 23.0, 0.45),

  -- 6 · التلبيس
  (6,  'EN-01', 'تلبيس داخلي', 'Enduit intérieur', 'm2', 'surface * 3.1', 19.0, 0.55),
  (6,  'EN-02', 'تلبيس خارجي', 'Enduit extérieur', 'm2', 'surface * 1.25', 22.0, 0.55),
  (6,  'EN-03', 'chape السطح', 'Chape terrasse', 'm2', 'surface * 1.05', 13.0, 0.55),

  -- 7 · العزل والحماية من المياه
  (7,  'IS-01', 'عزل السطح', 'Étanchéité terrasse', 'm2', 'surface * 1.05', 38.0, 0.40),
  (7,  'IS-02', 'عزل الحمّامات والمطبخ', 'Étanchéité pièces humides', 'm2', 'bathrooms * 8 + kitchens * 6', 30.0, 0.40),
  (7,  'IS-03', 'ميلان تصريف المياه', 'Forme de pente', 'm2', 'surface * 1.05', 2.5, 0.40),

  -- 8 · السباكة
  (8,  'PL-01', 'شبكة ماء بارد وسخن', 'Réseau eau froide / chaude', 'u', 'bathrooms * 6 + kitchens * 3', 155.0, 0.35),
  (8,  'PL-02', 'شبكة الصرف', 'Réseau évacuation', 'u', 'bathrooms * 5 + kitchens * 2', 130.0, 0.35),
  (8,  'PL-03', 'تجهيزات صحّية لكلّ حمّام', 'Appareils sanitaires par SDB', 'u', 'bathrooms', 1450.0, 0.30),
  (8,  'PL-04', 'خزّان ماء وربط بالشبكة', 'Bâche à eau & branchement SONEDE', 'forfait', '1', 1700.0, 0.35),
  (8,  'PL-05', 'حوض المطبخ وتوصيلاته', 'Évier & raccordements cuisine', 'u', 'kitchens', 880.0, 0.30),

  -- 9 · الكهرباء
  (9,  'EL-01', 'نقاط إنارة', 'Points lumineux', 'u', 'surface * 0.22', 78.0, 0.35),
  (9,  'EL-02', 'مآخذ تيار', 'Prises de courant', 'u', 'surface * 0.28', 82.0, 0.35),
  (9,  'EL-03', 'لوحة توزيع وحماية', 'Tableau & protections', 'forfait', '1', 1450.0, 0.30),
  (9,  'EL-04', 'تمديدات وأنابيب', 'Saignées & gaines', 'm2', 'surface', 22.0, 0.45),
  (9,  'EL-05', 'ربط بشبكة الكهرباء', 'Branchement STEG', 'forfait', '1', 950.0, 0.35),

  -- 20 · التنظيف والتسليم
  (20, 'NE-01', 'تنظيف نهائي', 'Nettoyage final', 'm2', 'surface * 1.15', 12.0, 0.80),
  (20, 'NE-02', 'إزالة الأنقاض والنقل', 'Évacuation des gravats', 'forfait', '1', 1450.0, 0.80),
  (20, 'NE-03', 'تصحيحات ما قبل التسليم', 'Reprises avant réception', 'forfait', '1', 1700.0, 0.80),

  -- 10 · الفرش والتغطية
  (10, 'RE-01', 'بلاط أرضي: توريد وتركيب', 'Carrelage sol fourni & posé', 'm2', 'surface * 1.05', 78.0, 0.35),
  (10, 'RE-02', 'فيانس الحمّامات والمطبخ', 'Faïence SDB & cuisine', 'm2', 'bathrooms * 18 + kitchens * 14', 62.0, 0.35),
  (10, 'RE-03', 'رخام العتبات والدرج', 'Marbre seuils & escalier', 'ml', 'surface * 0.35', 95.0, 0.35),
  (10, 'RE-04', 'فرش السطح', 'Revêtement terrasse', 'm2', 'surface * 0.45', 42.0, 0.35),

  -- 11 · الألمنيوم
  (11, 'AL-01', 'نوافذ ألمنيوم', 'Fenêtres aluminium', 'm2', 'surface * 0.16', 340.0, 0.20),
  (11, 'AL-02', 'باب المدخل ألمنيوم وزجاج', 'Porte d''entrée alu / verre', 'u', '1', 1850.0, 0.20),
  (11, 'AL-03', 'باب الجراج', 'Porte de garage', 'u', 'garage', 2600.0, 0.20),
  (11, 'AL-04', 'مصاريع وحماية', 'Volets & protections', 'm2', 'surface * 0.10', 165.0, 0.20),

  -- 12 · النجارة الخشبية
  (12, 'BO-01', 'أبواب داخلية', 'Portes intérieures', 'u', 'bedrooms + living_rooms + bathrooms + 1', 620.0, 0.20),
  (12, 'BO-02', 'خزائن حائطية', 'Placards', 'ml', 'bedrooms * 1.6', 620.0, 0.20),
  (12, 'BO-03', 'تركيب وتشطيب النجارة', 'Pose & finition menuiserie', 'forfait', '1', 1080.0, 0.60),

  -- 13 · الحدادة
  (13, 'FE-01', 'حماية النوافذ', 'Grilles de protection', 'm2', 'surface * 0.16', 135.0, 0.25),
  (13, 'FE-02', 'درابزين وسياج حديدي', 'Garde-corps & clôture métallique', 'ml', 'surface * 0.25', 88.0, 0.25),
  (13, 'FE-03', 'باب حديدي للخدمة', 'Porte de service métallique', 'u', '1', 520.0, 0.25),

  -- 14 · الدهن
  (14, 'PE-01', 'دهن داخلي', 'Peinture intérieure', 'm2', 'surface * 3.1', 14.0, 0.45),
  (14, 'PE-02', 'دهن خارجي', 'Peinture extérieure', 'm2', 'surface * 1.25', 16.0, 0.45),
  (14, 'PE-03', 'تحضير الأسطح وتصحيحها', 'Préparation des supports', 'forfait', '1', 320.0, 0.70),

  -- 15 · المطبخ
  (15, 'CU-01', 'مطبخ مركّب: خزائن ورخام', 'Cuisine équipée : meubles & plan', 'ml', 'kitchens * 4.5', 1450.0, 0.20),
  (15, 'CU-02', 'حوض وحنفية وتوصيلات', 'Évier, robinetterie & raccords', 'u', 'kitchens', 980.0, 0.20),
  (15, 'CU-03', 'شفّاط وتهوية', 'Hotte & ventilation', 'u', 'kitchens', 620.0, 0.20),
  (15, 'CU-04', 'تركيب المطبخ', 'Pose cuisine', 'forfait', 'kitchens', 990.0, 0.75),

  -- 16 · السقف المستعار
  (16, 'FP-01', 'سقف مستعار جبس', 'Faux plafond placo', 'm2', 'surface * 0.45', 58.0, 0.40),
  (16, 'FP-02', 'إنارة مدمجة', 'Éclairage encastré', 'u', 'surface * 0.05', 38.0, 0.35),

  -- 17 · التكييف والتدفئة
  (17, 'CL-01', 'تهيئة تمديدات التكييف', 'Pré-installation climatisation', 'u', 'bedrooms + living_rooms', 480.0, 0.40),
  (17, 'CL-02', 'مكيّفات', 'Climatiseurs', 'u', 'living_rooms', 1680.0, 0.15),

  -- 18 · الواجهة
  (18, 'FA-01', 'تلبيس الواجهة', 'Enduit de façade', 'm2', 'surface * 0.85', 46.0, 0.45),
  (18, 'FA-02', 'حجر أو زليج الواجهة', 'Pierre / zellige façade', 'm2', 'surface * 0.15', 95.0, 0.45),
  (18, 'FA-03', 'إنارة الواجهة وتفاصيلها', 'Éclairage & détails façade', 'forfait', '1', 560.0, 0.40),

  -- 19 · التهيئة الخارجية
  (19, 'AE-01', 'سياج المحيط', 'Clôture', 'ml', 'surface * 0.33', 110.0, 0.40),
  (19, 'AE-02', 'ممرّات وفناء', 'Allées & cour', 'm2', 'surface * 0.35', 62.0, 0.40),
  (19, 'AE-03', 'بوّابة خارجية', 'Portail', 'u', '1', 960.0, 0.25)
),
factor as (
  select s.lot_code,
         s.standing_code,
         (s.share_pct * lv.price_ht_m2) /
         nullif(base.share_pct * base_lv.price_ht_m2, 0) as f
  from standing_lot_shares s
  join standing_levels lv       on lv.code = s.standing_code
  join standing_lot_shares base on base.lot_code = s.lot_code and base.standing_code = 'B03'
  join standing_levels base_lv  on base_lv.code = 'B03'
)
insert into articles
  (code, lot_id, designation_ar, designation_fr, unit, qty_formula, standing,
   pu_fourniture_ht, pu_main_oeuvre_ht, is_active)
select t.code || '-' || f.standing_code,
       l.id,
       t.ar,
       t.fr,
       t.unit::article_unit,
       t.formula,
       f.standing_code,
       round((t.pu_total * f.f * (1 - t.mo_pct))::numeric, 3),
       round((t.pu_total * f.f * t.mo_pct)::numeric, 3),
       true
from tmpl t
join factor f on f.lot_code = t.lot_code
join lots l   on l.code = t.lot_code
where f.f > 0
on conflict (code) do nothing;
