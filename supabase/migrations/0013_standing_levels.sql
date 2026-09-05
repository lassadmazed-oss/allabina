-- ============================================================
-- 0013_standing_levels.sql · مستويات التشطيب B01–B05 وتوزيعها على الـLots
-- ============================================================
-- المشكلة التي تحلّها هذه الهجرة: مستوى التشطيب كان نوعاً مُعدّداً
-- (enum: standard · mid · premium). إضافة مستوى جديد كانت تستوجب
-- هجرة قاعدة بيانات، أي تدخّل مطوّر. صار المستوى سطراً في جدول:
-- الإدارة تزيد Standing وتضبط سعره وتوزيعه على الـLots من الـBack-office.
--
-- الشبكة المرجعية (د.ت/م² HT):
--   B01  1 200  ·  B02  1 400  ·  B03  1 600  ·  B04  1 800  ·  B05  2 000
-- B03 هو الفرضية المرجعية لدراسة الجدوى (build.reference_price_ht).
--
-- ملاحظة: النوع standing_tier يبقى موجوداً بلا استعمال، لأنّ الهجرات
-- السابقة تذكره داخل create table if not exists؛ حذفه يكسر إعادة التطبيق.
-- ============================================================

-- ---------- مستويات التشطيب ----------
create table if not exists standing_levels (
  code            text primary key,          -- B01 … أو أيّ رمز تختاره الإدارة
  name_ar         text not null,
  name_fr         text,
  description_ar  text,
  description_fr  text,
  price_ht_m2     numeric(10,2) not null,    -- السعر المرجعي د.ت/م² HT
  price_min_ht    numeric(10,2),
  price_max_ht    numeric(10,2),
  sort_order      int  not null default 0,
  is_active       boolean not null default true,
  updated_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists standing_levels_touch on standing_levels;
create trigger standing_levels_touch before update on standing_levels
  for each row execute function touch_updated_at();

insert into standing_levels
  (code, name_ar, name_fr, description_ar, description_fr,
   price_ht_m2, price_min_ht, price_max_ht, sort_order)
values
  ('B01', 'اقتصادي', 'Économique',
   'بناء سليم بمواد عادية وتشطيب بسيط. الأولوية للهيكل والسكن قبل الزينة.',
   'Construction saine, matériaux courants, finition simple.',
   1200, 1150, 1300, 1),
  ('B02', 'عادي', 'Standard',
   'نفس الهيكل مع تشطيب أحسن: فرش أرقى، ألمنيوم أمتن، ودهن أنظف.',
   'Même structure, finitions supérieures : revêtements, aluminium, peinture.',
   1400, 1350, 1500, 2),
  ('B03', 'محسّن', 'Confort',
   'مستوى مرجعي: مطبخ مركّب، سقف مستعار، وتكييف مُهيّأ.',
   'Niveau de référence : cuisine équipée, faux plafond, climatisation préparée.',
   1600, 1550, 1700, 3),
  ('B04', 'راقٍ', 'Supérieur',
   'مواد وتجهيزات أرقى في كامل التشطيب، وواجهة مدروسة.',
   'Matériaux et équipements haut de gamme, façade soignée.',
   1800, 1750, 1900, 4),
  ('B05', 'Haut Standing', 'Haut standing',
   'أعلى مستوى: تجهيزات فاخرة، تكييف كامل، وتهيئة خارجية متكاملة.',
   'Prestations haut de gamme, climatisation complète, aménagement extérieur.',
   2000, 1950, 2200, 5)
on conflict (code) do nothing;

-- ---------- من النوع المُعدّد إلى نصّ مرتبط بالجدول ----------
-- المستويات الثلاثة القديمة تُسقَط على الشبكة الجديدة:
-- عادي → B01 · متوسّط ومحسّن → B03 · Haut Standing → B05
do $$
declare
  r record;
begin
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and udt_name = 'standing_tier'
  loop
    execute format(
      'alter table %I alter column %I type text using %I::text',
      r.table_name, r.column_name, r.column_name
    );
  end loop;
end $$;

-- price_references: إن بقي سطر قديم وبديله الجديد موجود، القديم يُحذف —
-- وإلّا اصطدم مفتاحه الفريد بالجديد عند التحويل.
delete from price_references p
where p.tier in ('standard', 'mid', 'premium')
  and exists (
    select 1 from price_references q
    where q.gov_code = p.gov_code
      and q.product  = p.product
      and q.zone is not distinct from p.zone
      and q.tier = case p.tier
                     when 'standard' then 'B01'
                     when 'mid'      then 'B03'
                     else                 'B05'
                   end
  );

do $$
declare
  t record;
  col text;
begin
  for t in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_name = c.table_name and tb.table_schema = c.table_schema
    where c.table_schema = 'public'
      and tb.table_type = 'BASE TABLE'
      and c.column_name in ('standing', 'tier')
      and c.data_type = 'text'
  loop
    col := t.column_name;
    execute format(
      'update %I set %I = case %I
         when ''standard'' then ''B01''
         when ''mid''      then ''B03''
         when ''premium''  then ''B05''
         else %I end
       where %I in (''standard'', ''mid'', ''premium'')',
      t.table_name, col, col, col, col
    );
  end loop;
end $$;

-- الربط بالجدول: مستوى مستعمل لا يُحذف (restrict)، وتغيير رمزه ينتشر (cascade)
do $$
declare
  r record;
begin
  for r in
    select unnest(array['housing_requests','articles','project_configs','devis','finish_options'])
             as tbl
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl and column_name = 'standing'
    ) then
      execute format('alter table %I drop constraint if exists %I', r.tbl, r.tbl || '_standing_fkey');
      execute format(
        'alter table %I add constraint %I foreign key (standing)
           references standing_levels(code) on update cascade on delete restrict',
        r.tbl, r.tbl || '_standing_fkey'
      );
    end if;
  end loop;
