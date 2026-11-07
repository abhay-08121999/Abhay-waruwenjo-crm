-- Stage 8 now reuses the WaruWenJo patient-account architecture.
--
-- The CRM calls create-patient-account with the authenticated CRM session.
-- That Edge Function creates an Auth user with role='user'.
-- The existing on_auth_user_created -> handle_new_user() trigger then creates:
--   public.profiles
--   public.patients
--   public.user_roles
--
-- The old Stage 8 pg_net trigger is removed because it created a second,
-- independent patient-profile pipeline and required a Vault shared secret.

DROP TRIGGER IF EXISTS on_stage8_handover_prepared ON public.patient_enquiries;
DROP FUNCTION IF EXISTS public.trigger_create_patient_account_on_handover();

-- The CRM stores the Auth UUID here after the website signup trigger has
-- created the standard patient account. This column was missing from the
-- original version of this migration and caused PostgreSQL 42703 errors.
ALTER TABLE public.patient_enquiries
  ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_patient_enquiries_user_id
  ON public.patient_enquiries(user_id);

COMMENT ON COLUMN public.patient_enquiries.user_id IS
  'Auth user linked to the WaruWenJo patient account. Stage 8 provisioning uses the existing on_auth_user_created trigger.';

COMMENT ON COLUMN public.patient_enquiries.patient_profile_id IS
  'Legacy CRM patient_profiles reference. New Stage 8 accounts use public.profiles + public.patients and this column is no longer populated.';
