-- ============================================================
-- اللَّبنة للبناء والإعمار — ALLABINA
-- 0006_auth_roles.sql · مصادقة حقيقية وأدوار للوحة القيادة
-- ============================================================
-- ينقل /admin من كلمة سرّ مشتركة إلى Supabase Auth:
--   · أربعة أدوار: owner · admin · agent · viewer
--   · سجلّ تدقيق staff_events لكلّ عملية حسّاسة
--   · بنية خاملة لحسابات المواطنين (بلا واجهات في هذه المرحلة)
-- ============================================================

-- ---------- 1. توسيع جدول الفريق ----------
alter table staff add column if not exists email                text;
alter table staff add column if not exists must_change_password boolean not null default false;
alter table staff add column if not exists last_login_at        timestamptz;
alter table staff add column if not exists created_by           uuid references auth.users(id);
alter table staff add column if not exists updated_at           timestamptz not null default now();

-- الدور: إضافة «owner» إلى القيم المسموحة
alter table staff drop constraint if exists staff_role_check;
alter table staff add  constraint staff_role_check
  check (role in ('owner','admin','agent','viewer'));

create unique index if not exists staff_email_key on staff (lower(email)) where email is not null;

drop trigger if exists staff_touch on staff;
create trigger staff_touch before update on staff
  for each row execute function touch_updated_at();

-- ---------- 2. دوالّ الأدوار ----------
-- دور المستعمل الحالي، أو null إن لم يكن من الفريق النشط.
create or replace function staff_role() returns text
language sql stable security definer set search_path = public as $$
  select s.role from staff s where s.user_id = auth.uid() and s.active;
$$;

-- هل دور المستعمل الحالي ضمن القائمة؟
create or replace function has_role(variadic roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(staff_role() = any(roles), false);
$$;

-- ---------- 3. سجلّ التدقيق ----------
create table if not exists staff_events (
  id           bigserial primary key,
  actor        uuid references auth.users(id) on delete set null,
  actor_email  text,                       -- يُحفظ نصّاً حتى بعد حذف الحساب
  target       uuid references auth.users(id) on delete set null,
  target_email text,
  event_type   text not null check (event_type in (
                 'login','login_failed','login_denied','logout',
                 'member_created','role_changed','activated','deactivated',
                 'password_set','password_changed','member_removed')),
  detail       jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists staff_events_created_idx on staff_events (created_at desc);
create index if not exists staff_events_actor_idx   on staff_events (actor, created_at desc);

-- ---------- 4. RLS: إدارة الفريق ----------
alter table staff_events enable row level security;

drop policy if exists staff_events_staff_read on staff_events;
create policy staff_events_staff_read on staff_events for select to authenticated
  using (has_role('owner','admin'));

-- المالك يتصرّف في كلّ الأسطر.
drop policy if exists staff_owner_manage on staff;
create policy staff_owner_manage on staff for all to authenticated
  using (has_role('owner')) with check (has_role('owner'));

-- المدير يتصرّف في الوكلاء والمطّلعين فقط — لا يمسّ مالكاً ولا مديراً.
drop policy if exists staff_admin_manage on staff;
create policy staff_admin_manage on staff for all to authenticated
  using (has_role('admin') and role in ('agent','viewer'))
  with check (has_role('admin') and role in ('agent','viewer'));

-- ---------- 5. بنية حسابات المواطنين (مجهَّزة، غير مفعَّلة) ----------
-- لا واجهة تستعملها اليوم: تتبّع المطلب يبقى بالرمز + الهاتف في /suivi.
-- الغرض أن يُربط المطلب بحساب مواطن لاحقاً دون إعادة تصميم.
create table if not exists citizen_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  created_at timestamptz not null default now()
);

create index if not exists citizen_profiles_phone_idx on citizen_profiles (phone);

alter table citizen_profiles enable row level security;

drop policy if exists citizen_profiles_self on citizen_profiles;
create policy citizen_profiles_self on citizen_profiles for select to authenticated
  using (user_id = auth.uid() or is_staff());

alter table housing_requests add column if not exists owner_user_id uuid references auth.users(id);
create index if not exists housing_requests_owner_idx on housing_requests (owner_user_id);

-- المواطن يقرأ مطالبه هو فقط (تُضاف إلى سياسة الفريق القائمة، لا تحلّ محلّها).
drop policy if exists housing_requests_owner_read on housing_requests;
create policy housing_requests_owner_read on housing_requests for select to authenticated
  using (owner_user_id is not null and owner_user_id = auth.uid());
