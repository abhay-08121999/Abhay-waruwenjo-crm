/**
 * Supabase Service Functions
 * Extended CRUD operations for the CRM admin panel
 */

import { createClient } from '@supabase/supabase-js';
import { supabase, Tables, InsertTables, UpdateTables } from '../integrations/supabase/client';
import { AppRole } from '../types';

// A second, throwaway Supabase client used ONLY to run the patient signUp() call.
// supabase.auth.signUp() on the main `supabase` client would sign the browser in
// as the new patient and replace the CRM staff member's own session — this client
// has its own separate localStorage key so that never happens, and we simply
// discard it once we have the new user's id.
const patientSignupClient = createClient(
  import.meta.env.VITE_SUPABASE_URL?.trim(),
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'crm-patient-signup-throwaway',
    },
  },
);



// ============================================
// B2B LEADS / PARTNERSHIPS
// ============================================

export const fetchB2BLeads = async () => {
  const { data, error } = await supabase
    .from('medical_leads')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};


/**
 * Creates a Medical Partner lead from the Stage 1 Partnership Inquiry form.
 *
 * This is separate from createPatientEnquiry(): Medical Partner Leads belong
 * in public.medical_leads, not public.patient_enquiries.
 * This function only saves the inquiry; it does not send email/MoU or activate
 * a partner. Existing Supabase authentication and RLS policies remain in use.
 */
export const createB2BLead = async (lead: {
  partner_type: string;
  full_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  industry?: string;
  country?: string;
  city?: string;
  website?: string;
  address?: string;
  source: string;
  source_reference?: string;
  campaign_name?: string;
  target_geography?: string;
  owner_name: string;
  data_use_permission: boolean;
  notes?: string;
  status?: string;
  estimated_value?: number | null;
  pipeline_stage?: string;
}) => {
  try {
    // Explicit payload prevents accidental fields being sent to PostgREST.
    const payload = {
      partner_type: lead.partner_type.trim(),
      full_name: lead.full_name.trim(),
      company_name: lead.company_name?.trim() || null,
      email: lead.email?.trim().toLowerCase() || null,
      phone: lead.phone?.trim() || null,
      industry: lead.industry?.trim() || null,
      country: lead.country?.trim() || null,
      city: lead.city?.trim() || null,
      website: lead.website?.trim() || null,
      address: lead.address?.trim() || null,
      source: lead.source.trim(),
      source_reference: lead.source_reference?.trim() || null,
      campaign_name: lead.campaign_name?.trim() || null,
      target_geography: lead.target_geography?.trim() || null,
      owner_name: lead.owner_name.trim(),
      data_use_permission: lead.data_use_permission,
      notes: lead.notes?.trim() || null,
      status: lead.status ?? 'new',
      pipeline_stage: lead.pipeline_stage ?? 'Imported',
      estimated_value: lead.estimated_value ?? null,
    };

    const { data, error } = await supabase
      .from('medical_leads')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[medical_leads] Insert failed:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return { data: null, error };
    }

    if (!data) {
      const noDataError = new Error('Supabase did not return the saved medical lead record.');
      console.error('[medical_leads] Insert returned no record.');
      return { data: null, error: noDataError };
    }

    console.info('[medical_leads] Partner inquiry saved:', data.id);
    return { data, error: null };
  } catch (caught) {
    const error = caught instanceof Error
      ? caught
      : new Error('Unexpected error while creating the partner inquiry.');
    console.error('[medical_leads] Unexpected insert exception:', error);
    return { data: null, error };
  }
};

// ============================================
// DIGITAL VAULT / FILES
// ============================================

export const fetchMedicalFiles = async (patientId?: string) => {
  let query = supabase.from('medical_files').select('*');
  if (patientId) query = query.eq('patient_id', patientId);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  return { data, error };
};

// ============================================
// LEADS / ENQUIRIES
// ============================================

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  status: string;
  value: number;
  notes: string;
  facility_type: string;
  created_at?: string;
}

export const fetchPatientEnquiries = async () => {
  const { data, error } = await supabase
    .from('patient_enquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching enquiries:', error);
  }
  return { data, error };
};

export const fetchLeads = fetchPatientEnquiries;

export const createPatientEnquiry = async (enquiry: any) => {
  const { data, error } = await supabase
    .from('patient_enquiries')
    .insert(enquiry)
    .select()
    .single();

  // ─── Send SMS/WhatsApp confirmation to the patient ───────────────────────
  if (!error && data && data.phone) {
    try {
      const payload = {
        full_name: data.full_name ?? enquiry.full_name,
        phone: data.phone ?? enquiry.phone,
        email: data.email ?? enquiry.email,
        country: data.country ?? enquiry.country,
        treatment_interest: data.treatment_interest ?? enquiry.treatment_interest,
        preferred_date: data.preferred_date ?? enquiry.preferred_date,
        message: data.message ?? enquiry.message,
        urgency: data.urgency ?? enquiry.urgency,
        enquiry_id: data.id,
      };

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'send-enquiry-sms',
        { body: payload }
      );

      if (fnError) {
        console.warn('[SMS] Edge function error (non-blocking):', fnError.message);
      } else {
        console.log('[SMS] Notification dispatched:', fnData);
      }
    } catch (smsErr) {
      // Non-blocking — the enquiry is still saved even if SMS fails
      console.warn('[SMS] Failed to send confirmation SMS (non-blocking):', smsErr);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  return { data, error };
};

export const createLead = createPatientEnquiry;

export const updatePatientEnquiry = async (id: string, enquiry: any) => {
  const { data, error } = await supabase
    .from('patient_enquiries')
    .update(enquiry)
    .eq('id', id);

  return { data, error };
};

export const updateLeadStatus = async (id: string, status: string) => {
  return updatePatientEnquiry(id, { status });
};

export const updateLeadWorkflow = async (id: string, stage: number, status?: string) => {
  const payload: any = { workflow_stage: stage };
  if (status) payload.status = status;
  return updatePatientEnquiry(id, payload);
};

export const saveLeadWorkflowState = async (id: string, state: any) => {
  return updatePatientEnquiry(id, { workflow_state: state });
};

// Same four values the website's signup form offers; public.patients has a CHECK
// constraint on gender, so anything else is normalised to null rather than sent
// straight through and failing the signup trigger.
const WEBSITE_GENDERS = ['Male', 'Female', 'Other', 'Prefer Not to Say'];
const normalizeWebsiteGender = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = WEBSITE_GENDERS.find((g) => g.toLowerCase() === text.toLowerCase());
  if (match) return match;
  const short: Record<string, string> = { m: 'Male', f: 'Female' };
  return short[text.toLowerCase()] ?? null;
};

const clean = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text ? text : null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Best-effort look at what the on_auth_user_created -> handle_new_user()
 * trigger created, used ONLY to fill in patient_id for display. NOT used to
 * decide success/failure: public.profiles / public.patients carry the same
 * RLS the website uses ("auth.uid() = id", i.e. a patient can see only their
 * own row), so the CRM staff member's own session is generally NOT allowed to
 * read a different patient's row back — that would show as "not found" even
 * when the trigger worked perfectly. The website's own signUp() call never
 * checks this either; it just trusts signUp() succeeding. We do the same.
 */
