
export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  WON = 'won',
  LOST = 'lost'
}

export type AppRole = 'super_admin' | 'admin' | 'user' | 'doctor' | 'hospital_admin' | 'agent' | 'in_house_doctor' | 'indian_doctor' | 'international_doctor' | 'specialist_doctor' | 'bdm' | 'cdm' | 'waru_buddy' | 'unassigned';


export enum PatientStatus {
  REFERRAL = 'Referral',
  CONSULTATION = 'Consultation',
  TREATMENT_PLAN = 'Treatment Plan',
  ACTIVE_CARE = 'Active Care',
  POST_OP = 'Post-Op',
  DISCHARGED = 'Discharged'
}

export enum PatientPriority {
  EMERGENCY = 'Emergency',
  URGENT = 'Urgent',
  STANDARD = 'Standard'
}

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
  PREFER_NOT_TO_SAY = 'Prefer not to say'
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export enum FacilityType {
  HOSPITAL = 'Hospital',
  CLINIC = 'Clinic',
  LAB = 'Laboratory',
  PHARMACY = 'Pharmacy',
  OTHER = 'Other'
}

export enum ArrivalStatus {
  EXPECTED = 'Expected',
  LANDED = 'Landed',
  PICKED_UP = 'Picked Up',
  AT_FACILITY = 'At Facility',
  DELAYED = 'Delayed'
}

export interface Hospital {
  id: string;
  name: string;
  type?: string;        // maps to hospitals.type (DB column added via migration)
  country?: string;     // maps to hospitals.country (DB column added via migration)
  city: string;
  address: string;
  contactEmail?: string; // maps to hospitals.contact_email
  contactPhone?: string; // maps to hospitals.contact_phone
  rating?: number;      // maps to hospitals.rating (DB column added via migration)
  bedCount?: number;    // maps to hospitals.bed_count (DB column added via migration)
  accreditation?: string;
  description?: string;
  imageUrl?: string;    // maps to hospitals.image_url
  facilities?: string[] | null; // maps to hospitals.facilities (JSON)
  is_active?: boolean;   // maps to hospitals.is_active
  // Legacy aliases kept for backwards compat — remove after all usages updated
  email?: string;
  phone?: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  hospitalId?: string;       // maps to doctors.hospital_id
  hospitalName?: string;     // derived from join with hospitals
  bio?: string | null;       // maps to doctors.bio
  imageUrl?: string | null;  // maps to doctors.image_url
  /** @deprecated use imageUrl */ avatar?: string;
  languages?: string[];      // maps to doctors.languages
  experienceYears?: number | null; // maps to doctors.experience_years
  consultationFee?: number | null; // maps to doctors.consultation_fee
  availableForOnline?: boolean;    // maps to doctors.available_for_online
  status?: 'Active' | 'On Leave' | 'Inactive';
  email?: string; // maps to doctors.email
  phone?: string;  // maps to doctors.phone
  user_id?: string; // maps to doctors.user_id
  doctor_type?: string;     // maps to doctors.doctor_type
  is_active?: boolean;      // maps to doctors.is_active
  qualifications?: string;   // maps to doctors.qualifications
  availability?: any;        // maps to doctors.availability (JSON)
  rating?: number;           // maps to doctors.rating
}

export interface TravelBooking {
  id: string;
  patientId: string;
  patientName: string;
  type: 'Flight' | 'Hotel' | 'Transfer';
  provider: string;
  reference: string;
  date: string;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  details: string;
}

export interface ConsentForm {
  id: string;
  patientId: string;
  patientName: string;
  type: 'Surgical' | 'Data Privacy' | 'HIPAA' | 'Financial Liability';
  status: 'Signed' | 'Pending' | 'Expired';
  signedAt?: string;
  version: string;
}

export interface Dispute {
  id: string;
  reporterName: string;
  category: 'Service Quality' | 'Billing' | 'Logistics' | 'Medical Outcome';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Review' | 'Resolved' | 'Closed';
  subject: string;
  createdAt: string;
}

export interface Agreement {
  id: string;
  partnerName: string;
  type: 'Service Level' | 'Agency Partnership' | 'Consultancy';
  status: 'Active' | 'Draft' | 'Expired';
  validUntil: string;
  version: string;
}

export interface FinanceRecord {
  id: string;
  patientId?: string;
  entityName: string;
  type: 'Invoice' | 'Payment' | 'Refund' | 'Commission';
  amount: number;
  status: 'Paid' | 'Unpaid' | 'Partial' | 'Overdue';
  date: string;
  category: 'Treatment' | 'Travel' | 'Administrative';
}

export interface TransportTeam {
  id: string;
  name: string;
  vehicle: string;
  status: 'Available' | 'On Trip' | 'Offline';
  contact: string;
}

export interface PatientArrival {
  id: string;
  patientName: string;
  patientId: string;
  flightNumber: string;
  carrier: string;
  arrivalDate: string;
  arrivalTime: string;
  countryCode: string; // Used for color coding (e.g., 'UAE', 'TUR', 'GER')
  status: ArrivalStatus;
  assignedTransportId?: string;
  notes?: string;
}

