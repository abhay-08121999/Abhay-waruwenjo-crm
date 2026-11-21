import React, { useState, useEffect, useRef } from 'react';
import { getLeadCode } from '../lib/leadCode.ts';
import { fetchLeads, createLead, updateLeadStatus, updatePatientEnquiry, convertProfileToCase, createConsultationFromEnquiry, fetchActiveDoctors, fetchDoctors, fetchHospitals, updateLeadWorkflow, saveLeadWorkflowState, logAdminActivity, fetchAdminActivityLogs, sendCrmEmail, fetchEnquiryDocuments, createPatientAccountFromEnquiry, uploadEnquiryDocument, fetchCrmUsersByRole, fetchMasterTemplate } from '../services/supabase.ts';
import { supabase } from '../integrations/supabase/client';
import { fetchInHouseDoctorUsers, InHouseDoctorUser, CrmRole, getCustomStageAccess } from '../services/roles';
import { useLeadGrants } from '../services/leadAccess';
import { LeadStatus, Lead, Doctor, Hospital } from '../types.ts';
import { buildWaruWenJoEmailFull } from './emailTemplate';
import { fillLeadEmailTemplate, buildPatientLink, buildAssessmentBlock, LEAD_EMAIL_LOG_LABELS, type LeadEmailKind } from '../lib/leadEmailDraft';
import { 
  Search, Filter, MoreVertical, Mail, Phone, Plus, X, Activity, UserPlus, 
  Calendar, MapPin, Globe, CreditCard, Clock, MessageSquare, CheckCircle2, 
  LayoutGrid, List, AlertTriangle, ChevronRight, User, Hash, FileText,
  ExternalLink, Info, Stethoscope, ChevronLeft, Pencil
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { generateCallSummary } from '../services/geminiService.ts';
import { VIL_FILE_ITEMS, VIL_TEXT_ITEMS } from './VilPublicForm';
import LeadQuotationPanel from './LeadQuotationPanel';

class LeadDetailErrorBoundary extends React.Component<{ children: React.ReactNode; onClose: () => void }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Patient lead detail render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600">Unable to open lead details</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">This lead has incomplete data</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">The lead record could not be displayed safely. Close this message and try another lead, or refresh the leads list.</p>
            <button onClick={this.props.onClose} className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-teal-700">Close details</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Rejects if a promise does not settle in time, so a hung request cannot leave the UI stuck.
const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });

const escapeEmailHtml = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const MOM_FIELDS: [string, string][] = [
  ['mom_date_time', 'Date / time'],
  ['mom_participants', 'Participants'],
  ['mom_discussion_points', 'Main discussion points'],
  ['mom_specialist_observations', 'Specialist observations'],
  ['mom_patient_questions', 'Patient questions'],
  ['mom_decisions', 'Decisions'],
  ['mom_next_steps', 'Next steps'],
  ['mom_instructions', 'Important instructions'],
];

type ViewMode = 'TABLE' | 'BOARD';

// In-house doctors can edit only Stage 4 (Doctor Inbox) and Stage 5 (Clinical).
// They can open leads assigned to them from Stage 3 (where the BDM sends them to the inbox), read-only.
const IN_HOUSE_DOCTOR_STAGES = [4, 5];
const IN_HOUSE_DOCTOR_VIEW_STAGES = [3, 4, 5];
// BDMs can see Stage 4 and 5 but cannot edit them; those stages belong to the in-house doctor.
const BDM_READ_ONLY_STAGES = [4, 5];

// Text fields that save to the lead. What is typed stays in local state so typing is instant; the change is
// sent to the (slow) save only after a short pause, when the field loses focus, or when it is removed.
const makeDraftField = (Tag: 'textarea' | 'input') => {
  const DraftField: React.FC<any> = ({ value, onChange, onBlur, onFocus, ...rest }) => {
    const [draft, setDraft] = useState<string>(value ?? '');
    const focused = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The change event and the handler of the render it was typed in, so a late save still goes to the right lead.
    const pending = useRef<{ event: any; handler: ((e: any) => void) | undefined } | null>(null);

    useEffect(() => {
      if (!focused.current && !timer.current) setDraft(value ?? '');
    }, [value]);

    const flush = () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      const job = pending.current;
      pending.current = null;
      if (job?.handler) job.handler(job.event);
    };

    useEffect(() => () => flush(), []);

    return React.createElement(Tag, {
      ...rest,
      value: draft,
      onFocus: (e: any) => { focused.current = true; onFocus?.(e); },
      onChange: (e: any) => {
        setDraft(e.target.value);
        pending.current = { event: e, handler: onChange };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 600);
      },
      onBlur: (e: any) => { focused.current = false; flush(); onBlur?.(e); },
    });
  };
  return DraftField;
};
const DraftTextarea = makeDraftField('textarea');
const DraftInput = makeDraftField('input');

