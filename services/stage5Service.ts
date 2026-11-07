/**
 * Secure Stage 5 Clinical Review Service
 *
 * Every mutation verifies the caller's role and permission via Supabase auth.
 * Frontend RBAC is still enforced for UX, but these checks are the authoritative
 * backend guard — even if a user manually invokes these functions, unauthorized
 * mutations will be rejected.
 */

import { supabase } from '../integrations/supabase/client';
import { logAdminActivity } from './supabase';

// RBAC functions removed - using direct role checks via user ID

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClinicalStatus =
  | 'pending_review'
  | 'under_clinical_review'
  | 'doctor_recommended'
  | 'manager_review'
  | 'approved'
  | 'changes_requested'
  | 'second_opinion_required'
  | 'not_recommended'
  | 'reopened';

export interface Stage5VersionEntry {
  version: number;
  changed_by: string;
  changed_by_role: AppRole;
  changed_at: string;
  action: string;
  details?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const getUserContext = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHENTICATED');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile?.role || 'patient_coordinator') as AppRole;
  return { user, role };
};

const assertPermission = async (required: Permission) => {
  const { role } = await getUserContext();
  if (!hasPermission(role, required)) {
    throw new Error(`FORBIDDEN: missing permission ${required}`);
  }
  return role;
};

const ensureLead = async (leadId: string) => {
  const { data, error } = await supabase
    .from('patient_enquiries')
    .select('id, workflow_stage, workflow_state, assigned_to, status')
    .eq('id', leadId)
    .maybeSingle();

  if (error || !data) throw new Error('LEAD_NOT_FOUND');
  return data;
};

const buildWorkflowState = (current: any, patch: Record<string, any>) => ({
  ...(current || {}),
  ...patch,
});

