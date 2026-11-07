-- Repair migration for environments where patient_enquiry_documents was never
-- applied. This is separate from Stage 8 account creation.

CREATE TABLE IF NOT EXISTS public.patient_enquiry_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.patient_enquiries(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  verification_result TEXT CHECK (verification_result IN ('Genuine', 'Suspicious', 'Fake/Invalid')),
  verification_confidence INTEGER CHECK (verification_confidence >= 0 AND verification_confidence <= 100),
  verification_reasons TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_enquiry_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can submit enquiry documents" ON public.patient_enquiry_documents;
CREATE POLICY "Public can submit enquiry documents"
  ON public.patient_enquiry_documents
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage enquiry documents" ON public.patient_enquiry_documents;
CREATE POLICY "Admins can manage enquiry documents"
  ON public.patient_enquiry_documents
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_patient_enquiry_documents_lead_id
  ON public.patient_enquiry_documents(lead_id);
