-- =====================================================================
-- 0038 — فهرس رمز الوثيقة يصلح لـON CONFLICT
--
-- 0037 أنشأ الفهرس جزئياً (`where doc_code is not null`). الفهرس
-- الجزئي لا يصلح مرجعاً لـON CONFLICT إلّا إذا حمل الأمر نفس الشرط،
-- وPostgREST لا يحمله — فكان الإدراج يفشل، والفشل يُسجَّل في سجلّ
-- الخادم ولا يظهر لأحد: المطلب يصل، والأوراق المصرَّح بها لا تُكتب.
--
-- الفهرس الكامل يقبل NULL متعدّدة (السطور القديمة بلا رمز)، ويصلح
-- مرجعاً. والمفتاح الخارجي يمنع رمزاً لا وجود له في الدليل.
-- =====================================================================

drop index if exists request_documents_code_idx;

create unique index if not exists request_documents_code_idx
  on request_documents (request_id, doc_code);

-- حذف سطر من الدليل يُستعمل فعلاً ممنوع: يُعطَّل بـis_active بدل ذلك
alter table request_documents
  drop constraint if exists request_documents_doc_code_fkey;
alter table request_documents
  add constraint request_documents_doc_code_fkey
  foreign key (doc_code) references request_doc_catalog(code)
  on update cascade on delete restrict;
