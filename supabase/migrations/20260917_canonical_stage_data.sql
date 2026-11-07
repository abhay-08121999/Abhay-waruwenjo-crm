-- Canonical patient workflow storage
-- One source of truth: patient_enquiries.workflow_state.stage_data
-- Existing workflow_stage remains as a query/index field for pipeline filtering.

ALTER TABLE public.patient_enquiries
  ADD COLUMN IF NOT EXISTS workflow_stage INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS workflow_state JSONB NOT NULL DEFAULT '{"stage_data":{}}'::jsonb;

-- Wrap legacy flat workflow objects once. The application hydrator remains backward compatible
-- for records that were written before this migration.
UPDATE public.patient_enquiries
SET workflow_state = jsonb_build_object('stage_data', jsonb_build_object('legacy', workflow_state))
WHERE workflow_state IS NOT NULL
  AND jsonb_typeof(workflow_state) = 'object'
  AND NOT (workflow_state ? 'stage_data');

ALTER TABLE public.patient_enquiries
  DROP CONSTRAINT IF EXISTS patient_enquiries_workflow_state_stage_data_check;

ALTER TABLE public.patient_enquiries
  ADD CONSTRAINT patient_enquiries_workflow_state_stage_data_check
  CHECK (
    jsonb_typeof(workflow_state) = 'object'
    AND jsonb_typeof(workflow_state->'stage_data') = 'object'
  );

CREATE INDEX IF NOT EXISTS idx_patient_enquiries_workflow_stage
  ON public.patient_enquiries(workflow_stage);

COMMENT ON COLUMN public.patient_enquiries.workflow_state IS
  'Canonical workflow envelope: { stage_data: { stage1..stage9 } }. Do not store duplicate flat stage fields.';

-- Idempotent default for new enquiries. The application fills the complete stage_data object
-- before the first workflow update; this default only guarantees the envelope shape.
ALTER TABLE public.patient_enquiries
  ALTER COLUMN workflow_state SET DEFAULT '{"stage_data":{}}'::jsonb;