end $$;

-- ---------- توزيع السعر على الـLots ----------
-- النسبة هي المرجع، والدينار للمتر يُشتقّ منها: price_ht_m2 × share_pct / 100.
create table if not exists standing_lot_shares (
  standing_code text not null references standing_levels(code) on update cascade on delete cascade,
  lot_code      int  not null references lots(code) on delete cascade,
  share_pct     numeric(6,3) not null check (share_pct >= 0 and share_pct <= 100),
  note          text,
  updated_at    timestamptz not null default now(),
  primary key (standing_code, lot_code)
);

drop trigger if exists standing_lot_shares_touch on standing_lot_shares;
create trigger standing_lot_shares_touch before update on standing_lot_shares
  for each row execute function touch_updated_at();

-- البذرة موضوعة بالدينار للمتر المربّع لكلّ Lot — أوضح للمراجعة —
-- والنسبة تُحسب منها، فيكون المجموع 100% بالبناء لا بالمصادفة.
with seed(standing_code, lot_code, amount_m2) as (
  values
    ('B01', 1,  24), ('B01', 2,  24), ('B01', 3,  84), ('B01', 4, 240), ('B01', 5, 132),
    ('B01', 6,  84), ('B01', 7,  36), ('B01', 8,  60), ('B01', 9,  60), ('B01', 10, 96),
    ('B01', 11, 72), ('B01', 12, 48), ('B01', 13, 36), ('B01', 14, 48), ('B01', 15, 30),
    ('B01', 16,  6), ('B01', 17,  0), ('B01', 18, 36), ('B01', 19, 48), ('B01', 20, 36),

    ('B02', 1,  26), ('B02', 2,  25), ('B02', 3,  90), ('B02', 4, 248), ('B02', 5, 140),
    ('B02', 6,  95), ('B02', 7,  42), ('B02', 8,  68), ('B02', 9,  70), ('B02', 10, 130),
    ('B02', 11, 86), ('B02', 12, 58), ('B02', 13, 42), ('B02', 14, 56), ('B02', 15, 56),
    ('B02', 16, 16), ('B02', 17, 12), ('B02', 18, 46), ('B02', 19, 56), ('B02', 20, 38),

    ('B03', 1,  28), ('B03', 2,  26), ('B03', 3,  92), ('B03', 4, 256), ('B03', 5, 140),
    ('B03', 6, 100), ('B03', 7,  48), ('B03', 8,  78), ('B03', 9,  82), ('B03', 10, 160),
    ('B03', 11, 108),('B03', 12, 70), ('B03', 13, 48), ('B03', 14, 66), ('B03', 15, 76),
    ('B03', 16, 28), ('B03', 17, 30), ('B03', 18, 58), ('B03', 19, 66), ('B03', 20, 40),

    ('B04', 1,  32), ('B04', 2,  28), ('B04', 3,  96), ('B04', 4, 264), ('B04', 5, 146),
    ('B04', 6, 104), ('B04', 7,  56), ('B04', 8,  90), ('B04', 9,  96), ('B04', 10, 178),
    ('B04', 11, 120),('B04', 12, 84), ('B04', 13, 56), ('B04', 14, 78), ('B04', 15, 86),
    ('B04', 16, 42), ('B04', 17, 52), ('B04', 18, 72), ('B04', 19, 78), ('B04', 20, 42),

    ('B05', 1,  36), ('B05', 2,  30), ('B05', 3, 100), ('B05', 4, 272), ('B05', 5, 152),
    ('B05', 6, 112), ('B05', 7,  64), ('B05', 8, 104), ('B05', 9, 112), ('B05', 10, 170),
    ('B05', 11, 132),('B05', 12, 100),('B05', 13, 64), ('B05', 14, 92), ('B05', 15, 100),
    ('B05', 16, 58), ('B05', 17, 78), ('B05', 18, 88), ('B05', 19, 92), ('B05', 20, 44)
)
insert into standing_lot_shares (standing_code, lot_code, share_pct)
select s.standing_code, s.lot_code,
       round(s.amount_m2 * 100.0 / l.price_ht_m2, 3)
from seed s
join standing_levels l on l.code = s.standing_code
on conflict (standing_code, lot_code) do nothing;

-- مراقبة: مجموع النسب لكلّ مستوى — تُعرض في الـBack-office كتنبيه لا كمنع،
-- لأنّ الإدارة قد تعدّل سطراً سطراً وتحتاج حفظ عمل ناقص.
create or replace view standing_share_totals as
select l.code,
       l.name_ar,
       l.price_ht_m2,
       coalesce(sum(s.share_pct), 0)                          as total_pct,
       round(coalesce(sum(s.share_pct), 0) - 100, 3)          as drift_pct,
       count(s.lot_code)                                      as lots_count
from standing_levels l
left join standing_lot_shares s on s.standing_code = l.code
group by l.code, l.name_ar, l.price_ht_m2;

comment on view standing_share_totals is
  'انحراف مجموع النسب عن 100% لكلّ مستوى تشطيب — أداة مراجعة للإدارة';

-- ---------- RLS ----------
alter table standing_levels     enable row level security;
alter table standing_lot_shares enable row level security;

drop policy if exists standing_levels_public_read on standing_levels;
create policy standing_levels_public_read on standing_levels
  for select to anon, authenticated using (is_active = true);

drop policy if exists standing_lot_shares_public_read on standing_lot_shares;
create policy standing_lot_shares_public_read on standing_lot_shares
  for select to anon, authenticated using (true);
