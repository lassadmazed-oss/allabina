-- ============================================================
-- 0048_request_photos.sql · صور تقدّم الأشغال في ملفّ المطلب
-- ============================================================
-- الملفّ يتبع الحريف من المكالمة إلى المفتاح، والفريق يحتاج يرى الحضيرة
-- تتقدّم دون أن يتنقّل: صور مرتّبة بمراحل البناء، بتاريخ اللقطة.
--
--   · مخزن خاصّ: دار الحريف ليست صفحة عمومية. العرض برابط موقَّع قصير
--     العمر يولّده الخادم لعضو فريق مصادَق عليه.
--   · show_to_client: الفريق يقرّر أيّ صورة تصلح لصاحب المطلب — مغلق افتراضياً.
--   · تُحذف مع مطلبها.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-photos', 'request-photos', false,
  8388608,                                              -- 8 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,                       -- لا يُفتح سهواً
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists request_photos (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references housing_requests(id) on delete cascade,
  storage_path   text not null unique,                  -- داخل المخزن request-photos
  stage          text not null check (stage in ('site', 'foundations', 'structure', 'roof', 'masonry', 'finishing', 'handover')),
  caption        text check (caption is null or char_length(caption) <= 300),
  taken_at       date,                                  -- تاريخ اللقطة لا تاريخ الرفع
  show_to_client boolean not null default false,
  sort_order     int not null default 0,
  mime           text,
  bytes          int,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists request_photos_request_idx
  on request_photos (request_id, stage, taken_at, created_at);

comment on table request_photos is
  'صور تقدّم أشغال المطلب بمراحل البناء — مخزن خاصّ، روابط موقَّعة للفريق فقط';

alter table request_photos enable row level security;

drop policy if exists request_photos_staff_read on request_photos;
create policy request_photos_staff_read on request_photos
  for select to authenticated using (is_staff());

notify pgrst, 'reload schema';