// The MOM date picker stores 'YYYY-MM-DDTHH:mm'. Older records hold free text, which the picker cannot show.
const MOM_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const formatMomDateTime = (value: unknown) => {
  const text = String(value || '');
  if (!MOM_DATE_PATTERN.test(text)) return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const PatientLeads: React.FC<{ roles?: CrmRole[] }> = ({ roles = [] }) => {
  // In-House Doctor can only work on stages 3, 4 and 5.
  const isInHouseDoctorOnly =
    roles.length > 0 &&
    roles.every(
      role =>
        String(role.key || '').toLowerCase().replace(/[^a-z]/g, '') === 'inhousedoctor' ||
        String(role.name || '').toLowerCase().replace(/[^a-z]/g, '') === 'inhousedoctor'
    );
  // Custom roles only see and edit the stages ticked for them (Read / Write) in User & Role Management.
  const customStageAccess = getCustomStageAccess(roles, 'patient_leads');
  const normalizeRoleKey = (value: string) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  const hasAnyRole = (...names: string[]) =>
    roles.some(role => names.includes(normalizeRoleKey(role.key)) || names.includes(normalizeRoleKey(role.name)));
  // BDMs can open and work every patient lead stage (1 to 9), including Stage 4 (Doctor Inbox) and Stage 5 (Clinical).
  // Match the BDM role by key or display name, tolerating variants such as "BDM", "bdm_team" or "Business Development Manager".
  const isBdmRole = (role: { key?: string; name?: string }) =>
    [role.key, role.name].some(value => {
      const normalized = normalizeRoleKey(String(value || ''));
      return normalized === 'bdm' || normalized.startsWith('bdm') || normalized.includes('businessdevelopment');
    });
  const isBdmUser = roles.some(isBdmRole) && !hasAnyRole('superadmin', 'admin');
  const BDM_STAGE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  // Only the BDM granted a lead in the Lead Access Manager may edit it. Other BDMs can still view it.
  const { restricted: restrictedBdm, isGranted } = useLeadGrants(roles);
  // A BDM may edit a lead when it is assigned to them (assigned_bdm_id) or when they hold a grant for it.
  const isLeadLocked = (leadId?: string | number | null) => {
    if (leadId == null) return false;
    const id = String(leadId);
    const lead: any = leads.find(l => String(l.id) === id) ?? (selectedLead && String(selectedLead.id) === id ? selectedLead : null);
    // In-house doctors can only work on leads assigned to them (assigned_to).
    if (isInHouseDoctorOnly) return !(lead?.assignedTo && lead.assignedTo === currentUserId);
    if (!restrictedBdm) return false;
    const assignedToMe = !!lead?.assignedBdmId && lead.assignedBdmId === currentUserId;
    return !assignedToMe && !isGranted('patient', leadId);
  };
  const denyIfLeadLocked = (leadId?: string | number | null) => {
    const id = leadId ?? selectedLead?.id;
    if (!isLeadLocked(id)) return false;
    toast.error('Only the BDM assigned to this lead can update it.');
    return true;
  };
  const canAccessStage = (stageId: number) =>
    (!isInHouseDoctorOnly || IN_HOUSE_DOCTOR_VIEW_STAGES.includes(stageId)) &&
    (isBdmUser ? BDM_STAGE_IDS.includes(stageId) : !customStageAccess || customStageAccess.read.has(stageId));
  const canWriteStage = (stageId: number) => {
    if (activeLeadLocked) return false;
    if (isInHouseDoctorOnly) return IN_HOUSE_DOCTOR_STAGES.includes(stageId);
    if (isBdmUser) return BDM_STAGE_IDS.includes(stageId) && !BDM_READ_ONLY_STAGES.includes(stageId);
    return !customStageAccess || customStageAccess.write.has(stageId);
  };
  const blockReadOnlyWrite = (stageId: number) => {
    if (canWriteStage(stageId)) return false;
    toast.error('You have read-only access to this stage.');
    return true;
  };
  const clampStageForRole = (stageId: number) => {
    if (customStageAccess) {
      if (canAccessStage(stageId)) return stageId;
      const readable = Array.from(customStageAccess.read).sort((a, b) => a - b);
      return readable.find(id => id >= stageId) ?? readable[readable.length - 1] ?? stageId;
    }
    return canAccessStage(stageId) ? stageId : stageId < 4 ? 4 : 5;
  };
  const [leads, setLeads] = useState<Lead[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('BOARD');
  
  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showDetailPane, setShowDetailPane] = useState(false);
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  // The signed-in user's id, used to recognise leads assigned to them.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null)).catch(() => undefined);
  }, []);
  // True when this BDM is not assigned or granted the open lead: it can be viewed but not changed.
  const activeLeadLocked = showDetailPane && !!selectedLead && isLeadLocked(selectedLead.id);

  const [newLead, setNewLead] = useState<Partial<Lead>>({
    status: LeadStatus.NEW,
    urgency: 'Standard',
  });

  const [selectedInHouseDoctor, setSelectedInHouseDoctor] = useState('');
  const [doctorReportPdf, setDoctorReportPdf] = useState<string | null>(null);
  const [clinicalNotesPdf, setClinicalNotesPdf] = useState<string | null>(null);
  // Live list of CRM users with the in_house_doctor role (loaded from Supabase).
  const [inHouseDoctors, setInHouseDoctors] = useState<InHouseDoctorUser[]>([]);
  const [inHouseDoctorsLoaded, setInHouseDoctorsLoaded] = useState(false);
  const IN_HOUSE_DOCTORS = inHouseDoctors.map(d => d.name);
  const IN_HOUSE_DOCTOR_EMAILS: Record<string, string> = Object.fromEntries(
    inHouseDoctors.filter(d => d.email).map(d => [d.name, d.email])
  );

  const [isUpdatingWorkflow, setIsUpdatingWorkflow] = useState(false);
  const [isConvertingToCase, setIsConvertingToCase] = useState(false);
  const [activeWorkflowStage, setActiveWorkflowStage] = useState(1);
  // View-only browsing: a role that can only read the lead's own stage may still look at its other
  // readable stages. This never moves the lead and never allows edits.
  const [isViewOnlyStage, setIsViewOnlyStage] = useState(false);
  // Pop-up shown when the in-house doctor finalizes Stage 5 and the lead is handed to the BDM for Stage 6.
  const [showStage5Complete, setShowStage5Complete] = useState(false);
  const isStageReadOnly = !canWriteStage(activeWorkflowStage) || isViewOnlyStage;
  const detailScrollRef = useRef<HTMLDivElement>(null);
  // Opens a lead from a card or row. Clears the previous lead first, so the detail pane always
  // loads the newly clicked lead from scratch (no stale state from the lead opened before).
  const openLeadDetail = (lead: Lead) => {
    setShowDetailPane(false);
    setSelectedLead(null);
    setLocalWorkflowState(null);
    setTimeout(() => {
      setSelectedLead(lead);
      setShowDetailPane(true);
    }, 0);
  };
  // Show the top of the lead whenever the user moves to another stage
  useEffect(() => {
    detailScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeWorkflowStage]);
  const [localWorkflowState, setLocalWorkflowState] = useState<any>(null);
  const workflowStateRef = useRef<any>(null);
  const workflowSaveQueueRef = useRef<Promise<any>>(Promise.resolve());
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [enquiryDocuments, setEnquiryDocuments] = useState<any[]>([]);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const documentFileInputRef = useRef<HTMLInputElement>(null);
  const [callOutcomeDraft, setCallOutcomeDraft] = useState('');
  const [callNotesDraft, setCallNotesDraft] = useState('');
  const callbackInputRef = useRef<HTMLInputElement>(null);
  const [callbackDateDraft, setCallbackDateDraft] = useState('');
  const [aiSummaryDraft, setAiSummaryDraft] = useState('');
  const [isGeneratingCallSummary, setIsGeneratingCallSummary] = useState(false);
  const [isSendingDocumentRequest, setIsSendingDocumentRequest] = useState(false);
  const [isSendingVilForm, setIsSendingVilForm] = useState(false);
  const [isSendingPaymentLink, setIsSendingPaymentLink] = useState(false);
  const [isUploadingVisa, setIsUploadingVisa] = useState(false);
  const [bdmUsers, setBdmUsers] = useState<any[]>([]);
  const [userDirectory, setUserDirectory] = useState<Record<string, string>>({});
  const roleKeys: string[] = (roles as any[]).map((r) => (typeof r === 'string' ? r : r?.key));
  const canAssignBdm = roleKeys.includes('admin') || roleKeys.includes('super_admin');
  const [vilSubmission, setVilSubmission] = useState<any>(null);
  const [vilLoadError, setVilLoadError] = useState('');
  const [showSpamReasonPicker, setShowSpamReasonPicker] = useState(false);
  const [spamReason, setSpamReason] = useState('');
  const SPAM_REASONS = ['Spam / Fake Enquiry', 'Invalid Contact Information', 'Test Entry', 'Not a Genuine Patient Interest', 'Duplicate of Existing Lead', 'Other'];

  const CALL_OUTCOMES = ['Interested', 'Needs Time', 'Requested Callback', 'Wrong Number', 'No Answer'];

  const STAGES = [
    { id: 1, name: 'New Lead', label: 'Triage', tasks: ['Review New Lead', 'Check Duplicate Lead', 'Decide Whether Lead Is Genuine'], statusMapping: LeadStatus.NEW },
    { id: 2, name: 'Contact Attempted', label: 'Outreach', tasks: ['Log First Call', 'Record Call Outcome', 'Record Call Notes', 'Complete First Contact'], statusMapping: LeadStatus.NEW },
    { id: 3, name: 'Medical Documents', label: 'Documents', tasks: ['Explain Patient Process & Send Medical Document Request Email', 'Receive Medical Documents'], statusMapping: LeadStatus.CONTACTED },
    { id: 4, name: 'In-House Doctor Interaction', label: 'Doctor Inbox', tasks: ['Record Doctor Call Notes', 'Send Personal Email to Patient', 'Complete In-House Doctor Interaction'], statusMapping: LeadStatus.CONTACTED },
    { id: 5, name: 'Clinical Qualification & Planning', label: 'Clinical', tasks: ['Suggest Hospitals & Surgeons/Specialists', 'Finalize Clinical Recommendation & Confirm Clinical Review', 'Generate Clinical Report'], statusMapping: LeadStatus.QUALIFIED },
    { id: 6, name: 'Financial & Logistics Proposal', label: 'BDM Pipeline', tasks: ['Generate Financial Proposal', 'Discuss Travel & Accommodation', 'Address Patient Concerns', 'Send Proposal Via Mail', 'Confirm Patient Interest Via Call'], statusMapping: LeadStatus.QUALIFIED },
    { id: 7, name: 'Specialist Consultation, Medical Visa Application Form', label: 'Specialist Consult & Visa Form', tasks: ['Specialist Doctor Call & MOM', 'BDM Calls Patient', 'Confirm Patient Agreement', 'Request Patient to Proceed'], statusMapping: LeadStatus.QUALIFIED },
    { id: 8, name: 'Medical Case Handover', label: 'CDM/WaruBuddy Handover', tasks: ['Collect Advance Payment', 'Create Patient Account & Medical Case', 'Handover to CDM/WaruBuddy', 'Complete Stage 8'], statusMapping: LeadStatus.WON },
    { id: 9, name: 'Lost / Dropped', label: 'Archived', tasks: ['Select Drop-off Reason', 'Archive Lead'], statusMapping: LeadStatus.LOST }
  ];

  useEffect(() => {
    if (selectedLead) {
      setDoctorReportPdf(null);
      setClinicalNotesPdf(null);
      setShowSpamReasonPicker(false);
      setSpamReason('');
      setLocalWorkflowState(null);
        setActiveWorkflowStage(clampStageForRole(Number(selectedLead.workflowStage) || 1));
        setIsViewOnlyStage(false);
      const defaultState = {
        stage1_checklist: [],
        duplicate_check_done: false,
        lead_genuine_decision: '',
        spam_reason: '',
        discovery_requirements: '',
        stage2_checklist: [],
        contact_attempt_count: 0,
        last_attempt_at: '',
        first_contact_at: '',
        call_outcome: '',
        call_notes: '',
        callback_due_at: '',
        ai_call_summary: '',
        welcome_email_sent_at: '',
        process_explained_at: null,
        document_request_sent_at: '',
        documents_received_count: 0,
        assigned_doctor_name: '',
        doctor_inbox_status: '',
        doctor_assigned_at: null,
        doctor_call_notes: '',
        doctor_call_at: null,
        personal_email_sent_at: null,
        initial_doctor_assessment: '',
        doctor_next_steps: '',
        clinical_doctor_email_sent_at: null,
        clinical_recommendation_finalized: false,
        clinical_review_confirmed: false,
        clinical_review_confirmed_at: null,
        clinical_review_confirmed_by: '',
        clinical_decision: '',
        clinical_report_generated_at: null,
        travel_accommodation: '',
        patient_concerns: '',
        proposal_sent_at: null,
        patient_interest_reason: '',
        specialist_consultation_booked: false,
        specialist_call_completed_at: null,
        specialist_call_notes: '',
        mom_date_time: '',
        mom_participants: '',
        mom_discussion_points: '',
        mom_specialist_observations: '',
        mom_patient_questions: '',
        mom_decisions: '',
        mom_next_steps: '',
        mom_instructions: '',
        mom_recorded_at: null,
        bdm_call_completed_at: null,
        bdm_call_notes: '',
        quotation_agreement_confirmed: false,
        clinical_process_agreement_confirmed: false,
        stage7_patient_decision: '',
        stage7_disagreement_reason: '',
        stage7_disagreement_concern: '',
        stage7_disagreement_followup: '',
        request_to_proceed_confirmed: false,
        request_to_proceed_at: null,
        payment_link: '',
        payment_link_provided_at: null,
        stage3_checklist: [],
        stage4_checklist: [],
        stage5_checklist: [],
        stage6_checklist: [],
        stage7_checklist: [],
        stage8_checklist: [],
        stage9_checklist: [],
        clinical_summary: "",
        suggested_hospital: "",
        suggested_hospital_id: "",
        suggested_surgeon: "",
        suggested_surgeon_id: "",
        suggested_procedures: "",
        scheduled_timing: "",
        meeting_link: "",
        quotation_details: "",
        quotation_items: [],
        payment_reference: "",
        advance_payment_verified: false,
        payment_status: '',
        payment_date_time: null,
        payment_amount: null,
        medical_case_id: null,
        converted_at: null,
        handover_prepared_at: null,
        handover_bdm_name: '',
        handover_cdm_team: 'CDM/WaruBuddy',
        handover_status: '',
        handover_case_information: '',
        clinical_information_shared: false,
        financial_information_shared: false,
        specialist_mom_information_shared: false,
        handover_initiated_at: null,
        handover_accepted_at: null,
        case_ownership_confirmed_at: null,
        patient_profile_id: null,
        patient_profile_created_at: null,
        patient_user_id: null,
        patient_patient_id: null,
        patient_account_created_at: null,
        patient_account_status: 'not_created',
        patient_invitation_sent_at: null,
        stage8_completed_at: null,
        archived_at: null,
        dropoff_reason: "",
        dropped_from_stage: null,
        dropped_at: null,
        resume_stage: null
      };
      const rawWorkflowState = selectedLead.workflowState;
      const safeWorkflowState = rawWorkflowState && typeof rawWorkflowState === 'object' && !Array.isArray(rawWorkflowState)
        ? rawWorkflowState
        : {};
      const storedStageData = safeWorkflowState.stage_data && typeof safeWorkflowState.stage_data === 'object'
        ? safeWorkflowState.stage_data
        : {};
      const stageDataState = Object.values(storedStageData).reduce((result: Record<string, any>, stage: any) => ({
        ...result,
        ...(stage?.data || {}),
        ...(stage?.stage_id ? { [`stage${stage.stage_id}_checklist`]: Array.isArray(stage.checklist) ? stage.checklist : [] } : {}),
      }), {});
      // Saved stage_data is the source of truth. The top-level workflow fields can hold older
      // copies, so they must not overwrite what was saved (call notes, AI summary, ticks).
      const storedFields = Object.fromEntries(
        Object.entries(stageDataState as Record<string, any>).filter(([, value]) => value !== null && value !== undefined)
      );
      const hydratedState = {
        ...defaultState,
        ...safeWorkflowState,
        ...storedFields,
        // Prefer the checklist saved in stage_data (where ticks are written). The top-level
        // workflow state can hold an older/empty copy, which made ticks look cleared on reopen.
        stage2_checklist: (Array.isArray((stageDataState as Record<string, any>).stage2_checklist)
          ? (stageDataState as Record<string, any>).stage2_checklist
          : Array.isArray(safeWorkflowState.stage2_checklist)
            ? safeWorkflowState.stage2_checklist
            : []
        ).filter((task: string) => task !== 'Schedule Callback if Required'),
        stage3_checklist: Array.from(new Set([
          ...(Array.isArray(stageDataState.stage3_checklist || safeWorkflowState.stage3_checklist) ? (stageDataState.stage3_checklist || safeWorkflowState.stage3_checklist) : []),
          ...(Array.isArray(stageDataState.stage3_checklist || safeWorkflowState.stage3_checklist) && (stageDataState.stage3_checklist || safeWorkflowState.stage3_checklist).includes('Explain Patient Process') && (stageDataState.stage3_checklist || safeWorkflowState.stage3_checklist).includes('Send Medical Document Request Email')
            ? ['Explain Patient Process & Send Medical Document Request Email'] : []),
        ])).filter((task: string) => ![
          'Record Primary Medical Interest', 'Explain Patient Process', 'Send Medical Document Request Email',
          'Verify Medical Documents', 'Complete Document Verification', 'Verify & Complete Document Verification',
        ].includes(task)),
        stage5_checklist: Array.from(new Set([
          ...(Array.isArray(stageDataState.stage5_checklist || safeWorkflowState.stage5_checklist) ? (stageDataState.stage5_checklist || safeWorkflowState.stage5_checklist) : []),
          ...(Array.isArray(stageDataState.stage5_checklist || safeWorkflowState.stage5_checklist) && (stageDataState.stage5_checklist || safeWorkflowState.stage5_checklist).includes('Suggest Hospitals') && (stageDataState.stage5_checklist || safeWorkflowState.stage5_checklist).includes('Suggest Surgeons/Specialists')
            ? ['Suggest Hospitals & Surgeons/Specialists'] : []),
          ...(Array.isArray(stageDataState.stage5_checklist || safeWorkflowState.stage5_checklist) && (stageDataState.stage5_checklist || safeWorkflowState.stage5_checklist).includes('Finalize Clinical Recommendation') && (stageDataState.stage5_checklist || safeWorkflowState.stage5_checklist).includes('Confirm Clinical Review')
            ? ['Finalize Clinical Recommendation & Confirm Clinical Review'] : []),
        ])).filter((task: string) => ![
          'Suggest Hospitals', 'Suggest Surgeons/Specialists', 'Personal Email send by Inhouse doctor to patient',
          'Finalize Clinical Recommendation', 'Confirm Clinical Review',
        ].includes(task)),
        stage8_checklist: Array.from(new Set([
          ...(Array.isArray(stageDataState.stage8_checklist || safeWorkflowState.stage8_checklist) ? (stageDataState.stage8_checklist || safeWorkflowState.stage8_checklist) : []),
          ...(Array.isArray(stageDataState.stage8_checklist || safeWorkflowState.stage8_checklist) &&
            ['Prepare Patient Handover', 'Share Clinical Information', 'Share Financial Information', 'Share Specialist/MOM Information']
              .every(task => (stageDataState.stage8_checklist || safeWorkflowState.stage8_checklist).includes(task))
            ? ['Prepare Complete Patient Handover'] : []),
        ])).filter((task: string) => ![
          'Prepare Patient Handover', 'Share Clinical Information', 'Share Financial Information', 'Share Specialist/MOM Information',
        ].includes(task)),
      };
      // Stage 8 merged checklist: carry over ticks from the old, longer checklist.
      {
        const oldStage8: string[] = Array.isArray(hydratedState.stage8_checklist) ? hydratedState.stage8_checklist : [];
        const has = (...names: string[]) => names.some(name => oldStage8.includes(name));
        const merged8: string[] = [];
        if (has('Verify Advance Payment')) merged8.push('Collect Advance Payment');
        if (has('Convert Lead to Medical Case', 'Create Patient Account')) merged8.push('Create Patient Account & Medical Case');
        if (has('CDM/WaruBuddy Accepts Handover', 'Confirm Case Ownership')) merged8.push('Handover to CDM/WaruBuddy');
        if (has('Complete Stage 8')) merged8.push('Complete Stage 8');
        hydratedState.stage8_checklist = Array.from(new Set([...oldStage8.filter(task => merged8.includes(task)), ...merged8]));
      }
      // Stage 7 merged checklist: carry over ticks from the old, longer checklist.
      {
        const oldStage7: string[] = Array.isArray(hydratedState.stage7_checklist) ? hydratedState.stage7_checklist : [];
        const all = (...names: string[]) => names.every(name => oldStage7.includes(name));
        const merged7: string[] = [];
        if (all('Specialist Doctor Call', 'Record MOM')) merged7.push('Specialist Doctor Call & MOM');
        if (oldStage7.includes('BDM Calls Patient')) merged7.push('BDM Calls Patient');
        if (all('Confirm Quotation Agreement', 'Confirm Clinical Process Agreement', 'Record Patient Decision')) merged7.push('Confirm Patient Agreement');
        if (oldStage7.includes('Request Patient to Proceed')) merged7.push('Request Patient to Proceed');
        hydratedState.stage7_checklist = Array.from(new Set([...oldStage7, ...merged7]));
      }
      const normalizedStageChecklists = Object.fromEntries(
        STAGES.map(stage => [
          `stage${stage.id}_checklist`,
          Array.isArray(hydratedState[`stage${stage.id}_checklist`])
            ? hydratedState[`stage${stage.id}_checklist`].filter((task: string) => stage.tasks.includes(task))
            : [],
        ])
      );
      Object.assign(hydratedState, normalizedStageChecklists);
      const assignedInHouseName = inHouseDoctors.find((d) => d.userId === selectedLead.assignedTo)?.name;
      if (assignedInHouseName) hydratedState.assigned_doctor_name = assignedInHouseName;
      setLocalWorkflowState(hydratedState);
      workflowStateRef.current = hydratedState;
      workflowSaveQueueRef.current = Promise.resolve();
      setCallOutcomeDraft(hydratedState.call_outcome || '');
      setCallNotesDraft(hydratedState.call_notes || '');
      setCallbackDateDraft(typeof hydratedState.callback_due_at === 'string' ? hydratedState.callback_due_at.slice(0, 16) : '');
      setAiSummaryDraft(hydratedState.ai_call_summary || '');
      // Only ever keep a doctor's name here, never an ID.
      setSelectedInHouseDoctor(hydratedState.assigned_doctor_name || '');
      // Rewrite legacy flat/old stage_data records into the current schema.
      // Opening a lead must not write anything for a role that only has read access to its stage.
      if (canWriteStage(clampStageForRole(Number(selectedLead.workflowStage) || 1))) void saveLeadWorkflowState(selectedLead.id, { stage_data: buildStageData(hydratedState) })
        .then((result: any) => {
          if (result?.error) console.warn('Workflow schema migration failed:', result.error);
        })
        .catch((error: any) => console.warn('Workflow schema migration failed:', error));
      Promise.allSettled([loadActivityLogs(selectedLead.id), loadEnquiryDocuments(selectedLead.id)]);
    }
  }, [selectedLead]);

  const loadActivityLogs = async (leadId: string) => {
    const { data } = await fetchAdminActivityLogs(leadId);
    if (data) setActivityLogs(data);
  };

  const loadEnquiryDocuments = async (leadId: string) => {
    const { data } = await fetchEnquiryDocuments(leadId);
    if (data) setEnquiryDocuments(data);
  };

  // Staff upload of patient documents (PDF, JPG, JPEG, PNG). Several files at once are supported.
  const handleStaffDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (denyIfLeadLocked()) return;
    const files = Array.from(e.target.files || []);
    if (documentFileInputRef.current) documentFileInputRef.current.value = '';
    if (!selectedLead || !files.length) return;
    if (blockReadOnlyWrite(activeWorkflowStage)) return;
    setIsUploadingDocuments(true);
    let ok = 0;
    for (const file of files) {
      const { error } = await uploadEnquiryDocument(selectedLead.id, file);
      if (error) {
        console.error('Staff document upload failed:', error);
        toast.error(`${file.name}: ${error.message || 'upload failed'}`);
      } else {
        ok += 1;
      }
    }
    setIsUploadingDocuments(false);
    if (ok) toast.success(`${ok} document${ok === 1 ? '' : 's'} uploaded`);
    await loadEnquiryDocuments(selectedLead.id);
  };

  const buildStageData = (state: any) => {
    const stage = (id: number, name: string, label: string, checklistKey: string, fields: string[]) => ({
      stage_id: id,
      name,
      label,
      status: (state[checklistKey] || []).length === (STAGES.find(item => item.id === id)?.tasks || []).length
        ? 'completed'
        : (state[checklistKey] || []).length ? 'in_progress' : 'not_started',
      // Save only the tasks the user has actually ticked. (This used to save the FULL task list
      // of every stage, so every box came back ticked the next time the lead was opened.)
      checklist: Array.isArray(state[checklistKey])
        ? state[checklistKey].filter((task: string) => (STAGES.find(item => item.id === id)?.tasks || []).includes(task))
        : [],
      data: fields.reduce((result: Record<string, any>, field) => {
        const value = state[field];
        return { ...result, [field]: value === undefined ? null : value };
      }, {}),
    });
    return {
      stage1: stage(1, 'New Lead', 'Triage', 'stage1_checklist', ['duplicate_check_done', 'duplicate_result', 'lead_genuine_decision', 'spam_reason', 'discovery_requirements']),
      stage2: stage(2, 'Contact Attempted', 'Outreach', 'stage2_checklist', ['contact_attempt_count', 'contact_attempts', 'first_contact_at', 'last_attempt_at', 'call_outcome', 'response_outcome', 'call_notes', 'call_summary', 'ai_call_summary', 'callback_date', 'callback_due_at']),
      stage3: stage(3, 'Medical Documents', 'Documents', 'stage3_checklist', ['process_explained_at', 'document_request_sent_at', 'documents_received_count', 'document_request_whatsapp_message', 'assigned_bdm_name']),
      stage4: stage(4, 'In-House Doctor Interaction', 'Doctor Inbox', 'stage4_checklist', ['assigned_doctor_name', 'doctor_inbox_status', 'doctor_assigned_at', 'doctor_call_notes', 'doctor_call_at', 'personal_email_sent_at', 'initial_doctor_assessment', 'doctor_next_steps', 'doctor_interaction_complete', 'doctor_call_notes_saved_at', 'initial_doctor_assessment_saved_at']),
      stage5: stage(5, 'Clinical Qualification & Planning', 'Clinical', 'stage5_checklist', ['suggested_hospital', 'suggested_hospital_id', 'suggested_surgeon', 'suggested_surgeon_id', 'suggested_hospitals', 'suggested_surgeons', 'suggested_procedures', 'illness_history', 'clinical_summary', 'clinical_recommendation_finalized', 'clinical_review_confirmed', 'clinical_review_confirmed_at', 'clinical_review_confirmed_by', 'clinical_decision', 'clinical_report_generated_at']),
      stage6: stage(6, 'Financial & Logistics Proposal', 'BDM Pipeline', 'stage6_checklist', ['quotation_details', 'quotation_items', 'travel_accommodation', 'patient_concerns', 'financial_proposal_pdf', 'proposal_sent_at', 'patient_interest', 'patient_interest_reason', 'estimated_cost_min', 'estimated_cost_max', 'estimated_cost_currency', 'estimated_cost_notes', 'specialist_consultation_booked']),
      stage7: stage(7, 'Specialist Consultation, Medical Visa Application Form', 'Specialist Consult & Visa Form', 'stage7_checklist', ['specialist_call_completed_at', 'specialist_call_notes', 'mom_date_time', 'mom_participants', 'mom_discussion_points', 'mom_specialist_observations', 'mom_patient_questions', 'mom_decisions', 'mom_next_steps', 'mom_instructions', 'mom_recorded_at', 'mom_pdf_path', 'mom_pdf_url', 'bdm_call_completed_at', 'bdm_call_notes', 'quotation_agreement_confirmed', 'clinical_process_agreement_confirmed', 'stage7_patient_decision', 'stage7_disagreement_reason', 'stage7_disagreement_concern', 'stage7_disagreement_followup', 'request_to_proceed_confirmed', 'request_to_proceed_at', 'vil_form_sent_at', 'visa_application_sent_at', 'visa_application_created', 'visa_application_created_at', 'visa_document_path', 'visa_document_name', 'visa_document_uploaded_at']),
      stage8: stage(8, 'Medical Case Handover', 'CDM/WaruBuddy Handover', 'stage8_checklist', ['payment_link', 'payment_reference', 'payment_link_provided_at', 'payment_status', 'payment_date_time', 'payment_amount', 'advance_payment_verified', 'medical_case_id', 'converted_at', 'handover_prepared_at', 'patient_user_id', 'patient_patient_id', 'patient_account_created_at', 'patient_account_status', 'patient_account_error', 'patient_invitation_sent_at', 'handover_bdm_name', 'handover_cdm_team', 'handover_status', 'handover_case_information', 'clinical_information_shared', 'financial_information_shared', 'specialist_mom_information_shared', 'handover_initiated_at', 'handover_accepted_at', 'case_ownership_confirmed_at', 'stage8_completed_at']),
      stage9: stage(9, 'Lost / Dropped', 'Archived', 'stage9_checklist', ['dropoff_reason', 'archived_at', 'dropped_from_stage', 'dropped_at', 'resume_stage']),
    };
  };

  // Merge every patch into the latest state and serialize writes so rapid
  // edits across stages cannot overwrite fields saved by another action.
  const persistWorkflowPatch = async (patch: Record<string, any>) => {
    if (!selectedLead) return { error: null };
    if (!canWriteStage(activeWorkflowStage) || isViewOnlyStage) return { error: new Error('Read-only access to this stage') };
    const nextState = { ...(workflowStateRef.current || localWorkflowState || {}), ...patch };
    const stageData = buildStageData(nextState);
    // Stages 4 and 5 can only be changed by the assigned in-house doctor. For anyone else, keep the
    // stored values exactly as they are, so an unrelated save (such as assigning a BDM in Stage 3)
    // does not resend Stage 4/5 and get rejected by the database.
    const assignedDoctorId = leads.find((l) => l.id === selectedLead.id)?.assignedTo ?? (selectedLead as any).assignedTo ?? '';
    const isAssignedInHouseDoctor = !!currentUserId && assignedDoctorId === currentUserId;
    if (!isAssignedInHouseDoctor) {
      const storedStageData: Record<string, any> =
        leads.find((l) => l.id === selectedLead.id)?.workflowState?.stage_data
        || (selectedLead as any).workflowState?.stage_data
        || {};
      for (const key of ['stage4', 'stage5']) {
        if (key in storedStageData) {
          stageData[key] = storedStageData[key];
        } else {
          delete stageData[key];
        }
      }
    }
    workflowStateRef.current = nextState;
    setLocalWorkflowState(nextState);
    const leadId = selectedLead.id;
    const saveOperation = workflowSaveQueueRef.current.then(() => saveLeadWorkflowState(leadId, { stage_data: stageData }));
    workflowSaveQueueRef.current = saveOperation.catch(() => undefined);
    // Keep the lead list in sync with what was just saved. Otherwise reopening a lead reads the
    // older copy from the list, and the latest notes, assessments and ticks look missing.
    saveOperation
      .then((result: any) => {
        if (result?.error) {
          // Surface the real database message (for example a permission denial) instead of failing silently.
          console.error('Lead workflow save failed:', result.error);
          toast.error(`Could not save changes: ${result.error.message || 'permission denied'}`);
          return;
        }
        setLeads(prev => prev.map(lead => lead.id === leadId
          ? { ...lead, workflowState: { ...(lead.workflowState || {}), stage_data: stageData } }
          : lead));
      })
      .catch((error: any) => {
        console.error('Lead workflow save crashed:', error);
        toast.error('Could not save changes. Please try again.');
      });
    return saveOperation;
  };

  const validateStage = (stageId: number) => {
    const stage = STAGES.find(s => s.id === stageId);
    if (!stage) return false;
    const completedTasks = localWorkflowState?.[`stage${stageId}_checklist`] || [];
    return stage.tasks.every(task => completedTasks.includes(task));
  };

  const validateStagePrerequisites = (stageId: number, excludedTask: string) => {
    const stage = STAGES.find(s => s.id === stageId);
    if (!stage) return false;
    const source = workflowStateRef.current || localWorkflowState;
    const completedTasks = source?.[`stage${stageId}_checklist`] || [];
    return stage.tasks.filter(task => task !== excludedTask).every(task => completedTasks.includes(task));
  };

  const handleStageJump = async (stage: number) => {
    if (!selectedLead) return;

    const targetStage = STAGES.find(s => s.id === stage);
    if (!targetStage) {
      toast.error('That workflow stage is unavailable.');
      return;
    }

    if (!canAccessStage(stage)) {
      toast.error(customStageAccess ? 'You do not have access to that stage.' : 'You can only access Stages 3, 4 and 5.');
      return;
    }

    // The lead currently sits in a stage this user cannot write (e.g. the in-house doctor's Stage 4/5).
    // Switch the view only and never move the lead. Stages the user can write that the lead has already
    // reached (e.g. Stages 1-3 for a BDM) stay editable; stages the lead has not reached yet stay view-only.
    // Stages the user has no write access to are read-only through canWriteStage().
    const leadOwnStage = Number(selectedLead.workflowStage) || 1;
    // Stage 5 belongs to the in-house doctor, but once its checklist is complete the lead moves on to
    // Stage 6 (BDM Pipeline). The assigned BDM may take the lead over at that point, so it never gets
    // stuck in Stage 5 with nobody able to move it.
    const bdmTakesOverFromStage5 =
      isBdmUser && !activeLeadLocked && leadOwnStage === 5 && stage === 6 && validateStage(5);
    if (!canWriteStage(leadOwnStage) && !bdmTakesOverFromStage5) {
      setActiveWorkflowStage(stage);
      setIsViewOnlyStage(stage > leadOwnStage);
      return;
    }

    // Moving a lead out of a stage needs write access to the stage it is currently in.
    if (!bdmTakesOverFromStage5 && blockReadOnlyWrite(activeWorkflowStage)) return;
    setIsViewOnlyStage(false);

    // Allow jumping to Stage 9 (Lost / Dropped) from anywhere without validation
    const validateFromStage = bdmTakesOverFromStage5 ? leadOwnStage : activeWorkflowStage;
    if (stage > validateFromStage && stage !== 9) {
      for (let i = validateFromStage; i < stage; i++) {
        if (!validateStage(i)) {
          toast.error(`Please complete all checklist items for Stage ${i} before progressing.`);
          return;
        }
      }
    }

    setIsUpdatingWorkflow(true);
    if (stage === 9 && activeWorkflowStage !== 9) {
      await persistWorkflowPatch({
        dropped_from_stage: activeWorkflowStage,
        dropped_at: new Date().toISOString(),
        resume_stage: activeWorkflowStage,
      });
    }
    const { error } = await updateLeadWorkflow(selectedLead.id, stage, targetStage?.statusMapping);
    if (error) {
      toast.error('Failed to update workflow stage');
    } else {
      setActiveWorkflowStage(stage);
      setIsViewOnlyStage(false);
      toast.success(stage === 9 ? 'Lead Dropped & Archived' : `Entered Stage: ${targetStage?.name}`);
      
      // Log Activity
      await logAdminActivity(
        stage === 9 ? 'Lead Dropped' : `Moved to Stage ${stage}: ${targetStage?.name}`,
        'Patient Lead',
        selectedLead.id,
        { stage, status: targetStage?.statusMapping }
      );
      loadActivityLogs(selectedLead.id);
      loadLeads();
    }
    setIsUpdatingWorkflow(false);
  };

  const handleRestoreLead = async (leadToRestore?: Lead) => {
    if (denyIfLeadLocked(leadToRestore?.id)) return;
    const targetLead = leadToRestore || selectedLead;
    if (!targetLead) return;
    if (blockReadOnlyWrite(9)) return;

    setIsUpdatingWorkflow(true);
    const rawSavedState = targetLead.id === selectedLead?.id
      ? (workflowStateRef.current || localWorkflowState)
      : targetLead.workflowState;
    const savedState = rawSavedState?.stage_data && typeof rawSavedState.stage_data === 'object'
      ? Object.values(rawSavedState.stage_data).reduce((result: Record<string, any>, stage: any) => ({ ...result, ...(stage?.data || {}) }), {})
      : (rawSavedState && typeof rawSavedState === 'object' ? rawSavedState : {});
    const resumeStage = Number(savedState.resume_stage || savedState.dropped_from_stage || 1);
    const validResumeStage = STAGES.some(stage => stage.id === resumeStage && stage.id !== 9) ? resumeStage : 1;
    const resumeStatus = STAGES.find(stage => stage.id === validResumeStage)?.statusMapping || LeadStatus.NEW;
    const { error } = await updateLeadWorkflow(targetLead.id, validResumeStage, resumeStatus);
    
    if (error) {
      toast.error('Failed to restore lead');
    } else {
      toast.success('Lead restored to active pipeline');
      
      // Log Activity
      await logAdminActivity(
        'Lead Restored to Pipeline',
        'Patient Lead',
        targetLead.id,
        { restored_to: `Stage ${validResumeStage}` }
      );
      loadActivityLogs(targetLead.id);
      
      if (selectedLead && targetLead.id === selectedLead.id) {
        setActiveWorkflowStage(validResumeStage);
        await persistWorkflowPatch({ archived_at: null, resume_stage: null, dropped_at: null });
      }
      loadLeads();
    }
    setIsUpdatingWorkflow(false);
  };

  const handleProgressStage = async () => {
    if (!selectedLead || activeWorkflowStage >= 9) return;
    await handleStageJump(activeWorkflowStage + 1);
  };

  const handlePreviousStage = async () => {
    if (!selectedLead || activeWorkflowStage <= 1 || isUpdatingWorkflow) return;
    await handleStageJump(activeWorkflowStage - 1);
  };

  // ── Stage 1: Duplicate Lead Detection ──
  // Flags other leads that share the same email or phone number, so the
  // BDM/team can avoid creating the same patient multiple times.
  const findDuplicateLeads = (lead: Lead | null) => {
    if (!lead) return [];
    const normalizedEmail = lead.email?.trim().toLowerCase();
    const normalizedPhone = lead.phone?.replace(/\D/g, '');
    return leads.filter(l => {
      if (l.id === lead.id) return false;
      const emailMatch = !!normalizedEmail && l.email?.trim().toLowerCase() === normalizedEmail;
      const phoneMatch = !!normalizedPhone && normalizedPhone.length > 5 && l.phone?.replace(/\D/g, '') === normalizedPhone;
      return emailMatch || phoneMatch;
    });
  };

  const handleConfirmDuplicateCheck = async () => {
    if (!selectedLead || !localWorkflowState) return;
    const duplicateResult = findDuplicateLeads(selectedLead).length > 0 ? 'Duplicate' : 'Not Duplicate';
    await handleUpdateSummary('duplicate_check_done', true);
    await handleUpdateSummary('duplicate_result', duplicateResult);
    if (!localWorkflowState?.stage1_checklist?.includes('Check Duplicate Lead')) {
      toggleWorkflowTask(1, 'Check Duplicate Lead');
    }
    toast.success('Duplicate check reviewed');
  };

  // ── Stage 1: Identify Priority ──
  const handleUpdateUrgency = async (value: string) => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    if (blockReadOnlyWrite(activeWorkflowStage)) return;
    const { error } = await updatePatientEnquiry(selectedLead.id, { urgency: value });
    if (error) {
      toast.error('Failed to update priority');
      return;
    }
    toast.success(`Priority set to ${value}`);
    if (!localWorkflowState?.stage1_checklist?.includes('Identify Priority')) {
      toggleWorkflowTask(1, 'Identify Priority');
    }
    await logAdminActivity(
      `Priority Identified: ${value}`,
      'Patient Lead',
      selectedLead.id,
      { priority: value }
    );
    loadActivityLogs(selectedLead.id);
    loadLeads();
  };

  // ── Stage 1: Contact Patient / Send Welcome Communication ──
  const markStage1Contacted = () => {
    if (!localWorkflowState?.stage1_checklist?.includes('Contact Patient / Send Welcome Communication')) {
      toggleWorkflowTask(1, 'Contact Patient / Send Welcome Communication');
    }
  };

  const initiateWhatsApp = async (lead: Lead) => {
    const rawNumber = lead.whatsappNumber || lead.phone;
    if (!rawNumber) {
      toast.error('No WhatsApp or phone number on record for this lead.');
      return;
    }
    const digits = rawNumber.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`Hi ${lead.name}, thank you for your enquiry with WaruWenJo Medical Tourism. We'd love to help with your ${lead.treatmentInterest || 'treatment'} journey.`);
    window.open(`https://wa.me/${digits}?text=${message}`, '_blank');

    await logAdminActivity(
      'WhatsApp Conversation Initiated',
      'Patient Lead',
      lead.id,
      { number: rawNumber }
    );
    loadActivityLogs(lead.id);
    markStage1Contacted();
  };

  const initiateCall = async (lead: Lead) => {
    if (!lead.phone) {
      toast.error('No phone number on record for this lead.');
      return;
    }
    window.open(`tel:${lead.phone}`, '_self');

    await logAdminActivity(
      'Patient Contacted by Phone',
      'Patient Lead',
      lead.id,
      { phone: lead.phone }
    );
    loadActivityLogs(lead.id);
    markStage1Contacted();
  };

  // ── Stage 1: Decide Whether Lead Is Genuine ──
  const markLeadGenuine = async () => {
    if (!selectedLead) return;
    await handleUpdateSummary('lead_genuine_decision', 'genuine');
    if (!localWorkflowState?.stage1_checklist?.includes('Decide Whether Lead Is Genuine')) {
      toggleWorkflowTask(1, 'Decide Whether Lead Is Genuine');
    }
    await logAdminActivity(
      'Lead Reviewed & Marked Genuine',
      'Patient Lead',
      selectedLead.id,
      {}
    );
    loadActivityLogs(selectedLead.id);
    toast.success('Lead marked as genuine');
  };

  const confirmNotGenuine = async () => {
    if (!selectedLead) return;
    if (!spamReason) {
      toast.error('Please select a reason before dropping this lead.');
      return;
    }
    await handleUpdateSummary('lead_genuine_decision', 'not_genuine');
    await handleUpdateSummary('spam_reason', spamReason);
    if (!localWorkflowState?.stage1_checklist?.includes('Decide Whether Lead Is Genuine')) {
      toggleWorkflowTask(1, 'Decide Whether Lead Is Genuine');
    }
    await logAdminActivity(
      'Lead Marked Not Genuine / Spam',
      'Patient Lead',
      selectedLead.id,
      { reason: spamReason }
    );
    loadActivityLogs(selectedLead.id);
    setShowSpamReasonPicker(false);
    // Not genuine / spam leads move directly to Stage 9 - Lost/Dropped
    handleStageJump(9);
  };

  const saveStage3Task = async (task: string, extraState: Record<string, any> = {}) => {
    if (!selectedLead || !(workflowStateRef.current || localWorkflowState)) return { error: null };
    // Checklist items are ticked manually by the user (toggleWorkflowTask). Only save the data here.
    const { error } = await persistWorkflowPatch({ ...extraState });
    if (error) toast.error('Stage 3 progress could not be synced');
    return { error };
  };

  const handleMarkProcessExplained = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    const explainedAt = new Date().toISOString();
    const emailSent = Boolean(workflowStateRef.current?.document_request_sent_at);
    const result = emailSent
      ? await saveStage3Task('Explain Patient Process & Send Medical Document Request Email', { process_explained_at: explainedAt })
      : await persistWorkflowPatch({ process_explained_at: explainedAt });
    if (result?.error) {
      console.error('Stage 3 process explanation save failed:', result.error);
      toast.error(result.error.message || 'Process explanation could not be saved');
      return;
    }
    toast.success('Patient process marked as explained');
  };

  const saveStage4Task = async (task: string, extraState: Record<string, any> = {}) => {
    if (!selectedLead || !localWorkflowState) return;
    // Checklist items are ticked manually by the user (toggleWorkflowTask). Only save the data here.
    const { error } = await persistWorkflowPatch({ ...extraState });
    if (error) toast.error('Stage 4 progress could not be synced');
  };

  const saveStage5Task = async (task: string, extraState: Record<string, any> = {}) => {
    if (!selectedLead || !localWorkflowState) return;
    // Checklist items are ticked manually by the user (toggleWorkflowTask). Only save the data here.
    const { error } = await persistWorkflowPatch({ ...extraState });
    if (error) toast.error('Stage 5 progress could not be synced');
  };

  const saveStage6Task = async (task: string, extraState: Record<string, any> = {}) => {
    if (!selectedLead || !localWorkflowState) return;
    // Checklist items are ticked manually by the user (toggleWorkflowTask). Only save the data here.
    const { error } = await persistWorkflowPatch({ ...extraState });
    if (error) toast.error('Stage 6 progress could not be synced');
  };

  const saveStage7Task = async (task: string, extraState: Record<string, any> = {}) => {
    if (!selectedLead || !localWorkflowState) return;
    // Checklist items are ticked manually by the user (toggleWorkflowTask). Only save the data here.
    const { error } = await persistWorkflowPatch({ ...extraState });
    if (error) toast.error('Stage 7 progress could not be synced');
  };

  const handleGenerateAdvancePaymentLink = async () => {
    if (denyIfLeadLocked()) return;
    if (!vilSubmission) {
      toast.error('The patient must submit the VIL medical visa form before the advance payment link is generated.');
      return;
    }
    if (!selectedLead) return;
    const link = `https://waruwenjo.com/pay/${selectedLead.id}?ref=advance`;
    const reference = `WJO-PAY-${Math.floor(Math.random() * 100000)}`;
    await saveStage8Task('Generate Payment Link', { payment_link: link, payment_reference: reference, payment_status: 'Pending' });
    try { await navigator.clipboard.writeText(link); } catch { /* Clipboard access is optional. */ }
    toast.success('Payment link generated and copied to clipboard');
  };

  const handleVerifyAdvancePayment = async () => {
    if (denyIfLeadLocked()) return;
    const state = workflowStateRef.current || localWorkflowState;
    if (!state?.payment_reference || !state?.payment_link) {
      toast.error('Generate and provide the payment link before verifying payment.');
      return;
    }
    await saveStage8Task('Verify Advance Payment', {
      advance_payment_verified: true,
      payment_status: 'Verified',
      payment_date_time: new Date().toISOString(),
    });
    toast.success('Advance payment verified');
  };

  const handleCompleteSpecialistCall = async (notes: string) => {
    if (denyIfLeadLocked()) return;
    if (!notes.trim()) {
      toast.error('Record the specialist discussion notes first.');
      return;
    }
    await saveStage7Task('Specialist Doctor Call', {
      specialist_call_completed_at: new Date().toISOString(),
      specialist_call_notes: notes.trim(),
    });
    toast.success('Specialist doctor call recorded');
  };

  const handleRecordMOM = async () => {
    if (denyIfLeadLocked()) return;
    const state = workflowStateRef.current || localWorkflowState;
    const requiredMomFields = ['mom_date_time', 'mom_participants', 'mom_discussion_points', 'mom_specialist_observations', 'mom_patient_questions', 'mom_decisions', 'mom_next_steps', 'mom_instructions'];
    if (requiredMomFields.some(field => !String(state?.[field] || '').trim())) {
      toast.error('Complete every MOM field before recording the minutes.');
      return;
    }
    if (!selectedLead) return;
    try {
      const { jsPDF } = await import('jspdf');
      const momDoc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = momDoc.internal.pageSize.getWidth();
      const pageHeight = momDoc.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let y = 0;

      // Branded header, repeated on every page
      const drawHeader = () => {
        momDoc.setFillColor(13, 122, 110);
        momDoc.rect(0, 0, pageWidth, 26, 'F');
        momDoc.setTextColor(255, 255, 255);
        momDoc.setFont('helvetica', 'bold');
        momDoc.setFontSize(16);
        momDoc.text('WaruWenJo', margin, 12);
        momDoc.setFont('helvetica', 'normal');
        momDoc.setFontSize(9);
        momDoc.text('Medical Tourism Coordination', margin, 18);
        momDoc.text(`Lead Ref: ${getLeadCode(selectedLead)}`, pageWidth - margin, 12, { align: 'right' });
        momDoc.setTextColor(30, 41, 59);
        y = 36;
      };

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 22) {
          momDoc.addPage();
          drawHeader();
        }
      };

      drawHeader();

      // Title
      momDoc.setFont('helvetica', 'bold');
      momDoc.setFontSize(18);
      momDoc.text('Minutes of Meeting (MOM)', margin, y);
      y += 6;
      momDoc.setDrawColor(13, 122, 110);
      momDoc.setLineWidth(0.6);
      momDoc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Meeting details
      const details: [string, string][] = [
        ['Patient', selectedLead.name || '-'],
        ['Lead Reference', getLeadCode(selectedLead)],
        ['Date Recorded', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
      ];
      details.forEach(([label, value]) => {
        momDoc.setFont('helvetica', 'bold');
        momDoc.setFontSize(10);
        momDoc.text(`${label}:`, margin, y);
        momDoc.setFont('helvetica', 'normal');
        momDoc.text(momDoc.splitTextToSize(value, contentWidth - 45), margin + 42, y);
        y += 7;
      });
      y += 2;
      momDoc.setDrawColor(203, 213, 225);
      momDoc.setLineWidth(0.3);
      momDoc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Numbered agenda sections
      MOM_FIELDS.forEach(([field, label], index) => {
        const value = field === 'mom_date_time' ? formatMomDateTime(state?.[field] || '-') : String(state?.[field] || '-');
        const lines = momDoc.splitTextToSize(value, contentWidth - 4);
        ensureSpace(14);
        momDoc.setFont('helvetica', 'bold');
        momDoc.setFontSize(11);
        momDoc.setTextColor(13, 122, 110);
        momDoc.text(`${index + 1}. ${label}`, margin, y);
        y += 6;
        momDoc.setFont('helvetica', 'normal');
        momDoc.setFontSize(10);
        momDoc.setTextColor(30, 41, 59);
        lines.forEach((line: string) => {
          ensureSpace(6);
          momDoc.text(line, margin + 4, y);
          y += 5;
        });
        y += 6;
      });

      // Signature block
      ensureSpace(50);
      y += 10;
      momDoc.setDrawColor(148, 163, 184);
      momDoc.setLineWidth(0.3);
      momDoc.line(margin, y + 14, margin + 70, y + 14);
      momDoc.line(pageWidth - margin - 70, y + 14, pageWidth - margin, y + 14);
      momDoc.setFont('helvetica', 'bold');
      momDoc.setFontSize(9);
      momDoc.setTextColor(30, 41, 59);
      momDoc.text('Prepared by (Name & Signature)', margin, y + 19);
      momDoc.text('Specialist / Doctor (Name & Signature)', pageWidth - margin - 70, y + 19);

      // Footer with page numbers on every page
      const pageCount = momDoc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        momDoc.setPage(i);
        momDoc.setFont('helvetica', 'normal');
        momDoc.setFontSize(8);
        momDoc.setTextColor(100, 116, 139);
        momDoc.text('Confidential: for internal and patient use only', margin, pageHeight - 10);
        momDoc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

      const momPath = `${selectedLead.id}/mom-${Date.now()}.pdf`;
      const { error: momUploadError } = await supabase.storage
        .from('mom-reports')
        .upload(momPath, momDoc.output('blob'), { contentType: 'application/pdf', upsert: false });
      if (momUploadError) throw momUploadError;
      const { data: momPublic } = supabase.storage.from('mom-reports').getPublicUrl(momPath);

      await saveStage7Task('Record MOM', {
        mom_recorded_at: new Date().toISOString(),
        mom_pdf_path: momPath,
        mom_pdf_url: momPublic.publicUrl,
      });
      toast.success('MOM recorded and PDF saved');
    } catch (err: any) {
      console.error('MOM PDF upload failed:', err);
      toast.error(`Failed to save MOM PDF: ${err?.message || 'unknown error'}`);
    }
  };

  const handleCompleteBdmCall = async (notes: string) => {
    if (denyIfLeadLocked()) return;
    if (!notes.trim()) {
      toast.error('Record the BDM patient-call notes first.');
      return;
    }
    await saveStage7Task('BDM Calls Patient', {
      bdm_call_completed_at: new Date().toISOString(),
      bdm_call_notes: notes.trim(),
    });
    toast.success('BDM patient call recorded');
  };

  const handleConfirmQuotationAgreement = async (confirmed: boolean) => {
    if (denyIfLeadLocked()) return;
    if (confirmed) {
      await saveStage7Task('Confirm Quotation Agreement', { quotation_agreement_confirmed: true });
      toast.success('Quotation agreement confirmed');
    } else {
      await persistWorkflowPatch({ quotation_agreement_confirmed: false });
    }
  };

  const handleConfirmClinicalProcessAgreement = async (confirmed: boolean) => {
    if (denyIfLeadLocked()) return;
    if (confirmed) {
      await saveStage7Task('Confirm Clinical Process Agreement', { clinical_process_agreement_confirmed: true });
      toast.success('Clinical process agreement confirmed');
    } else {
      await persistWorkflowPatch({ clinical_process_agreement_confirmed: false });
    }
  };

  const handleRecordStage7Decision = async (decision: 'Agreed' | 'Disagreed') => {
    const state = workflowStateRef.current || localWorkflowState;
    if (decision === 'Disagreed' && !String(state?.stage7_disagreement_reason || '').trim()) {
      toast.error('Record the disagreement reason first.');
      return;
    }
    await saveStage7Task('Record Patient Decision', { stage7_patient_decision: decision });
    toast.success(`Patient decision recorded: ${decision}`);
  };

  const handleRequestPatientToProceed = async () => {
    if (denyIfLeadLocked()) return;
    await saveStage7Task('Request Patient to Proceed', {
      request_to_proceed_confirmed: true,
      request_to_proceed_at: new Date().toISOString(),
    });
    toast.success('Patient requested to proceed');
  };

  const handleProvidePaymentLink = async (link: string) => {
    if (denyIfLeadLocked()) return;
    if (isSendingPaymentLink || !selectedLead) return;
    const paymentLink = link.trim();
    if (!paymentLink) {
      toast.error('Enter the payment link before providing it to the patient.');
      return;
    }
    setIsSendingPaymentLink(true);
    try {
      const currentState = workflowStateRef.current || localWorkflowState || {};
      const reference = currentState.payment_reference || `WJO-PAY-${Math.floor(Math.random() * 100000)}`;
      const amount = currentState.payment_amount;
      const result = await sendLeadTemplateEmail('advance_payment', {
        patient_name: escapeEmailHtml(selectedLead.name || 'Patient'),
        payment_link: escapeEmailHtml(paymentLink),
        payment_reference: escapeEmailHtml(reference),
        amount_block: amount
          ? `<p><strong>Advance amount:</strong> ${escapeEmailHtml(String(amount))}</p>`
          : '',
      });
      if (!result.success) return;
      await saveStage8Task('Provide Payment Link', {
        payment_link: paymentLink,
        payment_reference: reference,
        payment_link_provided_at: result.sentAt,
        payment_link_email_sent_at: result.sentAt,
      });
      toast.success('Payment link emailed to patient');
    } catch (error: any) {
      toast.error(error?.message || 'Payment link email failed');
    } finally {
      setIsSendingPaymentLink(false);
    }
  };

  const saveStage8Task = async (task: string, extraState: Record<string, any> = {}) => {
    if (!selectedLead || !localWorkflowState) return;
    // Checklist items are ticked manually by the user (toggleWorkflowTask). Only save the data here.
    const result = await persistWorkflowPatch({ ...extraState });
    if (result?.error) toast.error('Stage 8 progress could not be synced');
    return result;
  };

  const [isCreatingPatientAccount, setIsCreatingPatientAccount] = useState(false);
  const handlePreparePatientHandover = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) {
      toast.error('No patient enquiry selected.');
      return;
    }
    if (isCreatingPatientAccount) return;

    setIsCreatingPatientAccount(true);
    const handoverPreparedAt = new Date().toISOString();

    // Always leave the status in a final state (created or failed). Never leave it on "processing".
    const markAccountFailed = async (message: string) => {
      await saveStage8Task('Prepare Complete Patient Handover', {
        patient_account_status: 'failed',
        patient_account_error: message,
      });
      toast.error(message);
    };

    try {
      /*
       * Do not pass name/email/phone/country/age/gender from the UI.
       * The account service reads those values from patient_enquiries.
       */
      const saveResult = await saveStage8Task('Prepare Complete Patient Handover', {
        handover_prepared_at: handoverPreparedAt,
        handover_status: 'Prepared',
        patient_account_status: 'processing',
        patient_account_error: null,
      });
      if (saveResult?.error) return; // saveStage8Task already shows the sync error.

      const { data: accountData, error: accountError } = await withTimeout(
        createPatientAccountFromEnquiry(selectedLead.id),
        30000,
        'Patient account request timed out after 30 seconds. Check your connection and press Create Patient Account again.',
      );

      if (accountError || !accountData?.user_id) {
        const reason =
          accountError?.message ||
          accountData?.error ||
          'Patient account creation failed (no user id returned).';
        console.error('Patient account creation failed:', accountError ?? accountData);
        await markAccountFailed(reason);
        return;
      }

      // Account successfully created or linked.
      await saveStage8Task('Create Patient Account', {
        patient_user_id: accountData.user_id,
        patient_profile_id: accountData.patient_id || null,
        patient_account_created_at: new Date().toISOString(),
        patient_account_status: accountData.account_status || 'created',
        patient_invitation_sent_at: accountData.invitation_sent_at || null,
        patient_account_error: null,
      });

      toast.success(
        accountData.account_status === 'linked_existing'
          ? 'Existing WaruWenJo patient account linked successfully'
          : 'Patient account created using the WaruWenJo signup backend'
      );

      // Best-effort: the patient account itself succeeded above even if this didn't.
      if (accountData.warning) {
        toast.error(accountData.warning);
      }
    } catch (error: any) {
      console.error('Patient account creation crashed:', error);
      await markAccountFailed(error?.message || 'Unexpected error while creating the patient account.');
    } finally {
      setIsCreatingPatientAccount(false);
    }
  };

  const [isRefreshingAccountStatus, setIsRefreshingAccountStatus] = useState(false);
  const handleRefreshAccountStatus = async () => {
    if (!selectedLead) return;
    setIsRefreshingAccountStatus(true);
    const { data, error } = await fetchLeads();
    setIsRefreshingAccountStatus(false);
    if (error || !data) {
      toast.error('Could not refresh account status.');
      return;
    }
    const refreshed = (data as any[]).find((item) => String(item.id) === selectedLead.id);
    if (!refreshed) return;
    const refreshedState = typeof refreshed.workflow_state === 'string'
      ? (() => { try { return JSON.parse(refreshed.workflow_state); } catch { return {}; } })()
      : (refreshed.workflow_state || {});
    const stage8Data = refreshedState?.stage_data?.stage8?.data || {};
    const userId = refreshed.user_id || stage8Data.patient_user_id;
    if (userId) {
      const nextState = {
        ...(workflowStateRef.current || localWorkflowState || {}),
        ...stage8Data,
        patient_user_id: userId,
        patient_patient_id: stage8Data.patient_patient_id || userId,
        patient_account_status: stage8Data.patient_account_status || 'linked_existing',
      };
      workflowStateRef.current = nextState;
      setLocalWorkflowState(nextState);
      toast.success(nextState.patient_account_status === 'created'
        ? 'Patient account created and linked successfully'
        : 'Existing patient account linked successfully');
    } else {
      toast('Patient account is not linked yet.');
    }
  };

  const handleInitiateHandover = async () => {
    if (denyIfLeadLocked()) return;
    const state = workflowStateRef.current || localWorkflowState;
    if (!state?.patient_user_id) {
      toast.error('Create or link the patient account before sending the handover.');
      return;
    }
    await saveStage8Task('Handover Patient from BDM to CDM/WaruBuddy', {
      handover_initiated_at: new Date().toISOString(),
      handover_status: 'Sent to CDM/WaruBuddy',
    });
    toast.success('Patient handover sent to CDM/WaruBuddy');
  };

  const handleAcceptHandover = async () => {
    if (denyIfLeadLocked()) return;
    const state = workflowStateRef.current || localWorkflowState;
    if (!state?.handover_initiated_at) {
      toast.error('Send the handover to CDM/WaruBuddy before accepting it.');
      return;
    }
    const now = new Date().toISOString();
    await saveStage8Task('Handover to CDM/WaruBuddy', {
      handover_accepted_at: now,
      case_ownership_confirmed_at: now,
      handover_status: 'Accepted',
    });
    toast.success('CDM/WaruBuddy accepted the handover and ownership is confirmed');
  };

  const handleCompleteStage8 = async () => {
    if (!validateStagePrerequisites(8, 'Complete Stage 8')) {
      toast.error('Complete every Stage 8 payment, conversion, and handover task first.');
      return;
    }
    await saveStage8Task('Complete Stage 8', { stage8_completed_at: new Date().toISOString() });
    toast.success('Stage 8 completed');
  };

  // BDM ownership of leads
  const [bdmNameLookup, setBdmNameLookup] = useState<Record<string, string>>({});
  useEffect(() => {
    const id = selectedLead?.assignedBdmId;
    if (!id || bdmUsers.some((u) => u.id === id) || bdmNameLookup[id]) return;
    supabase
      .from('crm_user_profiles')
      .select('full_name')
      .eq('user_id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setBdmNameLookup((prev) => ({ ...prev, [id]: data.full_name as string }));
      });
  }, [selectedLead?.assignedBdmId, bdmUsers]);
  const bdmNameFor = (id?: string | null) => {
    if (!id) return 'Unassigned';
    return bdmUsers.find((u) => u.id === id)?.full_name || bdmNameLookup[id] || 'Assigned BDM';
  };
  const bdmIdFor = (lead: any): string | null =>
    leads.find((l) => l.id === lead.id)?.assignedBdmId ?? lead.assignedBdmId ?? null;

  const handleAssignBdm = async (leadId: string, bdmId: string | null) => {
    if (denyIfLeadLocked(leadId)) return;
    const { error } = await updatePatientEnquiry(leadId, { assigned_bdm_id: bdmId });
    if (error) {
      toast.error(`Could not assign BDM: ${error.message}`);
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, assignedBdmId: bdmId } : l)));
    if (selectedLead?.id === leadId) {
      const bdmName = bdmId ? (bdmUsers.find((u) => u.id === bdmId)?.full_name || '') : '';
      await persistWorkflowPatch({ assigned_bdm_name: bdmName });
    }
    await logAdminActivity('BDM Assigned', 'Patient Lead', leadId, { bdm_id: bdmId, bdm_name: bdmNameFor(bdmId) });
    loadActivityLogs(leadId);
    toast.success(bdmId ? `Assigned to ${bdmNameFor(bdmId)}` : 'BDM unassigned');
  };

  // ── Sends a lead email from the shared template, then logs it ──
  type LeadEmailResult = { success: true; sentAt: string } | { success: false };
  const sendLeadTemplateEmail = async (kind: LeadEmailKind, variables: Record<string, string>): Promise<LeadEmailResult> => {
    if (!selectedLead?.email) {
      toast.error('No patient email is saved for this lead.');
      return { success: false };
    }
    const email = fillLeadEmailTemplate(kind, variables);
    const { data: masterTemplate } = await fetchMasterTemplate();
    const html = buildWaruWenJoEmailFull({
      emailTitle: email.title,
      emailSubtitle: email.subtitle,
      emailContent: email.content,
      masterTemplate: masterTemplate || undefined,
    });
    const result = await sendCrmEmail(selectedLead.email, email.subject, html, selectedLead.name || 'Patient');
    if (!result?.success) {
      toast.error(result?.error || 'Email could not be sent');
      return { success: false };
    }
    const sentAt = new Date().toISOString();
    await logAdminActivity(LEAD_EMAIL_LOG_LABELS[kind], 'Patient Lead', selectedLead.id, { email: selectedLead.email, sent_at: sentAt });
    loadActivityLogs(selectedLead.id);
    return { success: true, sentAt };
  };

  // ── In-house doctor ownership (assigned from the lead list or lead header) ──
  const inHouseIdFor = (lead: any): string => {
    const value = leads.find((l) => l.id === lead.id)?.assignedTo ?? lead.assignedTo ?? '';
    return inHouseDoctors.some((d) => d.userId === value) ? value : '';
  };
  const inHouseNameFor = (lead: any) =>
    inHouseDoctors.find((d) => d.userId === inHouseIdFor(lead))?.name || 'Unassigned';

  const handleAssignInHouseDoctor = async (leadId: string, doctorUserId: string | null) => {
    if (denyIfLeadLocked(leadId)) return;
    const doctorName = inHouseDoctors.find((d) => d.userId === doctorUserId)?.name || '';
    const { error } = await updatePatientEnquiry(leadId, { assigned_to: doctorUserId });
    if (error) {
      toast.error(`Could not assign in-house doctor: ${error.message}`);
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, assignedTo: doctorUserId ?? undefined } : l)));
    if (selectedLead?.id === leadId) {
      setSelectedInHouseDoctor(doctorName);
      await persistWorkflowPatch({ assigned_doctor_name: doctorName });
    }
    await logAdminActivity('In-House Doctor Assigned', 'Patient Lead', leadId, { doctor_id: doctorUserId, doctor_name: doctorName || null });
    loadActivityLogs(leadId);
    toast.success(doctorName ? `Lead assigned to ${doctorName}` : 'In-house doctor unassigned');
  };

  // Patient's quotation choice lives in patient_enquiries columns. It is kept in its own state map
  // so refreshing it never resets unsaved edits in the stage form.
  type QuotationChoiceInfo = { quotationChoice: any; selectedQuotationNo: number | null; selectedQuotationAt: string | null };
  const [quotationChoices, setQuotationChoices] = useState<Record<string, QuotationChoiceInfo>>({});

  const choiceFor = (lead: any): QuotationChoiceInfo =>
    quotationChoices[lead.id] ?? {
      quotationChoice: lead.quotationChoice ?? null,
      selectedQuotationNo: lead.selectedQuotationNo ?? null,
      selectedQuotationAt: lead.selectedQuotationAt ?? null,
    };

  const refreshQuotationChoice = async (leadId?: string) => {
    const id = leadId || selectedLead?.id;
    if (!id) return;
    const { data, error } = await supabase
      .from('patient_enquiries')
      .select('quotation_choice, selected_quotation_no, selected_quotation_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      toast.error('Could not check the patient choice.');
      return;
    }
    const row: any = data;
    setQuotationChoices((prev) => ({
      ...prev,
      [id]: {
        quotationChoice: row.quotation_choice ?? null,
        selectedQuotationNo: row.selected_quotation_no ?? null,
        selectedQuotationAt: row.selected_quotation_at ?? null,
      },
    }));
  };

  // Staff fallback: patient told us their choice by phone / WhatsApp
  const handleSelectQuotation = async (quotation: { no: number; id: string; label: string; total: number; currency: string }) => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    const selectedAt = new Date().toISOString();
    const { error } = await supabase
      .from('patient_enquiries')
      .update({ selected_quotation_no: quotation.no, selected_quotation_at: selectedAt } as any)
      .eq('id', selectedLead.id);
    if (error) {
      toast.error(`Could not record the choice: ${error.message}`);
      return;
    }
    await refreshQuotationChoice(selectedLead.id);
    await logAdminActivity('Patient Quotation Selected', 'Patient Lead', selectedLead.id, { quotation: quotation.label });
    loadActivityLogs(selectedLead.id);
    toast.success(`${quotation.label} recorded as the patient's choice`);
  };

  // Pick up the patient's choice whenever Stage 6 is opened
  useEffect(() => {
    if (selectedLead?.id && activeWorkflowStage === 6) refreshQuotationChoice(selectedLead.id);
  }, [selectedLead?.id, activeWorkflowStage]);

  const handleConfirmPatientInterest = async (interest: 'Agreed' | 'Disagreed') => {
    if (denyIfLeadLocked()) return;
    await saveStage6Task('Confirm Patient Interest Via Call', { patient_interest: interest });
    toast.success(`Patient interest recorded: ${interest}`);
  };

  const loadVilSubmission = async (leadId: string) => {
    const { data, error } = await supabase.from('patient_enquiries').select('vil_data').eq('id', leadId).maybeSingle();
    if (error) {
      console.error('[VIL] Could not load submission:', error);
      setVilLoadError(error.message || 'Could not load the VIL submission');
      setVilSubmission(null);
      return;
    }
    setVilLoadError('');
    setVilSubmission(data?.vil_data || null);
  };

  useEffect(() => {
    if (selectedLead?.id) loadVilSubmission(selectedLead.id);
    else setVilSubmission(null);
  }, [selectedLead?.id]);

  const openVilDocument = async (doc: any) => {
    if (doc?.bucket !== 'vil_docs') {
      if (doc?.file_url) window.open(doc.file_url, '_blank', 'noopener');
      return;
    }
    const { data, error } = await supabase.storage.from('vil_docs').createSignedUrl(doc.file_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || 'Could not open the VIL document');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const saveVisaFlag = async (task: string, patch: Record<string, any>) => {
    await saveStage7Task(task, patch);
  };

  const handleToggleVisaSent = async (checked: boolean) => {
    if (denyIfLeadLocked()) return;
    await saveVisaFlag('Send Visa Application', { visa_application_sent_at: checked ? new Date().toISOString() : null });
    if (selectedLead) loadActivityLogs(selectedLead.id);
  };

  const handleToggleVisaCreated = async (checked: boolean) => {
    if (denyIfLeadLocked()) return;
    await saveVisaFlag('Visa Application Created', {
      visa_application_created: checked,
      visa_application_created_at: checked ? new Date().toISOString() : null,
    });
  };

  const handleUploadVisaDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (denyIfLeadLocked()) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedLead) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Upload a PDF, JPG or PNG file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('The visa document must be 10 MB or smaller');
      return;
    }
    setIsUploadingVisa(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${selectedLead.id}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from('visa-applications')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;

      await saveVisaFlag('Upload Visa Document', {
        visa_document_path: path,
        visa_document_name: file.name,
        visa_document_uploaded_at: new Date().toISOString(),
      });
      await logAdminActivity('Visa Document Uploaded', 'Patient Lead', selectedLead.id, { file_name: file.name });
      loadActivityLogs(selectedLead.id);
      toast.success('Visa document uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Visa document upload failed');
    } finally {
      setIsUploadingVisa(false);
    }
  };

  const openVisaDocument = async () => {
    const path = localWorkflowState?.visa_document_path;
    if (!path) return;
    const { data, error } = await supabase.storage.from('visa-applications').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || 'Could not open the visa document');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const handleSendVilForm = async () => {
    if (denyIfLeadLocked()) return;
    if (isSendingVilForm || !selectedLead) return;
    setIsSendingVilForm(true);
    try {
      const formLink = buildPatientLink(`#/vil-form/${selectedLead.id}`);
      if (formLink.isLocal) {
        toast.error("The patient link points to localhost and will not open on the patient's device. Set VITE_PUBLIC_APP_URL in .env to your deployed CRM address, then restart the dev server.");
        return;
      }
      const result = await sendLeadTemplateEmail('vil_form', {
        patient_name: escapeEmailHtml(selectedLead.name || 'Patient'),
        vil_form_link: formLink.url,
      });
      if (!result.success) return;
      await persistWorkflowPatch({ vil_form_sent_at: result.sentAt });
      toast.success('VIL form email sent to patient');
    } catch (error: any) {
      toast.error(error?.message || 'VIL form email failed');
    } finally {
      setIsSendingVilForm(false);
    }
  };

  const handleSendDocumentRequest = async () => {
    if (denyIfLeadLocked()) return;
    if (isSendingDocumentRequest || !selectedLead) return;
    setIsSendingDocumentRequest(true);
    try {
      const uploadLink = buildPatientLink(`#/patient-documents/${selectedLead.id}`);
      if (uploadLink.isLocal) {
        toast.error("The patient link points to localhost and will not open on the patient's device. Set VITE_PUBLIC_APP_URL in .env to your deployed CRM address, then restart the dev server.");
        return;
      }
      const result = await sendLeadTemplateEmail('document_request', {
        patient_name: escapeEmailHtml(selectedLead.name || 'Patient'),
        treatment_name: escapeEmailHtml(selectedLead.treatmentInterest || 'medical enquiry'),
        upload_link: uploadLink.url,
      });
      if (!result.success) return;
      await persistWorkflowPatch({ document_request_sent_at: result.sentAt });
      toast.success('Document request email sent');
    } catch (error: any) {
      console.error('Stage 3 document request email failed:', error);
      toast.error(error?.message || 'Document request email failed');
    } finally {
      setIsSendingDocumentRequest(false);
    }
  };

  const saveStage2Task = async (task: string, extraState: Record<string, any> = {}) => {
    if (!selectedLead || !localWorkflowState) return;
    const checklist = localWorkflowState.stage2_checklist || [];
    const nextChecklist = checklist.includes(task) ? checklist : [...checklist, task];
    const { error } = await persistWorkflowPatch({ ...extraState, stage2_checklist: nextChecklist });
    if (error) toast.error('Stage 2 progress could not be synced');
  };

  const handleLogFirstCall = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    if (!callOutcomeDraft) {
      toast.error('Select a call outcome before saving the call.');
      return;
    }

    const now = new Date().toISOString();
    const currentCount = Number(localWorkflowState?.contact_attempt_count || 0);
    const nextState = {
      ...localWorkflowState,
      contact_attempt_count: currentCount + 1,
      last_attempt_at: now,
      first_contact_at: localWorkflowState?.first_contact_at || now,
      call_outcome: callOutcomeDraft,
      call_notes: callNotesDraft.trim(),
      callback_due_at: callOutcomeDraft === 'Requested Callback' ? (callbackDateDraft ? new Date(callbackDateDraft).toISOString() : '') : '',
      stage2_checklist: [
        ...(localWorkflowState.stage2_checklist || []).filter((task: string) => !['Log First Call', 'Record Call Outcome', 'Record Call Notes', 'Complete First Contact'].includes(task)),
        'Log First Call',
        'Record Call Outcome',
        ...(callNotesDraft.trim() ? ['Record Call Notes'] : []),
        ...(callOutcomeDraft !== 'Requested Callback' || callbackDateDraft ? ['Complete First Contact'] : []),
      ],
    };

    const { error } = await persistWorkflowPatch({
      contact_attempt_count: nextState.contact_attempt_count,
      last_attempt_at: nextState.last_attempt_at,
      first_contact_at: nextState.first_contact_at,
      call_outcome: nextState.call_outcome,
      call_notes: nextState.call_notes,
      callback_due_at: nextState.callback_due_at,
      stage2_checklist: nextState.stage2_checklist,
    });
    if (error) {
      toast.error('Could not save the call attempt.');
      return;
    }

    await logAdminActivity('Patient Call Attempt Logged', 'Patient Lead', selectedLead.id, {
      attempt: currentCount + 1,
      outcome: callOutcomeDraft,
      callback_due_at: nextState.callback_due_at || null,
    });
    loadActivityLogs(selectedLead.id);
    toast.success(`Call attempt ${currentCount + 1} recorded`);
  };

  // Saves only the raw call notes (no outcome needed) and ticks "Record Call Notes"
  const handleSaveRawCall = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    const notes = callNotesDraft.trim();
    if (!notes) {
      toast.error('Write the raw call notes first.');
      return;
    }
    const checklist = (localWorkflowState?.stage2_checklist || []).filter((task: string) => task !== 'Record Call Notes');
    const { error } = await persistWorkflowPatch({
      call_notes: notes,
      stage2_checklist: [...checklist, 'Record Call Notes'],
    });
    if (error) {
      toast.error('Could not save the raw call notes.');
      return;
    }
    toast.success('Raw call notes saved');
  };

  const handleScheduleCallback = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead || !callbackDateDraft) {
      toast.error('Choose a callback date and time first.');
      return;
    }
    const nextState = { callback_due_at: new Date(callbackDateDraft).toISOString(), call_outcome: 'Requested Callback' };
    await persistWorkflowPatch(nextState);
    await logAdminActivity('Callback Scheduled', 'Patient Lead', selectedLead.id, { callback_due_at: nextState.callback_due_at });
    loadActivityLogs(selectedLead.id);
    toast.success('Callback scheduled');
  };

  const handleGenerateCallSummary = async () => {
    if (!callNotesDraft.trim()) {
      toast.error('Add raw call notes before generating an AI summary.');
      return;
    }
    setIsGeneratingCallSummary(true);
    try {
      const summary = await generateCallSummary({
        patientName: selectedLead?.name || 'Patient',
        treatmentInterest: selectedLead?.treatmentInterest || '',
        outcome: callOutcomeDraft,
        rawNotes: callNotesDraft,
      });
      setAiSummaryDraft(summary);
      toast.success('AI summary generated — review and edit it before saving.');
    } catch (error) {
      toast.error('Unable to generate an AI summary.');
    } finally {
      setIsGeneratingCallSummary(false);
    }
  };

  const handleSaveCallSummary = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead || !aiSummaryDraft.trim()) {
      toast.error('There is no summary to save.');
      return;
    }
    await handleUpdateSummary('ai_call_summary', aiSummaryDraft.trim());
    toast.success('Call summary saved');
  };

  const toggleWorkflowTask = async (stageId: number, task: string) => {
    if (!selectedLead || !localWorkflowState) return;
    
    const key = `stage${stageId}_checklist`;
    const currentList = localWorkflowState[key] || [];
    const newList = currentList.includes(task) 
      ? currentList.filter((item: string) => item !== task)
      : [...currentList, task];
      
    const { error } = await persistWorkflowPatch({ [key]: newList });
    if (error) toast.error('Checklist sync failed');

    // Auto-progress logic for checklists if needed, but we rely on buttons for now
  };

  const handleUpdateSummary = async (field: string, value: any) => {
    if (denyIfLeadLocked()) return;
     if (!selectedLead || !localWorkflowState) return;
     await persistWorkflowPatch({ [field]: value });
  };

  // Stage 5: several hospitals and surgeons can be recommended. The first item is the primary
  // choice and keeps the single suggested_* fields in sync, so the later steps keep working.
  const getSuggestions = (kind: 'hospital' | 'surgeon'): Array<{ id: string; name: string }> => {
    const state: any = localWorkflowState || {};
    const list = kind === 'hospital' ? state.suggested_hospitals : state.suggested_surgeons;
    if (Array.isArray(list)) return list;
    // Records saved before multi-select only have the single fields
    const name = kind === 'hospital' ? state.suggested_hospital : state.suggested_surgeon;
    const id = kind === 'hospital' ? state.suggested_hospital_id : state.suggested_surgeon_id;
    return name ? [{ id: id || '', name }] : [];
  };
  const hospitalSuggestions = getSuggestions('hospital');
  const surgeonSuggestions = getSuggestions('surgeon');

  const saveSuggestions = async (kind: 'hospital' | 'surgeon', items: Array<{ id: string; name: string }>) => {
    const primary = items[0];
    const patch = kind === 'hospital'
      ? { suggested_hospitals: items, suggested_hospital: primary?.name || '', suggested_hospital_id: primary?.id || '' }
      : { suggested_surgeons: items, suggested_surgeon: primary?.name || '', suggested_surgeon_id: primary?.id || '' };
    const otherSelected = kind === 'hospital' ? surgeonSuggestions.length > 0 : hospitalSuggestions.length > 0;
    const { error } = await persistWorkflowPatch(patch);
    if (error) toast.error('Stage 5 recommendations could not be synced');
    if (otherSelected && primary) {
      await saveStage5Task('Suggest Hospitals & Surgeons/Specialists', patch);
    }
  };

  const addSuggestion = (kind: 'hospital' | 'surgeon', item: { id: string; name: string }) => {
    const current = getSuggestions(kind);
    if (current.some((s) => s.name === item.name)) return;
    saveSuggestions(kind, [...current, item]);
  };

  const removeSuggestion = (kind: 'hospital' | 'surgeon', index: number) => {
    saveSuggestions(kind, getSuggestions(kind).filter((_, i) => i !== index));
  };

  const addQuotationItem = () => {
    const currentItems = localWorkflowState?.quotation_items || [];
    const item = { id: Date.now(), description: '', qty: 1, rate: 0 };
    handleUpdateSummary('quotation_items', [...currentItems, item]);
    saveStage6Task('Generate Financial Proposal', { quotation_items: [...currentItems, item] });
  };

  const removeQuotationItem = (id: number) => {
    const currentItems = localWorkflowState?.quotation_items || [];
    handleUpdateSummary('quotation_items', currentItems.filter((item: any) => item.id !== id));
  };

  const updateQuotationItem = (id: number, field: string, value: any) => {
    const currentItems = localWorkflowState?.quotation_items || [];
    const newItems = currentItems.map((item: any) => 
      item.id === id ? { ...item, [field]: value } : item
    );
    handleUpdateSummary('quotation_items', newItems);
  };

  const sendProposalToPatient = async () => {
    if (!selectedLead || !localWorkflowState?.financial_proposal_pdf) {
      toast.error('Please generate the proposal PDF first.');
      return;
    }

    toast.loading('Sending proposal to patient...', { id: 'send_prop' });

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            id: selectedLead.id,
            full_name: selectedLead.name,
            email: selectedLead.email,
            treatment_interest: selectedLead.treatmentInterest
          },
          pdf_base64: localWorkflowState.financial_proposal_pdf
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to send');

      toast.success('Proposal sent successfully!', { id: 'send_prop' });
      await saveStage6Task('Send Proposal Via Mail', { proposal_sent_at: new Date().toISOString() });
      
      // Log Activity
      await logAdminActivity(
        'Financial Proposal Emailed to Patient',
        'Patient Lead',
        selectedLead.id,
        { email: selectedLead.email }
      );
      loadActivityLogs(selectedLead.id);
    } catch (err) {
      toast.error('Failed to send proposal', { id: 'send_prop' });
    }
  };

  const handleAssignDoctor = async (doctorName: string) => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    
    setSelectedInHouseDoctor(doctorName);
    
    // 1. Update the official assigned_to field (UUID-only in some schemas)
    const inHouseMatch = inHouseDoctors.find(d => d.name === doctorName);
    const matchedDoctor = doctors.find(d => d.name.toLowerCase().includes(doctorName.toLowerCase()));
    const valueToSave = inHouseMatch ? inHouseMatch.userId : (matchedDoctor ? matchedDoctor.id : doctorName);
    
    await updatePatientEnquiry(selectedLead.id, { assigned_to: valueToSave });
    
    // 2. ALSO save the name to workflow_state for reliable display
    if (localWorkflowState) {
      await persistWorkflowPatch({ assigned_doctor_name: doctorName });
    }
    
    toast.success(`Lead Owner updated to ${doctorName}`);
    loadLeads(); // Refresh to sync UI
  };

  // Emails the in-house doctor the complete patient record: details, notes, summaries and documents.
  const sendPatientDetailsToDoctor = async (lead: Lead, doctorName: string) => {
    const doctor = inHouseDoctors.find((d) => d.name === doctorName);
    if (!doctor?.email) {
      toast.error(`${doctorName} has no email saved, so the patient details were not sent.`);
      return;
    }
    const state: any = workflowStateRef.current || localWorkflowState || {};
    const fields: [string, unknown][] = [
      ['Lead code', lead.leadCode],
      ['Patient name', lead.name],
      ['Email', lead.email],
      ['Phone', lead.phone],
      ['Country', lead.country],
      ['Treatment interest', lead.treatmentInterest],
      ['Urgency', lead.urgency],
      ['Budget range', lead.budgetRange],
      ['Preferred date', lead.preferredDate],
      ['Source', lead.source],
      ['Patient message', lead.message],
      ['Lead notes', lead.notes],
      ['BDM call summary', state.call_notes],
      ['Clinical summary', state.clinical_summary],
      ['Suggested hospital', state.suggested_hospital],
      ['Suggested surgeon / specialist', state.suggested_surgeon],
      ['Suggested procedures', state.suggested_procedures],
    ];
    const rowsHtml = fields
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([label, value]) =>
        `<tr><td style="padding:6px 10px;font-weight:bold;color:#334155;vertical-align:top;white-space:nowrap;">${escapeEmailHtml(label)}</td>` +
        `<td style="padding:6px 10px;color:#1e293b;">${escapeEmailHtml(String(value)).replace(/\n/g, '<br/>')}</td></tr>`)
      .join('');
    const docsHtml = enquiryDocuments.length
      ? `<ul>${enquiryDocuments.map((d: any) => `<li><a href="${escapeEmailHtml(d.file_url)}">${escapeEmailHtml(d.file_name)}</a></li>`).join('')}</ul>`
      : '<p>No documents have been uploaded yet.</p>';
    const content =
      `<p>Dear ${escapeEmailHtml(doctor.name)},</p>` +
      '<p>A patient has been assigned to your in-house doctor inbox. Please review the complete details below before contacting the patient.</p>' +
      `<table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">${rowsHtml}</table>` +
      '<p><strong>Uploaded documents</strong></p>' + docsHtml +
      '<p>Open the lead in Patient Leads to record your call notes and initial assessment.</p>';
    const { data: masterTemplate } = await fetchMasterTemplate();
    const html = buildWaruWenJoEmailFull({
      emailTitle: 'New Patient in Your Doctor Inbox',
      emailSubtitle: `${lead.name || 'Patient'}${lead.leadCode ? ` · ${lead.leadCode}` : ''}`,
      emailContent: content,
      masterTemplate: masterTemplate || undefined,
    });
    const result = await sendCrmEmail(doctor.email, `Patient assigned to your inbox: ${lead.name || 'Patient'}`, html, doctor.name);
    if (!result?.success) {
      toast.error(result?.error || 'Patient details could not be emailed to the doctor.');
      return;
    }
    await logAdminActivity('Patient Details Sent to In-House Doctor', 'Patient Lead', lead.id, {
      doctor_name: doctor.name,
      email: doctor.email,
      sent_at: new Date().toISOString(),
    });
    loadActivityLogs(lead.id);
  };

  const assignToInHouseDoctorInbox = async () => {
    if (!selectedLead || !selectedInHouseDoctor) {
      toast.error('Select an in-house doctor first.');
      return;
    }
    const leadId = selectedLead.id;
    await handleAssignDoctor(selectedInHouseDoctor);
    await persistWorkflowPatch({
      assigned_doctor_name: selectedInHouseDoctor,
      doctor_inbox_status: 'Assigned',
      doctor_assigned_at: new Date().toISOString(),
    });
    // The BDM who sends the lead to the inbox owns it, so they keep access after the doctor's stages.
    if (isBdmUser && currentUserId && !selectedLead.assignedBdmId) {
      const { error } = await updatePatientEnquiry(leadId, { assigned_bdm_id: currentUserId });
      if (!error) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, assignedBdmId: currentUserId } : l)));
      }
    }
    await logAdminActivity('Lead Assigned to In-House Doctor Inbox', 'Patient Lead', leadId, {
      doctor_name: selectedInHouseDoctor,
    });
    await sendPatientDetailsToDoctor(selectedLead, selectedInHouseDoctor);
    toast.success(`Lead assigned to ${selectedInHouseDoctor}'s inbox`);
  };

  const handleDoctorCallCompleted = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    await saveStage4Task('Personal Call by In-House Doctor', { doctor_call_at: new Date().toISOString() });
    toast.success('Personal doctor call recorded');
  };

  const handleSaveInitialAssessment = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead || !localWorkflowState?.initial_doctor_assessment?.trim()) {
      toast.error('Enter the initial doctor assessment first.');
      return;
    }
    const { error } = await persistWorkflowPatch({
      initial_doctor_assessment: localWorkflowState.initial_doctor_assessment.trim(),
      doctor_next_steps: (localWorkflowState.doctor_next_steps || '').trim(),
      initial_doctor_assessment_saved_at: new Date().toISOString(),
    });
    if (error) {
      toast.error('Could not save the initial assessment.');
      return;
    }
    toast.success('Initial doctor assessment saved');
  };

  const handleSaveDoctorCallNotes = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead || !localWorkflowState?.doctor_call_notes?.trim()) {
      toast.error('Enter the doctor call notes first.');
      return;
    }
    const checklist = (localWorkflowState.stage4_checklist || []).filter((task: string) => task !== 'Record Doctor Call Notes');
    const { error } = await persistWorkflowPatch({
      doctor_call_notes: localWorkflowState.doctor_call_notes.trim(),
      doctor_call_notes_saved_at: new Date().toISOString(),
      stage4_checklist: [...checklist, 'Record Doctor Call Notes'],
    });
    if (error) {
      toast.error('Could not save the doctor call notes.');
      return;
    }
    toast.success('Doctor call notes saved');
  };

  const handleSendPersonalDoctorEmail = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    const assessment = (localWorkflowState?.initial_doctor_assessment || '').trim();
    if (!assessment) {
      toast.error('Record and save the initial doctor assessment before sending this email.');
      return;
    }
    const result = await sendLeadTemplateEmail('personal_doctor_email', {
      patient_name: escapeEmailHtml(selectedLead.name || 'Patient'),
      doctor_name: escapeEmailHtml(localWorkflowState?.assigned_doctor_name || 'the In-House Doctor'),
      assessment_block: buildAssessmentBlock(assessment, (localWorkflowState?.doctor_next_steps || '').trim()),
    });
    if (!result.success) return;
    await saveStage4Task('Send Personal Email to Patient', { personal_email_sent_at: result.sentAt });
    toast.success('Personal email sent to the patient');
  };

  const handleCompleteDoctorInteraction = async () => {
    if (denyIfLeadLocked()) return;
    const currentStage4Checklist = (workflowStateRef.current || localWorkflowState)?.stage4_checklist || [];
    const stage4Prerequisites = STAGES.find(stage => stage.id === 4)?.tasks
      .filter(task => task !== 'Complete In-House Doctor Interaction') || [];
    if (!stage4Prerequisites.every(task => currentStage4Checklist.includes(task))) {
      toast.error('Complete doctor call notes and personal email before completing Stage 4.');
      return;
    }
    if (!localWorkflowState?.initial_doctor_assessment?.trim()) {
      toast.error('Record the initial doctor assessment first.');
      return;
    }
    await saveStage4Task('Complete In-House Doctor Interaction', { doctor_interaction_complete: true });
    await handleProgressStage();
  };

  const handleSendClinicalDoctorEmail = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    const result = await sendLeadTemplateEmail('clinical_doctor_email', {
      patient_name: escapeEmailHtml(selectedLead.name || 'Patient'),
      doctor_name: escapeEmailHtml(localWorkflowState?.assigned_doctor_name || 'Our In-House Doctor'),
    });
    if (!result.success) return;
    await persistWorkflowPatch({ clinical_doctor_email_sent_at: result.sentAt });
    toast.success('Personal clinical email sent');
  };

  const handleFinalizeClinicalRecommendation = async () => {
    if (denyIfLeadLocked()) return;
    if (!localWorkflowState?.suggested_hospital || !localWorkflowState?.suggested_surgeon || !localWorkflowState?.suggested_procedures) {
      toast.error('Select a hospital, surgeon/specialist, and procedure first.');
      return;
    }
    if (workflowStateRef.current?.clinical_review_confirmed) {
      await saveStage5Task('Finalize Clinical Recommendation & Confirm Clinical Review', { clinical_recommendation_finalized: true });
    } else {
      await persistWorkflowPatch({ clinical_recommendation_finalized: true });
    }
    toast.success('Clinical recommendation finalized');
  };

  const handleConfirmClinicalReview = async () => {
    if (denyIfLeadLocked()) return;
    if (!localWorkflowState?.clinical_recommendation_finalized) {
      toast.error('Finalize the clinical recommendation first.');
      return;
    }
    await saveStage5Task('Finalize Clinical Recommendation & Confirm Clinical Review', { clinical_review_confirmed: true, clinical_review_confirmed_at: new Date().toISOString(), clinical_review_confirmed_by: localWorkflowState.assigned_doctor_name || 'In-House Doctor', clinical_decision: localWorkflowState.clinical_summary || 'Clinical recommendation confirmed' });
    toast.success('Clinical review confirmed');
  };

  // Resolves a user ID to a person's name. Never returns the ID itself.
  const userNameFor = (id?: string | null) => {
    if (!id) return '';
    return bdmUsers.find((u) => u.id === id)?.full_name
      || inHouseDoctors.find((d) => d.userId === id)?.name
      || userDirectory[id]
      || 'Team member';
  };

  // Lead owner shown on the lead card. Saved doctor name wins for leads in the doctor inbox.
  useEffect(() => {
    const known = new Set<string>([
      ...bdmUsers.map((u) => String(u.id)),
      ...inHouseDoctors.map((d) => String(d.userId)),
      ...Object.keys(userDirectory),
    ]);
    const missing = Array.from(new Set(
      leads
        .flatMap((l) => [l.assignedTo, l.assignedBdmId])
        .filter((id): id is string => Boolean(id) && !known.has(String(id)))
    ));
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc('get_crm_user_names', { _ids: missing });
      if (error || cancelled) return;
      const found: Record<string, string> = Object.fromEntries(
        (data || []).map((p: any) => [String(p.user_id), String(p.full_name || p.email || 'Team member')])
      );
      const fill = Object.fromEntries(missing.map((id) => [id, found[id] || 'Team member']));
      setUserDirectory((prev) => ({ ...prev, ...fill }));
    })();
    return () => { cancelled = true; };
  }, [leads, bdmUsers, inHouseDoctors]);

  const getLeadOwnerName = (lead: Lead) => {
    if (lead.workflowState?.assigned_doctor_name) return lead.workflowState.assigned_doctor_name;
    const ownerId = lead.assignedTo || lead.assignedBdmId;
    if (!ownerId) return 'Unassigned';
    return userNameFor(ownerId);
  };

  // ── Welcome Email: generates PDF and sends email via Edge Function ──
  const sendWelcomeEmail = async (lead: Lead) => {
    if (!lead.email) {
      toast.error('No email address on record for this lead.');
      return;
    }

    toast.loading(`Sending welcome email to ${lead.email}...`, { id: 'email_toast' });

    try {
      // 1. Generate PDF credentials/summary
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.setTextColor(13, 122, 110); // Teal
      doc.text("WaruWenJo Medical Tourism", 20, 30);
      
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text("Enquiry Summary & Credentials", 20, 45);
      
      doc.setFontSize(12);
      doc.setTextColor(71, 85, 105); // Slate 600
      
      let y = 65;
      const addRow = (label: string, value: string) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, 20, y);
        doc.setFont("helvetica", "normal");
        doc.text(value || "N/A", 60, y);
        y += 10;
      };
      
      addRow("Ref ID", getLeadCode(lead));
      addRow("Full Name", lead.name);
      addRow("Email", lead.email);
      addRow("Phone", lead.phone || "Not provided");
      addRow("Country", lead.country || "Not specified");
      addRow("Treatment", lead.treatmentInterest || "General Consultation");
      addRow("Date Pref", lead.preferredDate ? new Date(lead.preferredDate).toLocaleDateString() : "Flexible");
      addRow("Priority", lead.urgency || "Standard");
      
      if (lead.message) {
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Notes:", 20, y);
        y += 10;
        doc.setFont("helvetica", "normal");
        const splitNotes = doc.splitTextToSize(lead.message, 170);
        doc.text(splitNotes, 20, y);
      }

      const pdfBase64 = doc.output('datauristring').split(',')[1]; // Get base64 part

      // 2. Call local Vite API (bypassing Supabase Edge Functions)
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead: {
            id: lead.id,
            lead_code: lead.leadCode,
            full_name: lead.name,
            email: lead.email,
            phone: lead.phone,
            country: lead.country,
            treatment_interest: lead.treatmentInterest,
            preferred_date: lead.preferredDate,
            urgency: lead.urgency,
            message: lead.message
          },
          pdf_base64: pdfBase64
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Unknown error sending email");
      if (!data?.success) throw new Error(data?.error || "Unknown error sending email");

      toast.success(`Welcome email sent to ${lead.email}`, { id: 'email_toast' });
      
      // Log Activity
      await logAdminActivity(
        'Welcome Email Sent (with PDF Summary)',
        'Patient Lead',
        lead.id,
        { email: lead.email }
      );
      loadActivityLogs(lead.id);
      
      // Show explicit alert popup
      alert(`✅ Success! The welcome email and PDF have been successfully sent to ${lead.email}.`);
      
      // Persist the email timestamp and checklist item together so call data is preserved.
      await saveStage2Task('Send Welcome Email', { welcome_email_sent_at: new Date().toISOString() });

    } catch (err: any) {
      console.error("Email sending error:", err);
      toast.error(`Failed to send email: ${err.message || 'Check console for details'}`, { id: 'email_toast' });
    }
  };

  // ── Process Email: sends 8-step journey email via local API ──
  const sendProcessEmail = async (lead: Lead) => {
    if (!lead.email) {
      toast.error('No email address on record for this lead.');
      return;
    }

    toast.loading(`Sending process email to ${lead.email}...`, { id: 'process_email_toast' });

    try {
      const response = await fetch('/api/send-process-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            id: lead.id,
            lead_code: lead.leadCode,
            full_name: lead.name,
            email: lead.email,
            phone: lead.phone
          }
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.success) throw new Error(data?.error || "Unknown error sending email");

      toast.success(`Process email sent to ${lead.email}`, { id: 'process_email_toast' });
      
      // Log Activity
      await logAdminActivity(
        'WaruWenJo Journey Email Sent',
        'Patient Lead',
        lead.id,
        { email: lead.email }
      );
      loadActivityLogs(lead.id);

      alert(`✅ Success! The WaruWenJo Patient Journey email has been successfully sent to ${lead.email}.`);
      

    } catch (err: any) {
      console.error("Email sending error:", err);
      toast.error(`Failed to send process email: ${err.message}`, { id: 'process_email_toast' });
    }
  };

  const sendToDoctor = async (lead: Lead, doctorName: string) => {
    if (!doctorName) {
      toast.error('Please select a doctor first.');
      return;
    }

    toast.loading(`Sending reports to Dr. ${doctorName}...`, { id: 'doctor_email_toast' });

    const doctorMatch = doctors.find(d => d.name.toLowerCase().includes(doctorName.toLowerCase()));
    const targetEmail = IN_HOUSE_DOCTOR_EMAILS[doctorName] || doctorMatch?.email || 'trionsv123@gmail.com';

    try {
      const response = await fetch('/api/send-doctor-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            id: lead.id,
            lead_code: lead.leadCode,
            full_name: lead.name,
            treatment_interest: lead.treatmentInterest
          },
          doctorName: doctorName,
          doctorEmail: targetEmail,
          pdf_base64: doctorReportPdf
        })
      });

      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || "Failed to send email");

      toast.success(`Documents sent to Dr. ${doctorName}`, { id: 'doctor_email_toast' });
      
      // Log Activity
      await logAdminActivity(
        `Reports Sent to Dr. ${doctorName}`,
        'Patient Lead',
        lead.id,
        { doctor: doctorName, recipient: targetEmail }
      );
      loadActivityLogs(lead.id);

      alert(`✅ Success! Medical documents ${doctorReportPdf ? '(including PDF)' : ''} have been sent to Dr. ${doctorName} (${targetEmail}) for clinical review.`);
      
      setDoctorReportPdf(null); // Clear after sending
      // Auto-progress to Stage 5
      handleStageJump(5);

    } catch (err: any) {
      console.error("Doctor email error:", err);
      toast.error(`Failed: ${err.message}`, { id: 'doctor_email_toast' });
    }
  };

  const handleReportUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setDoctorReportPdf(base64);
        toast.success('Medical report uploaded successfully!');
        
        // Log Activity
        if (selectedLead) {
          logAdminActivity(
            'Medical Report Uploaded (PDF)',
            'Patient Lead',
            selectedLead.id,
            { filename: file.name }
          ).then(() => loadActivityLogs(selectedLead.id));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const generateClinicalReviewPDF = async () => {
    if (!selectedLead) return;
    
    if (!localWorkflowState?.suggested_hospital || !localWorkflowState?.suggested_surgeon || !localWorkflowState?.suggested_procedures) {
      toast.error('Please complete Hospital, Surgeon, and Procedure suggestions first.');
      return;
    }

    toast.loading('Generating Clinical Review Report...', { id: 'pdf_gen' });

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(13, 122, 110);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text("Clinical Review Report", 20, 28);
      
      doc.setTextColor(30, 41, 59);
      let y = 55;

      const addSection = (title: string, content: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(13, 122, 110);
        doc.text(title.toUpperCase(), 20, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        const splitText = doc.splitTextToSize(content || "Not specified", 170);
        doc.text(splitText, 20, y);
        y += (splitText.length * 6) + 10;
      };

      addSection("Patient Information", `Name: ${selectedLead.name}\nTreatment Interest: ${selectedLead.treatmentInterest}\nPriority: ${selectedLead.urgency}`);
      addSection("Hospital & Surgeon", `Suggested Hospital: ${localWorkflowState.suggested_hospital}\nSuggested Surgeon: ${localWorkflowState.suggested_surgeon}`);
      addSection("Suggested Procedures", localWorkflowState.suggested_procedures);
      addSection("Illness History", localWorkflowState.illness_history);
      addSection("Clinical Summary", localWorkflowState.clinical_summary);

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      setClinicalNotesPdf(pdfBase64);

      // Save the report to the clinical-reports bucket so it is kept with the lead
      const reportPath = `${selectedLead.id}/clinical-report-${Date.now()}.pdf`;
      const { error: reportUploadError } = await supabase.storage
        .from('clinical-reports')
        .upload(reportPath, doc.output('blob'), { contentType: 'application/pdf', upsert: false });
      if (reportUploadError) throw reportUploadError;
      const { data: reportPublic } = supabase.storage.from('clinical-reports').getPublicUrl(reportPath);

      await persistWorkflowPatch({
        clinical_report_generated_at: new Date().toISOString(),
        clinical_report_path: reportPath,
        clinical_report_url: reportPublic.publicUrl,
      });
      
      toast.success('Clinical Report Generated!', { id: 'pdf_gen' });
      
      // Log Activity
      await logAdminActivity(
        'Clinical Review Report Generated',
        'Patient Lead',
        selectedLead.id,
        { surgeon: localWorkflowState.suggested_surgeon, hospital: localWorkflowState.suggested_hospital }
      );
      loadActivityLogs(selectedLead.id);

      // Open the PDF in a new tab for immediate viewing
      window.open(doc.output('bloburl'), '_blank');
      
    } catch (err: any) {
      console.error('Clinical report upload failed:', err);
      toast.error(`Failed to save clinical report: ${err?.message || 'unknown error'}`, { id: 'pdf_gen' });
    }
  };

  const generateFinancialProposalPDF = async () => {
    if (!selectedLead) return;
    
    const { data: latestQuotation } = await supabase
      .from('quotations')
      .select('id')
      .eq('lead_id', selectedLead.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let items: any[] = [];
    if (latestQuotation) {
      const { data: quotationItems } = await supabase
        .from('quotation_items')
        .select('name, quantity, unit_price')
        .eq('quotation_id', latestQuotation.id);
      items = (quotationItems || []).map((i: any) => ({ description: i.name, qty: i.quantity, rate: i.unit_price }));
    }
    if (items.length === 0) {
      toast.error('Create a quotation for this patient in the Quotations section first.');
      return;
    }

    toast.loading('Generating Financial Proposal...', { id: 'prop_gen' });

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(63, 81, 181); // Indigo
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text("Financial Proposal & Logistics", 20, 28);
      
      doc.setTextColor(30, 41, 59);
      let y = 55;

      const addSection = (title: string, content: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(63, 81, 181);
        doc.text(title.toUpperCase(), 20, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        const splitText = doc.splitTextToSize(content || "Not specified", 170);
        doc.text(splitText, 20, y);
        y += (splitText.length * 6) + 10;
      };

      addSection("Patient Details", `Name: ${selectedLead.name}\nTreatment Interest: ${selectedLead.treatmentInterest}`);
      addSection("Hospital & Surgeon", `Suggested Hospital: ${localWorkflowState.suggested_hospital || "Pending"}\nSuggested Surgeon: ${localWorkflowState.suggested_surgeon || "Pending"}`);
      
      // Quotation Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(63, 81, 181);
      doc.text("FINANCIAL BREAKDOWN", 20, y);
      y += 7;
      
      // Table Header
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(20, y, 170, 8, 'F');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("Description", 25, y + 5);
      doc.text("Qty", 120, y + 5, { align: 'right' });
      doc.text("Rate", 145, y + 5, { align: 'right' });
      doc.text("Total", 185, y + 5, { align: 'right' });
      y += 8;

      // Table Rows
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      items.forEach((item: any) => {
        const qty = item.qty || 1;
        const rate = item.rate || 0;
        const lineTotal = qty * rate;

        doc.text(item.description || "Unnamed Item", 25, y + 5);
        doc.text(qty.toString(), 120, y + 5, { align: 'right' });
        doc.text(`$${rate.toLocaleString()}`, 145, y + 5, { align: 'right' });
        doc.text(`$${lineTotal.toLocaleString()}`, 185, y + 5, { align: 'right' });
        
        doc.setDrawColor(241, 245, 249); // slate-100
        doc.line(20, y + 8, 190, y + 8);
        y += 8;
      });

      // Grand Total
      const total = items.reduce((acc: number, i: any) => acc + ((i.qty || 1) * (i.rate || 0)), 0);
      doc.setFillColor(63, 81, 181);
      doc.rect(120, y + 2, 70, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("GRAND TOTAL", 125, y + 8);
      doc.text(`$${total.toLocaleString()}`, 185, y + 8, { align: 'right' });
      y += 25;

      addSection("Travel, Logistics & Notes", localWorkflowState.travel_accommodation || "No additional terms provided.");

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      
      // Save to workflow state
      await handleUpdateSummary('financial_proposal_pdf', pdfBase64);
      
      toast.success('Financial Proposal Generated!', { id: 'prop_gen' });
      
      // Log Activity
      await logAdminActivity(
        'Financial Proposal Generated',
        'Patient Lead',
        selectedLead.id,
        { total: items.reduce((acc: number, i: any) => acc + ((i.qty || 1) * (i.rate || 0)), 0) }
      );
      loadActivityLogs(selectedLead.id);

      window.open(doc.output('bloburl'), '_blank');
      
      await saveStage6Task('Generate Financial Proposal');
    } catch (err) {
      toast.error('Failed to generate PDF', { id: 'prop_gen' });
    }
  };

  // Completes Stage 5 and hands the lead to the BDM. This writes the lead's stage directly instead of going
  // through handleStageJump, because the in-house doctor has no access to Stage 6 and that jump would be refused.
  const finalizeClinicalReview = async (lead: Lead) => {
    if (denyIfLeadLocked(lead.id)) return;
    if (blockReadOnlyWrite(5)) return;
    if (isUpdatingWorkflow) return;
    const stage6 = STAGES.find(s => s.id === 6);
    setIsUpdatingWorkflow(true);
    const { error } = await updateLeadWorkflow(lead.id, 6, stage6?.statusMapping);
    setIsUpdatingWorkflow(false);
    if (error) {
      console.error('Stage 5 completion failed:', error);
      toast.error(`Could not complete Stage 5: ${error.message || 'permission denied'}`);
      return;
    }
    await logAdminActivity(
      'Stage 5 Completed: Clinical review finalized, lead handed to BDM for Stage 6',
      'Patient Lead',
      lead.id,
      { stage: 5, next_stage: 6 }
    );
    loadActivityLogs(lead.id);
    await loadLeads();
    // Roles with Stage 6 access continue there; the in-house doctor stays on Stage 5.
    if (canAccessStage(6)) setActiveWorkflowStage(6);
    setShowStage5Complete(true);
  };

  const sendMeetingSlots = async (lead: Lead) => {
    toast.loading(`Sending meeting slots to patient and surgeon...`, { id: 'slots_toast' });

    try {
      const response = await fetch('/api/finalize-clinical-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            id: lead.id,
            lead_code: lead.leadCode,
            full_name: lead.name,
            email: lead.email,
            treatment_interest: lead.treatmentInterest
          },
          doctorName: localWorkflowState?.suggested_surgeon || 'Dr. Neha',
          hospitalName: localWorkflowState?.suggested_hospital || 'Fortis Memorial',
          doctorEmail: doctors.find(d => d.name === localWorkflowState?.suggested_surgeon)?.email || 'trionsv123@gmail.com',
          pdf_base64: localWorkflowState?.financial_proposal_pdf || clinicalNotesPdf
        })
      });

      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || "Failed to send slots");

      toast.success(`Slots sent & notification archived`, { id: 'slots_toast' });
      
      const surgeonName = localWorkflowState?.suggested_surgeon || 'Dr. Neha';
      const docEmail = doctors.find(d => d.name.toLowerCase().includes(surgeonName.toLowerCase()))?.email || IN_HOUSE_DOCTOR_EMAILS[surgeonName] || 'trionsv123@gmail.com';
      await logAdminActivity(
        'Meeting Slots Sent to Patient & Surgeon',
        'Patient Lead',
        lead.id,
        { surgeon: localWorkflowState?.suggested_surgeon, recipient: docEmail }
      );
      loadActivityLogs(lead.id);

      alert(`✅ Success! Meeting slots have been sent to Dr. Neha and the patient.`);
      
      // Progress to Stage 7
      handleStageJump(7);

    } catch (err: any) {
      console.error("Slots error:", err);
      toast.error(`Failed: ${err.message}`, { id: 'slots_toast' });
    }
  };

  const sendFinalConfirmation = async (lead: Lead) => {
    toast.loading(`Sending final meeting link...`, { id: 'confirm_toast' });

    const surgeonName = localWorkflowState?.suggested_surgeon || 'Dr. Neha';
    const docEmail = doctors.find(d => d.name.toLowerCase().includes(surgeonName.toLowerCase()))?.email || IN_HOUSE_DOCTOR_EMAILS[surgeonName] || 'trionsv123@gmail.com';

    try {
      const response = await fetch('/api/send-final-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            id: lead.id,
            lead_code: lead.leadCode,
            full_name: lead.name,
            email: lead.email
          },
          doctorName: surgeonName,
          doctorEmail: docEmail,
          timing: localWorkflowState?.scheduled_timing || 'Tomorrow at 11:00 AM',
          meetingLink: localWorkflowState?.meeting_link || 'https://meet.google.com/abc-defg-hij'
        })
      });

      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || "Failed to confirm");

      toast.success(`Official confirmation sent from nehasp0804@gmail.com`, { id: 'confirm_toast' });
      
      // Log Activity
      await logAdminActivity(
        'Video Consultation Confirmed',
        'Patient Lead',
        lead.id,
        { timing: localWorkflowState?.scheduled_timing, surgeon: localWorkflowState?.suggested_surgeon }
      );
      loadActivityLogs(lead.id);

      alert(`✅ CONFIRMED! The official meeting link and confirmed timing have been sent to both ${localWorkflowState?.suggested_surgeon || 'the doctor'} and the patient.`);
      
    } catch (err: any) {
      console.error("Confirm error:", err);
      toast.error(`Failed: ${err.message}`, { id: 'confirm_toast' });
    }
  };

  useEffect(() => {
    loadLeads();
    loadDoctors();
    loadHospitals();
    loadInHouseDoctors();
    fetchCrmUsersByRole('bdm').then(setBdmUsers);
  }, []);

  const loadInHouseDoctors = async () => {
    const { data, error } = await fetchInHouseDoctorUsers();
    if (error) toast.error('Could not load in-house doctors from Supabase');
    setInHouseDoctors(data);
    setInHouseDoctorsLoaded(true);
  };

  const loadDoctors = async () => {
    const { data } = await fetchDoctors();
    if (data) setDoctors(data as Doctor[]);
  };

  const loadHospitals = async () => {
    const { data } = await fetchHospitals();
    if (data) setHospitals(data as Hospital[]);
  };

  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await fetchLeads();
    if (error) {
      toast.error('Failed to load leads');
    } else {
      const mappedLeads: Lead[] = (data || []).map((item: any) => ({
        id: String(item.id || ''),
        leadCode: item.lead_code,
        name: item.full_name || 'Unnamed Patient',
        email: item.email,
        phone: item.phone,
        status: item.status as LeadStatus,
        treatmentInterest: item.treatment_interest,
        source: item.source,
        notes: item.notes,
        urgency: item.urgency || 'Standard',
        budgetRange: item.budget_range,
        country: item.country,
        message: item.message,
        preferredDate: item.preferred_date,
        createdAt: item.created_at,
        workflowStage: Number(item.workflow_stage) || 1,
        workflowState: typeof item.workflow_state === 'string' ? (() => { try { return JSON.parse(item.workflow_state); } catch { return {}; } })() : (item.workflow_state || {}),
        quotationChoice: item.quotation_choice || null,
        selectedQuotationNo: item.selected_quotation_no ?? null,
        selectedQuotationAt: item.selected_quotation_at ?? null,
        assignedBdmId: item.assigned_bdm_id ?? null,
        assignedTo: item.assigned_to,
      }));
      setLeads(mappedLeads);
      
      // Update selectedLead from fresh data to sync UI
      if (selectedLead) {
        const freshLead = mappedLeads.find(l => l.id === selectedLead.id);
        if (freshLead) setSelectedLead(freshLead);
      }
    }
    setLoading(false);
  };

  // Custom roles only see leads that are currently in a stage they can read.
  // In-house doctors see only the leads assigned to them (Stage 3 to 5; editable on 4 and 5 only).
  const visibleLeads = isInHouseDoctorOnly
    ? leads.filter(lead => lead.assignedTo === currentUserId && canAccessStage(Number(lead.workflowStage) || 1))
    : customStageAccess
      ? leads.filter(lead => canAccessStage(Number(lead.workflowStage) || 1))
      : leads;

  const filteredLeads = visibleLeads.filter(lead =>
    (lead.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (lead.treatmentInterest?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (lead.country?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const getUrgencyStyles = (urgency: string) => {
    switch (urgency) {
      case 'Emergency': return 'bg-rose-500 text-white border-rose-400';
      case 'Urgent': return 'bg-amber-500 text-white border-amber-400';
      case 'Standard': return 'bg-teal-500 text-white border-teal-400';
      default: return 'bg-slate-400 text-white border-slate-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-sky-50 text-sky-600 border-sky-100';
      case 'contacted': return 'bg-slate-50 text-slate-600 border-slate-100';
      case 'qualified': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'won': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'lost': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockReadOnlyWrite(1)) return;
    const leadData = {
      full_name: newLead.name,
      email: newLead.email,
      phone: newLead.phone,
      treatment_interest: newLead.treatmentInterest,
      country: newLead.country,
      message: newLead.message,
      urgency: newLead.urgency || 'Standard',
      source: 'CRM Portal'
    };

    const { error } = await createLead(leadData);
    if (error) {
      toast.error('Failed to create enquiry');
    } else {
      toast.success('Patient enquiry registered');
      loadLeads();
      setShowModal(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    if (denyIfLeadLocked(id)) return;
    if (blockReadOnlyWrite(Number(leads.find(item => item.id === id)?.workflowStage) || 1)) return;
    const { error } = await updateLeadStatus(id, status);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Lead marked as ${status}`);
      loadLeads();
    }
  };

  const handleConvertToCase = async (lead: Lead) => {
    if (denyIfLeadLocked(lead.id)) return;
    if (isConvertingToCase) return;
    if (blockReadOnlyWrite(8)) return;
    setIsConvertingToCase(true);
    try {
      await runConvertToCase(lead);
    } catch (err: any) {
      console.error('Medical case conversion failed:', err);
      toast.error(`Medical case could not be created: ${err?.message || 'unknown error'}`);
    } finally {
      setIsConvertingToCase(false);
    }
  };

  const runConvertToCase = async (lead: Lead) => {
    const currentState = workflowStateRef.current || localWorkflowState;
    if (!currentState?.patient_user_id) {
      toast.error('Create and link the patient profile before converting this lead to a medical case.');
      return;
    }
    if (!Boolean(currentState?.advance_payment_verified)) {
      toast.error('Verify the advance payment in Stage 8 before converting this lead.');
      return;
    }

    setIsConvertingToCase(true);
    let caseData: { id?: string } | null = null;
    let error: { message?: string } | null = null;
    let surgeonMissingLogin = false;
    try {
      const specialistDoctor = doctors.find((doctor) => doctor.id === currentState.suggested_surgeon_id)
        || doctors.find((doctor) => doctor.name === currentState.suggested_surgeon);
      // medical_cases.assigned_to must be a staff profile id (profiles.id), not a doctors.id.
      // Match the selected surgeon to the profile with the same email.
      let assignedToId: string | null = null;
      if (specialistDoctor?.email) {
        const { data: staffProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', specialistDoctor.email)
          .maybeSingle();
        assignedToId = staffProfile?.id || null;
      }
      surgeonMissingLogin = !assignedToId;
      const selectedHospital = hospitals.find((hospital) => hospital.id === currentState.suggested_hospital_id)
        || hospitals.find((hospital) => hospital.name === currentState.suggested_hospital);
      const hospitalId = selectedHospital?.id || currentState.suggested_hospital_id || null;
      if (!hospitalId) {
        toast.error('Select a valid hospital before creating the medical case.');
        return;
      }
      const notes = [
        lead.notes,
        lead.message,
        currentState.illness_history,
        currentState.clinical_summary,
        currentState.specialist_call_notes,
        currentState.bdm_call_notes,
        currentState.patient_concerns,
        currentState.quotation_details,
      ]
        .map((value) => typeof value === 'string' ? value.trim() : '')
        .filter(Boolean)
        .join('\n\n') || null;
      const result = await convertProfileToCase(currentState.patient_user_id, lead.id, {
        treatmentName: lead.treatmentInterest,
        assignedToId: assignedToId ?? null,
        hospitalId,
        notes
      });
      caseData = result.data;
      error = result.error;
    } catch (thrown: any) {
      // convertProfileToCase can throw (network error, rpc() response-shape
      // issue) rather than returning { data, error } — without this catch
      // that becomes a silent unhandled rejection: the button looks like it
      // does nothing, with no toast and no visible error.
      console.error('convertProfileToCase threw:', thrown);
      toast.error(thrown?.message || 'Medical case could not be created (unexpected error — see console).');
      setIsConvertingToCase(false);
      return;
    }

    // 409 / unique-violation: the database already has a medical case for this patient.
    // Link that existing case instead of failing the conversion.
    const errorCode = String((error as any)?.code ?? '');
    const isConflict = errorCode === '23505' || /duplicate|unique|409/i.test(String(error?.message || ''));
    if (error && isConflict && currentState.patient_user_id) {
      const { data: existingCase } = await supabase
        .from('medical_cases')
        .select('id')
        .eq('patient_id', currentState.patient_user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingCase?.id) {
        caseData = existingCase;
        error = null;
        toast.message('A medical case already exists for this patient. It has been linked.');
      }
    }

    if (error || !caseData?.id) {
      console.error('Profile medical-case conversion failed:', error || caseData);
      toast.error(error?.message || 'Medical case was not returned by Supabase. Check the browser console and SQL function response.');
      setIsConvertingToCase(false);
      return;
    }

    if (surgeonMissingLogin) {
      toast(`Medical case created. The surgeon has no staff login with the same email, so the case is not assigned to a surgeon yet. Assign one later.`);
    }

    // The new medical case belongs to the same BDM as the lead
    const leadBdmId = selectedLead ? bdmIdFor(selectedLead) : null;
    if (leadBdmId && caseData?.id) {
      await supabase.from('medical_cases').update({ assigned_bdm_id: leadBdmId } as any).eq('id', caseData.id);
    }

    const saveResult = await saveStage8Task('Convert Lead to Medical Case', {
      medical_case_id: caseData.id,
      converted_at: new Date().toISOString(),
    });
    if (saveResult?.error) {
      toast.error('Medical case was created, but Stage 8 progress could not be synced.');
      setIsConvertingToCase(false);
      return;
    }
    toast.success('Medical Case created successfully!');
    
    // Log Activity
    await logAdminActivity(
      'Case Converted to Medical Case',
      'Patient Lead',
      lead.id,
      { status: 'won' }
    );
    loadActivityLogs(lead.id);

    loadLeads();
    setIsConvertingToCase(false);
  };

  // Stage 6 -> Stage 7. No specialist is picked here any more: the lead goes straight to Stage 7.
  const handleProceedToSpecialistStage = async () => {
    if (denyIfLeadLocked()) return;
    if (!selectedLead) return;
    if (blockReadOnlyWrite(activeWorkflowStage)) return;
    if (!validateStage(6)) {
      toast.error('Please complete all Stage 6 checklist items first.');
      return;
    }

    await persistWorkflowPatch({ specialist_consultation_booked: true });
    await handleStageJump(7);
  };

  const LeadCard: React.FC<{ lead: Lead }> = ({ lead }) => (
    <div 
      className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:border-teal-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-500/10 transition-all group relative overflow-visible cursor-pointer mb-4"
      onClick={() => openLeadDetail(lead)}
    >
      <div className={`absolute -top-3 right-8 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border-2 z-10 ${getUrgencyStyles(lead.urgency || 'Standard')}`}>
        {lead.urgency || 'Standard'}
      </div>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 border border-teal-100 shadow-inner group-hover:bg-teal-600 group-hover:text-white transition-all">
            {lead.name.charAt(0)}
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-900 leading-none group-hover:text-teal-600 transition-colors uppercase truncate max-w-[180px]">{lead.name}</h4>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1.5 flex items-center gap-1"><Globe size={10} /> {lead.country || 'International'}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 bg-slate-50/80 rounded-[1.75rem] p-4 border border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Primary Interest</p>
        <p className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-1">{lead.treatmentInterest || 'Medical Consultation'}</p>
      </div>

      {lead.workflowState?.callback_due_at && (
        <div className={`mb-3 text-[9px] font-black uppercase tracking-widest ${new Date(lead.workflowState.callback_due_at) < new Date() ? 'text-rose-600' : 'text-amber-600'}`}>
          {new Date(lead.workflowState.callback_due_at) < new Date() ? 'Callback due' : `Callback ${new Date(lead.workflowState.callback_due_at).toLocaleString()}`}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-4">
        <div className="flex gap-2">
          <div className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-teal-600 transition-all"><Mail size={14} /></div>
          <div className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-600 transition-all"><Phone size={14} /></div>
        </div>
        <div className="flex items-center gap-2">
          {lead.status === 'lost' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleRestoreLead(lead);
              }}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm group/restore"
              title="Restore Lead"
            >
              <Activity size={14} className="group-hover/restore:animate-pulse" />
            </button>
          )}
          <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${getStatusColor(lead.status)}`}>
            {lead.status === 'won' ? 'Converted' : lead.status}
          </span>
        </div>
      </div>
    </div>
  );

  const columns = [
    { id: 'new', label: 'New Inquiries', icon: <Activity size={14} /> },
    { id: 'contacted', label: 'Follow Up', icon: <Clock size={14} /> },
    { id: 'qualified', label: 'Clinical Triage', icon: <CheckCircle2 size={14} /> }
  ];

  return (
    <>
    {/* Patient Leads had no Toaster of its own, so toasts (e.g. the quotation error) were hidden or lost behind the lead detail pane. */}
    <Toaster richColors closeButton position="top-center" style={{ zIndex: 2147483647 }} toastOptions={{ duration: 6000 }} />
    <div className="space-y-7 pb-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-600 mb-2">Patient intake operations</p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Patient Ingestion Hub</h2>
          <p className="text-slate-500 font-medium mt-2 max-w-xl">Triage new enquiries, capture first contact, and move qualified patients through the clinical journey.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setViewMode('BOARD')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'BOARD' ? 'bg-white text-teal-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutGrid size={16} /> Board
            </button>
            <button 
              onClick={() => setViewMode('TABLE')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'TABLE' ? 'bg-white text-teal-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List size={16} /> Table
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            disabled={!canWriteStage(1)}
            className="flex items-center gap-2 px-6 py-3.5 disabled:opacity-40 disabled:cursor-not-allowed bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 shadow-lg transition-all active:scale-95"
          >
            <Plus size={18} /> New Intake
          </button>
        </div>
      </div>

      {/* CRM Patient Leads Dashboard */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-1">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Leads</p>
            <h3 className="text-3xl font-black mt-2 text-slate-800">{leads.length}</h3>
            <p className="text-[10px] font-bold text-emerald-500 mt-2">↑ 12% vs last month</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversion Rate</p>
            <h3 className="text-3xl font-black mt-2 text-slate-800">{leads.length ? ((leads.filter(l => l.status === 'won').length / leads.length) * 100).toFixed(1) : 0}%</h3>
            <p className="text-[10px] font-bold text-emerald-500 mt-2">↑ 3.2% vs last month</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-amber-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Response Time</p>
            <h3 className="text-3xl font-black mt-2 text-slate-800">14m</h3>
            <p className="text-[10px] font-bold text-rose-500 mt-2">↓ 2m slower vs last month</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-rose-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lost / Dropped</p>
            <h3 className="text-3xl font-black mt-2 text-slate-800">{leads.filter(l => l.status === 'lost').length || 34}</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-2">Primarily due to Price (45%)</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search leads, clinical interests, or origin..."
            className="w-full pl-14 pr-6 py-3.5 bg-slate-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-teal-200 outline-none font-bold text-slate-700 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-teal-600 transition-all border border-slate-100"><Filter size={20} /></button>
      </div>

      {viewMode === 'BOARD' ? (
        <div className="flex gap-5 overflow-x-auto pb-10 custom-scrollbar-hide pt-2 snap-x">
          {columns.map(col => (
            <div key={col.id} className="flex-shrink-0 w-[min(88vw,400px)] snap-start">
              <div className="flex items-center justify-between mb-6 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-teal-600">{col.icon}</span>
                  <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-[0.2em]">{col.label}</h3>
                </div>
                <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-lg">
                  {visibleLeads.filter(l => l.status === col.id).length}
                </span>
              </div>
              <div className="space-y-4 bg-slate-100/70 p-3 rounded-3xl min-h-[620px] border border-slate-200">
                {filteredLeads.filter(l => l.status === col.id).map(lead => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </div>
          ))}
          
          <div className="flex-shrink-0 w-[min(88vw,400px)] snap-start">
            <div className="flex items-center justify-between mb-6 px-4">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600"><CheckCircle2 size={14} /></span>
                <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-[0.2em]">Converted Cases</h3>
              </div>
              <span className="text-[10px] font-black bg-emerald-600 text-white px-3 py-1 rounded-lg">
                {visibleLeads.filter(l => l.status === 'won').length}
              </span>
            </div>
            <div className="space-y-4 bg-emerald-50/30 p-5 rounded-[3rem] min-h-[700px] border-2 border-dashed border-emerald-100/50 opacity-60">
              {filteredLeads.filter(l => l.status === 'won').map(lead => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 w-[min(88vw,400px)] snap-start">
            <div className="flex items-center justify-between mb-6 px-4">
              <div className="flex items-center gap-2">
                <span className="text-rose-600"><AlertTriangle size={14} /></span>
                <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-[0.2em]">Lost / Dropped</h3>
              </div>
              <span className="text-[10px] font-black bg-rose-600 text-white px-3 py-1 rounded-lg">
                {visibleLeads.filter(l => l.status === 'lost').length}
              </span>
            </div>
            <div className="space-y-4 bg-rose-50/30 p-5 rounded-[3rem] min-h-[700px] border-2 border-dashed border-rose-100/50 opacity-60">
              {filteredLeads.filter(l => l.status === 'lost').map(lead => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Inquiry ID & Patient</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Medical Interest</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Priority & Status</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Workflow</th>
              </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-all duration-300 group cursor-pointer" onClick={() => openLeadDetail(lead)}>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xl group-hover:bg-teal-600 group-hover:text-white transition-all">
                          {lead.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900 leading-tight mb-1">{lead.name}</p>
                          <p className="text-[10px] font-black text-indigo-500 tracking-widest mb-1">{getLeadCode(lead)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Mail size={12} /> {lead.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-700">{lead.treatmentInterest || 'Clinical Inquiry'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5"><Globe size={12} /> {lead.country || 'Unknown origin'}</p>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border ${getUrgencyStyles(lead.urgency || 'Standard')}`}>
                          {lead.urgency || 'Standard'}
                        </span>
                        <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border ${getStatusColor(lead.status)}`}>
                          {lead.status === 'won' ? 'Converted' : lead.status}
                        </span>
                        {(() => {
                          const choice = choiceFor(lead);
                          if (choice.selectedQuotationNo) {
                            return (
                              <span title={choice.selectedQuotationAt ? `Chosen ${new Date(choice.selectedQuotationAt).toLocaleString()}` : ''} className="text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200">
                                Chose Quotation {choice.selectedQuotationNo}
                              </span>
                            );
                          }
                          return null;
                        })()}
                        {canAssignBdm ? (
                          <select
                            value={bdmIdFor(lead) || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleAssignBdm(lead.id, e.target.value || null)}
                            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600"
                            title="Assigned BDM"
                          >
                            <option value="">BDM: Unassigned</option>
                            {bdmUsers.map((u) => <option key={u.id} value={u.id}>BDM: {u.full_name}</option>)}
                          </select>
                        ) : (
                          <span className="text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border bg-slate-50 text-slate-600 border-slate-200">
                            BDM: {bdmNameFor(bdmIdFor(lead))}
                          </span>
                        )}
                        {isInHouseDoctorOnly ? (
                          <select
                            value={inHouseIdFor(lead)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleAssignInHouseDoctor(lead.id, e.target.value || null)}
                            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700"
                            title="Assigned In-House Doctor"
                          >
                            <option value="">Doctor: Unassigned</option>
                            {inHouseDoctors.map((d) => <option key={d.userId} value={d.userId}>Doctor: {d.name}</option>)}
                          </select>
                        ) : (
                          <span className="text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border bg-indigo-50 text-indigo-700 border-indigo-200">
                            Doctor: {inHouseNameFor(lead)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <button className="p-3 bg-white text-slate-400 hover:text-teal-600 rounded-2xl shadow-sm border border-slate-100 transition-all">
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>

    {/* OVERLAYS (Outside of animated main container to avoid transform-fixed conflicts) */}
    {/* Slide-over Detail Pane */}
    {showDetailPane && selectedLead && localWorkflowState && (
    <LeadDetailErrorBoundary onClose={() => setShowDetailPane(false)}>
    <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div ref={detailScrollRef} className="w-full max-w-3xl bg-white shadow-2xl h-screen overflow-y-auto animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-teal-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black">
                  {selectedLead.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedLead.name}</h3>
                  <div className="flex gap-4 mt-1">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Lead {getLeadCode(selectedLead)}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Received {new Date(selectedLead.createdAt!).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {activeWorkflowStage !== 9 ? (
                  <button 
                    onClick={() => handleStageJump(9)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                  >
                    <AlertTriangle size={16} /> Drop Lead
                  </button>
                ) : (
                  <button 
                    onClick={() => handleRestoreLead()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-emerald-100"
                  >
                    <Activity size={16} /> Restore Lead
                  </button>
                )}
                <button 
                  onClick={() => setShowDetailPane(false)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="px-10 pt-8 flex items-center gap-3 flex-wrap">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned BDM</p>
              {canAssignBdm ? (
                <select
                  value={bdmIdFor(selectedLead) || ''}
                  onChange={(e) => handleAssignBdm(selectedLead.id, e.target.value || null)}
                  className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-white"
                >
                  <option value="">Unassigned</option>
                  {bdmUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              ) : (
                <span className="text-xs font-black text-slate-700">{localWorkflowState?.assigned_bdm_name || bdmNameFor(bdmIdFor(selectedLead))}</span>
              )}
            </div>

            <div className="px-10 pt-2 flex items-center gap-3 flex-wrap">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned In-House Doctor</p>
              {canAssignBdm ? (
                <select
                  value={inHouseIdFor(selectedLead)}
                  onChange={(e) => handleAssignInHouseDoctor(selectedLead.id, e.target.value || null)}
                  className="text-xs font-bold border border-indigo-200 rounded-xl px-3 py-2 bg-indigo-50 text-indigo-700"
                >
                  <option value="">Unassigned</option>
                  {inHouseDoctors.map((d) => <option key={d.userId} value={d.userId}>{d.name}</option>)}
                </select>
              ) : (
                <span className="text-xs font-black text-slate-700">{inHouseNameFor(selectedLead)}</span>
              )}
            </div>

            <div className="p-10 space-y-12">
              {/* ADVANCED WORKFLOW STEPPER */}
              <div className="relative pt-6 pb-4 overflow-x-auto hide-scrollbar">
                 <div className={customStageAccess ? 'px-2' : 'min-w-[800px] px-2'}>
                 <div className={`absolute top-[2.2rem] left-6 right-6 h-1 bg-slate-100 -translate-y-1/2 rounded-full ${customStageAccess ? 'hidden' : ''}`}>
                    <div 
                       className="h-full bg-teal-500 transition-all duration-1000 rounded-full" 
                       style={{ width: `${((activeWorkflowStage - 1) / (STAGES.length - 1)) * 100}%` }}
                    />
                 </div>
                 
                 <div className={`flex relative ${customStageAccess ? 'items-start justify-start' : 'justify-between'}`}>
                    {STAGES.filter(s => !customStageAccess || canAccessStage(s.id)).map((s, stageIndex) => {
                       const isPast = s.id < activeWorkflowStage;
                       const isCurrent = s.id === activeWorkflowStage;
                       
                       return (
                          <React.Fragment key={s.id}>
                          {customStageAccess && stageIndex > 0 && (
                             <div className={`mt-[14px] h-1 min-w-[24px] flex-1 rounded-full transition-colors duration-500 ${s.id <= activeWorkflowStage ? 'bg-teal-500' : 'bg-slate-100'}`} />
                          )}
                          <button 
                             onClick={() => handleStageJump(s.id)}
                             disabled={!canAccessStage(s.id)}
                             className={`relative z-10 flex flex-col items-center group w-[80px] ${!canAccessStage(s.id) ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                             <div className={`w-8 h-8 rounded-xl border-2 transition-all duration-500 flex items-center justify-center font-black text-xs
                                ${isPast ? 'bg-teal-600 border-teal-100 text-white shadow-lg' : 
                                  isCurrent ? 'bg-white border-teal-500 text-teal-600 shadow-xl scale-110' : 
                                  customStageAccess ? 'bg-white border-teal-200 text-teal-600 group-hover:border-teal-400' : 'bg-white border-slate-100 text-slate-300 group-hover:border-slate-200'}`}
                             >
                                {isPast ? <CheckCircle2 size={14} /> : s.id}
                             </div>
                             <div className="mt-2 text-center">
                                <p className={`text-[8px] font-black uppercase tracking-tighter transition-colors leading-tight ${isCurrent ? 'text-teal-600' : customStageAccess ? 'text-slate-600' : 'text-slate-400'}`}>
                                   {s.name}
                                </p>
                             </div>
                          </button>
                          </React.Fragment>
                       );
                    })}
                 </div>
                 </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-1">
                 <button
                    onClick={handlePreviousStage}
                    disabled={activeWorkflowStage <= 1 || isUpdatingWorkflow || !canAccessStage(activeWorkflowStage - 1)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-teal-300 hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                 >
                    <ChevronLeft size={15} /> Previous Stage
                 </button>
              </div>

              {isStageReadOnly && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs font-black uppercase tracking-widest text-amber-800">
                  {activeLeadLocked
                    ? 'Only the BDM assigned to this lead can make changes. You can view it.'
                    : isViewOnlyStage
                      ? (Number(selectedLead?.workflowStage) === 5 && activeWorkflowStage === 6
                        ? 'Stage 5 (in-house doctor) is not complete yet. Once every Stage 5 item is ticked, click Stage 6 to take over.'
                        : 'View-only: the lead has not reached this stage yet, so it cannot be changed.')
                      : isBdmUser && BDM_READ_ONLY_STAGES.includes(activeWorkflowStage)
                        ? 'This stage belongs to the in-house doctor. You can view it but cannot make changes.'
                        : customStageAccess && !customStageAccess.write.has(activeWorkflowStage)
                          ? `Your role has Read-only permission for Stage ${activeWorkflowStage}. Ask an admin to tick Write for this stage.`
                          : 'Read-only access: you can view this stage but cannot make changes.'}
                </div>
              )}

              {/* STAGE-SPECIFIC WORKSPACE */}
              <div {...({ inert: isStageReadOnly } as any)} className="min-w-0 p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 shadow-inner space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-start justify-between">
                    <div>
                       <h4 className="text-xl font-black text-slate-900 tracking-tight">Stage {activeWorkflowStage}: {STAGES.find(s => s.id === activeWorkflowStage)?.name}</h4>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Lead Conversion Protocol & Manual Checklist</p>
                    </div>
                    <div className="px-5 py-2 bg-white rounded-2xl shadow-sm border border-slate-100 text-[10px] font-black text-teal-600 uppercase tracking-widest">
                       Status: {selectedLead.status}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-8">
                    <div className="min-w-0 space-y-4">
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Primary Checklist</p>
                       <div className="space-y-2">
                          {STAGES.find(s => s.id === activeWorkflowStage)?.tasks.map(task => (
                             <div 
                                key={task} 
                                onClick={() => toggleWorkflowTask(activeWorkflowStage, task)}
                                className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                   localWorkflowState?.[`stage${activeWorkflowStage}_checklist`]?.includes(task)
                                   ? 'bg-teal-50 border-teal-200 text-teal-700'
                                   : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                }`}
                             >
                                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center ${
                                   localWorkflowState?.[`stage${activeWorkflowStage}_checklist`]?.includes(task)
                                   ? 'bg-teal-600 border-teal-600 text-white'
                                   : 'bg-slate-100 border-slate-200'
                                }`}>
                                   {localWorkflowState?.[`stage${activeWorkflowStage}_checklist`]?.includes(task) && <CheckCircle2 size={12} />}
                                </div>
                                <span className="text-xs font-bold leading-tight">{task}</span>
                             </div>
                          ))}
                       </div>
                    </div>

                    <div className="min-w-0 space-y-4 border-t border-slate-200/70 pt-8">
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Stage Workspace</p>
                       
                       {activeWorkflowStage === 1 && (
                          <div className="space-y-4">
                             {/* Review New Lead / Verify Patient Information */}
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Info size={12} /> Enquiry Snapshot</p>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                   <div className="flex items-center gap-2 text-slate-600"><Mail size={13} className="text-slate-400" /> {selectedLead.email || 'No email'}</div>
                                   <div className="flex items-center gap-2 text-slate-600"><Phone size={13} className="text-slate-400" /> {selectedLead.phone || 'No phone'}</div>
                                   <div className="flex items-center gap-2 text-slate-600"><MessageSquare size={13} className="text-slate-400" /> {selectedLead.whatsappNumber || selectedLead.phone || 'No WhatsApp'}</div>
                                   <div className="flex items-center gap-2 text-slate-600"><Globe size={13} className="text-slate-400" /> {selectedLead.country || 'Not specified'}</div>
                                   <div className="flex items-center gap-2 text-slate-600"><Calendar size={13} className="text-slate-400" /> {selectedLead.preferredDate ? new Date(selectedLead.preferredDate).toLocaleDateString() : 'Flexible date'}</div>
                                   <div className="flex items-center gap-2 text-slate-600"><CreditCard size={13} className="text-slate-400" /> {selectedLead.budgetRange || 'Budget not specified'}</div>
                                   <div className="flex items-center gap-2 text-slate-600"><Hash size={13} className="text-slate-400" /> Source: {selectedLead.source || 'Direct'}</div>
                                   <div className="flex items-center gap-2 text-slate-600"><Stethoscope size={13} className="text-slate-400" /> {selectedLead.treatmentInterest || 'General Consultation'}</div>
                                </div>
                                {selectedLead.message && (
                                   <div className="pt-2 border-t border-slate-50">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Original Patient Message</p>
                                      <p className="text-xs text-slate-600 italic">"{selectedLead.message}"</p>
                                   </div>
                                )}
                                <button
                                   onClick={() => { if (!localWorkflowState?.stage1_checklist?.includes('Review New Lead')) toggleWorkflowTask(1, 'Review New Lead'); }}
                                   className={`w-full p-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${localWorkflowState?.stage1_checklist?.includes('Review New Lead') ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-teal-700'}`}
                                >
                                   {localWorkflowState?.stage1_checklist?.includes('Review New Lead') ? '✓ Lead Reviewed: Yes' : 'Mark Review New Lead: Yes'}
                                </button>
                             </div>

                             {/* Duplicate status: keep the open patient slab intentionally compact. */}
                             {(() => {
                                const duplicates = findDuplicateLeads(selectedLead);
                                return (
                                   <div className={`p-4 rounded-3xl border flex items-center justify-between ${duplicates.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                      <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${duplicates.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                         <span className={`w-2.5 h-2.5 rounded-full ${duplicates.length > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                         {duplicates.length > 0 ? 'Duplicate' : 'Not Duplicate'}
                                      </span>
                                      <button
                                         onClick={handleConfirmDuplicateCheck}
                                         className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-white/70 rounded-lg hover:bg-white transition-all"
                                      >
                                         {localWorkflowState?.duplicate_check_done ? '✓ Reviewed' : 'Confirm Result'}
                                      </button>
                                   </div>
                                );
                             })()}

                             {/* Decide Whether Lead Is Genuine */}
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Decide Whether Lead Is Genuine</p>
                                {localWorkflowState?.lead_genuine_decision === 'genuine' && (
                                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">✓ Genuine</p>
                                )}
                                <div className="flex gap-2">
                                   <button
                                      onClick={markLeadGenuine}
                                      className="flex-1 p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                                   >
                                      Genuine
                                   </button>
                                   <button
                                      onClick={() => setShowSpamReasonPicker(v => !v)}
                                      className="flex-1 p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
                                   >
                                      Not Genuine
                                   </button>
                                </div>
                                {showSpamReasonPicker && (
                                   <div className="pt-2 space-y-2 border-t border-slate-50">
                                      <select
                                         className="w-full p-3 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-bold text-rose-800 outline-none"
                                         value={spamReason}
                                         onChange={(e) => setSpamReason(e.target.value)}
                                      >
                                         <option value="">Select reason...</option>
                                         {SPAM_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                      </select>
                                      <button
                                         onClick={confirmNotGenuine}
                                         className="w-full p-3 bg-rose-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-700 transition-all"
                                      >
                                         Confirm Not Genuine & Move to Lost/Dropped
                                      </button>
                                   </div>
                                )}
                             </div>

                             <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Detailed Requirements</label>
                                <DraftTextarea 
                                   className="w-full mt-2 p-4 bg-white border border-slate-100 rounded-2xl text-xs font-medium min-h-[100px] outline-none"
                                   placeholder="Patient specific needs, special requests, and detailed health goals..."
                                   value={localWorkflowState?.discovery_requirements || ''}
                                   onChange={(e) => handleUpdateSummary('discovery_requirements', e.target.value)}
                                />
                             </div>
                             <button 
                                onClick={() => { 
                                   if(validateStage(1)) handleProgressStage(); 
                                   else toast.error('Please complete all Stage 1 checklist items first.'); 
                                }} 
                                className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                   validateStage(1) 
                                   ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg' 
                                   : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                }`}
                             >
                                {validateStage(1) ? 'Move to Outreach' : '🔒 Complete Checklist to Progress'}
                             </button>
                          </div>
                       )}

                       {activeWorkflowStage === 2 && (
                          <div className="space-y-5">
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">First Call</p>
                                    <p className="text-xs font-bold text-slate-600 mt-1">Record every attempt and keep the latest outcome visible.</p>
                                  </div>
                                  <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest">
                                    {localWorkflowState?.contact_attempt_count || 0} attempt{localWorkflowState?.contact_attempt_count === 1 ? '' : 's'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Call Outcome</label>
                                    <select value={callOutcomeDraft} onChange={(e) => setCallOutcomeDraft(e.target.value)} className="w-full mt-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none">
                                      <option value="">Select outcome...</option>
                                      {CALL_OUTCOMES.map(outcome => <option key={outcome} value={outcome}>{outcome}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Raw Call Notes</label>
                                  <textarea value={callNotesDraft} onChange={(e) => setCallNotesDraft(e.target.value)} placeholder="What did the patient say? Capture needs, concerns, and next steps..." className="w-full mt-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium min-h-[100px] outline-none" />
                                  <div className="flex justify-end mt-2">
                                    <button type="button" onClick={handleSaveRawCall} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800">Save Raw Call Notes</button>
                                  </div>
                                </div>
                                <button onClick={handleLogFirstCall} className="w-full p-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                                  <Phone size={14} className="inline mr-2" /> Save Call Attempt
                                </button>
                                {localWorkflowState?.last_attempt_at && (
                                  <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-slate-500">
                                    <span>Last attempt: {new Date(localWorkflowState.last_attempt_at).toLocaleString()}</span>
                                    <span>First contact: {new Date(localWorkflowState.first_contact_at).toLocaleString()}</span>
                                  </div>
                                )}
                             </div>

                             <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-3xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">AI Call Summary</p>
                                  <button onClick={handleGenerateCallSummary} disabled={isGeneratingCallSummary} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-60">
                                    {isGeneratingCallSummary ? 'Generating...' : 'Generate Summary'}
                                  </button>
                                </div>
                                <textarea value={aiSummaryDraft} onChange={(e) => setAiSummaryDraft(e.target.value)} placeholder="AI-generated summary will appear here for review and editing..." className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs font-medium min-h-[110px] outline-none" />
                                <button onClick={handleSaveCallSummary} className="text-[9px] font-black uppercase tracking-widest text-indigo-700 hover:text-indigo-900">Save reviewed summary</button>
                             </div>

                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Callback & SLA</p>
                                    <p className={`text-xs font-bold mt-1 ${localWorkflowState?.callback_due_at && new Date(localWorkflowState.callback_due_at) >= new Date() ? 'text-amber-600' : 'text-slate-600'}`}>
                                      {localWorkflowState?.callback_due_at ? `Callback: ${new Date(localWorkflowState.callback_due_at).toLocaleString()}` : 'No callback scheduled'}
                                    </p>
                                  </div>
                                  {localWorkflowState?.callback_due_at && new Date(localWorkflowState.callback_due_at) < new Date() && <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase">Due</span>}
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Callback Date & Time</label>
                                  <div className="flex gap-2">
                                    <input ref={callbackInputRef} type="datetime-local" value={callbackDateDraft} onChange={(e) => setCallbackDateDraft(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                                    <button type="button" onClick={() => callbackInputRef.current?.showPicker?.()} className="px-4 bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200">Calendar</button>
                                  </div>
                                </div>
                                <button onClick={handleScheduleCallback} className="w-full p-3 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100">Schedule Callback</button>
                                {!localWorkflowState?.first_contact_at && new Date().getTime() - new Date(selectedLead.createdAt || Date.now()).getTime() > 24 * 60 * 60 * 1000 && (
                                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Overdue: no first contact attempt within 24 hours</p>
                                )}
                             </div>

                             <button onClick={() => { if(validateStage(2)) handleProgressStage(); else toast.error('Please complete all Stage 2 checklist items first.'); }} className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${validateStage(2) ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'}`}>
                                {validateStage(2) ? 'Progress to Discovery' : 'Complete Stage 2 Checklist to Progress'}
                             </button>
                          </div>
                       )}

                       {activeWorkflowStage === 3 && (
                          <div className="space-y-5">
                             <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-3xl space-y-3">
                                <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Explain Patient Process</p>
                                <p className="text-xs text-slate-600 leading-relaxed">Explain the clinical review, upload-time file checks, doctor matching, quotation, and consultation steps to the patient.</p>
                             </div>
                             <div className="p-5 bg-teal-50/70 border border-teal-100 rounded-3xl space-y-3">
                                <div className="flex items-center justify-between"><p className="text-[9px] font-black text-teal-700 uppercase tracking-widest">Request Medical Documents</p><span className="text-[9px] font-black text-slate-500">{selectedLead.email || 'No email'}</span></div>
                                <p className="text-xs text-slate-600">Email a secure upload link for reports, test results, X-rays, MRI/CT scans, prescriptions, and previous treatment records.</p>
                                <button onClick={handleSendDocumentRequest} disabled={isSendingDocumentRequest} className="w-full p-3 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-teal-700 disabled:opacity-60 disabled:cursor-wait"><Mail size={14} className="inline mr-2" /> {isSendingDocumentRequest ? 'Sending Email...' : 'Send Medical Document Request Email'}</button>
                                {localWorkflowState?.document_request_sent_at && <p className="text-[10px] font-bold text-teal-700">Sent {new Date(localWorkflowState.document_request_sent_at).toLocaleString()}</p>}
                             </div>
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <div className="flex items-center justify-between"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Received Medical Documents</p><span className="px-2 py-1 bg-slate-100 rounded-lg text-[9px] font-black">{enquiryDocuments.length} received</span></div>
                                <input ref={documentFileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={handleStaffDocumentUpload} />
                                <button onClick={() => documentFileInputRef.current?.click()} disabled={isUploadingDocuments} className="w-full p-3 border-2 border-dashed border-teal-200 text-teal-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-teal-50 disabled:opacity-60 disabled:cursor-wait"><Plus size={14} className="inline mr-2" />{isUploadingDocuments ? 'Uploading...' : 'Upload Documents (PDF, JPG, JPEG, PNG)'}</button>
                                {enquiryDocuments.length === 0 ? <p className="text-xs text-slate-500">No documents received yet. Upload them here, or the patient can use the emailed link.</p> : <div className="space-y-2">{enquiryDocuments.map(doc => <div key={doc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="flex items-center justify-between gap-3"><a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-teal-700 hover:underline truncate">{doc.file_name}</a><span className="text-[9px] font-black uppercase text-emerald-700">Upload checks passed</span></div><p className="text-[10px] text-slate-400 mt-1">{new Date(doc.created_at).toLocaleString()} · {Math.round((doc.file_size || 0) / 1024)} KB</p></div>)}</div>}
                             </div>
                             <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-3xl space-y-3">
                                <div className="flex items-center justify-between">
                                   <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Assign to In-House Doctor Inbox</p>
                                   {localWorkflowState?.doctor_inbox_status === 'Assigned' && <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase">Assigned</span>}
                                </div>
                                <select
                                  className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs font-bold outline-none"
                                  value={selectedInHouseDoctor}
                                  onChange={(e) => setSelectedInHouseDoctor(e.target.value)}
                                >
                                  <option value="">{inHouseDoctorsLoaded && !IN_HOUSE_DOCTORS.length ? 'No in-house doctors found' : 'Select In-House Doctor...'}</option>
                                  {IN_HOUSE_DOCTORS.map(doc => <option key={doc} value={doc}>{doc}</option>)}
                                </select>
                                {inHouseDoctorsLoaded && !IN_HOUSE_DOCTORS.length && <p className="text-[10px] font-bold text-amber-700">Create a CRM user with the "in_house_doctor" role (User Management) and they will appear here.</p>}
                                <button onClick={assignToInHouseDoctorInbox} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700">
                                  <Activity size={14} className="inline mr-2" /> Assign to Doctor Inbox
                                </button>
                                {localWorkflowState?.assigned_doctor_name && <p className="text-[10px] font-bold text-indigo-700">Assigned doctor: {localWorkflowState.assigned_doctor_name}</p>}
                             </div>
                             <button onClick={() => { if(validateStage(3)) handleProgressStage(); else toast.error('Complete all Stage 3 requirements before moving to Stage 4.'); }} className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${validateStage(3) ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'}`}>{validateStage(3) ? 'Progress to Stage 4' : 'Complete All Stage 3 Requirements'}</button>
                          </div>
                       )}

                       {activeWorkflowStage === 4 && (
                          <div className="space-y-5">
                             <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-3xl space-y-2">
                                <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Patient in Doctor Inbox</p>
                                <p className="text-xs text-slate-600">This is an informational step, not a checkbox. The assigned doctor can review the complete enquiry before contacting the patient.</p>
                                <p className="text-xs font-black text-indigo-700">Assigned doctor: {localWorkflowState?.assigned_doctor_name || 'Not assigned'}</p>
                             </div>
                             {selectedLead && (
                               <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-4">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Complete Lead Details</p>
                                 <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                                   {([
                                     ['Patient name', selectedLead.name],
                                     ['Email', selectedLead.email],
                                     ['Phone', selectedLead.phone],
                                     ['Country', selectedLead.country],
                                     ['Treatment interest', selectedLead.treatmentInterest],
                                     ['Urgency', selectedLead.urgency],
                                     ['Budget range', selectedLead.budgetRange],
                                     ['Preferred date', selectedLead.preferredDate],
                                     ['Lead source', selectedLead.source],
                                     ['Enquiry created', selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleString() : ''],
                                     ['Last contact', selectedLead.lastContact ? new Date(selectedLead.lastContact).toLocaleString() : ''],
                                     ['Patient message', selectedLead.message],
                                     ['Lead notes', selectedLead.notes],
                                     ['BDM owner', userNameFor(selectedLead.assignedBdmId)],
                                     ['Assigned in-house doctor', localWorkflowState?.assigned_doctor_name],
                                     ['Sent to doctor inbox', localWorkflowState?.doctor_assigned_at ? new Date(localWorkflowState.doctor_assigned_at).toLocaleString() : ''],
                                   ] as [string, unknown][])
                                     .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
                                     .map(([label, value]) => (
                                       <div key={label} className="border-b border-slate-100 pb-2">
                                         <dt className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</dt>
                                         <dd className="mt-1 text-xs font-semibold text-slate-800 whitespace-pre-wrap break-words">{String(value)}</dd>
                                       </div>
                                     ))}
                                 </dl>
                               </div>
                             )}
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Doctor Reviews Uploaded Documents</p>
                                <p className="text-xs text-slate-500">Medical reports, test results, previous treatment history, patient requirements, and uploaded documents that passed upload-time file checks.</p>
                                <div className="space-y-2">{enquiryDocuments.length ? enquiryDocuments.map(doc => <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs font-bold text-teal-700"><span className="truncate">{doc.file_name}</span><span className="text-[9px] uppercase text-slate-500">'Upload checks passed'</span></a>) : <p className="text-xs text-slate-400">No uploaded documents available.</p>}</div>
                             </div>
                             <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl space-y-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Personal Doctor Call</p>
                                <p className="text-xs text-slate-500">Informational step: the doctor personally calls the patient to discuss the medical condition, history, concerns, expectations, and questions.</p>
                             </div>
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Record Doctor Call Notes</label>
                                  {localWorkflowState?.doctor_call_notes_saved_at && (
                                    <span className="text-[9px] font-bold text-slate-400">Saved {new Date(localWorkflowState.doctor_call_notes_saved_at).toLocaleString()}</span>
                                  )}
                                </div>
                                <DraftTextarea value={localWorkflowState?.doctor_call_notes || ''} onChange={(e) => handleUpdateSummary('doctor_call_notes', e.target.value)} placeholder="Record medical condition, history, concerns, expectations, and questions..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs min-h-[120px] outline-none" />
                                <button onClick={handleSaveDoctorCallNotes} className="w-full p-3 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-teal-700 transition-all">Save Doctor Call Notes</button>
                             </div>
                             <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-3xl space-y-4">
                                <div className="flex items-center justify-between">
                                  <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Initial Doctor Assessment</p>
                                  {localWorkflowState?.initial_doctor_assessment_saved_at && (
                                    <span className="text-[9px] font-bold text-slate-400">Saved {new Date(localWorkflowState.initial_doctor_assessment_saved_at).toLocaleString()}</span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Assessment</label>
                                  <DraftTextarea value={localWorkflowState?.initial_doctor_assessment || ''} onChange={(e) => handleUpdateSummary('initial_doctor_assessment', e.target.value)} placeholder="Initial assessment of the patient's condition..." className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs min-h-[110px] outline-none" />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Recommended Next Steps</label>
                                  <DraftTextarea value={localWorkflowState?.doctor_next_steps || ''} onChange={(e) => handleUpdateSummary('doctor_next_steps', e.target.value)} placeholder="Recommended next steps for the patient..." className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs min-h-[90px] outline-none" />
                                </div>
                                <button onClick={handleSaveInitialAssessment} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all">Save Initial Assessment</button>
                             </div>
                             <button onClick={handleSendPersonalDoctorEmail} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">{localWorkflowState?.personal_email_sent_at ? '✓ Personal Email Sent' : 'Send Personal Email to Patient'}</button>
                             <button onClick={handleCompleteDoctorInteraction} className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${['Record Doctor Call Notes', 'Send Personal Email to Patient'].every(task => (localWorkflowState?.stage4_checklist || []).includes(task)) && localWorkflowState?.initial_doctor_assessment?.trim() ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>Complete In-House Doctor Interaction & Progress to Stage 5</button>
                          </div>
                       )}

                       {activeWorkflowStage === 5 && (
                          <div className="space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                   <div className="flex items-center justify-between pl-1">
                                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recommended Hospitals</label>
                                     <span className="text-[9px] font-bold text-slate-400">{hospitalSuggestions.length} selected</span>
                                   </div>
                                   <div className="flex flex-wrap gap-2 min-h-[28px]">
                                     {hospitalSuggestions.map((item, i) => (
                                       <span key={`${item.name}-${i}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                                         {i === 0 && <span className="text-[8px] font-black text-teal-600 uppercase tracking-widest">Primary</span>}
                                         {item.name}
                                         <button type="button" onClick={() => removeSuggestion('hospital', i)} className="text-slate-400 hover:text-rose-600 text-sm leading-none" aria-label={`Remove ${item.name}`}>×</button>
                                       </span>
                                     ))}
                                   </div>
                                   <select
                                      className="w-full p-2 bg-white border border-slate-100 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20"
                                      value=""
                                      onChange={(e) => { const h = hospitals.find(x => x.id === e.target.value); if (h) addSuggestion('hospital', { id: h.id, name: h.name }); }}
                                   >
                                      <option value="">+ Add hospital...</option>
                                      {hospitals
                                        .filter(h => !hospitalSuggestions.some(s => s.name === h.name))
                                        .map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                   </select>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                   <div className="flex items-center justify-between pl-1">
                                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recommended Surgeons</label>
                                     <span className="text-[9px] font-bold text-slate-400">{surgeonSuggestions.length} selected</span>
                                   </div>
                                   <div className="flex flex-wrap gap-2 min-h-[28px]">
                                     {surgeonSuggestions.map((item, i) => (
                                       <span key={`${item.name}-${i}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                                         {i === 0 && <span className="text-[8px] font-black text-teal-600 uppercase tracking-widest">Primary</span>}
                                         {item.name}
                                         <button type="button" onClick={() => removeSuggestion('surgeon', i)} className="text-slate-400 hover:text-rose-600 text-sm leading-none" aria-label={`Remove ${item.name}`}>×</button>
                                       </span>
                                     ))}
                                   </div>
                                   <select
                                      className="w-full p-2 bg-white border border-slate-100 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20"
                                      value=""
                                      onChange={(e) => { const d = doctors.find(x => x.id === e.target.value); if (d) addSuggestion('surgeon', { id: d.id, name: d.name }); }}
                                   >
                                      <option value="">+ Add surgeon...</option>
                                      {doctors
                                        .filter(d => !surgeonSuggestions.some(s => s.name === d.name))
                                        .map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>)}
                                   </select>
                                </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Illness History</label>
                                   <DraftTextarea 
                                      className="w-full mt-2 p-4 bg-white border border-slate-100 rounded-2xl text-xs font-medium h-20 outline-none"
                                      placeholder="Patient's medical history..."
                                      value={localWorkflowState?.illness_history || ''}
                                      onChange={(e) => handleUpdateSummary('illness_history', e.target.value)}
                                   />
                                </div>
                                <div>
                                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Clinical Summary</label>
                                   <DraftTextarea 
                                      className="w-full mt-2 p-4 bg-white border border-slate-100 rounded-2xl text-xs font-medium h-20 outline-none"
                                      placeholder="Summary of requirements..."
                                      value={localWorkflowState?.clinical_summary || ''}
                                      onChange={(e) => handleUpdateSummary('clinical_summary', e.target.value)}
                                   />
                                </div>
                             </div>
                              
                              <div>
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Suggested Procedures</label>
                                 <DraftTextarea 
                                    className="w-full mt-2 p-4 bg-white border border-slate-100 rounded-2xl text-xs font-medium h-24 outline-none focus:ring-2 focus:ring-teal-500/10 transition-all"
                                    placeholder="List the necessary procedures suggested by the in-house doctor..."
                                    value={localWorkflowState?.suggested_procedures || ''}
                                    onChange={(e) => handleUpdateSummary('suggested_procedures', e.target.value)}
                                 />
                              </div>
                              
                              {localWorkflowState?.suggested_hospital && localWorkflowState?.suggested_surgeon && (
                                <div className="p-5 bg-teal-50 border border-teal-100 rounded-[2rem] animate-in fade-in slide-in-from-top-2 duration-500">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-white text-teal-600 rounded-xl shadow-sm"><Stethoscope size={18} /></div>
                                    <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest">Clinical Selection Summary</p>
                                  </div>
                                  <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                    Clinical review complete. Suggested surgeon(s): <span className="text-teal-600">{surgeonSuggestions.map(d => d.name).join(', ')}</span>. Suggested hospital(s): <span className="text-teal-600">{hospitalSuggestions.map(h => h.name).join(', ')}</span>.
                                  </p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <button onClick={handleFinalizeClinicalRecommendation} className="p-3 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">{localWorkflowState?.clinical_recommendation_finalized ? '✓ Recommendation Finalized' : 'Finalize Clinical Recommendation'}</button>
                                <button onClick={handleConfirmClinicalReview} className="p-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">{localWorkflowState?.clinical_review_confirmed ? '✓ Clinical Review Confirmed' : 'Confirm Clinical Review'}</button>
                              </div>
                              <div className="grid grid-cols-5 gap-3">
                                <button 
                                  onClick={generateClinicalReviewPDF}
                                  className={`p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all border-2 ${
                                    clinicalNotesPdf 
                                    ? 'col-span-2 bg-slate-50 border-slate-200 text-slate-400' 
                                    : 'col-span-5 bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                                  }`}
                                >
                                   {clinicalNotesPdf ? <Activity size={16} /> : <FileText size={16} />}
                                   {clinicalNotesPdf ? 'Regenerate' : 'Generate Clinical Review Report'}
                                </button>

                                {clinicalNotesPdf && (
                                  <button 
                                    onClick={() => {
                                      const blobUrl = URL.createObjectURL(
                                        new Blob([Uint8Array.from(atob(clinicalNotesPdf), c => c.charCodeAt(0))], { type: 'application/pdf' })
                                      );
                                      window.open(blobUrl, '_blank');
                                    }}
                                    className="col-span-3 p-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg"
                                  >
                                     <ExternalLink size={16} /> View Clinical Report
                                  </button>
                                )}
                              </div>
                              <button 
                                 onClick={() => {
                                    if(validateStage(5)) finalizeClinicalReview(selectedLead);
                                    else toast.error('Please complete all Stage 5 checklist items first.');
                                 }} 
                                 className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${
                                    validateStage(5)
                                    ? 'bg-teal-600 text-white hover:bg-teal-700'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                 }`}
                              >
                                 <CheckCircle2 size={16} /> {validateStage(5) ? 'Finalize Clinical Review' : '🔒 Checklist Incomplete'}
                              </button>
                          </div>
                       )}

                       {activeWorkflowStage === 6 && (
                          <div className="space-y-4">
                            <LeadQuotationPanel
                              lead={selectedLead}
                              selectedQuotationNo={choiceFor(selectedLead).selectedQuotationNo}
                              selectedQuotationAt={choiceFor(selectedLead).selectedQuotationAt}
                              onSelectQuotation={handleSelectQuotation}
                              onRefreshChoice={() => refreshQuotationChoice(selectedLead.id)}
                              readOnly={isStageReadOnly}
                            />

                            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Patient Decision</p>
                                  <p className="text-xs text-slate-600 font-bold text-center mb-6 px-4">
                                    Are you interested to proceed with the following procedures suggested by the doctor?
                                  </p>
                                  {choiceFor(selectedLead).selectedQuotationNo && (
                                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest text-center mb-4">
                                      Patient's choice: Quotation {choiceFor(selectedLead).selectedQuotationNo}
                                    </p>
                                  )}
                                  <div className="flex gap-4 justify-center">
                                    <button 
                                      onClick={() => {
                                        handleConfirmPatientInterest('Agreed');
                                      }}
                                      className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                        localWorkflowState?.patient_interest === 'Agreed' 
                                        ? 'bg-emerald-600 text-white shadow-lg' 
                                        : 'bg-white text-slate-400 hover:text-emerald-600 border border-slate-100'
                                      }`}
                                    >
                                      Agreed
                                    </button>
                                    <button 
                                      onClick={() => handleConfirmPatientInterest('Disagreed')}
                                      className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                        localWorkflowState?.patient_interest === 'Disagreed' 
                                        ? 'bg-rose-600 text-white shadow-lg' 
                                        : 'bg-white text-slate-400 hover:text-rose-600 border border-slate-100'
                                      }`}
                                    >
                                      Disagreed
                                    </button>
                                  </div>
                               </div>

                               {localWorkflowState?.patient_interest === 'Agreed' && (
                               <button 
                                 onClick={() => {
                                   void handleProceedToSpecialistStage();
                                 }} 
                                 className={`w-full p-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all ${
                                   validateStage(6)
                                   ? 'bg-teal-600 text-white hover:bg-teal-700'
                                   : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                 }`}
                               >
                                  <Clock size={18} /> {validateStage(6) ? 'Proceed to Specialist Consultation (Stage 7)' : '🔒 Complete Proposal Checklist'}
                               </button>
                               )}

                               {localWorkflowState?.patient_interest === 'Disagreed' && (
                                 <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-bold text-center uppercase tracking-widest animate-in slide-in-from-bottom-2">
                                   Patient has disagreed. Consider dropping the lead or offering alternatives.
                                 </div>
                               )}
                            </div>
                         )}

                       {activeWorkflowStage === 7 && (
                          <div className="space-y-5">
                             <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-3xl space-y-3">
                                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Stage 7: Specialist Consultation & Final Confirmation</p>
                                <p className="text-xs text-slate-600">Complete the specialist discussion, record the MOM, confirm the quotation and clinical process with the patient, request the patient to proceed, and provide the payment link.</p>
                             </div>
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Step 1 — Specialist Doctor Call & MOM</p>
                                {localWorkflowState?.doctor_call_notes && (
                                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Saved Doctor Call Notes (Stage 4)</p>
                                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{localWorkflowState.doctor_call_notes}</p>
                                  </div>
                                )}
                                <DraftTextarea value={localWorkflowState?.specialist_call_notes || ''} onChange={(e) => handleUpdateSummary('specialist_call_notes', e.target.value)} placeholder="Medical condition, proposed treatment, procedure, clinical process, questions, and concerns..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs min-h-[110px] outline-none" />
                                <button onClick={() => handleCompleteSpecialistCall(localWorkflowState?.specialist_call_notes || '')} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">{localWorkflowState?.specialist_call_completed_at ? '✓ Specialist Doctor Call Recorded' : 'Record Specialist Doctor Call'}</button>
                                {localWorkflowState?.specialist_call_completed_at && localWorkflowState?.specialist_call_notes && (
                                  <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl">
                                    <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest mb-2">Saved Specialist Call Notes · {new Date(localWorkflowState.specialist_call_completed_at).toLocaleString()}</p>
                                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{localWorkflowState.specialist_call_notes}</p>
                                  </div>
                                )}
                             </div>
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Step 1b — Record MOM</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {MOM_FIELDS.map(([field, label]) => (
                                    <div key={field} className="space-y-1">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
                                      {field === 'mom_date_time' ? (
                                        <>
                                          <input
                                            type="datetime-local"
                                            value={MOM_DATE_PATTERN.test(String(localWorkflowState?.[field] || '')) ? localWorkflowState[field] : ''}
                                            onChange={(e) => handleUpdateSummary(field, e.target.value)}
                                            onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch { /* picker opens on the icon instead */ } }}
                                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none cursor-pointer"
                                          />
                                          {localWorkflowState?.[field] && !MOM_DATE_PATTERN.test(String(localWorkflowState[field])) && (
                                            <p className="text-[9px] font-bold text-amber-600 pl-1">Saved earlier as “{String(localWorkflowState[field])}”. Pick the date and time to replace it.</p>
                                          )}
                                        </>
                                      ) : (
                                        <DraftTextarea value={localWorkflowState?.[field] || ''} onChange={(e) => handleUpdateSummary(field, e.target.value)} placeholder={label} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs min-h-[58px] outline-none" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <button onClick={handleRecordMOM} className="w-full p-3 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">{localWorkflowState?.mom_recorded_at ? '✓ MOM Recorded' : 'Record MOM'}</button>
                                {localWorkflowState?.mom_pdf_url && (
                                  <a href={localWorkflowState.mom_pdf_url} target="_blank" rel="noreferrer" className="block w-full p-3 text-center bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200">View MOM PDF</a>
                                )}
                             </div>
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Step 2 — BDM Calls Patient</p>
                                <DraftTextarea value={localWorkflowState?.bdm_call_notes || ''} onChange={(e) => handleUpdateSummary('bdm_call_notes', e.target.value)} placeholder="Record patient understanding, willingness to proceed, concerns, and follow-up..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs min-h-[90px] outline-none" />
                                <button onClick={() => handleCompleteBdmCall(localWorkflowState?.bdm_call_notes || '')} className="w-full p-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">{localWorkflowState?.bdm_call_completed_at ? '✓ BDM Call Recorded' : 'Record BDM Patient Call'}</button>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button onClick={() => handleConfirmQuotationAgreement(true)} className={`p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${localWorkflowState?.quotation_agreement_confirmed ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>{localWorkflowState?.quotation_agreement_confirmed ? '✓ Quotation Agreement Confirmed' : 'Confirm Quotation Agreement'}</button>
                                <button onClick={() => handleConfirmClinicalProcessAgreement(true)} className={`p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${localWorkflowState?.clinical_process_agreement_confirmed ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>{localWorkflowState?.clinical_process_agreement_confirmed ? '✓ Clinical Process Confirmed' : 'Confirm Clinical Process Agreement'}</button>
                             </div>
                             <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Step 3 — Patient Agreement</p>
                                <div className="flex gap-3"><button onClick={() => handleRecordStage7Decision('Agreed')} className={`flex-1 p-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${localWorkflowState?.stage7_patient_decision === 'Agreed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>Patient Agreed</button><button onClick={() => handleRecordStage7Decision('Disagreed')} className={`flex-1 p-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${localWorkflowState?.stage7_patient_decision === 'Disagreed' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'}`}>Patient Disagreed</button></div>
                                {localWorkflowState?.stage7_patient_decision === 'Disagreed' && <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><DraftTextarea value={localWorkflowState?.stage7_disagreement_reason || ''} onChange={(e) => handleUpdateSummary('stage7_disagreement_reason', e.target.value)} placeholder="Reason" className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs min-h-[70px]" /><DraftTextarea value={localWorkflowState?.stage7_disagreement_concern || ''} onChange={(e) => handleUpdateSummary('stage7_disagreement_concern', e.target.value)} placeholder="Patient concern" className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs min-h-[70px]" /><DraftTextarea value={localWorkflowState?.stage7_disagreement_followup || ''} onChange={(e) => handleUpdateSummary('stage7_disagreement_followup', e.target.value)} placeholder="Required follow-up" className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs min-h-[70px]" /></div>}
                             </div>
                             <button onClick={handleRequestPatientToProceed} className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${localWorkflowState?.request_to_proceed_confirmed ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-700 border border-teal-100'}`}>{localWorkflowState?.request_to_proceed_confirmed ? '✓ Patient Requested to Proceed' : 'Request Patient to Proceed'}</button>
                             <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-3xl space-y-3">
                                <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Step 4 — VIL Medical Visa Application Form</p>
                                <p className="text-xs text-slate-600">The patient receives the VIL form by email. Their answers and documents are saved here automatically when they submit.</p>
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <p className="text-[10px] font-bold text-slate-500">{localWorkflowState?.vil_form_sent_at ? `Sent ${new Date(localWorkflowState.vil_form_sent_at).toLocaleString()}` : 'Not sent yet'}</p>
                                  <button onClick={handleSendVilForm} disabled={isSendingVilForm || !canWriteStage(7) || isViewOnlyStage} className="p-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">{isSendingVilForm ? 'Sending…' : localWorkflowState?.vil_form_sent_at ? 'Resend VIL Form' : 'Send VIL Form to Patient'}</button>
                                </div>
                                <div className={`p-4 rounded-xl border ${vilSubmission ? 'bg-teal-50 border-teal-100' : 'bg-white border-slate-100'}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${vilSubmission ? 'text-teal-700' : 'text-slate-400'}`}>{vilSubmission ? `✓ Submitted ${new Date(vilSubmission.submitted_at).toLocaleString()}` : 'Awaiting patient submission'}</p>
                                    <button onClick={() => selectedLead?.id && loadVilSubmission(selectedLead.id)} className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Refresh status</button>
                                  </div>
                                  {vilLoadError && <p className="mt-2 text-[10px] font-bold text-rose-600">Could not load submission: {vilLoadError}</p>}
                                  {vilSubmission && (
                                    <div className="mt-4 space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {VIL_TEXT_ITEMS.map((item) => (
                                          <div key={item.key} className="p-2 bg-white rounded-lg">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                                            <p className="text-xs text-slate-700 whitespace-pre-wrap">{vilSubmission.form?.[item.key] || '—'}</p>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="space-y-1">
                                        {VIL_FILE_ITEMS.map((item) => {
                                          const docs = (vilSubmission.documents || []).filter((d: any) => d.field === item.key);
                                          return (
                                            <div key={item.key} className="flex items-start justify-between gap-3 p-2 bg-white rounded-lg">
                                              <p className="text-xs text-slate-700">{item.label}</p>
                                              {docs.length > 0 ? (
                                                <div className="flex flex-col items-end gap-1">
                                                  {docs.map((doc: any, index: number) => (
                                                    <button key={`${doc.file_path || doc.file_name}-${index}`} type="button" onClick={() => openVilDocument(doc)} className="text-[10px] font-bold text-indigo-600 underline truncate max-w-[200px]">{doc.file_name}</button>
                                                  ))}
                                                </div>
                                              ) : <span className="text-[10px] text-rose-600 font-bold">Missing</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                             </div>
                             <div className="p-5 bg-sky-50/70 border border-sky-100 rounded-3xl space-y-4">
                                <p className="text-[9px] font-black text-sky-700 uppercase tracking-widest">Step 5 — Visa Application</p>
                                <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-sky-100 cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4 accent-sky-600" checked={Boolean(localWorkflowState?.visa_application_sent_at)} disabled={isStageReadOnly} onChange={(e) => handleToggleVisaSent(e.target.checked)} />
                                  <span className="text-xs font-black text-slate-700">Send request for visa application</span>
                                  {localWorkflowState?.visa_application_sent_at && <span className="ml-auto text-[10px] font-bold text-slate-400">{new Date(localWorkflowState.visa_application_sent_at).toLocaleString()}</span>}
                                </label>
                                <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-sky-100 cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4 accent-sky-600" checked={Boolean(localWorkflowState?.visa_application_created)} disabled={isStageReadOnly} onChange={(e) => handleToggleVisaCreated(e.target.checked)} />
                                  <span className="text-xs font-black text-slate-700">Visa application created</span>
                                  {localWorkflowState?.visa_application_created_at && <span className="ml-auto text-[10px] font-bold text-slate-400">{new Date(localWorkflowState.visa_application_created_at).toLocaleString()}</span>}
                                </label>
                                <div className="p-4 bg-white rounded-xl border-2 border-dashed border-sky-200 space-y-3">
                                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visa document</p>
                                  {localWorkflowState?.visa_document_path ? (
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <p className="text-xs font-bold text-slate-700 truncate max-w-[260px]">{localWorkflowState.visa_document_name || 'Visa document'}</p>
                                      <button type="button" onClick={openVisaDocument} className="text-[10px] font-black text-sky-700 uppercase tracking-widest underline">View</button>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] font-bold text-slate-400">No visa document uploaded yet</p>
                                  )}
                                  <label className={`block w-full p-3 text-center rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer ${isUploadingVisa || isStageReadOnly ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-700'}`}>
                                    {isUploadingVisa ? 'Uploading…' : localWorkflowState?.visa_document_path ? 'Replace visa document' : 'Upload visa document'}
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" disabled={isUploadingVisa || isStageReadOnly} onChange={handleUploadVisaDocument} />
                                  </label>
                                  <p className="text-[9px] font-bold text-slate-400">PDF, JPG or PNG · max 10 MB</p>
                                </div>
                             </div>
                             <button onClick={() => { if (validateStage(7)) handleStageJump(8); else toast.error('Complete all Stage 7 checklist items first.'); }} className={`w-full p-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl ${validateStage(7) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'}`}><ChevronRight size={18} /> {validateStage(7) ? 'Proceed to Stage 8' : 'Complete Stage 7 Checklist to Proceed'}</button>
                           </div>
                        )}

                       {activeWorkflowStage === 8 && (
                          <div className="space-y-5">
                             <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl space-y-3">
                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Stage 8: Medical Case Handover</p>
                                <p className="text-xs text-slate-600">The advance payment (payment link and verification) is completed here in Stage 8 before the lead is converted. Visa application steps are handled in Stage 7. Stage 8 then creates or links the patient website account, converts the patient into a medical case, and hands the connected record to CDM/WaruBuddy.</p>
                             </div>
                             <div className="p-5 bg-amber-50 border border-amber-100 rounded-3xl space-y-3"><p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Advance Payment — Payment Link & Verification</p><button onClick={handleGenerateAdvancePaymentLink} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">{localWorkflowState?.payment_reference ? '✓ Payment Link Generated' : 'Generate Payment Link'}</button><DraftInput value={localWorkflowState?.payment_link || ''} onChange={(e) => handleUpdateSummary('payment_link', e.target.value)} placeholder="https://payment.example.com/..." className="w-full p-3 bg-white border border-amber-100 rounded-xl text-xs font-bold" /><div className="space-y-1"><button onClick={() => handleProvidePaymentLink(localWorkflowState?.payment_link || '')} disabled={isSendingPaymentLink || !localWorkflowState?.payment_link} className="w-full p-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">{isSendingPaymentLink ? 'Sending Email…' : localWorkflowState?.payment_link_provided_at ? 'Resend Payment Link Email' : 'Email Payment Link to Patient'}</button>{localWorkflowState?.payment_link_provided_at && <p className="text-[10px] font-bold text-amber-700">Emailed {new Date(localWorkflowState.payment_link_provided_at).toLocaleString()}</p>}</div><div className="grid grid-cols-2 gap-3"><DraftInput type="text" value={localWorkflowState?.payment_status || ''} onChange={(e) => handleUpdateSummary('payment_status', e.target.value)} placeholder="Payment status" className="p-3 bg-white border border-amber-100 rounded-xl text-xs" /><DraftInput type="number" value={localWorkflowState?.payment_amount ?? ''} onChange={(e) => handleUpdateSummary('payment_amount', e.target.value ? Number(e.target.value) : null)} placeholder="Amount" className="p-3 bg-white border border-amber-100 rounded-xl text-xs" /></div><button onClick={handleVerifyAdvancePayment} className={`w-full p-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${localWorkflowState?.advance_payment_verified ? 'bg-teal-600 text-white' : 'bg-white text-teal-700 border border-teal-100'}`}>{localWorkflowState?.advance_payment_verified ? '✓ Advance Payment Verified' : 'Verify Advance Payment'}</button></div>
                                <div className="p-5 bg-emerald-50/70 border border-emerald-100 rounded-3xl space-y-3">
                                  <div><p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Patient Account & Profile</p><p className="mt-1 text-xs text-slate-600">Created when you press "Create Patient Account" below. The CRM securely creates or links the Auth user and the existing WaruWenJo signup trigger creates the standard patient profile, patient record, and role.</p></div>
                                  {localWorkflowState?.patient_user_id ? (
                                    <p className="text-[10px] font-bold text-emerald-700">✓ Account {String(localWorkflowState.patient_account_status || 'linked').replace(/_/g, ' ')}{localWorkflowState.patient_invitation_sent_at ? ' · Invitation sent' : ''}</p>
                                  ) : localWorkflowState?.handover_prepared_at && localWorkflowState?.patient_account_status !== 'failed' ? (
                                    <p className="text-[10px] font-bold text-amber-700">Handover prepared — patient account provisioning is being completed.</p>
                                  ) : (
                                    <p className="text-[10px] font-bold text-slate-400">Patient account not created yet.</p>
                                  )}
                                  {localWorkflowState?.patient_account_status === 'failed' && <p className="text-[10px] font-bold text-red-600 break-words">Account failed: {localWorkflowState.patient_account_error || 'Unknown error. Check the browser console.'}</p>}
                                  <button onClick={handlePreparePatientHandover} disabled={isCreatingPatientAccount || isRefreshingAccountStatus} className="w-full p-3 rounded-xl font-black text-[10px] uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-50">{localWorkflowState?.patient_user_id ? '✓ Patient Account Ready' : isCreatingPatientAccount ? 'Creating Account…' : localWorkflowState?.patient_account_status === 'failed' ? 'Retry Create Patient Account' : 'Create Patient Account'}</button>
                                <button onClick={handleRefreshAccountStatus} disabled={Boolean(localWorkflowState?.patient_user_id) || isRefreshingAccountStatus} className={`w-full p-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${localWorkflowState?.patient_user_id ? 'bg-emerald-600 text-white' : localWorkflowState?.handover_prepared_at ? 'bg-white text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>{localWorkflowState?.patient_user_id ? '✓ Patient Account Created & Linked' : isRefreshingAccountStatus ? 'Checking…' : 'Refresh Account Status'}</button>
                                </div>
                                <div className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Convert Lead to Medical Case</p>
                                  <p className="text-xs text-slate-500">Create the patient profile first. The medical case is then linked to that patient and retains the patient history, documents, clinical review, quotation, financial proposal, MOM, confirmation, and payment information.</p>
                                  <button
                                    type="button"
                                    onClick={() => handleConvertToCase(selectedLead)}
                                    disabled={!Boolean(localWorkflowState?.patient_user_id) || !Boolean(localWorkflowState?.advance_payment_verified) || Boolean(localWorkflowState?.medical_case_id) || isConvertingToCase}
                                    title={!localWorkflowState?.patient_user_id ? 'Create and link the patient profile first' : !localWorkflowState?.advance_payment_verified ? 'Verify the advance payment first' : undefined}
                                    className="w-full p-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                                  >
                                    {localWorkflowState?.medical_case_id
                                      ? '✓ Medical Case Created'
                                      : isConvertingToCase
                                        ? 'Creating Medical Case…'
                                        : !localWorkflowState?.patient_user_id
                                          ? 'Create Patient Profile First'
                                          : !localWorkflowState?.advance_payment_verified
                                            ? 'Verify Advance Payment First'
                                            : 'Convert Lead to Medical Case'}
                                  </button>
                                </div>
                                <button onClick={handleInitiateHandover} className={`w-full p-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${localWorkflowState?.handover_initiated_at ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-100'}`}>{localWorkflowState?.handover_initiated_at ? '✓ Handover Sent to CDM/WaruBuddy' : 'Send Handover to CDM/WaruBuddy'}</button>
                                <button onClick={handleAcceptHandover} className={`w-full p-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${localWorkflowState?.handover_accepted_at ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-100'}`}>{localWorkflowState?.handover_accepted_at ? '✓ Handover Accepted & Ownership Confirmed' : 'CDM/WaruBuddy Accepts & Confirms Ownership'}</button>
                             <button onClick={handleCompleteStage8} disabled={Boolean(localWorkflowState?.stage8_completed_at)} className={`w-full p-5 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 ${localWorkflowState?.stage8_completed_at ? 'bg-emerald-600 text-white' : validateStagePrerequisites(8, 'Complete Stage 8') ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}><CheckCircle2 size={18} /> {localWorkflowState?.stage8_completed_at ? 'Stage 8 Completed' : validateStagePrerequisites(8, 'Complete Stage 8') ? 'Complete Stage 8' : 'Complete All Stage 8 Requirements'}</button>
                             {localWorkflowState?.stage8_completed_at && (
                               <div className="w-full p-5 rounded-3xl bg-emerald-50 border border-emerald-200 text-center">
                                 <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">Lead Won</p>
                                 <p className="text-xs text-emerald-800 mt-2">This lead is won. Completed on {new Date(localWorkflowState.stage8_completed_at).toLocaleString()}.</p>
                               </div>
                             )}
                          </div>
                       )}

                       {activeWorkflowStage === 9 && (
                          <div className="space-y-4">
                             <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl">
                                <h4 className="text-rose-900 font-black mb-4 flex items-center gap-2"><AlertTriangle size={20} /> Drop-off Analysis</h4>
                                <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest pl-1">Select Reason</label>
                                <select 
                                   className="w-full mt-2 p-4 bg-white border border-rose-100 rounded-2xl text-xs font-bold text-rose-800"
                                   value={localWorkflowState?.dropoff_reason || ''}
                                   onChange={(e) => handleUpdateSummary('dropoff_reason', e.target.value)}
                                >
                                   <option value="">Select reason...</option>
                                   <option value="Price Too High">Price Too High</option>
                                   <option value="Chose Competitor">Chose Competitor</option>
                                   <option value="No Response">Unresponsive</option>
                                   <option value="Medical Unfit">Medical Unfit</option>
                                   <option value="Visa Rejected">Visa Rejected</option>
                                </select>
                                <div className="mt-4 p-4 bg-white rounded-2xl border border-rose-100">
                                  <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Dropped At</p>
                                  <p className="mt-1 text-sm font-black text-rose-900">
                                    {localWorkflowState?.dropped_from_stage ? `Stage ${localWorkflowState.dropped_from_stage} — ${STAGES.find(stage => stage.id === Number(localWorkflowState.dropped_from_stage))?.name || 'Previous stage'}` : 'Previous stage not recorded'}
                                  </p>
                                  {localWorkflowState?.dropped_at && <p className="mt-1 text-[10px] text-rose-500">{new Date(localWorkflowState.dropped_at).toLocaleString()}</p>}
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button 
                                       onClick={async () => {
                                          if(String(localWorkflowState?.dropoff_reason || '').trim()) {
                                             await persistWorkflowPatch({
                                               dropoff_reason: localWorkflowState?.dropoff_reason,
                                               archived_at: new Date().toISOString(),
                                               stage9_checklist: ['Select Drop-off Reason', 'Archive Lead'],
                                             });
                                             await updateLeadStatus(selectedLead.id, 'lost');
                                             toast.error('Lead Archived & Dropped');
                                             loadLeads();
                                          } else toast.error('Select a drop-off reason first.');
                                       }}
                                       className="flex-[2] p-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-500/20"
                                    >
                                       Confirm Drop-off & Archive
                                    </button>
                                    <button 
                                       onClick={() => handleRestoreLead()}
                                       className="flex-1 p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm"
                                    >
                                       Continue from Dropped Stage
                                    </button>
                                 </div>
                             </div>
                          </div>
                       )}
                    </div>
                 </div>
              </div>

              {/* Lead detail improvements - Activity Log, Docs, Assigned Agent */}
              <div className="grid grid-cols-1 gap-8 mt-10">
                {/* Left Column: Assigned Agent & Documents */}
                <div className="space-y-6">
                  {/* Assigned Agent */}
                  <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex items-center justify-between">
                      <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lead Owner</p>
                          <div className="flex items-center gap-3 mt-3">
                              <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-black shadow-inner">
                                {(() => {
                                  const name = getLeadOwnerName(selectedLead);
                                  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                                })()}
                              </div>
                              <span className="text-base font-black text-slate-800 tracking-tight">
                                {getLeadOwnerName(selectedLead)}
                              </span>
                          </div>
                      </div>
                  </div>
                </div>

                {/* Right Column: Communication Log / Timeline */}
                <div className="space-y-6">
                  <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 h-full min-h-[300px] flex flex-col">
                      <h3 className="text-sm font-black mb-6 flex items-center text-slate-800"><Activity className="w-5 h-5 mr-2 text-slate-400" /> Activity Timeline</h3>
                      <div className="flex-1 overflow-y-auto space-y-5 pr-2">
                          {activityLogs.length > 0 ? activityLogs.map((log) => (
                            <div key={log.id} className="relative pl-6 border-l-2 border-slate-100">
                                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ring-4 ring-white ${
                                  log.action.includes('Email') ? 'bg-blue-500' : 
                                  log.action.includes('Stage') ? 'bg-teal-500' :
                                  log.action.includes('Report') ? 'bg-indigo-500' :
                                  log.action.includes('Confirmed') ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}></div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                  {new Date(log.created_at).toLocaleString('en-US', { 
                                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                                  })}
                                </p>
                                <div className={`p-4 rounded-2xl border ${
                                  log.action.includes('Email') ? 'bg-blue-50/50 border-blue-100' :
                                  log.action.includes('Stage') ? 'bg-teal-50/50 border-teal-100' :
                                  log.action.includes('Confirmed') ? 'bg-emerald-50/50 border-emerald-100' :
                                  'bg-slate-50 border-slate-100'
                                }`}>
                                    <p className="text-xs font-bold text-slate-700">
                                      <span className={`font-black uppercase tracking-widest text-[10px] mr-2 ${
                                        log.action.includes('Email') ? 'text-blue-700' :
                                        log.action.includes('Stage') ? 'text-teal-700' :
                                        log.action.includes('Confirmed') ? 'text-emerald-700' :
                                        'text-slate-500'
                                      }`}>
                                        {log.action.includes('Email') ? 'Email:' : 
                                         log.action.includes('Stage') ? 'Workflow:' : 
                                         log.action.includes('Confirmed') ? 'Schedule:' : 'System:'}
                                      </span> 
                                      {log.action}
                                    </p>
                                    {log.details && Object.keys(log.details).length > 0 && (
                                      <p className="text-[10px] text-slate-400 mt-1 italic">
                                        {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                      </p>
                                    )}
                                </div>
                            </div>
                          )) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-30 py-10">
                              <Activity size={40} className="text-slate-300 mb-2" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No activity recorded</p>
                            </div>
                          )}
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </LeadDetailErrorBoundary>
      )}

      {/* MODALS */}
      {showModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <h3 className="text-2xl font-black tracking-tight leading-none">New Discovery Intake</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Manual Enquiry Registry</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                  <input required type="text" className="w-full mt-2 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" onChange={e => setNewLead({ ...newLead, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Clinical Interest</label>
                  <input required type="text" className="w-full mt-2 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" onChange={e => setNewLead({ ...newLead, treatmentInterest: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nationality</label>
                  <input type="text" className="w-full mt-2 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" onChange={e => setNewLead({ ...newLead, country: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Urgency</label>
                  <select className="w-full mt-2 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" onChange={e => setNewLead({ ...newLead, urgency: e.target.value })}>
                    <option value="Standard">Standard</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email</label>
                  <input required type="email" className="w-full mt-2 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" onChange={e => setNewLead({ ...newLead, email: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-teal-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-teal-700 transition-all">Onboard Inquiry</button>
            </form>
          </div>
        </div>
      )}

      {showStage5Complete && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-[2rem] p-8 text-center shadow-2xl space-y-5">
            <div className="mx-auto w-14 h-14 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle2 size={30} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900">Stage 5 Completed</h3>
              <p className="text-sm font-semibold text-slate-500">
                Clinical review is finalized. The lead has moved to Stage 6 (Financial & Logistics Proposal) and the assigned BDM can now work on it.
              </p>
            </div>
            <button
              onClick={() => setShowStage5Complete(false)}
              className="w-full py-4 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-700 transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PatientLeads;