const peekWebsitePatientRecords = async (userId: string) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const [{ data: profile }, { data: patient }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('patients').select('*').eq('id', userId).maybeSingle(),
    ]);
    if (profile || patient) return { profile, patient };
    if (attempt < 3) await sleep(400);
  }
  return { profile: null, patient: null };
};

// Stage 8's "Convert Lead to Medical Case" step (handleConvertToCase in
// PatientLeads.tsx) stores the created medical_cases.id via
// saveStage8Task('Convert Lead to Medical Case', { medical_case_id: ... }).
// That gets merged into patient_enquiries.workflow_state as
// { stage_data: { stage8: { data: { medical_case_id, ... } } } } by
// persistWorkflowPatch/buildStageData — same shape read back here.
const medicalCaseIdFromEnquiry = (enquiry: any): string | null => {
  let state = enquiry?.workflow_state;
  if (typeof state === 'string') {
    try { state = JSON.parse(state); } catch { state = null; }
  }
  const id = state?.stage_data?.stage8?.data?.medical_case_id;
  return typeof id === 'string' && id ? id : null;
};

/**
 * Assigns the newly created/linked patient to their medical_cases row
 * (medical_cases.patient_id -> profiles.id), mirroring the same "no separate
 * pipeline" approach as account creation: one plain update, using the CRM's
 * own existing RLS ("Assigned CRM staff update medical cases"). Best-effort —
 * a failure here does not undo the account that was already created; it is
 * reported back so Stage 8 can show it and someone can assign the case
 * manually if needed.
 */
const assignPatientToMedicalCase = async (enquiry: any, userId: string): Promise<string | null> => {
  const medicalCaseId = medicalCaseIdFromEnquiry(enquiry);
  if (!medicalCaseId) return null; // no case converted yet — nothing to assign

  const { error } = await supabase
    .from('medical_cases')
    .update({ patient_id: userId } as any)
    .eq('id', medicalCaseId);

  return error ? `Patient account was created but could not be assigned to the medical case: ${error.message}` : null;
};

/**
 * Stage 8 "Prepare Complete Patient Handover".
 *
 * This calls supabase.auth.signUp() exactly the way the WaruWenJo website's
 * UserLogin.tsx handleSignup() does — same metadata shape, same trigger,
 * same tables (profiles / patients / user_roles). No Edge Function, no
 * service-role key, no separate account-creation pipeline: it is the
 * website's own signup call, made from the CRM with the enquiry's own data.
 *
 * Patient data comes from `patient_enquiries` (the source of truth), not from
 * anything the CRM user types in. The account is created unconfirmed and with
 * a random password, exactly like a normal signup that hasn't verified its
 * email yet — the patient sets their own password via "Forgot password".
 */
export const createPatientProfileFromEnquiry = async (enquiryOrId: any) => {
  const enquiryId = typeof enquiryOrId === 'string' ? enquiryOrId : enquiryOrId?.id;

  if (!enquiryId) {
    return {
      data: null,
      error: new Error('Patient enquiry ID is required to create the patient account.'),
    };
  }

  // patient_enquiries is the source of truth — re-read it rather than trusting
  // whatever the caller happened to have in memory.
  const { data: enquiry, error: enquiryError } = await supabase
    .from('patient_enquiries')
    .select('*')
    .eq('id', enquiryId)
    .maybeSingle();

  if (enquiryError) {
    return { data: null, error: new Error(`Patient enquiry lookup failed: ${enquiryError.message}`) };
  }
  if (!enquiry) {
    return { data: null, error: new Error('Patient enquiry was not found.') };
  }

  const email = String((enquiry as any).email ?? '').trim().toLowerCase();
  const fullName = clean((enquiry as any).full_name);
  if (!email || !email.includes('@') || !fullName) {
    return {
      data: null,
      error: new Error('The patient enquiry needs a valid email and full name before an account can be created.'),
    };
  }

  // Already linked to an Auth user from a previous run — nothing left to do
  // except make sure the medical case (if converted since) also points at them.
  if ((enquiry as any).user_id) {
    const linkedUserId = (enquiry as any).user_id as string;
    const records = await peekWebsitePatientRecords(linkedUserId);
    const caseWarning = await assignPatientToMedicalCase(enquiry, linkedUserId);
    return {
      data: {
        success: true,
        user_id: linkedUserId,
        patient_id: (records.patient as any)?.patient_id ?? (records.profile as any)?.patient_id ?? linkedUserId,
        account_status: 'linked_existing',
        ...(caseWarning ? { warning: caseWarning } : {}),
      },
      error: null,
    };
  }

  // signUp() needs a password. The patient never sees or uses this one —
  // they set their own later via "Forgot password", same as the website flow.
  // crypto.randomUUID() only exists in secure contexts (HTTPS or localhost);
  // on plain HTTP it is undefined and throws, so fall back to
  // crypto.getRandomValues() (works in any context) and finally Math.random()
  // if crypto is missing entirely. Security doesn't matter here — this value
  // is discarded immediately.
  const randomToken = (): string => {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto?.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  };
  const throwawayPassword = `Wj-${randomToken()}-${randomToken()}`;

  const { data: signUpData, error: signUpError } = await patientSignupClient.auth.signUp({
    email,
    password: throwawayPassword,
    options: {
      data: {
        role: 'user',
        full_name: fullName,
        phone: clean((enquiry as any).phone),
        country: clean((enquiry as any).country),
        age: (enquiry as any).age ? Number.parseInt(String((enquiry as any).age), 10) : null,
        gender: normalizeWebsiteGender((enquiry as any).gender),
      },
    },
  });

  let userId: string | null = null;
  let accountStatus: 'created' | 'linked_existing' = 'created';

  if (signUpError) {
    return { data: null, error: new Error(`Patient account creation failed: ${signUpError.message}`) };
  }

  // supabase-js quirk: signUp() on an email that already has an account returns
  // a user object with NO error and an EMPTY identities array (this is how
  // Supabase avoids leaking which emails are registered). That is how an
  // existing website account is detected and linked instead of duplicated.
  if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
    userId = signUpData.user.id;
    accountStatus = 'linked_existing';
  } else if (signUpData?.user) {
    userId = signUpData.user.id;
    accountStatus = 'created';
  }

  if (!userId) {
    return { data: null, error: new Error('Patient account creation did not return a user id.') };
  }

  // Trust signUp() the same way the website does — do NOT block success on
  // reading profiles/patients back (RLS on those tables generally means the
  // CRM staff session cannot see a different patient's row; see
  // peekWebsitePatientRecords above). This is best-effort only, for patient_id.
  const records = await peekWebsitePatientRecords(userId);

  // Link the enquiry back to the Auth identity. Relies on the existing CRM RLS
  // policy on patient_enquiries UPDATE (crm_has_permission 'leads.write') — the
  // same permission check the CRM already uses, no separate check needed here.
  const { error: linkError } = await supabase
    .from('patient_enquiries')
    .update({ user_id: userId } as any)
    .eq('id', enquiryId);

  if (linkError) {
    return {
      data: { success: true, user_id: userId, account_status: accountStatus },
      error: new Error(`Account was created but could not be linked to the enquiry: ${linkError.message}`),
    };
  }

  // Assign the patient to their medical case, if one was already converted
  // (Stage 8's "Convert Lead to Medical Case" step, which runs before this one).
  const caseWarning = await assignPatientToMedicalCase(enquiry, userId);

  return {
    data: {
      success: true,
      user_id: userId,
      patient_id: (records.patient as any)?.patient_id ?? (records.profile as any)?.patient_id ?? userId,
      account_status: accountStatus,
      ...(caseWarning ? { warning: caseWarning } : {}),
    },
    error: null,
  };
};

