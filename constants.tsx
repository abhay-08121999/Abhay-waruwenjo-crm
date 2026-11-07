
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Kanban, 
  TrendingUp, 
  Settings, 
  Sparkles,
  HeartPulse,
  Map,
  Package,
  Wallet,
  ShoppingCart,
  Zap,
  Network,
  Plane,
  Mail,
  Truck,
  HardDrive,
  FileCheck,
  LifeBuoy,
  Briefcase,
  UserCircle,
  Hospital as HospitalIcon,
  Stethoscope,
  FileSignature,
  MessageSquare,
  Shield
} from 'lucide-react';
import { Lead, LeadStatus, Patient, PatientStatus, PatientPriority, Task, TaskPriority, FacilityType, CommunicationTemplate, Embassy, TransportTeam, PatientArrival, ArrivalStatus, AutomatedMessage, Gender, TravelBooking, ConsentForm, Dispute, Agreement, FinanceRecord, Hospital, Doctor } from './types.ts';

export const NAVIGATION = [
  { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '#/' },
  { name: 'Hospitals', icon: <HospitalIcon size={20} />, path: '#/hospitals' },
  { name: 'Doctors', icon: <Stethoscope size={20} />, path: '#/doctors' },
  { name: 'Patient Leads', icon: <UserCircle size={20} />, path: '#/patient-leads' },
  { name: 'Smart Inbound', icon: <Zap size={20} />, path: '#/automation' },
  { name: 'Clinical Bridge', icon: <Network size={20} />, path: '#/bridge' },
  { name: 'Consent Center', icon: <FileCheck size={20} />, path: '#/consent' },
  { name: 'Travel Mgmt', icon: <Plane size={20} />, path: '#/travel-mgmt' },
  { name: 'Agreements', icon: <Briefcase size={20} />, path: '#/agreements' },
  { name: 'Quotations', icon: <FileSignature size={20} />, path: '#/quotations' },
  { name: 'Finance Ledger', icon: <Wallet size={20} />, path: '#/finance' },
  { name: 'Dispute Center', icon: <LifeBuoy size={20} />, path: '#/disputes' },
  { name: 'Communications', icon: <Mail size={20} />, path: '#/communications' },
  { name: 'WhatsApp Inbox', icon: <MessageSquare size={20} />, path: '#/whatsapp' },
  { name: 'Digital Vault', icon: <HardDrive size={20} />, path: '#/vault' },
  { name: 'Logistics Hub', icon: <Truck size={20} />, path: '#/logistics' },
  { name: 'Medical Leads', icon: <Users size={20} />, path: '#/leads' },
  { name: 'Sales Pipeline', icon: <Kanban size={20} />, path: '#/pipeline' },
  { name: 'Patient Journey', icon: <HeartPulse size={20} />, path: '#/patients' },
  { name: 'Procurement', icon: <ShoppingCart size={20} />, path: '#/orders' },
  { name: 'Samples & Gift', icon: <Package size={20} />, path: '#/inventory' },
  { name: 'AI Diagnostics', icon: <Sparkles size={20} />, path: '#/insights' },
  { name: 'Analytics', icon: <TrendingUp size={20} />, path: '#/reports' },
  { name: 'User Management', icon: <Shield size={20} />, path: '#/users' },
  { name: 'Settings', icon: <Settings size={20} />, path: '#/settings' },
];

export const MOCK_HOSPITALS: Hospital[] = [
  {
    id: 'h1',
    name: 'Metropolitan General Hospital',
    type: FacilityType.HOSPITAL,
    country: 'USA',
    city: 'New York',
    address: '100 Medical Plaza, NY 10001',
    email: 'contact@metro-gen.org',
    phone: '+1 212 555 0100',
    rating: 4.8,
    bedCount: 450,
    accreditation: 'JCI Accredited'
  },
  {
    id: 'h2',
    name: 'Istanbul Aesthetics Center',
    type: FacilityType.CLINIC,
    country: 'Turkey',
    city: 'Istanbul',
    address: 'Sisli Center, Istanbul 34360',
    email: 'info@istanbul-aesthetics.tr',
    phone: '+90 212 555 1234',
    rating: 4.9,
    accreditation: 'ISO 9001'
  }
];

