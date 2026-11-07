-- Stage 8: automatically create/link the patient's website account the moment
-- "Prepare Complete Patient Handover" is completed, instead of relying on a
-- CRM user to fill in and submit the Stage 8 form.
--
-- handover_prepared_at is not a real column: it lives inside the JSONB
-- workflow_state column, at workflow_state -> stage_data -> stage8 -> data
-- -> handover_prepared_at (see buildStageData() in PatientLeads.tsx).
-- This trigger watches that JSON path directly.

-- 1. pg_net lets a trigger make an async outbound HTTP call to the edge
--    function, the same one the old "Create Patient Account & Profile"
--    button used to call.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. A trigger-only shared secret, stored in Supabase Vault, NOT in this
--    migration file and NOT in git. After running this migration, set the
--    actual value once from the SQL editor:
--
--      select vault.create_secret(
--        'a-long-random-value-you-generate',
--        'stage8_trigger_secret',
--        'Shared secret the Stage 8 auto-account trigger sends to create-patient-account'
--      );
--
--    Rotate it later with vault.update_secret(...) if it's ever exposed.

-- 3. The trigger function itself.
CREATE OR REPLACE FUNCTION public.trigger_create_patient_account_on_handover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_handover_prepared_at text;
  new_handover_prepared_at text;
  medical_history_value text;
  trigger_secret text;
  function_url text;
  request_body jsonb;
BEGIN
  -- Only act on the specific JSON path changing from unset to set.
  old_handover_prepared_at := OLD.workflow_state #>> '{stage_data,stage8,data,handover_prepared_at}';
  new_handover_prepared_at := NEW.workflow_state #>> '{stage_data,stage8,data,handover_prepared_at}';

  IF new_handover_prepared_at IS NULL OR old_handover_prepared_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard: never fire twice for the same lead. patient_profile_id
  -- is a real column on patient_enquiries (added by the 20260922 migration),
  -- kept in sync by the edge function itself.
  IF NEW.patient_profile_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- The one field with a real earlier source: Stage 5's illness_history.
  -- Falls back to clinical_summary if illness_history was left empty.
  medical_history_value := COALESCE(
    NULLIF(TRIM(NEW.workflow_state #>> '{stage_data,stage5,data,illness_history}'), ''),
    NULLIF(TRIM(NEW.workflow_state #>> '{stage_data,stage5,data,clinical_summary}'), '')
  );

  SELECT decrypted_secret INTO trigger_secret
  FROM vault.decrypted_secrets
  WHERE name = 'stage8_trigger_secret'
  LIMIT 1;

  IF trigger_secret IS NULL THEN
    RAISE WARNING 'stage8_trigger_secret is not set in Vault; skipping automatic patient account creation for lead %', NEW.id;
    RETURN NEW;
  END IF;

  -- Replace the project ref below if it ever changes.
  function_url := 'https://aedzbijwbwklbbuwpzni.supabase.co/functions/v1/create-patient-account';

  request_body := jsonb_build_object(
    'lead_id', NEW.id,
    'full_name', NEW.full_name,
    'email', NEW.email,
    'phone', NEW.phone,
    'country', NEW.country,
    'treatment_interest', NEW.treatment_interest,
    'urgency', NEW.urgency,
    'medical_history', medical_history_value
  );

  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-trigger-secret', trigger_secret
    ),
    body := request_body
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_stage8_handover_prepared ON public.patient_enquiries;
CREATE TRIGGER on_stage8_handover_prepared
AFTER UPDATE OF workflow_state ON public.patient_enquiries
FOR EACH ROW
EXECUTE FUNCTION public.trigger_create_patient_account_on_handover();

COMMENT ON FUNCTION public.trigger_create_patient_account_on_handover() IS
  'Fires create-patient-account automatically the instant Stage 8 handover_prepared_at is set, replacing the manual "Create Patient Account & Profile" button.';