export const createPatientAccountFromEnquiry = createPatientProfileFromEnquiry;

/**
 * Stage 8 "Convert Lead to Medical Case".
 *
 * Calls the profile-only public.create_medical_case_from_profiles() Postgres
 * function instead of building a medical case from enquiry fields. The
 * function receives only the linked profile ID and reads the patient data
 * directly from public.profiles. The enquiry ID is used only afterward to
 * mark the CRM lead as converted.
 * That function:
 *   - loads the linked patient profile and validates its role
 *   - checks the CRM 'cases.write' permission explicitly
 *   - maps the free-text urgency field to the case_priority enum
 *   - uses a valid case_status ('lead'), not the old invalid literal 'new'
 *   - inserts the linked profile id as medical_cases.patient_id
 *   - is SECURITY DEFINER, so it does not depend on a medical_cases INSERT
 *     RLS policy
 * The conversion payload carries the lead treatment, valid assigned staff and
 * hospital UUIDs, and the combined lead/workflow notes.
 */
export const convertProfileToCase = async (
  profileId: string,
  enquiryId: string,
  enquiryData?: {
    treatmentName?: string | null;
    assignedToId?: string | null;
    hospitalId?: string | null;
    notes?: string | null;
  },
) => {
  const { data: caseData, error: caseError } = await supabase
    .rpc('create_medical_case_from_profiles', {
      _profile_id: profileId,
      _treatment_name: enquiryData?.treatmentName ?? null,
      _assigned_to: enquiryData?.assignedToId ?? null,
      _hospital_id: enquiryData?.hospitalId ?? null,
      _notes: enquiryData?.notes ?? null,
    });

  if (caseError) {
    console.error('create_medical_case_from_profiles failed:', {
      message: caseError.message,
      details: caseError.details,
      hint: caseError.hint,
      code: caseError.code,
    });
    return { data: null, error: caseError };
  }

  // Depending on the PostgREST version and composite return type, an RPC can
  // return either one object or a one-item array. Normalize both forms for
  // the Stage 8 handler.
  const normalizedCase = Array.isArray(caseData) ? caseData[0] : caseData;
  if (!normalizedCase?.id) {
    const responseError = new Error('Supabase created no medical-case record or returned no case ID.');
    console.error('create_medical_case_from_profiles returned an unexpected response:', caseData);
    return { data: null, error: responseError };
  }

  // Update enquiry status to 'won'
  const { error: statusError } = await updateLeadStatus(enquiryId, 'won');
  if (statusError) {
    return {
      data: normalizedCase,
      error: new Error(`Medical case was created, but the lead status could not be updated: ${statusError.message}`),
    };
  }

  return { data: normalizedCase, error: null };
};

export const createConsultationFromEnquiry = async (enquiryId: string, doctorId: string, consultationType: string) => {
  const { data: enquiry } = await supabase
    .from('patient_enquiries')
    .select('*')
    .eq('id', enquiryId)
    .single();

  if (!enquiry) return { error: new Error('Enquiry not found') };

  const newConsultation = {
    doctor_id: doctorId,
    consultation_type: consultationType,
    status: 'pending',
    scheduled_at: enquiry.preferred_date || new Date().toISOString(),
    notes: enquiry.message || enquiry.notes,
    user_id: '00000000-0000-0000-0000-000000000000', // Placeholder
  };

  const { data, error } = await supabase
    .from('consultations')
    .insert([newConsultation])
    .select()
    .single();

  if (!error) {
    await updateLeadStatus(enquiryId, 'contacted');
  }

  return { data, error };
};


// ============================================
// APPOINTMENTS
// ============================================

export const fetchAppointments = async () => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching appointments:', error);
  }
  return { data, error };
};

export const updateAppointmentStatus = async (id: string, status: string) => {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id);

  return { data, error };
};

// ============================================
// HOSPITALS
// ============================================

export const fetchActiveDoctors = async () => {
  const { data, error } = await supabase
    .from('doctors')
    .select(`
      *,
      hospitals:hospital_id (name)
    `)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching doctors:', error);
  }
  return { 
    data: data?.map(d => ({ 
      ...d, 
      hospitalName: d.hospitals?.name 
    })), 
    error 
  };
};

// fetchDoctors: Fetches ALL doctors (active + inactive) for the admin/CRM panel
export const fetchDoctors = async () => {
  const { data, error } = await supabase
    .from('doctors')
    .select(`
      *,
      hospital:hospital_id (name)
    `)
    .order('name');

  if (error) {
    console.error('Error fetching doctors:', error);
  }
  return { data, error };
};

export const fetchHospitals = async () => {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching hospitals:', error);
  }
  return { data, error };
};

export const createHospital = async (hospital: InsertTables<'hospitals'>) => {
  const { data, error } = await supabase
    .from('hospitals')
    .insert(hospital)
    .select()
    .single();

  return { data, error };
};