export const MOCK_DOCTORS: Doctor[] = [
  { id: 'd1', name: 'Dr. Sarah Smith', specialty: 'Cardiology', hospitalId: 'h1', hospitalName: 'Metropolitan General', email: 's.smith@metro-gen.org', phone: '+1 212 555 0122', status: 'Active', avatar: 'https://i.pravatar.cc/150?u=sarah' },
  { id: 'd2', name: 'Dr. Mike Ross', specialty: 'General Surgery', hospitalId: 'h1', hospitalName: 'Metropolitan General', email: 'm.ross@metro-gen.org', phone: '+1 212 555 0123', status: 'Active', avatar: 'https://i.pravatar.cc/150?u=mike' },
  { id: 'd3', name: 'Dr. Elena Vance', specialty: 'Neurology', hospitalId: 'h2', hospitalName: 'Istanbul Aesthetics', email: 'e.vance@istanbul-aest.tr', phone: '+90 212 555 4433', status: 'Active', avatar: 'https://i.pravatar.cc/150?u=elena' },
  { id: 'd4', name: 'Dr. Gregory House', specialty: 'Diagnostic Medicine', hospitalId: 'h1', hospitalName: 'Metropolitan General', email: 'g.house@metro-gen.org', phone: '+1 212 555 0199', status: 'On Leave', avatar: 'https://i.pravatar.cc/150?u=house' },
];

export const MOCK_TRAVEL: TravelBooking[] = [
  { id: 'tr1', patientId: 'p1', patientName: 'Alice Johnson', type: 'Flight', provider: 'Emirates', reference: 'EK-992-A', date: '2024-06-15', status: 'Confirmed', details: 'DXB to LHR - Business Class' },
  { id: 'tr2', patientId: 'p1', patientName: 'Alice Johnson', type: 'Hotel', provider: 'Hilton London', reference: 'HL-0012', date: '2024-06-15', status: 'Confirmed', details: '7 Nights - Superior Suite' },
  { id: 'tr3', patientId: 'p2', patientName: 'Robert Miller', type: 'Transfer', provider: 'Alpha Elite', reference: 'T-8821', date: '2024-06-12', status: 'Pending', details: 'Airport to St. Judes' }
];

export const MOCK_CONSENT: ConsentForm[] = [
  { id: 'c1', patientId: 'p1', patientName: 'Alice Johnson', type: 'Surgical', status: 'Signed', signedAt: '2024-05-18T10:00:00Z', version: 'v2.4' },
  { id: 'c2', patientId: 'p2', patientName: 'Robert Miller', type: 'Data Privacy', status: 'Pending', version: 'v1.0' }
];

export const MOCK_DISPUTES: Dispute[] = [
  { id: 'd1', reporterName: 'Marcus Thorne', category: 'Billing', priority: 'High', status: 'In Review', subject: 'Duplicate invoice for MRI session', createdAt: '2024-05-19T14:20:00Z' },
  { id: 'd2', reporterName: 'Elena G.', category: 'Service Quality', priority: 'Medium', status: 'Open', subject: 'Delay in ground transfer pickup', createdAt: '2024-05-20T09:00:00Z' }
];

export const MOCK_FINANCE: FinanceRecord[] = [
  { id: 'f1', entityName: 'Alice Johnson', type: 'Invoice', amount: 12500, status: 'Paid', date: '2024-05-15', category: 'Treatment' },
  { id: 'f2', entityName: 'Global Air Tours', type: 'Payment', amount: 1200, status: 'Partial', date: '2024-05-18', category: 'Travel' },
  { id: 'f3', entityName: 'Dr. Mike Ross', type: 'Commission', amount: 500, status: 'Unpaid', date: '2024-05-20', category: 'Administrative' }
];

export const MOCK_AGREEMENTS: Agreement[] = [
  { id: 'ag1', partnerName: 'Metropolitan General', type: 'Service Level', status: 'Active', validUntil: '2025-12-31', version: 'v4.2' },
  { id: 'ag2', partnerName: 'AirMed Logistics', type: 'Agency Partnership', status: 'Draft', validUntil: '2024-12-31', version: 'v1.0' }
];

export const TRANSPORT_TEAMS: TransportTeam[] = [
  { id: 'tt1', name: 'Alpha Response', vehicle: 'Luxury SUV (Black)', status: 'Available', contact: '+1 (555) 001-1122' },
  { id: 'tt2', name: 'City Shuttle', vehicle: 'Mini-Van (Silver)', status: 'On Trip', contact: '+1 (555) 001-3344' },
  { id: 'tt3', name: 'Elite Transfer', vehicle: 'Sedan (White)', status: 'Available', contact: '+1 (555) 001-5566' }
];

