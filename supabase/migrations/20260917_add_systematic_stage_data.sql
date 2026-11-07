-- Add a systematic stage-wise view inside workflow_state.
-- This preserves the existing flat keys for backward compatibility while
-- grouping each stage's checklist, status, and data in one predictable object.

UPDATE public.patient_enquiries
SET workflow_state = COALESCE(workflow_state, '{}'::jsonb)
  || jsonb_build_object(
    'stage_data', jsonb_build_object(
      'stage1', jsonb_build_object(
        'stage_id', 1,
        'name', 'New Lead',
        'label', 'Triage',
        'status', CASE WHEN COALESCE(workflow_state->'stage1_checklist', '[]'::jsonb) <> '[]'::jsonb THEN 'in_progress' ELSE 'not_started' END,
        'checklist', COALESCE(workflow_state->'stage1_checklist', '[]'::jsonb),
        'data', jsonb_build_object(
          'duplicate_check_done', COALESCE(workflow_state->'duplicate_check_done', 'false'::jsonb),
          'duplicate_result', COALESCE(workflow_state->'duplicate_result', '""'::jsonb),
          'lead_genuine_decision', COALESCE(workflow_state->'lead_genuine_decision', '""'::jsonb),
          'spam_reason', COALESCE(workflow_state->'spam_reason', '""'::jsonb),
          'discovery_requirements', COALESCE(workflow_state->'discovery_requirements', '""'::jsonb)
        )
      ),
      'stage2', jsonb_build_object(
        'stage_id', 2,
        'name', 'Contact Attempted',
        'label', 'Outreach',
        'status', CASE WHEN COALESCE(workflow_state->'stage2_checklist', '[]'::jsonb) <> '[]'::jsonb THEN 'in_progress' ELSE 'not_started' END,
        'checklist', COALESCE(workflow_state->'stage2_checklist', '[]'::jsonb),
        'data', jsonb_build_object(
          'contact_attempt_count', COALESCE(workflow_state->'contact_attempt_count', workflow_state->'contact_attempts', '0'::jsonb),
          'first_contact_at', COALESCE(workflow_state->'first_contact_at', '""'::jsonb),
          'last_attempt_at', COALESCE(workflow_state->'last_attempt_at', '""'::jsonb),
          'call_outcome', COALESCE(workflow_state->'call_outcome', workflow_state->'response_outcome', '""'::jsonb),
          'call_notes', COALESCE(workflow_state->'call_notes', '""'::jsonb),
          'ai_call_summary', COALESCE(workflow_state->'ai_call_summary', workflow_state->'call_summary', '""'::jsonb),
          'callback_due_at', COALESCE(workflow_state->'callback_due_at', workflow_state->'callback_date', '""'::jsonb)
        )
      ),
      'stage3', jsonb_build_object(
        'stage_id', 3,
        'name', 'Documents & Verification',
        'label', 'Documents',
        'status', CASE WHEN COALESCE(workflow_state->'stage3_checklist', '[]'::jsonb) <> '[]'::jsonb THEN 'in_progress' ELSE 'not_started' END,
        'checklist', COALESCE(workflow_state->'stage3_checklist', '[]'::jsonb),
        'data', jsonb_build_object(
          'primary_interest', COALESCE(workflow_state->'primary_interest', '""'::jsonb),
          'document_request_sent_at', COALESCE(workflow_state->'document_request_sent_at', '""'::jsonb),
          'document_verification_complete', COALESCE(workflow_state->'document_verification_complete', 'false'::jsonb),
          'document_request_whatsapp_message', COALESCE(workflow_state->'document_request_whatsapp_message', '""'::jsonb),
          'documents_received_count', COALESCE(workflow_state->'documents_received_count', '0'::jsonb),
          'document_verification_results', COALESCE(workflow_state->'document_verification_results', '[]'::jsonb),
          'assigned_doctor_name', COALESCE(workflow_state->'assigned_doctor_name', '""'::jsonb),
          'doctor_inbox_status', COALESCE(workflow_state->'doctor_inbox_status', '""'::jsonb),
          'doctor_assigned_at', COALESCE(workflow_state->'doctor_assigned_at', 'null'::jsonb)
        )
      ),
      'stage4', jsonb_build_object(
        'stage_id', 4, 'name', 'In-House Doctor Interaction', 'label', 'Doctor Inbox',
        'status', CASE WHEN COALESCE(workflow_state->'stage4_checklist', '[]'::jsonb) <> '[]'::jsonb THEN 'in_progress' ELSE 'not_started' END,
        'checklist', jsonb_build_array('Record Doctor Call Notes', 'Send Personal Email to Patient', 'Complete In-House Doctor Interaction'),
        'data', jsonb_build_object(
          'assigned_doctor_name', COALESCE(workflow_state->'assigned_doctor_name', '""'::jsonb),
          'doctor_inbox_status', COALESCE(workflow_state->'doctor_inbox_status', '""'::jsonb),
          'doctor_call_notes', COALESCE(workflow_state->'doctor_call_notes', '""'::jsonb),
          'doctor_call_at', COALESCE(workflow_state->'doctor_call_at', 'null'::jsonb),
          'personal_email_sent_at', COALESCE(workflow_state->'personal_email_sent_at', 'null'::jsonb),
          'initial_doctor_assessment', COALESCE(workflow_state->'initial_doctor_assessment', '""'::jsonb),
          'doctor_next_steps', COALESCE(workflow_state->'doctor_next_steps', '""'::jsonb)
        )
      ),
      'stage5', jsonb_build_object(
        'stage_id', 5, 'name', 'Clinical Qualification & Planning', 'label', 'Clinical',
        'status', CASE WHEN COALESCE(workflow_state->'stage5_checklist', '[]'::jsonb) <> '[]'::jsonb THEN 'in_progress' ELSE 'not_started' END,
        'checklist', jsonb_build_array('Suggest Hospitals', 'Suggest Surgeons/Specialists', 'Personal Email send by Inhouse doctor to patient', 'Finalize Clinical Recommendation', 'Confirm Clinical Review', 'Generate Clinical Report'),
        'data', jsonb_build_object('assigned_doctor_name', COALESCE(workflow_state->'assigned_doctor_name', '""'::jsonb), 'suggested_hospital', COALESCE(workflow_state->'suggested_hospital', '""'::jsonb), 'suggested_hospitals', COALESCE(workflow_state->'suggested_hospitals', '[]'::jsonb), 'suggested_surgeon', COALESCE(workflow_state->'suggested_surgeon', '""'::jsonb), 'suggested_procedures', COALESCE(workflow_state->'suggested_procedures', '""'::jsonb), 'illness_history', COALESCE(workflow_state->'illness_history', '""'::jsonb), 'clinical_summary', COALESCE(workflow_state->'clinical_summary', '""'::jsonb), 'clinical_doctor_email_sent_at', COALESCE(workflow_state->'clinical_doctor_email_sent_at', 'null'::jsonb), 'clinical_recommendation_finalized', COALESCE(workflow_state->'clinical_recommendation_finalized', 'false'::jsonb), 'clinical_review_confirmed', COALESCE(workflow_state->'clinical_review_confirmed', 'false'::jsonb), 'clinical_review_confirmed_at', COALESCE(workflow_state->'clinical_review_confirmed_at', 'null'::jsonb), 'clinical_review_confirmed_by', COALESCE(workflow_state->'clinical_review_confirmed_by', '""'::jsonb), 'clinical_decision', COALESCE(workflow_state->'clinical_decision', '""'::jsonb))
      ),
      'stage6', jsonb_build_object(
        'stage_id', 6, 'name', 'Financial & Logistics Proposal', 'label', 'BDM Pipeline',
        'status', CASE WHEN COALESCE(workflow_state->'stage6_checklist', '[]'::jsonb) <> '[]'::jsonb THEN 'in_progress' ELSE 'not_started' END,
        'checklist', jsonb_build_array('Generate Financial Proposal', 'Discuss Travel & Accommodation', 'Address Patient Concerns', 'Generate Proposal PDF', 'Send Proposal Via Mail', 'Confirm Patient Interest Via Call'),
        'data', jsonb_build_object('patient_interest', COALESCE(workflow_state->'patient_interest', '""'::jsonb), 'patient_interest_reason', COALESCE(workflow_state->'patient_interest_reason', '""'::jsonb), 'quotation_details', COALESCE(workflow_state->'quotation_details', '""'::jsonb), 'quotation_items', COALESCE(workflow_state->'quotation_items', '[]'::jsonb), 'travel_accommodation', COALESCE(workflow_state->'travel_accommodation', '""'::jsonb), 'patient_concerns', COALESCE(workflow_state->'patient_concerns', '""'::jsonb), 'financial_proposal_pdf', COALESCE(workflow_state->'financial_proposal_pdf', '""'::jsonb), 'proposal_sent_at', COALESCE(workflow_state->'proposal_sent_at', 'null'::jsonb), 'specialist_consultation_booked', COALESCE(workflow_state->'specialist_consultation_booked', 'false'::jsonb), 'estimated_cost_min', COALESCE(workflow_state->'estimated_cost_min', 'null'::jsonb), 'estimated_cost_max', COALESCE(workflow_state->'estimated_cost_max', 'null'::jsonb), 'estimated_cost_currency', COALESCE(workflow_state->'estimated_cost_currency', '""'::jsonb), 'estimated_cost_notes', COALESCE(workflow_state->'estimated_cost_notes', '""'::jsonb))
      ),
      'stage7', jsonb_build_object(
        'stage_id', 7, 'name', 'Appointment Scheduled', 'label', 'Video Call',
        'status', CASE WHEN COALESCE(workflow_state->'stage7_checklist', '[]'::jsonb) <> '[]'::jsonb THEN 'in_progress' ELSE 'not_started' END,
        'checklist', COALESCE(workflow_state->'stage7_checklist', '[]'::jsonb), 'data', jsonb_build_object('scheduled_timing', COALESCE(workflow_state->'scheduled_timing', '""'::jsonb), 'meeting_link', COALESCE(workflow_state->'meeting_link', '""'::jsonb))
      ),
      'stage8', jsonb_build_object('stage_id', 8, 'name', 'Converted', 'label', 'Won', 'status', CASE WHEN COALESCE(workflow_state->'stage8_checklist', '[]'::jsonb) <> '[]'::jsonb THEN 'in_progress' ELSE 'not_started' END, 'checklist', COALESCE(workflow_state->'stage8_checklist', '[]'::jsonb), 'data', jsonb_build_object('payment_link_generated', COALESCE(workflow_state->'payment_link_generated', 'false'::jsonb), 'payment_reference', COALESCE(workflow_state->'payment_reference', '""'::jsonb))),
      'stage9', jsonb_build_object('stage_id', 9, 'name', 'Lost / Dropped', 'label', 'Archived', 'status', CASE WHEN COALESCE(workflow_state->'stage9_checklist', '[]'::jsonb) <> '[]'::jsonb THEN 'in_progress' ELSE 'not_started' END, 'checklist', COALESCE(workflow_state->'stage9_checklist', '[]'::jsonb), 'data', jsonb_build_object('dropoff_reason', COALESCE(workflow_state->'dropoff_reason', '""'::jsonb)))
    )
  );

COMMENT ON COLUMN public.patient_enquiries.workflow_state IS
  'Flat compatibility fields plus systematic stage_data.stage1 through stage9 objects. Callback scheduling remains functional; only its checklist checkbox is hidden.';