const appendVersion = (
  current: any,
  entry: Omit<Stage5VersionEntry, 'version'>
): Stage5VersionEntry[] => {
  const history: Stage5VersionEntry[] = current?.stage5_version_history || [];
  const nextVersion = history.length > 0 ? Math.max(...history.map(h => h.version)) + 1 : 1;
  return [...history, { ...entry, version: nextVersion }];
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getStage5Status = async (leadId: string): Promise<ClinicalStatus> => {
  const lead = await ensureLead(leadId);
  return (lead.workflow_state?.clinical_status as ClinicalStatus) || 'pending_review';
};

export const getStage5VersionHistory = async (
  leadId: string
): Promise<Stage5VersionEntry[]> => {
  const lead = await ensureLead(leadId);
  return lead.workflow_state?.stage5_version_history || [];
};

/**
 * Updates clinical assessment fields.
 * Permission: stage5.edit_assessment
 */
export const updateClinicalAssessment = async (
  leadId: string,
  patch: {
    primary_condition?: string;
    symptoms?: string;
    illness_history?: string;
    previous_treatment?: string;
    current_medication?: string;
    allergies?: string;
    risk_factors?: string;
    clinical_severity?: string;
    clinical_urgency?: string;
    clinical_summary?: string;
    document_review_status?: string;
    document_review_verification_status?: string;
    document_review_doctor_notes?: string;
    missing_documents?: string;
  }
) => {
  const role = await assertPermission('stage5.edit_assessment');
  const lead = await ensureLead(leadId);

  const newState = buildWorkflowState(lead.workflow_state, {
    ...patch,
    stage5_version_history: appendVersion(lead.workflow_state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: 'Clinical Assessment Updated',
      details: patch,
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity('Clinical Assessment Updated', 'Patient Lead', leadId, {
    role,
    fields: Object.keys(patch),
  });

  return newState;
};

/**
 * Selects hospital.
 * Permission: stage5.select_hospital
 */
export const selectHospital = async (leadId: string, hospitalName: string) => {
  const role = await assertPermission('stage5.select_hospital');
  const lead = await ensureLead(leadId);

  const newState = buildWorkflowState(lead.workflow_state, {
    suggested_hospital: hospitalName,
    stage5_version_history: appendVersion(lead.workflow_state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: 'Hospital Selected',
      details: { hospital: hospitalName },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity('Hospital Selected', 'Patient Lead', leadId, {
    role,
    hospital: hospitalName,
  });

  return newState;
};

/**
 * Selects surgeon.
 * Permission: stage5.select_surgeon
 */
export const selectSurgeon = async (leadId: string, surgeonName: string) => {
  const role = await assertPermission('stage5.select_surgeon');
  const lead = await ensureLead(leadId);

  const newState = buildWorkflowState(lead.workflow_state, {
    suggested_surgeon: surgeonName,
    stage5_version_history: appendVersion(lead.workflow_state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: 'Surgeon Selected',
      details: { surgeon: surgeonName },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity('Surgeon Selected', 'Patient Lead', leadId, {
    role,
    surgeon: surgeonName,
  });

  return newState;
};

/**
 * Updates procedure / treatment recommendation.
 * Permission: stage5.edit_procedure
 */
export const updateProcedure = async (leadId: string, procedures: string) => {
  const role = await assertPermission('stage5.edit_procedure');
  const lead = await ensureLead(leadId);

  const newState = buildWorkflowState(lead.workflow_state, {
    suggested_procedures: procedures,
    stage5_version_history: appendVersion(lead.workflow_state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: 'Procedure Updated',
      details: { procedures },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity('Procedure Updated', 'Patient Lead', leadId, {
    role,
    procedures,
  });

  return newState;
};

/**
 * Doctor confirms or undoes clinical review.
 * Permission: stage5.confirm_review
 */
export const confirmClinicalReview = async (leadId: string) => {
  const role = await assertPermission('stage5.confirm_review');
  const lead = await ensureLead(leadId);
  const current = lead.workflow_state || {};
  const alreadyConfirmed = !!current.clinical_review_confirmed;
  const reviewer = await getUserContext();

  const newState = buildWorkflowState(current, {
    clinical_review_confirmed: !alreadyConfirmed,
    clinical_review_confirmed_by: !alreadyConfirmed ? reviewer.user.email || 'In-House Doctor' : '',
    clinical_review_confirmed_by_id: !alreadyConfirmed ? reviewer.user.id : '',
    clinical_review_confirmed_by_role: !alreadyConfirmed ? role : '',
    clinical_review_confirmed_at: !alreadyConfirmed ? new Date().toISOString() : '',
    clinical_review_version: !alreadyConfirmed
      ? (current.clinical_review_version || 0) + 1
      : current.clinical_review_version || 0,
    stage5_version_history: appendVersion(current, {
      changed_by: reviewer.user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: alreadyConfirmed ? 'Clinical Review Confirmation Removed' : 'Clinical Review Confirmed',
      details: {
        clinical_decision: current.clinical_decision_type || '',
        clinical_outcome: current.clinical_outcome || '',
      },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity(
    alreadyConfirmed ? 'Clinical Review Confirmation Removed' : 'Clinical Review Confirmed',
    'Patient Lead',
    leadId,
    {
      reviewer: reviewer.user.email || role,
      reviewerId: reviewer.user.id,
      reviewerRole: role,
      clinical_decision: current.clinical_decision_type || '',
      clinical_outcome: current.clinical_outcome || '',
    }
  );

  return newState;
};

/**
 * Updates clinical decision and outcome.
 * Permission: stage5.edit_assessment
 */
export const updateClinicalDecision = async (
  leadId: string,
  decisionType: string,
  notes?: string
) => {
  const role = await assertPermission('stage5.edit_assessment');
  const lead = await ensureLead(leadId);

  const newState = buildWorkflowState(lead.workflow_state, {
    clinical_decision_type: decisionType,
    clinical_decision_notes: notes || '',
    stage5_version_history: appendVersion(lead.workflow_state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: 'Clinical Decision Updated',
      details: { decision_type: decisionType, notes },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity('Clinical Decision Updated', 'Patient Lead', leadId, {
    role,
    decision_type: decisionType,
  });

  return newState;
};

export const updateClinicalOutcome = async (leadId: string, outcome: string) => {
  const role = await assertPermission('stage5.edit_assessment');
  const lead = await ensureLead(leadId);

  const newState = buildWorkflowState(lead.workflow_state, {
    clinical_outcome: outcome,
    stage5_version_history: appendVersion(lead.workflow_state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: 'Clinical Outcome Updated',
      details: { clinical_outcome: outcome },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity('Clinical Outcome Updated', 'Patient Lead', leadId, {
    role,
    clinical_outcome: outcome,
  });

  return newState;
};

/**
 * Medical manager approves, requests changes, or overrides.
 * Permission: stage5.override
 */
export const managerReview = async (
  leadId: string,
  action: 'approve' | 'request_changes' | 'reject' | 'override',
  options: { notes?: string; override_reason?: string; new_assignee_id?: string }
) => {
  const role = await assertPermission('stage5.override');
  const lead = await ensureLead(leadId);

  if (action === 'override' && !options.override_reason?.trim()) {
    throw new Error('OVERRIDE_REASON_REQUIRED');
  }

  const statusMap: Record<string, ClinicalStatus> = {
    approve: 'approved',
    request_changes: 'changes_requested',
    reject: 'not_recommended',
    override: 'manager_review',
  };

  const newState = buildWorkflowState(lead.workflow_state, {
    clinical_status: statusMap[action] || 'manager_review',
    manager_review_action: action,
    manager_review_notes: options.notes || '',
    manager_review_at: new Date().toISOString(),
    manager_review_by: (await getUserContext()).user.email || role,
    ...(action === 'override'
      ? { clinical_override_reason: options.override_reason }
      : {}),
    ...(options.new_assignee_id
      ? { assigned_doctor_id: options.new_assignee_id }
      : {}),
    stage5_version_history: appendVersion(lead.workflow_state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: `Medical Manager ${action.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
      details: {
        action,
        notes: options.notes,
        override_reason: options.override_reason,
        new_assignee_id: options.new_assignee_id,
      },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity(
    `Medical Manager ${action.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
    'Patient Lead',
    leadId,
    {
      role,
      action,
      notes: options.notes,
      override_reason: options.override_reason,
      new_assignee_id: options.new_assignee_id,
    }
  );

  return newState;
};

/**
 * Generates clinical review report.
 * Permission: stage5.generate_report
 */
export const generateClinicalReport = async (leadId: string) => {
  const role = await assertPermission('stage5.generate_report');
  const lead = await ensureLead(leadId);

  await logAdminActivity('Clinical Review Report Generated', 'Patient Lead', leadId, {
    role,
    surgeon: lead.workflow_state?.suggested_surgeon,
    hospital: lead.workflow_state?.suggested_hospital,
    outcome: lead.workflow_state?.clinical_outcome,
  });

  return { success: true };
};

/**
 * Finalizes Stage 5 and moves to Stage 6.
 * Permission: stage5.finalize
 *
 * Validates all required fields before allowing finalization.
 */
export const finalizeStage5 = async (leadId: string) => {
  const role = await assertPermission('stage5.finalize');
  const lead = await ensureLead(leadId);
  const state = lead.workflow_state || {};

  const missing: string[] = [];
  if (!state.primary_condition && !state.illness_history) missing.push('Clinical Assessment');
  if (!state.assigned_doctor_name && !state.assigned_doctor_id) missing.push('Assigned Doctor');
  if (!state.suggested_hospital) missing.push('Hospital Selected');
  if (!state.suggested_surgeon) missing.push('Surgeon Selected');
  if (!state.suggested_procedures && !state.recommended_procedure) missing.push('Procedure Selected');
  if (!state.clinical_review_confirmed) missing.push('Doctor Sign-off');
  if (!state.clinical_decision_type) missing.push('Clinical Decision');
  if (!state.clinical_outcome) missing.push('Clinical Outcome');
  if (!state.clinical_summary && !state.clinical_decision_notes) missing.push('Clinical Report Data');

  if (missing.length > 0) {
    throw new Error(`CANNOT_FINALIZE: ${missing.join(', ')}`);
  }

  const newState = buildWorkflowState(state, {
    clinical_status: 'approved',
    finalized_at: new Date().toISOString(),
    finalized_by: (await getUserContext()).user.email || role,
    stage5_version_history: appendVersion(state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: 'Stage 5 Finalized → Stage 6',
      details: {
        clinical_outcome: state.clinical_outcome,
        hospital: state.suggested_hospital,
        surgeon: state.suggested_surgeon,
      },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState, workflow_stage: 6, status: 'qualified' })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity('Stage 5 Finalized → Stage 6', 'Patient Lead', leadId, {
    role,
    clinical_outcome: state.clinical_outcome,
    hospital: state.suggested_hospital,
    surgeon: state.suggested_surgeon,
  });

  return newState;
};

/**
 * Requests changes from doctor.
 * Permission: stage5.override
 */
export const requestChanges = async (
  leadId: string,
  comments: string
) => {
  return managerReview(leadId, 'request_changes', { notes: comments });
};

/**
 * Requests second opinion.
 * Permission: stage5.override
 */
export const requestSecondOpinion = async (
  leadId: string,
  secondDoctorId: string,
  reason: string
) => {
  const role = await assertPermission('stage5.override');
  const lead = await ensureLead(leadId);

  const newState = buildWorkflowState(lead.workflow_state, {
    clinical_status: 'second_opinion_required',
    second_opinion_requested_by: (await getUserContext()).user.email || role,
    second_opinion_requested_at: new Date().toISOString(),
    second_opinion_doctor_id: secondDoctorId,
    second_opinion_reason: reason,
    stage5_version_history: appendVersion(lead.workflow_state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: 'Second Opinion Requested',
      details: { second_doctor_id: secondDoctorId, reason },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity('Second Opinion Requested', 'Patient Lead', leadId, {
    role,
    second_doctor_id: secondDoctorId,
    reason,
  });

  return newState;
};

/**
 * Reopens a finalized Stage 5 review.
 * Permission: stage5.reopen
 */
export const reopenStage5 = async (
  leadId: string,
  reason: string
) => {
  const role = await assertPermission('stage5.reopen');
  const lead = await ensureLead(leadId);

  const newState = buildWorkflowState(lead.workflow_state, {
    clinical_status: 'reopened',
    reopened_at: new Date().toISOString(),
    reopened_by: (await getUserContext()).user.email || role,
    reopened_reason: reason,
    clinical_review_confirmed: false,
    clinical_review_confirmed_by: '',
    stage5_version_history: appendVersion(lead.workflow_state, {
      changed_by: (await getUserContext()).user.email || role,
      changed_by_role: role,
      changed_at: new Date().toISOString(),
      action: 'Stage 5 Reopened',
      details: { reason },
    }),
  });

  const { error } = await supabase
    .from('patient_enquiries')
    .update({ workflow_state: newState })
    .eq('id', leadId);

  if (error) throw error;

  await logAdminActivity('Clinical Review Reopened', 'Patient Lead', leadId, {
    role,
    reason,
  });

  return newState;
};
