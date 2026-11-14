-- ============================================================
-- حساب الحريف: الهويّة التي يعلّق عليها كلّ ناتج شخصي
-- ============================================================
-- كرّاس الشروط V2، القسم 02: «إنشاء أي devis شخصي أو إرساله أو تحميله،
-- وأي طلب خدمة أو مساندة أو مساهمة، يستوجب حساباً بالاسم ورقم تليفون
-- متثبت منه». والقسم 09: «روابط متابعة code+phone تستبدل بتسجيل آمن
-- دون كشف ملفات».
--
-- ما كان قبل هذا: الرمز المرجعي + الهاتف يمرّان في رابط GET، ومن يعرف
-- الاثنين يفتح الملفّ. لا حساب، ولا تحقّق من أنّ الرقم رقم صاحبه.
--
-- المصادقة هنا ليست Supabase Auth: ذاك يبعث رموزه عبر مزوّديه، ونحن
-- على WinSMS. فالرمز يُولَّد ويُرسل ويُتحقَّق منه في الخادم، والجلسة
-- كوكي httpOnly موقّع — نفس نمط lib/owner-session.ts المجرَّب، بمجال
-- توقيع مختلف. حسابات الفريق تبقى على Supabase Auth كما هي.

-- ---------- الحساب ----------
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  -- E.164 بلا علامة زائد: 21698120630. فريد — «منع تكرار الحساب حسب الرقم»
  phone         text not null unique,
  full_name     text not null,
  email         text,
  -- blocked: يمنع الدخول ولا يمحو الملفّات
  status        text not null default 'active' check (status in ('active', 'blocked')),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz,
  is_demo       boolean not null default false
);

comment on table app_users is
  'حساب الحريف — الاسم ورقم هاتف متثبَّت منه. لا كلمة سرّ: الدخول برمز يُرسل للهاتف.';
comment on column app_users.phone is
  'E.164 بلا +، مثال 21698120630. التونسي ثمانية أعداد يُسبَق بـ216.';

create index if not exists app_users_created_idx on app_users (created_at desc);

-- ---------- رموز التحقّق ----------
-- لا يُخزَّن الرمز أبداً، بل بصمته: من يقرأ الجدول لا ينتحل صاحبه.
create table if not exists phone_verifications (
  id            bigserial primary key,
  phone         text not null,
  purpose       text not null check (purpose in ('signup', 'login', 'phone_change')),
  code_hash     text not null,
  attempts      smallint not null default 0,
  sent_at       timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  -- phone_change: الحساب الذي يطلب التبديل. وإلّا فارغ قبل وجود الحساب.
  user_id       uuid references app_users (id) on delete cascade
);

comment on table phone_verifications is
  'رموز التحقّق — البصمة لا الرمز. تُحذف المنتهية دورياً، ولا تُقرأ إلّا من الخادم.';

create index if not exists phone_verifications_lookup_idx
  on phone_verifications (phone, purpose, sent_at desc);

-- ---------- الموافقات ----------
-- القسم 02: «موافقة شروط الحساب ومعالجة البيانات اللازمة للخدمة منفصلة
-- عن موافقة التسويق الاختيارية… لا يُشترط قبول التسويق لاستعمال الخدمة».
-- سطر لكلّ حدث لا خانة تُبدَّل: «وافق ثمّ سحب» تاريخ لا حالة.
create table if not exists user_consents (
  id              bigserial primary key,
  user_id         uuid not null references app_users (id) on delete cascade,
  kind            text not null check (kind in ('service', 'marketing')),
  granted         boolean not null,
  policy_version  text not null default '1',
  decided_at      timestamptz not null default now()
);

comment on table user_consents is
  'سجلّ الموافقات: الخدمة منفصلة عن التسويق، وكلّ تبديل سطر جديد لا تعديل سطر قديم.';

create index if not exists user_consents_user_idx on user_consents (user_id, kind, decided_at desc);

-- ---------- ربط ما هو قائم ----------
-- القسم 09: «الطلبات القديمة دون حساب لا تضيع ولا تصبح ملكاً لمن يعرف
-- رقمها. ربطها بحساب بعد تحقق الرقم». الخانة فارغة حتّى يُطالب بها صاحبها.
alter table housing_requests add column if not exists user_id uuid references app_users (id) on delete set null;
alter table properties       add column if not exists user_id uuid references app_users (id) on delete set null;
alter table support_intake   add column if not exists user_id uuid references app_users (id) on delete set null;

create index if not exists housing_requests_user_idx on housing_requests (user_id);
create index if not exists properties_user_idx       on properties (user_id);
create index if not exists support_intake_user_idx   on support_intake (user_id);

comment on column housing_requests.user_id is
  'صاحب الملفّ بعد أن يُثبت رقمه. فارغ = ملفّ قديم لم يُطالَب به بعد.';

-- ---------- RLS ----------
-- لا سياسة قراءة لأحد: هذه الجداول لا تُقرأ إلّا بالمفتاح السرّي في
-- الخادم. والحساب يرى ملفّه عبر الخادم بعد التحقّق من جلسته، لا بـRLS.
alter table app_users           enable row level security;
alter table phone_verifications enable row level security;
alter table user_consents       enable row level security;

revoke all on app_users, phone_verifications, user_consents from anon;
revoke all on app_users, phone_verifications, user_consents from authenticated;

-- ---------- إعدادات قابلة للتبديل من اللوحة ----------
insert into app_settings (key, value, description) values
  ('account.otp_ttl_seconds', '300'::jsonb,
   'مدّة صلاحية رمز التحقّق بالثواني — بعدها يُطلب رمز جديد'),
  ('account.otp_max_attempts', '5'::jsonb,
   'عدد محاولات إدخال الرمز قبل إبطاله'),
  ('account.otp_resend_cooldown_seconds', '60'::jsonb,
   'أقلّ فاصل بين رمزين لنفس الرقم — يمنع استنزاف الرصيد بالضغط المتكرّر'),
  ('account.otp_max_per_day', '8'::jsonb,
   'سقف الرموز لنفس الرقم في اليوم — كلّ رمز رسالة مدفوعة'),
  ('account.session_days', '30'::jsonb,
   'مدّة بقاء جلسة الحريف بالأيّام')
on conflict (key) do nothing;
