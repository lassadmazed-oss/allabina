-- ============================================================
-- 0019_case_photos.sql · صور الحالات المنجزة وتقدّمها
-- ============================================================
-- كان عند الحالة رابطان نصّيان: photo_before و photo_after، يُلصقان يدوياً.
-- هذا لا يحكي قصّة: الحالة المنجزة تُقرأ من صورة الأساسات إلى صورة
-- المفتاح. فصار لكلّ حالة ألبوم مرتّب على ثلاث مراحل — قبل · أثناء ·
-- بعد — والصور تُرفع من الـBack-office إلى Supabase Storage.
--
-- القواعد:
--   · الصورة تتبع حالتها: تُحذف معها، ولا تُعرض إلّا إذا نُشرت الحالة
--     (والنشر محروس بموافقة صاحبها منذ 0009).
--   · الرفع من الخادم وحده بمفتاحه السرّي. لا يرفع زائر ولا مواطن شيئاً
--     مباشرةً إلى المخزن.
--   · لا وجوه ولا أسماء ولا لوحات أرقام في الصور — قاعدة تحريرية مكتوبة
--     في شاشة الرفع، لأنّ الحالة مجهّلة الهوية والصورة تفضح ما يخفيه النصّ.
-- ============================================================

-- ---------- المخزن ----------
-- عمومي للقراءة: ما يُنشر هنا يُنشر أصلاً في صفحة عمومية. الكتابة بمفتاح
-- الخادم فقط — لا سياسة إدراج لـ anon ولا لـ authenticated.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-photos', 'case-photos', true,
  8388608,                                              -- 8 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- الألبوم ----------
create table if not exists case_photos (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references case_studies(id) on delete cascade,
  storage_path  text not null unique,                   -- داخل المخزن case-photos
  stage         text not null check (stage in ('before', 'progress', 'after')),
  caption_ar    text,
  caption_fr    text,
  taken_at      date,                                   -- تاريخ اللقطة لا تاريخ الرفع
  sort_order    int  not null default 0,
  mime          text,
  bytes         int,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

create index if not exists case_photos_case_idx
  on case_photos (case_id, stage, sort_order, taken_at);

comment on table case_photos is
  'ألبوم الحالة المنجزة: قبل · أثناء · بعد. الرابط العمومي يُشتقّ من storage_path ولا يُخزَّن.';

-- ---------- RLS ----------
alter table case_photos enable row level security;

-- العموم يقرأ صور الحالات المنشورة فقط
drop policy if exists case_photos_public_read on case_photos;
create policy case_photos_public_read on case_photos
  for select to anon, authenticated
  using (exists (
    select 1 from case_studies c
    where c.id = case_photos.case_id and c.published
  ));

drop policy if exists case_photos_staff_read on case_photos;
create policy case_photos_staff_read on case_photos
  for select to authenticated using (is_staff());
