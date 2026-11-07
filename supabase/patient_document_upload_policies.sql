-- ================================================================
-- PATIENT DOCUMENT UPLOAD — REQUIRED STORAGE & RLS POLICIES
--
-- Run this ONCE in the Supabase dashboard (SQL Editor) against the
-- project referenced in .env (VITE_SUPABASE_URL). It lets the PUBLIC
-- /#/upload-documents page upload files AND log them against the lead
-- WITHOUT any backend. This is required because:
--   1. The upload now goes directly from the patient's browser to
--      Supabase Storage (the deployed app is a static build that has
--      no /api/upload-patient-document endpoint).
--   2. The patient is unauthenticated, so only `anon` policies apply.
--
-- The script is idempotent — safe to run more than once.
-- ================================================================

-- 1) Make sure the Enquiry_docs bucket exists and is PUBLIC so the
--    generated secure_url (storage/v1/object/public/...) is viewable.
insert into storage.buckets (id, name, public)
values ('Enquiry_docs', 'Enquiry_docs', true)
on conflict (id) do update set public = true;

-- 2) Allow anonymous uploads into Enquiry_docs (patient upload page).
drop policy if exists "Anon can upload to Enquiry_docs" on storage.objects;
create policy "Anon can upload to Enquiry_docs"
  on storage.objects for insert to anon
  with check (bucket_id = 'Enquiry_docs');

-- 3) Allow anonymous INSERT into medical_files so the patient's file
--    shows up in the lead's "Documents Received" panel (Stage 4).
--    Only inserts with category 'Patient Submitted' are accepted.
drop policy if exists "Anon can log patient submitted documents" on public.medical_files;
create policy "Anon can log patient submitted documents"
  on public.medical_files for insert to anon
  with check (category = 'Patient Submitted');