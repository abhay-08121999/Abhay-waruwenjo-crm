-- Patient profile creation from the CRM lead workflow.
-- This profile is independent from Supabase Auth profiles because an enquiry
-- may not yet have a patient login account.
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.patient_enquiries(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country TEXT,
  treatment_interest TEXT,
  urgency TEXT,
  medical_history TEXT,
  source TEXT NOT NULL DEFAULT 'crm_stage_8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM staff can view patient profiles" ON public.patient_profiles;
CREATE POLICY "CRM staff can view patient profiles" ON public.patient_profiles
  FOR SELECT TO authenticated
  USING (public.crm_has_permission(auth.uid(), 'crm.read'));

DROP POLICY IF EXISTS "CRM staff can create patient profiles" ON public.patient_profiles;
CREATE POLICY "CRM staff can create patient profiles" ON public.patient_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_has_permission(auth.uid(), 'cases.write') OR public.crm_has_permission(auth.uid(), 'leads.write'));

DROP POLICY IF EXISTS "CRM staff can update patient profiles" ON public.patient_profiles;
CREATE POLICY "CRM staff can update patient profiles" ON public.patient_profiles
  FOR UPDATE TO authenticated
  USING (public.crm_has_permission(auth.uid(), 'cases.write') OR public.crm_has_permission(auth.uid(), 'leads.write'))
  WITH CHECK (public.crm_has_permission(auth.uid(), 'cases.write') OR public.crm_has_permission(auth.uid(), 'leads.write'));

CREATE OR REPLACE FUNCTION public.update_patient_profiles_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_profiles_updated_at ON public.patient_profiles;
CREATE TRIGGER patient_profiles_updated_at
BEFORE UPDATE ON public.patient_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_patient_profiles_timestamp();

COMMENT ON TABLE public.patient_profiles IS 'Patient profile created from a CRM enquiry after Stage 8 handover preparation.';
COMMENT ON COLUMN public.patient_profiles.lead_id IS 'The originating patient_enquiries record; one profile per lead.';