export const updateHospital = async (id: string, hospital: UpdateTables<'hospitals'>) => {
  const { data, error } = await supabase
    .from('hospitals')
    .update(hospital)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

export const deleteHospital = async (id: string) => {
  const { error } = await supabase
    .from('hospitals')
    .delete()
    .eq('id', id);

  return { error };
};

// DOCTORS
// ============================================

export const createDoctor = async (doctor: InsertTables<'doctors'>) => {
  const { data, error } = await supabase
    .from('doctors')
    .insert(doctor)
    .select()
    .single();

  return { data, error };
};

export const updateDoctor = async (id: string, doctor: UpdateTables<'doctors'>) => {
  const { data, error } = await supabase
    .from('doctors')
    .update(doctor)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

export const deleteDoctor = async (id: string) => {
  const { error } = await supabase
    .from('doctors')
    .delete()
    .eq('id', id);

  return { error };
};

// ============================================
// TREATMENT COSTS
// ============================================

export const fetchTreatmentCosts = async () => {
  const { data, error } = await supabase
    .from('treatment_costs')
    .select('*')
    .order('treatment_name', { ascending: true });

  if (error) {
    console.error('Error fetching treatment costs:', error);
  }
  return { data, error };
};

export const createTreatmentCost = async (treatment: InsertTables<'treatment_costs'>) => {
  const { data, error } = await supabase
    .from('treatment_costs')
    .insert(treatment)
    .select()
    .single();

  return { data, error };
};

export const updateTreatmentCost = async (id: string, treatment: UpdateTables<'treatment_costs'>) => {
  const { data, error } = await supabase
    .from('treatment_costs')
    .update(treatment)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

export const deleteTreatmentCost = async (id: string) => {
  const { error } = await supabase
    .from('treatment_costs')
    .delete()
    .eq('id', id);

  return { error };
};

// ============================================
// CONSULTATIONS
// ============================================

// ============================================
// CONSULTATIONS (CRM)
// ============================================

export const fetchConsultations = async () => {
  const { data, error } = await supabase
    .from('consultations')
    .select(`
      *,
      doctor:doctors(id, name, specialty),
      case:medical_cases(id, title, patient_id)
    `)
    .order('scheduled_at', { ascending: false });

  if (error) {
    console.error('Error fetching consultations:', error);
  }
  return { data, error };
};

// ============================================
// MASTER EMAIL TEMPLATE (admin-level)
// ============================================

/**
 * Fetch the active master email template HTML.
 * Returns { data: string | null, error }
 */
export const fetchMasterTemplateAdmin = async () => {
  try {
    const { data, error } = await supabase
      .from('master_email_template')
      .select('id, html, html_template, is_active')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[supabase] fetchMasterTemplate error:', error.message || error);
      return { data: null, error };
    }

    const html = (data && (data as any).html) ?? (data && (data as any).html_template) ?? null;
    return { data: html, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
};

/**
 * Insert or update the master email template HTML.
 * Returns { error }
 */
export const updateMasterTemplateAdmin = async (html: string) => {
  try {
    // Try to find any existing master row
    const { data: existing, error: selErr } = await supabase
      .from('master_email_template')
      .select('id, html, html_template')
      .limit(1)
      .maybeSingle();

    if (selErr) {
      console.warn('[supabase] updateMasterTemplate select error:', selErr.message || selErr);
    }

    if (existing && (existing as any).id) {
      // Update both possible column names for compatibility
      const payload: any = {
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      payload.html = html;
      payload.html_template = html;

      const { error } = await supabase
        .from('master_email_template')
        .update(payload)
        .eq('id', (existing as any).id);
      return { error };
    }

    const insertPayload: any = {
      html,
      html_template: html,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('master_email_template')
      .insert([insertPayload]);

    return { error };
  } catch (err: any) {
    return { error: err };
  }
};

export const updateConsultationStatus = async (id: string, status: string) => {
  const { data, error } = await supabase
    .from('consultations')
    .update({ status })
    .eq('id', id);

  return { data, error };
};

// ============================================
// PROFILES (Users/Patients)
// ============================================

export const fetchProfiles = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, patients(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching profiles:', error);
  }
  return { data, error };
};

export const fetchProfileById = async (id: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
};

export const fetchUsersByRole = async (role: AppRole) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', role)
    .order('full_name', { ascending: true });

  if (error) {
    console.error(`Error fetching users with role ${role}:`, error);
    return [];
  }
  return data;
};


// ============================================
// MEDICAL CASES (CRM)
// ============================================

export const fetchMedicalCases = async () => {
  const { data, error } = await supabase
    .from('medical_cases')
    .select(`
      *,
      patient:profiles(*, patients(*)),
      bdm:assigned_bdm_id(full_name),
      cdm:assigned_cdm_id(full_name),
      buddy:assigned_buddy_id(full_name)
    `)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching medical cases:', error);
  }
  return { data, error };
};

export const createMedicalCase = async (medicalCase: InsertTables<'medical_cases'>) => {
  const { data, error } = await supabase
    .from('medical_cases')
    .insert([medicalCase])
    .select()
    .single();

  return { data, error };
};

export const updateMedicalCase = async (id: string, medicalCase: UpdateTables<'medical_cases'>) => {
  const { data, error } = await supabase
    .from('medical_cases')
    .update(medicalCase)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

export const updateMedicalCaseStatus = async (id: string, status: string) => {
  const { data, error } = await supabase
    .from('medical_cases')
    .update({ status })
    .eq('id', id);

  return { data, error };
};

// ============================================
// PATIENT JOURNEY (Legacy support)
// ============================================

export const fetchPatientJourneys = fetchMedicalCases;

export const updatePatientJourney = async (id: string, journey: any) => {
  return updateMedicalCase(id, journey);
};


export const logAdminActivity = async (
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, any>
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('admin_activity_logs')
      .insert({
        admin_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: details || {},
      });

    if (error) {
      console.error('Error logging admin activity:', error);
      return { error };
    }
    return { success: true };
  } catch (err) {
    console.error('Logging catch error:', err);
    return { error: err };
  }
};

export const fetchAdminActivityLogs = async (entityId: string) => {
  const { data, error } = await supabase
    .from('admin_activity_logs')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching activity logs:', error);
  }
  return { data, error };
};

// ============================================
// CRM TASKS
// ============================================

export const fetchCRMTasks = async () => {
  const { data, error } = await supabase
    .from('crm_tasks')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching CRM tasks:', error);
  }
  return { data, error };
};

export const createCRMTask = async (task: {
  title: string;
  description?: string;
  assigned_to?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  priority?: string;
  due_date?: string;
}) => {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('crm_tasks')
    .insert({
      ...task,
      created_by: user?.id,
    })
    .select()
    .single();

  return { data, error };
};

export const updateCRMTask = async (id: string, task: {
  title?: string;
  description?: string;
  assigned_to?: string;
  priority?: string;
  status?: string;
  due_date?: string;
  completed_at?: string;
}) => {
  const { data, error } = await supabase
    .from('crm_tasks')
    .update(task)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
};

// ============================================
// STATISTICS / DASHBOARD
// ============================================

export const getDashboardStats = async () => {
  const [
    { count: enquiriesCount },
    { count: appointmentsCount },
    { count: patientsCount },
    { count: doctorsCount },
    { count: hospitalsCount },
    { data: activeCases },
    { data: recentLeads }
  ] = await Promise.all([
    supabase.from('patient_enquiries').select('*', { count: 'exact', head: true }),
    supabase.from('appointments').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('doctors').select('*', { count: 'exact', head: true }),
    supabase.from('hospitals').select('*', { count: 'exact', head: true }),
    supabase.from('medical_cases').select('id, status'),
    supabase.from('patient_enquiries').select('id, created_at').order('created_at', { ascending: false }).limit(10)
  ]);

  return {
    enquiries: enquiriesCount || 0,
    appointments: appointmentsCount || 0,
    patients: patientsCount || 0,
    doctors: doctorsCount || 0,
    hospitals: hospitalsCount || 0,
    activeCases: activeCases?.filter(c => c.status !== 'closed' && c.status !== 'Closed').length || 0,
    recentGrowth: recentLeads?.length || 0, 
  };
};

// ============================================
// CHAT / MESSAGES
// ============================================

export const fetchRecentChatMessages = async (limit = 5) => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent chat messages:', error);
  }
  return { data, error };
};

// ============================================
// TRAVEL BOOKINGS
// ============================================

export const fetchTravelBookings = async () => {
  const { data, error } = await supabase
    .from('travel_bookings')
    .select('*')
    .order('booking_date', { ascending: false });

  if (error) {
    console.error('Error fetching travel bookings:', error);
  }
  return { data, error };
};

export const createTravelBooking = async (booking: InsertTables<'travel_bookings'>) => {
  const { data, error } = await supabase
    .from('travel_bookings')
    .insert(booking)
    .select()
    .single();
  return { data, error };
};

export const updateTravelBooking = async (id: string, booking: UpdateTables<'travel_bookings'>) => {
  const { data, error } = await supabase
    .from('travel_bookings')
    .update(booking)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

// ============================================
// FINANCE RECORDS
// ============================================

export const fetchFinanceRecords = async () => {
  const { data, error } = await supabase
    .from('finance_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching finance records:', error);
  }
  return { data, error };
};