export const MOCK_ARRIVALS: PatientArrival[] = [
  { 
    id: 'a1', 
    patientName: 'Alice Johnson', 
    patientId: 'p1', 
    flightNumber: 'EK201', 
    carrier: 'Emirates', 
    arrivalDate: new Date().toISOString().split('T')[0], 
    arrivalTime: '10:30 AM', 
    countryCode: 'UAE', 
    status: ArrivalStatus.EXPECTED 
  },
  { 
    id: 'a2', 
    patientName: 'Robert Miller', 
    patientId: 'p2', 
    flightNumber: 'TK12', 
    carrier: 'Turkish Airlines', 
    arrivalDate: new Date().toISOString().split('T')[0], 
    arrivalTime: '02:15 PM', 
    countryCode: 'TUR', 
    status: ArrivalStatus.PICKED_UP 
  },
  { 
    id: 'a3', 
    patientName: 'Catherine Vane', 
    patientId: 'p3', 
    flightNumber: 'LH455', 
    carrier: 'Lufthansa', 
    arrivalDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], 
    arrivalTime: '09:00 AM', 
    countryCode: 'GER', 
    status: ArrivalStatus.EXPECTED 
  }
];

export const MOCK_INBOUND_FEED: AutomatedMessage[] = [
  { id: 'm1', source: 'WhatsApp', sender: 'Dr. Aris (City Lab)', content: 'We need 20 MRI scanners. Urgent procurement review requested.', receivedAt: '2 mins ago', status: 'Raw' },
  { id: 'm2', source: 'Email', sender: 'procurement@st-judes.org', content: 'Inquiry for centralized patient record software for our 300-bed facility.', receivedAt: '15 mins ago', status: 'Raw' },
  { id: 'm3', source: 'WhatsApp', sender: 'Nurse Sarah (CH)', content: 'Looking for portable X-Ray units for regional expansion.', receivedAt: '1 hour ago', status: 'Raw' }
];

export const COUNTRY_COLORS: Record<string, string> = {
  UAE: 'bg-emerald-500 border-emerald-600',
  TUR: 'bg-red-500 border-red-600',
  GER: 'bg-amber-500 border-amber-600',
  USA: 'bg-blue-500 border-blue-600',
  GBR: 'bg-indigo-500 border-indigo-600',
};

export const MOCK_EMBASSIES: Embassy[] = [
  {
    id: 'e1',
    name: 'Consulate General of the UAE',
    country: 'United Arab Emirates',
    city: 'New York',
    address: '3 Dag Hammarskjöld Plaza, 8th Fl, New York, NY 10017',
    consularSection: 'Attn: Medical Affairs Department'
  },
  {
    id: 'e2',
    name: 'Embassy of the Federal Republic of Germany',
    country: 'Germany',
    city: 'Tokyo',
    address: '4-chome-5-10 Minamiazabu, Minato City, Tokyo 106-0047',
    consularSection: 'Attn: Visa & Consular Services'
  },
  {
    id: 'e3',
    name: 'Royal Embassy of Saudi Arabia',
    country: 'Saudi Arabia',
    city: 'London',
    address: '30 Belgrave Square, London SW1X 8QB',
    consularSection: 'Attn: Cultural & Medical Attaché'
  },
  {
    id: 'e4',
    name: 'Embassy of the Republic of Turkey',
    country: 'Turkey',
    city: 'Washington D.C.',
    address: '2525 Massachusetts Ave NW, Washington, DC 20008',
    consularSection: 'Attn: International Healthcare Division'
  }
];

