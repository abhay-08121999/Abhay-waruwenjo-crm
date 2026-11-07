-- Columns the MOU builder writes to public.agreements
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS document_content TEXT;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS pdf_path TEXT;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS partner_category TEXT;

-- Private bucket for MOU PDFs (15 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('agreements', 'agreements', false, 15728640)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

-- Storage policies for logged-in CRM users
DROP POLICY IF EXISTS "agreements_insert_authenticated" ON storage.objects;
CREATE POLICY "agreements_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agreements');

DROP POLICY IF EXISTS "agreements_select_authenticated" ON storage.objects;
CREATE POLICY "agreements_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agreements');

-- needed because the app uploads with upsert: true
DROP POLICY IF EXISTS "agreements_update_authenticated" ON storage.objects;
CREATE POLICY "agreements_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'agreements')
  WITH CHECK (bucket_id = 'agreements');

DROP POLICY IF EXISTS "agreements_delete_authenticated" ON storage.objects;
CREATE POLICY "agreements_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'agreements');