-- ============================================================
-- 0035_voice_notes.sql · «احكِ بدل أن تكتب»
-- ============================================================
-- كلّ خانة نصّ حرّ في المنصة تفترض أنّ صاحبها يكتب: «حكيلنا على مشكلتك
-- بكلامك» · «شنوّة تحتاج بالضبط؟» · وصف العقار · نبذة المتدخّل.
--
-- والافتراض غير صحيح لجزء من الناس الذين بُنيت المنصة لهم: من كبر في
-- السنّ، ومن يقرأ ولا يكتب بيسر، ومن يجد الدارجة أسهل نطقاً منها كتابةً.
-- هؤلاء يتركون الخانة فارغة، فيصل الملفّ بلا حكايته — وهي أهمّ ما فيه.
--
-- التسجيل **يزيد ولا يعوّض**: النصّ يبقى قابلاً للبحث والفرز والتصدير،
-- والصوت يُسمَع. من يكتب يكتب، ومن يحكي يحكي.
--
-- المخزن خاصّ: صوت إنسان يحكي عن ضيق حاله ليس ملفّاً عمومياً. يُفتح
-- برابط موقّت في الـBack-office وحده.
-- ============================================================

-- ---------- المخزن ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-notes', 'voice-notes', false,
  8388608,                                        -- 8 MiB: أكبر بكثير من 3 دقائق opus
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
)
on conflict (id) do update
  set public             = false,                 -- لا يُفتح سهواً
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- الجدول ----------
-- ثلاثة مفاتيح خارجية بدل عمودَي (نوع، معرّف): هكذا يسري الحذف
-- المتتالي فعلاً، ولا يبقى تسجيل يتيم بعد محو صاحبه. والقيد يضمن
-- أنّ التسجيل يخصّ سطراً واحداً لا اثنين ولا صفراً.
create table if not exists voice_notes (
  id             uuid primary key default gen_random_uuid(),

  request_id     uuid references housing_requests(id) on delete cascade,
  property_id    uuid references properties(id)       on delete cascade,
  intervenant_id uuid references intervenants(id)     on delete cascade,

  -- أيّ خانة نصّ يقابلها هذا التسجيل: problemNote · description · bio…
  field          text not null,

  storage_path   text not null unique,
  mime           text not null,
  bytes          int  not null,
  duration_s     numeric(6,2),

  created_at     timestamptz not null default now(),

  constraint voice_notes_one_subject
    check (num_nonnulls(request_id, property_id, intervenant_id) = 1)
);

create index if not exists voice_notes_request_idx     on voice_notes (request_id)     where request_id is not null;
create index if not exists voice_notes_property_idx    on voice_notes (property_id)    where property_id is not null;
create index if not exists voice_notes_intervenant_idx on voice_notes (intervenant_id) where intervenant_id is not null;

comment on table voice_notes is
  'تسجيلات صوتية تقابل خانات النصّ الحرّ — تزيد على النصّ ولا تعوّضه';
comment on column voice_notes.field is
  'اسم الخانة التي سُجّل الصوت بدلاً منها أو معها — للعرض بجانبها في اللوحة';
comment on column voice_notes.storage_path is
  'مسار في مخزن voice-notes الخاصّ — يُفتح برابط موقّع لا برابط عمومي';

-- ---------- RLS ----------
-- الخادم يتجاوز RLS بمفتاح الخدمة؛ السياسة تحمي أيّ نفاذ من المتصفّح.
alter table voice_notes enable row level security;

drop policy if exists voice_notes_staff_read on voice_notes;
create policy voice_notes_staff_read on voice_notes
  for select to authenticated using (is_staff());