export const createFinanceRecord = async (record: InsertTables<'finance_records'>) => {
  const { data, error } = await supabase
    .from('finance_records')
    .insert(record)
    .select()
    .single();
  return { data, error };
};

export const updateFinanceRecord = async (id: string, record: UpdateTables<'finance_records'>) => {
  const { data, error } = await supabase
    .from('finance_records')
    .update(record)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

// ============================================
// INVENTORY
// ============================================

export const fetchInventoryItems = async () => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching inventory:', error);
  }
  return { data, error };
};

export const createInventoryItem = async (item: InsertTables<'inventory_items'>) => {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert(item)
    .select()
    .single();
  return { data, error };
};

export const updateInventoryItem = async (id: string, item: UpdateTables<'inventory_items'>) => {
  const { data, error } = await supabase
    .from('inventory_items')
    .update(item)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

// ============================================
// EXPENSES
// ============================================

export const fetchExpenses = async () => {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
  }
  return { data, error };
};

export const createExpense = async (expense: InsertTables<'expenses'>) => {
  const { data, error } = await supabase
    .from('expenses')
    .insert(expense)
    .select()
    .single();
  return { data, error };
};

export const updateExpense = async (id: string, expense: UpdateTables<'expenses'>) => {
  const { data, error } = await supabase
    .from('expenses')
    .update(expense)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

// ============================================
// LOGISTICS (Transport & Arrivals)
// ============================================

export const fetchTransportTeams = async () => {
  const { data, error } = await supabase
    .from('transport_teams')
    .select('*')
    .order('status', { ascending: true }); // Available first

  if (error) {
    console.error('Error fetching transport teams:', error);
  }
  return { data, error };
};

export const createTransportTeam = async (team: InsertTables<'transport_teams'>) => {
  const { data, error } = await supabase
    .from('transport_teams')
    .insert(team)
    .select()
    .single();
  return { data, error };
};

export const updateTransportTeam = async (id: string, team: UpdateTables<'transport_teams'>) => {
  const { data, error } = await supabase
    .from('transport_teams')
    .update(team)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

/**
 * Patient Arrivals is temporarily disabled.
 *
 * Keep this exported function so existing imports/callers continue to compile,
 * but do not query `patient_arrivals` or `transport_teams` until the module is
 * re-enabled. Database tables and the other transport helpers are unchanged.
 */
export const fetchPatientArrivals = async () => {
  return { data: [], error: null };
};

export const createPatientArrival = async (arrival: InsertTables<'patient_arrivals'>) => {
  const { data, error } = await supabase
    .from('patient_arrivals')
    .insert(arrival)
    .select()
    .single();
  return { data, error };
};

export const updatePatientArrival = async (id: string, arrival: UpdateTables<'patient_arrivals'>) => {
  const { data, error } = await supabase
    .from('patient_arrivals')
    .update(arrival)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

export const updateArrivalStatus = async (id: string, status: string) => {
  return updatePatientArrival(id, { status });
};

// ============================================
// COMMUNICATION TEMPLATES
// ============================================

export const fetchTemplates = async () => {
  const { data, error } = await supabase
    .from('communication_templates')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const createTemplate = async (template: any) => {
  const payload = {
    ...template,
    title: template.template_name || template.title,
    body: template.email_content || template.body,
    target: template.target_audience || template.target || 'Patient',
  };
  const { data, error } = await supabase
    .from('communication_templates')
    .insert([payload])
    .select()
    .single();
  return { data, error };
};

export const deleteTemplate = async (id: string) => {
  const { error } = await supabase
    .from('communication_templates')
    .delete()
    .eq('id', id);
  return { error };
};

export const updateTemplate = async (id: string, template: any) => {
  const { data, error } = await supabase
    .from('communication_templates')
    .update(template)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

// ============================================
// MASTER EMAIL TEMPLATES
// ============================================

export const fetchMasterTemplate = async () => {
  try {
    const { data, error } = await supabase
      .from('master_email_template')
      .select('html_template')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching master template:', error);
      return { data: null, error };
    }
    return { data: data?.html_template || null, error: null };
  } catch (err) {
    console.error('fetchMasterTemplate catch error:', err);
    return { data: null, error: err };
  }
};

export const updateMasterTemplate = async (htmlTemplate: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: existing } = await supabase
      .from('master_email_template')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('master_email_template')
        .update({
          html_template: htmlTemplate,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('id', existing.id);
      return { error };
    } else {
      const { error } = await supabase
        .from('master_email_template')
        .insert({
          html_template: htmlTemplate,
          name: 'WaruWenJo Master Template',
          is_active: true,
          updated_by: user?.id,
        });
      return { error };
    }
  } catch (err: any) {
    console.error('updateMasterTemplate catch error:', err);
    return { error: err };
  }
};

// ============================================
// EMAIL DISPATCH
// ============================================

export const sendCrmEmail = async (
  toEmail: string,
  subject: string,
  htmlContent: string,
  toName = 'Valued Partner'
) => {
  try {
    // Use the same SMTP API route as the existing working welcome-email flow.
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email: toEmail,
        to_name: toName,
        custom_subject: subject,
        custom_html: htmlContent,
      }),
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: responseText };
    }

    if (!response.ok || !data.success) {
      const message = data.error || `Email API returned HTTP ${response.status}.`;
      console.error('SMTP sendCrmEmail error:', message);
      return { success: false, error: message };
    }

    // Log the communication
    await logCrmCommunication({
      entity_type: 'Outreach',
      entity_id: '00000000-0000-0000-0000-000000000000', // Generic outreach
      channel: 'Email',
      direction: 'Outbound',
      subject,
      content: htmlContent,
      status: 'sent'
    });

    return { success: true, error: null };
  } catch (err: any) {
    console.error('sendCrmEmail catch error:', err);
    return { success: false, error: err.message || String(err) };
  }
};

export const logCrmCommunication = async (log: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('crm_communications')
    .insert({
      ...log,
      sent_by: user?.id
    });
  return { error };
};

export const assignTransportToArrival = async (arrivalId: string, transportId: string) => {
  return updatePatientArrival(arrivalId, { assigned_transport_id: transportId });
};

// ============================================
// AGREEMENTS
// ============================================

export const fetchAgreements = async () => {
  const { data, error } = await supabase
    .from('agreements')
    .select('*')
    .order('valid_until', { ascending: true });

  if (error) {
    console.error('Error fetching agreements:', error);
  }
  return { data, error };
};

/** Fetch generated agreement documents linked to one Medical Lead. */
export const fetchMedicalLeadAgreements = async (leadId: string) => {
  const normalizedLeadId = String(leadId || '').trim();
  if (!normalizedLeadId) return { data: [], error: new Error('Medical Lead ID is required.') };
  const { data, error } = await supabase
    .from('agreements')
    .select('*')
    .eq('source_lead_id', normalizedLeadId)
    .order('created_at', { ascending: false });
  if (error) console.error('[agreements] Could not fetch Medical Lead agreements:', error);
  return { data, error };
};

