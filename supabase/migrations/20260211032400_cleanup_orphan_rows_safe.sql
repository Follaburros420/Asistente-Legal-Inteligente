-- Safe orphan cleanup for monolith-facing tables.
-- Idempotent by design; can be executed repeatedly.

delete from public.chat_files cf
where not exists (select 1 from public.chats c where c.id = cf.chat_id)
   or not exists (select 1 from public.files f where f.id = cf.file_id);

delete from public.message_file_items mfi
where not exists (select 1 from public.messages m where m.id = mfi.message_id)
   or not exists (select 1 from public.file_items fi where fi.id = mfi.file_item_id);

delete from public.process_document_sections s
where not exists (select 1 from public.process_documents d where d.id = s.document_id)
   or not exists (select 1 from public.processes p where p.id = s.process_id);

delete from public.process_documents d
where not exists (select 1 from public.processes p where p.id = d.process_id);

delete from public.process_ingestion_jobs j
where not exists (select 1 from public.process_documents d where d.id = j.document_id)
   or not exists (select 1 from public.processes p where p.id = j.process_id);
