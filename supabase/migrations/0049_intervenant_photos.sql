-- ============================================================
-- 0049_intervenant_photos.sql · صور أعمال المتدخّلين ومنتوجات المزوّدين
-- ============================================================
-- الفريق يقرّر في مكالمة إن كان المتدخّل يصلح لحضيرة: صورة دالة صبّها
-- أو بلوك يصنعه تقول أكثر من «عشر سنين خبرة».
--
--   · kind: work (عمل أنجزه) أو product (منتوج يصنعه أو يبيعه المزوّد).
--   · مخزن خاصّ: الشبكة أداة داخلية، ودار الحريف في صورة العمل ليست
--     صفحة عمومية. العرض برابط موقَّع قصير العمر يولّده الخادم للفريق.
--   · لماذا ليس portfolio_media: تحمل رابطاً لا مساراً في المخزن، بلا ترتيب،
--     وتشترط «إنجازاً» بعنوان قبل أوّل صورة. الفريق يرفع صور الواتساب كما
--     وصلت؛ portfolio_items تبقى للإنجاز الموثّق (مساحة، تاريخ، مكان).
--   · تُحذف مع ملفّ المتدخّل.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'network-photos', 'network-photos', false,
  8388608,                                              -- 8 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,                       -- لا يُفتح سهواً
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists intervenant_photos (
  id             uuid primary key default gen_random_uuid(),
  intervenant_id uuid not null references intervenants(id) on delete cascade,
  kind           text not null default 'work' check (kind in ('work', 'product')),
  storage_path   text not null unique,                  -- داخل المخزن network-photos
  caption_ar     text check (caption_ar is null or char_length(caption_ar) <= 200),
  sort_order     int  not null default 0,               -- الأصغر هو الغلاف
  mime           text,
  bytes          int,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists intervenant_photos_idx
  on intervenant_photos (intervenant_id, sort_order, created_at);

comment on table intervenant_photos is
  'صور أعمال المتدخّلين ومنتوجات المزوّدين — مخزن network-photos خاصّ، روابط موقَّعة للفريق فقط';

alter table intervenant_photos enable row level security;

drop policy if exists intervenant_photos_staff_read on intervenant_photos;
create policy intervenant_photos_staff_read on intervenant_photos
  for select to authenticated using (is_staff());