export const MOCK_TEMPLATES: CommunicationTemplate[] = [
  {
    id: 't1',
    category: 'Clinical',
    title: 'Medical Opinion Dispatch',
    subject: 'Specialist Opinion: {{patient_name}} - Case #{{case_id}}',
    body: 'Dear {{recipient_name}},\n\nPlease find attached the clinical opinion from {{doctor_name}} regarding the recent consultation for {{patient_name}}.\n\nPlease contact our clinical coordination team if you have any follow-up questions.\n\nRegards,\nWaruWenJo Clinical Team',
    email_title: 'Medical Opinion Ready',
    email_subtitle: 'Your specialist consultation summary is now available.',
    email_content: 'Dear {{recipient_name}},\n\nPlease find attached the clinical opinion from {{doctor_name}} regarding the recent consultation for {{patient_name}}.\n\nCase ID: {{case_id}}\n\nPlease contact our clinical coordination team if you have any follow-up questions.\n\nRegards,\nWaruWenJo Clinical Team',
    target: 'Patient',
    target_audience: 'Patient',
  },
  {
    id: 't2',
    category: 'Finance',
    title: 'Proforma Invoice',
    subject: 'Proforma Invoice - {{invoice_number}}',
    body: 'Dear {{recipient_name}},\n\nPlease find attached the proforma invoice for your review.\n\nInvoice: {{invoice_number}}\nTreatment: {{treatment_name}}\n\nWe look forward to partnering with you.',
    email_title: 'Invoice from WaruWenJo',
    email_subtitle: 'Your proforma invoice is ready for review.',
    email_content: 'Dear {{recipient_name}},\n\nPlease find the proforma invoice details below.\n\nInvoice Number: {{invoice_number}}\nTreatment: {{treatment_name}}\nValidity: 30 Days\n\nPlease contact us for any clarifications.\n\nBest regards,\nWaruWenJo Finance Team',
    target: 'Finance',
    target_audience: 'Finance',
  },
  {
    id: 't3',
    category: 'Logistics',
    title: 'Pre-Intimation Visit',
    subject: 'Facility Visit Notification - {{hospital_name}}',
    body: 'Dear {{recipient_name}},\n\nThis is to notify you of an upcoming visit to {{hospital_name}}.\n\nPlease let us know if timing requires adjustment.',
    email_title: 'Upcoming Visit Notification',
    email_subtitle: 'A WaruWenJo representative will be visiting your facility.',
    email_content: 'Dear {{recipient_name}},\n\nThis is to notify you that our regional representative is scheduled to visit {{hospital_name}}.\n\nAppointment Date: {{appointment_date}}\n\nPlease let us know if this timing requires any adjustment.\n\nWarm regards,\nWaruWenJo Operations Team',
    target: 'Hospital',
    target_audience: 'Hospital',
  },
  {
    id: 't4',
    category: 'Patient',
    title: 'Appointment Confirmation',
    subject: 'Appointment Confirmed - {{patient_name}}',
    body: 'Dear {{patient_name}},\n\nYour appointment with {{doctor_name}} has been confirmed.\n\nDate: {{appointment_date}}\nHospital: {{hospital_name}}\n\nRegards,\nWaruWenJo Clinical Team',
    email_title: 'Your Appointment Is Confirmed',
    email_subtitle: 'Your consultation has been successfully scheduled.',
    email_content: 'Dear {{patient_name}},\n\nYour appointment with {{doctor_name}} has been confirmed.\n\nDate: {{appointment_date}}\nHospital: {{hospital_name}}\nCase ID: {{case_id}}\n\nIf you need to reschedule or have any questions, please contact us at contact@waruwenjo.com or call +91 73492 51395.\n\nWarm regards,\nWaruWenJo Clinical Team',
    target: 'Patient',
    target_audience: 'Patient',
  },
  {
    id: 't5',
    category: 'Partner',
    title: 'Partnership Welcome',
    subject: 'Welcome to the WaruWenJo Partner Network',
    body: 'Dear {{recipient_name}},\n\nWelcome to WaruWenJo Medical Tourism Partners network.\n\nWarm regards,\nWaruWenJo Team',
    email_title: 'Welcome to WaruWenJo',
    email_subtitle: 'We are thrilled to have you as a valued partner.',
    email_content: 'Dear {{recipient_name}},\n\nWelcome to the WaruWenJo Medical Tourism Partners network.\n\nWe are excited to begin this journey with you and look forward to building a long-lasting partnership.\n\nFor any queries, please reach out to your dedicated account manager or write to us at contact@waruwenjo.com.\n\nWarm regards,\nWaruWenJo Partnership Team',
    target: 'Partner',
    target_audience: 'Partner',
  },
];

export const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    name: 'Dr. Elizabeth Chen',
    company: 'Metropolitan General Hospital',
    email: 'e.chen@metro-gen.org',
    phone: '+1 415 555 0122',
    status: LeadStatus.PROPOSAL,
    value: 85000,
    lastContact: '2024-05-18',
    notes: 'Inquiry regarding 15 new MRI diagnostic units.',
    facilityType: FacilityType.HOSPITAL,
    bedCount: 450,
    assignedTo: 'James Wilson'
  },
  {
    id: '2',
    name: 'Marcus Thorne',
    company: 'Thorne Orthopedics Clinic',
    email: 'm.thorne@ortho-specialists.com',
    phone: '+1 650 555 0199',
    status: LeadStatus.QUALIFIED,
    value: 12000,
    lastContact: '2024-05-14',
    notes: 'Interested in cloud-based patient record management software trial.',
    facilityType: FacilityType.CLINIC,
    specialty: 'Orthopedics',
    assignedTo: 'James Wilson'
  }
];

