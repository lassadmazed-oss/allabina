-- ============================================================
-- قواعد المناطق: النقل والتوفّر واليد العاملة
-- ============================================================
-- كرّاس الشروط V2، القسم 03: «المنطقة تؤثر فقط وفق قواعد معتمدة: نقل،
-- توفر، يد عاملة أو توريد. **لا نعرض تخفيضات أو توفر غير مؤكد**».
--
-- الشطر الثاني هو الذي صاغ هذا الجدول: القاعدة لا تُطبَّق حتّى تُعتمد
-- ويحلّ تاريخ نفاذها. فلا يظهر للحريف سعرُ منطقة خمّنه أحد، ولا توفّرٌ
-- «غالباً موجود».
--
-- والوحدة الجغرافية هي المعتمدية لا الحيّ: النقل في تونس يُحسب بها،
-- و`zones` أحياءٌ داخل المدينة تخدم استمارة المطلب لا تسعير النقل.

create table if not exists region_rules (
  id              bigserial primary key,
  gov_code        text not null references governorates (code) on delete cascade,
  -- فارغ = كلّ الولاية
  delegation_id   integer references delegations (id) on delete cascade,
  -- فارغ = كلّ اللوطات
  lot_id          integer references lots (id) on delete cascade,

  -- النقل زيادة لا نقصان: كلفةُ وصولٍ، لا تخفيض.
  transport_pct      numeric(5, 2) check (transport_pct is null or transport_pct >= 0),
  transport_per_unit numeric(10, 3) check (transport_per_unit is null or transport_per_unit >= 0),

  -- معامل على جزء اليد العاملة وحده. دون الواحد ممكن (منطقة أقرب
  -- ويدٌ أرخص) لكن بقرار معتمد لا بتقدير.
  labour_factor   numeric(5, 3) check (labour_factor is null or (labour_factor >= 0.5 and labour_factor <= 2)),

  -- يطغى على توفّر المقال في هذه المنطقة
  availability    text check (availability is null or availability in ('in_stock', 'on_order', 'on_survey')),
  lead_time_days  smallint check (lead_time_days is null or (lead_time_days >= 0 and lead_time_days <= 365)),

  -- يُعرض للحريف سبباً: «زيادة نقل إلى جبنيانة»
  reason_ar       text,
  reason_fr       text,

  -- «قواعد معتمدة»: لا تُطبَّق قاعدة قبل اعتمادها وقبل تاريخ نفاذها
  is_approved     boolean not null default false,
  effective_from  date,
  approved_by     uuid references staff (user_id) on delete set null,
  approved_at     timestamptz,

  created_at      timestamptz not null default now(),
  created_by      uuid references staff (user_id) on delete set null,

  -- قاعدة لا تفعل شيئاً ليست قاعدة
  constraint region_rules_has_effect check (
    transport_pct is not null
    or transport_per_unit is not null
    or labour_factor is not null
    or availability is not null
    or lead_time_days is not null
  )
);

create unique index if not exists region_rules_scope_idx
  on region_rules (gov_code, coalesce(delegation_id, -1), coalesce(lot_id, -1));

create index if not exists region_rules_active_idx
  on region_rules (gov_code, is_approved) where is_approved;

comment on table region_rules is
  'أثر المنطقة على السعر والتوفّر — لا يُطبَّق منها إلّا المعتمَد النافذ.';
comment on column region_rules.transport_pct is
  'نسبة نقل تُضاف. زيادة لا نقصان: النقل كلفة وصول لا تخفيض.';
comment on column region_rules.is_approved is
  'القسم 03: «لا نعرض تخفيضات أو توفر غير مؤكد». غير المعتمَد لا يُطبَّق ولا يُعرض.';

alter table region_rules enable row level security;
revoke all on region_rules from anon, authenticated;

insert into app_settings (key, value, description) values
  ('catalog.region_rules_enabled', 'false'::jsonb,
   'تطبيق قواعد المناطق على الأسعار المعروضة. مغلق حتّى تُعتمد القواعد.')
on conflict (key) do nothing;
