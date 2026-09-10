-- ============================================================
-- 0002_seed_sfax.sql · بيانات الانطلاق — ولاية صفاقس
-- ============================================================
-- الولاية الأولى: صفاقس (is_active = true).
-- بقيّة الولايات مسجّلة لقبول المطالب دون معالجتها في هذه المرحلة.
-- الأسعار تُترك فارغة عمداً: المحاكي لا يشتغل قبل أن يُدخل الفريق
-- أرقاماً يقف وراءها — رقم مخترَع أخطر من غياب الرقم.
-- ============================================================

-- ---------- الولايات ----------
insert into governorates (code, name_ar, name_fr, is_active) values
  ('SFX','صفاقس','Sfax', true)
on conflict (code) do update set is_active = excluded.is_active;

insert into governorates (code, name_ar, name_fr) values
  ('TUN','تونس','Tunis'),               ('ARN','أريانة','Ariana'),
  ('BAN','بن عروس','Ben Arous'),        ('MAN','منوبة','Manouba'),
  ('NAB','نابل','Nabeul'),              ('ZAG','زغوان','Zaghouan'),
  ('BIZ','بنزرت','Bizerte'),            ('BJA','باجة','Béja'),
  ('JEN','جندوبة','Jendouba'),          ('KEF','الكاف','Le Kef'),
  ('SIL','سليانة','Siliana'),           ('KAI','القيروان','Kairouan'),
  ('KAS','القصرين','Kasserine'),        ('SBZ','سيدي بوزيد','Sidi Bouzid'),
  ('SOU','سوسة','Sousse'),              ('MON','المنستير','Monastir'),
  ('MAH','المهدية','Mahdia'),           ('GAB','قابس','Gabès'),
  ('MED','مدنين','Médenine'),           ('TAT','تطاوين','Tataouine'),
  ('GAF','قفصة','Gafsa'),               ('TOZ','توزر','Tozeur'),
  ('KEB','قبلي','Kébili')
on conflict (code) do nothing;

-- ---------- معتمديات صفاقس ----------
-- التقسيم حسب معطيات وزارة الداخلية — 16 معتمدية.
insert into delegations (gov_code, name_ar) values
  ('SFX','صفاقس المدينة'), ('SFX','صفاقس الشمالية'), ('SFX','صفاقس الجنوبية'),
  ('SFX','ساقية الزيت'),   ('SFX','ساقية الداير'),  ('SFX','طينة'),
  ('SFX','عقارب'),         ('SFX','جبنيانة'),       ('SFX','العامرة'),
  ('SFX','الحنشة'),        ('SFX','منزل شاكر'),     ('SFX','الغريبة'),
  ('SFX','بئر علي بن خليفة'), ('SFX','الصخيرة'),    ('SFX','المحرس'),
  ('SFX','قرقنة')
on conflict (gov_code, name_ar) do nothing;

-- ---------- أسعار مرجعية لصفاقس (فارغة إلى حين التعبئة) ----------
insert into price_references (gov_code, zone, product) values
  ('SFX','city','apartment'),    ('SFX','suburb','apartment'),
  ('SFX','city','land'),         ('SFX','suburb','land'),        ('SFX','rural','land'),
  ('SFX','city','construction'), ('SFX','suburb','construction'),
  ('SFX','city','house'),        ('SFX','suburb','house')
on conflict do nothing;

-- ---------- إعدادات المحاكي (فارغة إلى حين مصادقة مختصّ تمويل) ----------
insert into app_settings (key, value, description) values
  ('finance.annual_rate_pct',      null, 'نسبة الفائدة السنوية % (مرجع + هامش بنكي) — تحتاج مصادقة مختصّ'),
  ('finance.max_dti_pct',          null, 'سقف نسبة الاستدانة % من الدخل الصافي'),
  ('finance.max_years',            null, 'المدّة القصوى للقرض بالسنوات'),
  ('finance.registration_fees_pct',null, 'مصاريف التسجيل والتسجيل العقاري % من ثمن الاقتناء'),
  ('finance.insurance_pct',        null, 'تأمين القرض % سنوياً'),
  ('scoring.algo_version',    '"v1"'::jsonb, 'نسخة خوارزمية التنقيط المعتمدة'),
  ('pilot.governorate',       '"SFX"'::jsonb, 'الولاية المفتوحة للمعالجة في المرحلة التجريبية')
on conflict (key) do nothing;