export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'p1',
    name: 'Alice Johnson',
    medicalId: 'MED-7721',
    gender: Gender.FEMALE,
    status: PatientStatus.CONSULTATION,
    priority: PatientPriority.URGENT,
    referralSource: 'Dr. Elizabeth Chen',
    diagnosis: 'Chronic Hypertension',
    assignedPhysician: 'Dr. Sarah Smith',
    lastVisit: '2024-05-10',
    nextAppointment: '2024-05-25',
    careTeam: ['Nurse Kelly', 'Dietitian Rob'],
    history: [
      { id: 'h1', type: 'enrollment', description: 'Patient enrolled via Dr. Elizabeth Chen referral.', timestamp: '2024-05-01T09:00:00Z', user: 'Admin' },
      { id: 'h2', type: 'status_change', description: 'Status changed from Referral to Consultation.', timestamp: '2024-05-05T14:30:00Z', user: 'Dr. Sarah Smith' },
      { id: 'h3', type: 'care_team_update', description: 'Added Nurse Kelly to the care team.', timestamp: '2024-05-06T11:00:00Z', user: 'System' }
    ]
  },
  {
    id: 'p2',
    name: 'Robert Miller',
    medicalId: 'MED-8812',
    gender: Gender.MALE,
    status: PatientStatus.ACTIVE_CARE,
    priority: PatientPriority.STANDARD,
    referralSource: 'Walk-in',
    diagnosis: 'Post-Traumatic Recovery',
    assignedPhysician: 'Dr. Mike Ross',
    lastVisit: '2024-05-15',
    nextAppointment: '2024-05-22',
    careTeam: ['Physio Elena'],
    history: [
      { id: 'h4', type: 'enrollment', description: 'Emergency walk-in enrollment.', timestamp: '2024-05-10T22:15:00Z', user: 'Nurse On-Call' },
      { id: 'h5', type: 'physician_reassignment', description: 'Assigned to Dr. Mike Ross for specialized trauma care.', timestamp: '2024-05-11T08:00:00Z', user: 'Admin' }
    ]
  },
  {
    id: 'p3',
    name: 'Catherine Vane',
    medicalId: 'MED-9904',
    gender: Gender.FEMALE,
    status: PatientStatus.POST_OP,
    priority: PatientPriority.EMERGENCY,
    referralSource: 'Emergency Dept',
    diagnosis: 'Cardiac Surgery Recovery',
    assignedPhysician: 'Dr. Elena Vance',
    lastVisit: '2024-05-19',
    nextAppointment: '2024-05-21',
    careTeam: ['ICU Team A', 'Nurse Kelly'],
    history: [
      { id: 'h6', type: 'enrollment', description: 'Post-surgery admission.', timestamp: '2024-05-18T16:00:00Z', user: 'Surgical Team' },
      { id: 'h7', type: 'status_change', description: 'Transferred to Post-Op recovery unit.', timestamp: '2024-05-19T06:00:00Z', user: 'ICU Monitor' }
    ]
  }
];

export const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Send ISO 13485 docs to Dr. Chen', dueDate: new Date().toISOString().split('T')[0], priority: TaskPriority.HIGH, completed: false, leadId: '1', type: 'document' },
  { id: '2', title: 'Call Marcus for software feedback', dueDate: new Date().toISOString().split('T')[0], priority: TaskPriority.MEDIUM, completed: false, leadId: '2', type: 'follow-up' },
  { id: '3', title: 'Review Alice Johnson Labs', dueDate: new Date().toISOString().split('T')[0], priority: TaskPriority.HIGH, completed: true, patientId: 'p1', type: 'follow-up' },
  { id: '4', title: 'Coordinate pick-up for Robert Miller', dueDate: new Date().toISOString().split('T')[0], priority: TaskPriority.MEDIUM, completed: false, patientId: 'p2', type: 'follow-up' },
];

export const PHYSICIANS = MOCK_DOCTORS.map(d => ({ id: d.id, name: d.name, specialty: d.specialty, avatar: d.avatar }));

export const AVAILABLE_STAFF = [
  { name: 'Nurse Kelly', role: 'RN', avatar: 'https://i.pravatar.cc/150?u=kelly' },
  { name: 'Dietitian Rob', role: 'Nutritionist', avatar: 'https://i.pravatar.cc/150?u=rob' },
  { name: 'Physio Elena', role: 'Physical Therapist', avatar: 'https://i.pravatar.cc/150?u=elena_staff' },
  { name: 'ICU Team A', role: 'Intensive Care', avatar: 'https://i.pravatar.cc/150?u=icu_a' },
  { name: 'Pharmacist Sam', role: 'Pharmacy', avatar: 'https://i.pravatar.cc/150?u=sam' },
  { name: 'Tech Maria', role: 'Radiology Tech', avatar: 'https://i.pravatar.cc/150?u=maria' },
  { name: 'Social Worker Dan', role: 'Case Manager', avatar: 'https://i.pravatar.cc/150?u=dan' },
];
