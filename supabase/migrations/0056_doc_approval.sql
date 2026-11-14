-- ============================================================
-- أنواع الوثائق ودورة اعتمادها
-- ============================================================
-- كرّاس الشروط V2، القسم 05:
--   EST-xxx تقدير آلي استرشادي · DEV-xxx عرض أعدّه مسؤول وراجعته
--   الإدارة قبل الإرسال · CTR-xxx عقد مرتبط بالعرض المقبول وبنسخته.
--   «مسودة ← قيد المراجعة ← معتمد أو مرفوض مع سبب ← مرسل ← مقبول /
--   تعديل مطلوب / منتهي».
-- والقسم 08: «يمنع إرسال عرض غير معتمد حتى باستدعاء API مباشرة»،
-- و«القرار مربوط برقم النسخة أو hash؛ أي تعديل جوهري يلغي صلاحيته».
--
-- ما كان قبل هذا: نوع واحد اسمه devis، وأربع حالات draft | sent |
-- accepted | obsolete. لا «قيد المراجعة» ولا «معتمد» ولا «مرفوض بسبب».
-- فشرط «لا يُرسَل غير المعتمد» لم يكن قابلاً للتطبيق أصلاً: ما ثمّ
-- حالة تميّز المعتمد من غيره.

-- ---------- نوع الوثيقة ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'doc_kind') then
    create type doc_kind as enum ('est', 'dev', 'ctr', 'avenant');
  end if;
end $$;

-- ---------- الحالات الناقصة ----------
-- تُزاد ولا تُستعمل في نفس الملفّ: Postgres يمنع استعمال قيمة enum
-- جديدة داخل المعاملة التي أنشأتها.
alter type devis_status add value if not exists 'in_review'         after 'draft';
alter type devis_status add value if not exists 'approved'          after 'in_review';
alter type devis_status add value if not exists 'rejected'          after 'approved';
alter type devis_status add value if not exists 'changes_requested' after 'accepted';
alter type devis_status add value if not exists 'expired'           after 'changes_requested';

-- ---------- أعمدة الوثيقة ----------
alter table devis
  -- الأسطر الموجودة مولَّدة آلياً من الكاتالوج: هي تقديرات لا عروضاً
  add column if not exists kind doc_kind not null default 'est',
  -- بصمة المحتوى: الأسطر والمجموع والشروط. تتبدّل بأيّ تعديل جوهري.
  add column if not exists content_hash text,
  -- البصمة ساعة الاعتماد. اختلافها عن content_hash يعني أنّ المعتمَد
  -- ليس ما في اليد الآن — فيسقط الاعتماد بلا تدخّل أحد.
  add column if not exists approved_hash text,
  add column if not exists approved_by uuid references staff (user_id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists sent_at timestamptz,
  -- قرار الحريف: قبول أو طلب تعديل
  add column if not exists decided_at timestamptz,
  -- سبب الرفض أو نصّ طلب التعديل — «مرفوض مع سبب» لا مرفوض وحسب
  add column if not exists review_note text,
  -- العقد يشير إلى العرض المقبول، والavenant إلى عقده
  add column if not exists parent_id uuid references devis (id) on delete set null,
  -- «لكل وثيقة بنود وضرائب ومشمولات واستثناءات ومدة صلاحية وشروط دفعات»
  add column if not exists tax_rate_pct numeric(5, 2),
  add column if not exists inclusions text,
  add column if not exists exclusions text,
  add column if not exists payment_terms text;

comment on column devis.kind is 'est تقدير آلي · dev عرض معتمد · ctr عقد · avenant أشغال إضافية';
comment on column devis.approved_hash is
  'بصمة المحتوى ساعة الاعتماد. إن خالفت content_hash سقط الاعتماد: المعتمَد ليس ما في اليد.';

create index if not exists devis_kind_status_idx on devis (kind, status, created_at desc);
create index if not exists devis_parent_idx on devis (parent_id);

-- ---------- مرجع لكلّ نوع ----------
-- EST-2026-000001 · DEV-… · CTR-… · AVN-…
create sequence if not exists doc_ref_seq;

create or replace function next_doc_ref(k doc_kind) returns text
language sql volatile as $$
  select case k
           when 'est' then 'EST'
           when 'dev' then 'DEV'
           when 'ctr' then 'CTR'
           else 'AVN'
         end || '-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('doc_ref_seq')::text, 6, '0');
$$;

-- الافتراضي على العمود لا يرى بقيّة السطر، فالمرجع يُضبط بمُشغِّل.
create or replace function set_doc_ref() returns trigger
language plpgsql as $$
begin
  if new.ref_code is null or new.ref_code = '' or new.ref_code like 'DV-%' then
    new.ref_code := next_doc_ref(new.kind);
  end if;
  return new;
end $$;

alter table devis alter column ref_code drop default;
drop trigger if exists devis_set_ref on devis;
create trigger devis_set_ref before insert on devis
  for each row execute function set_doc_ref();

-- ---------- الحارس في القاعدة لا في الشفرة ----------
-- «يمنع إرسال عرض غير معتمد حتى باستدعاء API مباشرة»: الشرط هنا يمنعه
-- ولو كُتب السطر بـSQL مباشرة. والتقدير الآلي مستثنى عمداً — الكرّاس
-- يقول عنه إنّه «لا يحتاج موافقة يدوية على كل حركة للزائر».
alter table devis drop constraint if exists devis_sent_needs_approval;
alter table devis add constraint devis_sent_needs_approval check (
  kind = 'est'
  or status::text not in ('sent', 'accepted', 'changes_requested')
  or (approved_at is not null and approved_hash is not null and approved_hash = content_hash)
);

-- نسخة أُرسلت للحريف لا تُستبدل: لها تاريخ إرسال، والتعديل ينشئ نسخة.
alter table devis drop constraint if exists devis_sent_has_date;
alter table devis add constraint devis_sent_has_date check (
  status::text <> 'sent' or sent_at is not null
);

-- ---------- إعدادات ----------
insert into app_settings (key, value, description) values
  ('devis.tax_rate_pct', '19'::jsonb,
   'نسبة الأداء على القيمة المضافة — لا تُفترض واحدة لكلّ الحالات، تضبطها الإدارة مع المحاسب'),
  ('devis.require_admin_approval', 'true'::jsonb,
   'هل يستوجب العرض اعتماد الإدارة قبل الإرسال؟ التقدير الآلي مستثنى دائماً')
on conflict (key) do nothing;
