export type WorkflowState = Record<string, any>;

type StageDefinition = {
  stage_id: number;
  name: string;
  label: string;
  checklist: string[];
  data: WorkflowState;
};

const stage = (stage_id: number, name: string, label: string, checklist: string[], data: WorkflowState): StageDefinition => ({
  stage_id,
  name,
  label,
  status: 'not_started',
  checklist,
  data,
} as StageDefinition);

export const createDefaultStageData = (): Record<string, StageDefinition> => ({
  stage1: stage(1, 'New Lead', 'Triage', ['Review New Lead', 'Check Duplicate Lead', 'Decide Whether Lead Is Genuine'], {
    duplicate_check_done: false, duplicate_result: '', lead_genuine_decision: '', spam_reason: '', discovery_requirements: '',
  }),
  stage2: stage(2, 'Contact Attempted', 'Outreach', ['Log First Call', 'Record Call Outcome', 'Record Call Notes', 'Schedule Callback if Required', 'Complete First Contact'], {
    contact_attempt_count: 0, contact_attempts: [], first_contact_at: null, last_attempt_at: null, call_outcome: '', response_outcome: '', call_notes: '', call_summary: '', ai_call_summary: '', callback_date: null, callback_due_at: null,
  }),
  stage3: stage(3, 'Documents & Verification', 'Documents', ['Record Primary Medical Interest', 'Explain Patient Process', 'Send Medical Document Request Email', 'Receive Medical Documents', 'Verify Medical Documents', 'Complete Document Verification'], {
    primary_interest: '', document_request_sent_at: null, document_verification_complete: false, document_request_whatsapp_message: '', documents_received_count: 0, document_verification_results: [],
  }),
  stage4: stage(4, 'Medical Records Review', 'Records', ['Request Medical Records', 'Upload & Verify Reports'], { uploaded_medical_report_pdf: '' }),
  stage5: stage(5, 'Doctor Matched', 'Clinical', ['Review by In-House Doctor', 'Suggest Hospitals', 'Suggest Surgeons', 'Generate Clinical Report'], {
    assigned_doctor_name: '', suggested_hospital: '', suggested_hospitals: [], suggested_surgeon: '', suggested_procedures: [], illness_history: '', clinical_summary: '', clinical_review_confirmed: false, clinical_review_confirmed_at: null, clinical_review_confirmed_by: '',
  }),
  stage6: stage(6, 'Follow-up Pending', 'Negotiation', ['Send Financial Proposal', 'Discuss Travel & Accommodation', 'Address Patient Concerns', 'Generate Proposal PDF', 'Confirm Patient Interest'], {
    patient_interest: '', quotation_details: '', quotation_items: [], travel_accommodation: '', financial_proposal_pdf: '', estimated_cost_min: null, estimated_cost_max: null, estimated_cost_currency: '', estimated_cost_notes: '',
  }),
  stage7: stage(7, 'Appointment Scheduled', 'Video Call', ['Schedule Video Consultation', 'Send Video Link to Patient'], { scheduled_timing: null, meeting_link: '' }),
  stage8: stage(8, 'Converted', 'Won', ['Generate Payment Link', 'Verify Advance Payment', 'Convert to Medical Case'], { payment_link_generated: '', payment_reference: '' }),
  stage9: stage(9, 'Lost / Dropped', 'Archived', ['Select Drop-off Reason', 'Archive Lead'], { dropoff_reason: '' }),
});

const dataKeys: Record<number, string[]> = {
  1: ['duplicate_check_done', 'duplicate_result', 'lead_genuine_decision', 'spam_reason', 'discovery_requirements'],
  2: ['contact_attempt_count', 'contact_attempts', 'first_contact_at', 'last_attempt_at', 'call_outcome', 'response_outcome', 'call_notes', 'call_summary', 'ai_call_summary', 'callback_date', 'callback_due_at', 'welcome_email_sent_at'],
  3: ['primary_interest', 'document_request_sent_at', 'document_verification_complete', 'document_request_whatsapp_message', 'documents_received_count', 'document_verification_results'],
  4: ['uploaded_medical_report_pdf'],
  5: ['assigned_doctor_name', 'suggested_hospital', 'suggested_hospitals', 'suggested_surgeon', 'suggested_procedures', 'illness_history', 'clinical_summary', 'clinical_review_confirmed', 'clinical_review_confirmed_at', 'clinical_review_confirmed_by'],
  6: ['patient_interest', 'quotation_details', 'quotation_items', 'travel_accommodation', 'financial_proposal_pdf', 'estimated_cost_min', 'estimated_cost_max', 'estimated_cost_currency', 'estimated_cost_notes'],
  7: ['scheduled_timing', 'meeting_link'],
  8: ['payment_link_generated', 'payment_reference'],
  9: ['dropoff_reason'],
};

export const toCanonicalWorkflowState = (input: WorkflowState | null | undefined): { stage_data: Record<string, StageDefinition> } => {
  const defaults = createDefaultStageData();
  const source = input && typeof input === 'object' ? input : {};
  const canonical = source.stage_data && typeof source.stage_data === 'object' ? source.stage_data : null;
  const legacySource = canonical?.legacy && typeof canonical.legacy === 'object' ? canonical.legacy : source;

  for (let stageId = 1; stageId <= 9; stageId += 1) {
    const key = `stage${stageId}`;
    const existing = canonical?.[key] || {};
    const legacyChecklist = legacySource[`stage${stageId}_checklist`];
    defaults[key] = {
      ...defaults[key],
      ...existing,
      status: existing.status || (legacyChecklist?.length ? 'in_progress' : 'not_started'),
      checklist: Array.isArray(existing.checklist) ? existing.checklist : (Array.isArray(legacyChecklist) ? legacyChecklist : defaults[key].checklist),
      data: {
        ...defaults[key].data,
        ...(existing.data || {}),
      },
    };
    for (const field of dataKeys[stageId]) {
      if (Object.prototype.hasOwnProperty.call(legacySource, field)) defaults[key].data[field] = legacySource[field];
    }
  }

  return { stage_data: defaults };
};

export const fromCanonicalWorkflowState = (input: WorkflowState | null | undefined): WorkflowState => {
  const canonical = input?.stage_data && typeof input.stage_data === 'object' ? input.stage_data : input || {};
  const flat: WorkflowState = {};
  for (let stageId = 1; stageId <= 9; stageId += 1) {
    const stageValue = canonical[`stage${stageId}`] || {};
    flat[`stage${stageId}_checklist`] = Array.isArray(stageValue.checklist) ? stageValue.checklist : [];
    Object.assign(flat, stageValue.data || {});
  }
  return flat;
};

export const stageDataForSchema = () => createDefaultStageData();
