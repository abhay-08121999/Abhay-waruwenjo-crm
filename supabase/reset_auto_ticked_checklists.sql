-- Reset checklist ticks that were saved automatically by the old bug.
-- The old code stored EVERY task of EVERY stage as "done" on each save, so the real
-- ticks cannot be told apart from the fake ones. Resetting means staff re-tick manually.
-- Run in Supabase Dashboard > SQL Editor.

-- A) Reset ONE lead (replace the id). Recommended first, to check the result:
UPDATE public.patient_enquiries
SET workflow_state = jsonb_set(
  workflow_state,
  '{stage_data}',
  (
    SELECT jsonb_object_agg(
      key,
      value || jsonb_build_object('checklist', '[]'::jsonb, 'status', 'not_started')
    )
    FROM jsonb_each(workflow_state->'stage_data')
  )
)
WHERE id = '5e73e238-56cf-4db5-8d93-593263d56c00'
  AND jsonb_typeof(workflow_state->'stage_data') = 'object';

-- B) Reset ALL leads (uncomment to run). This clears every tick on every lead.
-- UPDATE public.patient_enquiries
-- SET workflow_state = jsonb_set(
--   workflow_state,
--   '{stage_data}',
--   (
--     SELECT jsonb_object_agg(
--       key,
--       value || jsonb_build_object('checklist', '[]'::jsonb, 'status', 'not_started')
--     )
--     FROM jsonb_each(workflow_state->'stage_data')
--   )
-- )
-- WHERE jsonb_typeof(workflow_state->'stage_data') = 'object';