export interface CommunicationTemplate {
  id: string;
  /** Display name used in template library */
  title: string;
  /** Alias for title stored in new schema */
  template_name?: string;
  category: 'Clinical' | 'Financial' | 'Logistics' | 'General' | 'Patient' | 'Doctor' | 'Hospital' | 'Partner' | 'Finance';
  /** Who this template is targeting */
  target: 'Doctor' | 'Patient' | 'Hospital' | 'Partner' | 'Finance' | 'Logistics';
  /** Alias for target stored in new schema */
  target_audience?: string;
  /** Email subject line (supports merge vars e.g. {{patient_name}}) */
  subject: string;
  /** Legacy plain body – kept for backwards compat */
  body: string;
  /** Injected into {{EMAIL_TITLE}} placeholder in master template */
  email_title?: string;
  /** Injected into {{EMAIL_SUBTITLE}} placeholder in master template */
  email_subtitle?: string;
  /** Injected into {{EMAIL_CONTENT}} placeholder in master template */
  email_content?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MessageLog {
  id: string;
  recipient: string;
  subject: string;
  sentAt: string;
  channel: 'Email' | 'WhatsApp';
  status: 'Delivered' | 'Opened' | 'Failed';
}

export interface Embassy {
  id: string;
  name: string;
  country: string;
  city: string;
  address: string;
  consularSection: string;
}

export interface VisaInvitation {
  id: string;
  travelerName: string;
  passportNumber: string;
  nationality: string;
  purpose: 'Conference' | 'Training' | 'Consultation' | 'Observation';
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Issued' | 'Sent';
  verificationCode: string;
  content?: string;
  embassyId?: string;
  embassyAddress?: string;
  patientId?: string;
}

export interface HistoryEvent {
  id: string;
  type: 'status_change' | 'physician_reassignment' | 'task_assignment' | 'task_completion' | 'care_team_update' | 'enrollment' | 'document_generated' | 'communication_sent' | 'demographic_update';
  description: string;
  timestamp: string;
  user: string;
}

export interface AutomatedMessage {
  id: string;
  source: 'Email' | 'WhatsApp';
  sender: string;
  content: string;
  receivedAt: string;
  status: 'Raw' | 'Processing' | 'Converted' | 'Forwarded' | 'Ignored';
  patientName?: string;
}

export interface MedicalOpinion {
  id: string;
  doctorName: string;
  opinion: string;
  timestamp: string;
  isUrgent: boolean;
  packageType?: string;
}

export interface ClinicalConsultation {
  id: string;
  queryId: string;
  patientName: string;
  description: string;
  assignedDoctor: string;
  status: 'Pending' | 'Collected' | 'Archived';
  opinions: MedicalOpinion[];
  sentAt: string;
}

export interface Lead {
  id: string;
  name: string; // full_name in DB
  email: string;
  phone?: string;
  company?: string; // Legacy alias for facility/hospital
  facilityType?: string; // facility_type in DB
  specialty?: string;
  bedCount?: number; // bed_count in DB
  treatmentInterest?: string; // treatment_interest
  source?: string;
  status: LeadStatus;
  notes?: string;
  urgency?: string;
  value?: number; // Legacy alias for budget/contract value
  budgetRange?: string; // budget_range
  country?: string;
  message?: string;
  preferredDate?: string; // preferred_date
  lastContact?: string; // last_contact_date
  assignedTo?: string; // assigned_to
  createdAt?: string;
  metadata?: any;
  workflowStage?: number;
  workflowState?: any;
}

export interface MedicalCase {
  id: string;
  patientId?: string;
  leadId?: string;
  title: string;
  status: string;
  priority: string;
  assignedTo?: string; // General
  assignedBdmId?: string;
  assignedCdmId?: string;
  assignedBuddyId?: string;
  doctorId?: string;
  hospitalId?: string;
  createdAt: string;
  updatedAt: string;
}


export interface Patient {
  id: string; // references profiles.id
  full_name?: string; // from profiles
  name?: string;      // backwards compat alias
  email?: string; // from profiles
  phone?: string; // from profiles
  patient_id?: string; // from patients table
  medicalId?: string;  // backwards compat alias
  medical_history?: string;
  preferred_country?: string;
  preferred_currency?: string;
  preferred_language?: string;
  date_of_birth?: string;
  gender?: Gender;
  blood_group?: string;
  allergies?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  status: PatientStatus; // clinical status
  priority: PatientPriority;
  referralSource?: string;
  diagnosis?: string;
  assignedPhysician?: string;
  assignedBdmName?: string;
  assignedCdmName?: string;
  assignedBuddyName?: string;
  lastVisit?: string;
  nextAppointment?: string;
  careTeam?: string[];
  history?: HistoryEvent[];
  created_at?: string;
  updated_at?: string;
}


export interface InventoryItem {
  id: string;
  name: string;
  type: 'Sample' | 'Collateral' | 'Gift';
  stock: number;
  unit: string;
  sku: string;
}

export interface RouteVisit {
  id: string;
  leadId: string;
  facilityName: string;
  plannedTime: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Missed';
  notes?: string;
}

export interface Expense {
  id: string;
  category: 'Travel' | 'Meals' | 'Lodging' | 'Conference' | 'Other';
  amount: number;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  description: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: TaskPriority;
  completed: boolean;
  leadId?: string;
  patientId?: string;
  type: 'follow-up' | 'meeting' | 'document' | 'other';
}

export type SpecializedPackage = {
  id: string;
  name: string;
  category: 'Transplant' | 'Ortho' | 'Neuro' | 'Cardiac' | 'General';
  description: string;
};

export interface MedicalFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  category: 'Imaging' | 'Lab' | 'Legal' | 'Financial' | 'Other';
  patientId?: string;
  leadId?: string;
  secureUrl: string;
  status: 'Uploading' | 'Scanning' | 'Secure';
}