// Keep this payload aligned with the current public.agreements table:
// id, partner_name, type, status, valid_until, version, created_at, and optional pdf_path.
export const createAgreement = async (agreement: {
  partner_name: string;
  type: string;
  status?: string | null;
  valid_until?: string | null;
  version?: string | null;
  pdf_path?: string | null;
  signed_mou_path?: string | null;
  source_lead_id?: string | null;
}) => {
  const { data, error } = await supabase
    .from('agreements')
    .insert(agreement as any)
    .select()
    .single();
  if (error) console.error('Could not create agreement:', error);
  return { data, error };
};


/** Upload an agreement PDF to the private `agreements` Storage bucket.
 * The returned path is stable per agreement and can be stored in the DB if
 * an agreement document_path column exists.
 */
export const uploadAgreementPdf = async (
  agreementId: string,
  pdfBlob: Blob,
  documentType: string,
  partnerName: string,
) => {
  const safeSegment = (value: string, fallback: string) =>
    value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || fallback;
  const fileName = `${safeSegment(partnerName, 'partner')}-${safeSegment(documentType, 'agreement')}.pdf`;
  const filePath = `${agreementId}/${fileName}`;
  const { data, error } = await supabase.storage
    .from('agreements')
    .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true, cacheControl: '3600' });
  if (error) {
    console.error('Agreement PDF upload failed:', error);
    return { data: null, error, filePath: null as string | null };
  }
  return { data, error: null, filePath };
};

/** Create a short-lived URL for viewing a private agreement PDF. */
export const getAgreementPdfUrl = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from('agreements')
    .createSignedUrl(filePath, 60 * 10);
  return { data: data?.signedUrl ?? null, error };
};

/** Upload a generated Clinical Review Report PDF to the public `clinical-reports` Storage bucket.
 * Stored at clinical-reports/<lead_id>/clinical-review-<timestamp>.pdf (every regeneration is kept).
 */
