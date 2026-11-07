-- Stage 8 live-schema repair.
--
-- The 20260926 migration documented patient_enquiries.user_id but did not add
-- the column. The live logs showed PostgreSQL 42703 (undefined_column) for
-- user_id, which prevented Stage 8 from linking the Auth identity.
--
-- This migration is intentionally additive and idempotent.

ALTER TABLE public.patient_enquiries
  ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_patient_enquiries_user_id
  ON public.patient_enquiries(user_id);

-- Stage 8 now uses the CRM-session Edge Function. Remove the obsolete
-- pg_net/Vault trigger pipeline if an older migration created it.
DROP TRIGGER IF EXISTS on_stage8_handover_prepared ON public.patient_enquiries;
DROP FUNCTION IF EXISTS public.trigger_create_patient_account_on_handover();

COMMENT ON COLUMN public.patient_enquiries.user_id IS
  'Auth user UUID linked to the WaruWenJo patient account. Stage 8 uses the existing auth.users -> handle_new_user() signup pipeline.';

COMMENT ON COLUMN public.patient_enquiries.patient_profile_id IS
  'Legacy CRM patient_profiles reference. New Stage 8 accounts use public.profiles + public.patients and this column is not populated.';
