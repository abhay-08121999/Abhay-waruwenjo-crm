-- CRM Stage 8 patient account creation and lead linking.
-- Credentials remain in Supabase Auth. Plain-text passwords are never stored in CRM tables.

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'not_created',
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ;

ALTER TABLE public.patient_enquiries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_profile_id UUID REFERENCES public.patient_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON public.patient_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_enquiries_user_id ON public.patient_enquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_enquiries_patient_profile_id ON public.patient_enquiries(patient_profile_id);

DROP POLICY IF EXISTS "Patients view their own CRM-created profile" ON public.patient_profiles;
CREATE POLICY "Patients view their own CRM-created profile" ON public.patient_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Patients update their own CRM-created profile" ON public.patient_profiles;
CREATE POLICY "Patients update their own CRM-created profile" ON public.patient_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN public.patient_profiles.user_id IS 'Supabase Auth account linked to this CRM-created patient profile.';
COMMENT ON COLUMN public.patient_enquiries.user_id IS 'Supabase Auth account linked to the patient lead.';
COMMENT ON COLUMN public.patient_enquiries.patient_profile_id IS 'CRM-created patient profile linked to this lead.';
COMMENT ON COLUMN public.patient_profiles.account_status IS 'not_created, invited, or linked_existing.';
COMMENT ON COLUMN public.patient_profiles.invitation_sent_at IS 'Timestamp when the patient account invitation was sent.';