export const uploadClinicalReportPdf = async (leadId: string, pdfBlob: Blob) => {
  const normalizedLeadId = String(leadId ?? '').trim();
  if (!normalizedLeadId) {
    return { data: null, error: new Error('Lead ID is required to store the clinical report.'), filePath: null as string | null, fileName: null as string | null };
  }
  const fileName = `clinical-review-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
  const filePath = `${normalizedLeadId}/${fileName}`;
  const { data, error } = await supabase.storage
    .from('clinical-reports')
    .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: false, cacheControl: '3600' });
  if (error) {
    console.error('Clinical report upload failed:', error);
    return { data: null, error, filePath: null as string | null, fileName: null as string | null };
  }
  return { data, error: null, filePath, fileName };
};

/** Public URL of a clinical report PDF in the public `clinical-reports` bucket. */
export const getClinicalReportUrl = async (filePath: string) => {
  const { data } = supabase.storage.from('clinical-reports').getPublicUrl(filePath);
  return { data: data?.publicUrl ?? null, error: null };
};

/**
 * Upload the final, signed MOU PDF to the private `signedmou` bucket.
 * Draft/generated agreement PDFs continue to use the separate `agreements` bucket.
 * The returned filePath should be saved in agreements.signed_mou_path.
 */
export const uploadSignedMou = async (
  agreementId: string,
  file: File,
  partnerName = 'partner',
) => {
  const normalizedId = String(agreementId ?? '').trim();
  if (!normalizedId) {
    return { data: null, error: new Error('Agreement ID is required.'), filePath: null as string | null };
  }
  if (!(file instanceof File) || file.size <= 0) {
    return { data: null, error: new Error('Please select a valid signed MOU PDF.'), filePath: null as string | null };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { data: null, error: new Error('Signed MOU must be 20 MB or smaller.'), filePath: null as string | null };
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { data: null, error: new Error('Only PDF files are allowed for signed MOUs.'), filePath: null as string | null };
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { data: null, error: new Error('The selected file must have a .pdf extension.'), filePath: null as string | null };
  }

  // Confirm the file begins with a PDF signature instead of trusting its name.
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (header.length < 5 || header[0] !== 0x25 || header[1] !== 0x50 || header[2] !== 0x44 || header[3] !== 0x46 || header[4] !== 0x2d) {
    return { data: null, error: new Error('The selected file is not a valid PDF.'), filePath: null as string | null };
  }

  const safePartner = String(partnerName || 'partner')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'partner';
  const filePath = `${normalizedId}/${safePartner}-signed-MOU-${Date.now()}.pdf`;

  const { data, error } = await supabase.storage
    .from('signedmou')
    .upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: false,
      cacheControl: '3600',
    });

  if (error) {
    console.error('[signedmou] Upload failed:', error);
    return { data: null, error, filePath: null as string | null };
  }

  return { data, error: null, filePath };
};

/**
 * Upload the final signed Consent Letter PDF to the same private signed-document
 * bucket. It is stored in a separate folder beneath the original medical lead ID.
 */
export const uploadSignedConsentLetter = async (
  leadId: string,
  file: File,
  partnerName = 'partner',
) => {
  const normalizedId = String(leadId ?? '').trim();
  if (!normalizedId) return { data: null, error: new Error('Lead ID is required.'), filePath: null as string | null };
  if (!(file instanceof File) || file.size <= 0) return { data: null, error: new Error('Please select a valid signed Consent Letter PDF.'), filePath: null as string | null };
  if (file.size > 20 * 1024 * 1024) return { data: null, error: new Error('Signed Consent Letter must be 20 MB or smaller.'), filePath: null as string | null };
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
    return { data: null, error: new Error('Only PDF files are allowed for signed Consent Letters.'), filePath: null as string | null };
  }
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (header.length < 5 || header[0] !== 0x25 || header[1] !== 0x50 || header[2] !== 0x44 || header[3] !== 0x46 || header[4] !== 0x2d) {
    return { data: null, error: new Error('The selected file is not a valid PDF.'), filePath: null as string | null };
  }
  const safePartner = String(partnerName || 'partner').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'partner';
  const filePath = `${normalizedId}/consent/${safePartner}-signed-Consent-Letter-${Date.now()}.pdf`;
  const { data, error } = await supabase.storage.from('signedmou').upload(filePath, file, {
    contentType: 'application/pdf', upsert: false, cacheControl: '3600',
  });
  if (error) {
    console.error('[signedmou] Signed Consent Letter upload failed:', error);
    return { data: null, error, filePath: null as string | null };
  }
  return { data, error: null, filePath };
};

/** Persist a signed document Storage path on the originating medical lead.
 * Requires signed_mou_path and signed_consent_path columns on public.medical_leads.
 */
export const saveMedicalLeadSignedDocumentPath = async (
  leadId: string,
  kind: 'MOU' | 'CONSENT',
  filePath: string,
) => {
  const id = String(leadId ?? '').trim();
  const path = String(filePath ?? '').trim();
  if (!id || !path) return { data: null, error: new Error('Lead ID and document path are required.') };
  const column = kind === 'MOU' ? 'signed_mou_path' : 'signed_consent_path';
  const { data, error } = await supabase
    .from('medical_leads')
    .update({ [column]: path } as any)
    .eq('id', id)
    .select('id')
    .single();
  if (error) console.error(`[medical_leads] Could not save signed ${kind} path:`, error);
  return { data, error };
};

/** Create a short-lived signed URL for a private signed MOU or Consent Letter PDF. */
export const getSignedMouUrl = async (filePath: string) => {
  const normalizedPath = String(filePath ?? '').trim();
  if (!normalizedPath) return { data: null, error: new Error('Signed MOU file path is required.') };
  const { data, error } = await supabase.storage
    .from('signedmou')
    .createSignedUrl(normalizedPath, 60 * 10);
  return { data: data?.signedUrl ?? null, error };
};

/** Delete a signed MOU object from the private `signedmou` bucket. */
export const deleteSignedMou = async (filePath: string) => {
  const normalizedPath = String(filePath ?? '').trim();
  if (!normalizedPath) return { error: new Error('Signed MOU file path is required.') };
  const { error } = await supabase.storage.from('signedmou').remove([normalizedPath]);
  if (error) console.error('[signedmou] Delete failed:', error);
  return { error };
};

/** Persist the signed MOU Storage path against its agreement record. */
export const saveSignedMouPath = async (agreementId: string, filePath: string) => {
  const id = String(agreementId ?? '').trim();
  const path = String(filePath ?? '').trim();
  if (!id || !path) return { data: null, error: new Error('Agreement ID and signed MOU path are required.') };

  // `as any` keeps this service compatible with projects whose generated
  // Supabase Database type has not yet been regenerated for signed_mou_path.
  const { data, error } = await supabase
    .from('agreements')
    .update({ signed_mou_path: path } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) console.error('[signedmou] Could not save Storage path:', error);
  return { data, error };
};

export const updateAgreement = async (id: string, agreement: UpdateTables<'agreements'>) => {
  const { data, error } = await supabase
    .from('agreements')
    .update(agreement)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

// ============================================
// CONSENT FORMS
// ============================================

export const fetchConsentForms = async () => {
  const { data, error } = await supabase
    .from('consent_forms')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const createConsentForm = async (form: InsertTables<'consent_forms'>) => {
  const { data, error } = await supabase
    .from('consent_forms')
    .insert(form)
    .select()
    .single();
  return { data, error };
};

export const updateConsentForm = async (id: string, form: UpdateTables<'consent_forms'>) => {
  const { data, error } = await supabase
    .from('consent_forms')
    .update(form)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

// ============================================
// DISPUTES
// ============================================

export const fetchDisputes = async () => {
  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const createDispute = async (dispute: InsertTables<'disputes'>) => {
  const { data, error } = await supabase
    .from('disputes')
    .insert(dispute)
    .select()
    .single();
  return { data, error };
};

export const updateDispute = async (id: string, dispute: UpdateTables<'disputes'>) => {
  const { data, error } = await supabase
    .from('disputes')
    .update(dispute)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

export const createCaseNote = async (note: InsertTables<'case_notes'>) => {
  const { data, error } = await supabase
    .from('case_notes')
    .insert([note])
    .select()
    .single();

  return { data, error };
};

export const fetchCaseNotes = async (caseId: string) => {
  const { data, error } = await supabase
    .from('case_notes')
    .select(`
      *,
      author:profiles(full_name)
    `)
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching case notes:', error);
  }
  return { data, error };
};



// ============================================
// VISA INVITATIONS
// ============================================

export const fetchVisaInvitations = async () => {
  const { data, error } = await supabase
    .from('visa_invitations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching visa invitations:', error);
  }
  return { data, error };
};

export const createVisaInvitation = async (invitation: InsertTables<'visa_invitations'>) => {
  const { data, error } = await supabase
    .from('visa_invitations')
    .insert(invitation)
    .select()
    .single();
  return { data, error };
};

export const updateVisaInvitation = async (id: string, invitation: UpdateTables<'visa_invitations'>) => {
  const { data, error } = await supabase
    .from('visa_invitations')
    .update(invitation)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

// ============================================
// COMMUNICATIONS / LOGGING
// ============================================

export const logCommunication = async (log: {
  recipient: string;
  subject: string;
  channel: string;
  status: string;
  patient_id?: string;
  template_id?: string;
}) => {
  const { data, error } = await supabase
    .from('communication_logs')
    .insert(log)
    .select()
    .single();
  return { data, error };
};

export const fetchCommunicationLogs = async () => {
  const { data, error } = await supabase
    .from('communication_logs')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

// Re-export the supabase client for direct usage
export { supabase };
// ============================================
// STORAGE / FILE UPLOADS
// ============================================

/**
 * Uploads a file to Supabase Storage and returns the public URL
 * @param file The file object to upload
 * @param bucket The storage bucket name (default: 'public-uploads')
 * @returns { publicUrl, error }
 */
export interface PatientEnquiryDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_url: string;
  mime_type: string | null;
  file_size: number;
  created_at: string;
  verification_result?: string | null;
  verification_confidence?: number | null;
  verification_reasons?: string | null;
  verified_at?: string | null;
}

/**
 * Stage 3: upload the binary file to Supabase Storage and save its metadata
 * directly in patient_enquiries.patient_documents (JSONB). No document table
 * or record_patient_enquiry_document RPC is used.
 */
/**
 * Stage 3 upload-time file checks. These checks reject unsupported, malformed,
 * oversized, and some obviously active/suspicious files before they reach Storage.
 * They are not a substitute for server-side antivirus scanning.
 */
type DetectedDocumentType = { mime: 'application/pdf' | 'image/jpeg' | 'image/png'; ext: '.pdf' | '.jpg' | '.png' };

/** Identify the real file type from its first bytes (not from its name). */
const detectDocumentType = (b: Uint8Array): DetectedDocumentType | null => {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { mime: 'image/png', ext: '.png' };
  const head = b.subarray(0, 1024); // some real PDFs have a few bytes before the header
  for (let i = 0; i + 4 < head.length; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46 && head[i + 4] === 0x2d) return { mime: 'application/pdf', ext: '.pdf' };
  }
  return null;
};

/** Name the type of common files we do not accept, to give a clear message. */
const describeUnsupportedContent = (b: Uint8Array): string | null => {
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(b.subarray(from, to)));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'WEBP';
  if (b.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'GIF';
  if (b.length >= 12 && ascii(4, 8) === 'ftyp' && /heic|heix|hevc|mif1|avif/.test(ascii(8, 12))) return 'HEIC/AVIF';
  if (b.length >= 2 && ascii(0, 2) === 'BM') return 'BMP';
  if (b.length >= 4 && (ascii(0, 4) === 'II*\0' || ascii(0, 4) === 'MM\0*')) return 'TIFF';
  const text = ascii(0, Math.min(b.length, 256)).trimStart().toLowerCase();
  if (text.startsWith('<svg') || text.startsWith('<?xml')) return 'SVG';
  if (text.startsWith('<!doctype html') || text.startsWith('<html')) return 'HTML';
  return null;
};

/**
 * Stage 3 upload-time file checks. Accepts PDF, JPG/JPEG and PNG. The REAL type is
 * read from the file content, so a valid PNG saved as "photo.jpg" is still accepted
 * (and stored with the correct extension and content type).
 * Not a substitute for server-side antivirus scanning.
 */
const validateEnquiryDocumentBeforeUpload = async (
  file: File,
): Promise<{ error: Error | null; detected?: DetectedDocumentType }> => {
  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];

  if (!file || !(file instanceof File)) return { error: new Error('Please select a valid document file.') };
  if (file.size <= 0) return { error: new Error('The selected document is empty.') };
  if (file.size > MAX_FILE_SIZE) return { error: new Error('Document must be 20 MB or smaller.') };

  const dot = file.name.lastIndexOf('.');
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  if (!allowedExtensions.includes(extension)) {
    return { error: new Error('Unsupported document type. Upload PDF, JPG, JPEG, or PNG files only.') };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Reject common executable/script signatures regardless of the file extension.
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (
    startsWith(0x4d, 0x5a) || // Windows executable (MZ)
    startsWith(0x7f, 0x45, 0x4c, 0x46) || // ELF executable
    startsWith(0xfe, 0xed, 0xfa, 0xce) || startsWith(0xfe, 0xed, 0xfa, 0xcf) ||
    startsWith(0xcf, 0xfa, 0xed, 0xfe) || startsWith(0xca, 0xfe, 0xba, 0xbe) ||
    startsWith(0x23, 0x21) // shebang script
  ) {
    return { error: new Error('Executable or script content is not allowed. The upload was blocked.') };
  }

  const detected = detectDocumentType(bytes);
  if (!detected) {
    const other = describeUnsupportedContent(bytes);
    return {
      error: new Error(
        other
          ? `This file is actually a ${other} file saved as "${extension}". Please convert it to JPG, PNG or PDF and upload again.`
          : 'The document content is not a valid PDF, JPG or PNG file. The upload was blocked.',
      ),
    };
  }

  if (detected.mime === 'application/pdf') {
    const pdfText = new TextDecoder('latin1').decode(bytes);
    // '/OpenAction' is common in normal PDFs and a bare '/JS' matches harmless names,
    // so only real script/embedding markers block.
    const suspiciousPdfMarkers = [
      /\/JavaScript\b/, /\/JS\s*[(<]/, /\/Launch\b/, /\/EmbeddedFiles?\b/, /\/RichMedia\b/,
    ];
    if (suspiciousPdfMarkers.some((marker) => marker.test(pdfText))) {
      return { error: new Error('This PDF contains active or embedded content and was blocked. Please upload a flattened/clean PDF.') };
    }
    if (!pdfText.includes('%%EOF')) {
      return { error: new Error('The PDF appears incomplete or malformed. Please upload a valid PDF.') };
    }
  }

  return { error: null, detected };
};

/**
 * Browsers can decode WEBP/GIF/BMP images. Patients often have such files saved as .jpg/.png
 * (downloaded or screenshotted images), so convert them to a real PNG before upload.
 */
const convertBrowserImageToPng = async (file: File): Promise<File> => {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.drawImage(bitmap, 0, 0);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not convert the image.');
    const base = file.name.replace(/\.[^.]*$/, '') || 'image';
    return new File([blob], `${base}.png`, { type: 'image/png', lastModified: Date.now() });
  } finally {
    bitmap.close?.();
  }
};

export const uploadEnquiryDocument = async (leadId: string, file: File) => {
  const bucket = 'Enquiry_docs';
  const normalizedLeadId = String(leadId ?? '').trim();

  if (!normalizedLeadId) {
    return { data: null, error: new Error('Lead ID is required to upload an enquiry document.') };
  }

  // Auto-convert WEBP / GIF / BMP images (any file name) to PNG so they can be uploaded.
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const realType = detectDocumentType(head) ? null : describeUnsupportedContent(head);
    if (realType === 'WEBP' || realType === 'GIF' || realType === 'BMP') {
      file = await convertBrowserImageToPng(file);
    }
  } catch (conversionFailure) {
    console.warn('[Documents] Image conversion failed:', conversionFailure);
    return { data: null, error: new Error('This image could not be converted. Please save it as JPG or PNG and try again.') };
  }

  let detected: DetectedDocumentType | undefined;
  try {
    const validation = await validateEnquiryDocumentBeforeUpload(file);
    if (validation.error) return { data: null, error: validation.error };
    detected = validation.detected;
  } catch (validationFailure) {
    const message = validationFailure instanceof Error ? validationFailure.message : 'Unable to inspect the selected document.';
    return { data: null, error: new Error(`Document validation failed: ${message}`) };
  }

  // Keep the stable lead_id folder structure: Enquiry_docs/<lead_id>/<file>.
  // The patient is not logged in, so we cannot read patient_enquiries here; the
  // lead is verified server-side by the submit_patient_enquiry_document RPC.
  // Use the REAL type found in the file content; fix a wrong extension (e.g. PNG saved as .jpg).
  const contentType = detected?.mime || file.type || undefined;
  const baseName = file.name.replace(/\.[^.]*$/, '');
  const properName = detected ? `${baseName}${detected.ext}` : file.name;
  const safeName = properName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${normalizedLeadId}/${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { upsert: false, contentType });
  if (uploadError) return { data: null, error: uploadError };

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  const document: PatientEnquiryDocument = {
    id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    file_name: properName,
    file_path: filePath,
    file_url: publicData.publicUrl,
    mime_type: contentType || null,
    file_size: file.size,
    created_at: new Date().toISOString(),
    verification_result: null,
    verification_confidence: null,
    verification_reasons: null,
    verified_at: null,
  };

  const { error: saveError } = await supabase.rpc('submit_patient_enquiry_document', {
    p_lead_id: normalizedLeadId,
    p_document: document,
  });

  if (saveError) {
    // Best effort cleanup (may be ignored if the caller is not allowed to delete).
    await supabase.storage.from(bucket).remove([filePath]);
    return { data: null, error: saveError };
  }

  return { data: document, error: null };
};

/** Read document metadata from the patient_enquiries JSONB column. */
export const fetchEnquiryDocuments = async (leadId: string) => {
  const { data, error } = await supabase
    .from('patient_enquiries')
    .select('patient_documents')
    .eq('id', leadId)
    .maybeSingle();

  if (error) return { data: null, error };
  const documents = Array.isArray(data?.patient_documents)
    ? [...data.patient_documents] as PatientEnquiryDocument[]
    : [];
  documents.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return { data: documents, error: null };
};

/** Update verification fields for a document stored inside patient_documents JSONB. */
export const updateEnquiryDocumentVerification = async (
  documentId: string,
  verification: { verification_result: string; verification_confidence: number; verification_reasons: string },
) => {
  const { data: lead, error: readError } = await supabase
    .from('patient_enquiries')
    .select('id, patient_documents')
    .filter('patient_documents', 'cs', JSON.stringify([{ id: documentId }]))
    .maybeSingle();

  if (readError) return { data: null, error: readError };
  if (!lead) return { data: null, error: new Error('Document was not found in patient enquiry documents.') };

  const documents = Array.isArray(lead.patient_documents) ? [...lead.patient_documents] as PatientEnquiryDocument[] : [];
  const index = documents.findIndex((document) => document.id === documentId);
  if (index < 0) return { data: null, error: new Error('Document was not found in patient enquiry documents.') };

  const updatedDocument: PatientEnquiryDocument = {
    ...documents[index],
    ...verification,
    verified_at: new Date().toISOString(),
  };
  documents[index] = updatedDocument;

  const { error: saveError } = await supabase
    .from('patient_enquiries')
    .update({ patient_documents: documents })
    .eq('id', lead.id);

  if (saveError) return { data: null, error: saveError };
  return { data: updatedDocument, error: null };
};

export const uploadFile = async (file: File, bucket = 'public-uploads') => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return { publicUrl, error: null };
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return { publicUrl: null, error };
  }
};