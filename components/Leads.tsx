import React, { useState, useEffect } from 'react';
import { fetchB2BLeads, createB2BLead, fetchMedicalLeadAgreements, getAgreementPdfUrl, sendCrmEmail, uploadSignedMou, uploadSignedConsentLetter, getSignedMouUrl, saveMedicalLeadSignedDocumentPath } from '../services/supabase.ts';
import * as XLSX from 'xlsx';
import { LeadStatus } from '../types.ts';
import { 
  Search, Filter, MoreVertical, Mail, Phone, Plus, Briefcase, Landmark, Upload, X, FileSpreadsheet, Send, 
  Calendar, Target, LayoutGrid, List, ChevronRight, DollarSign, Building, FileText, ShieldCheck,
  User, CheckCircle2, Clock, ArrowLeft, ChevronLeft, Check, Circle, Workflow, Archive, Trash2, RotateCcw, Save
} from 'lucide-react';
import { toast } from 'sonner';

type ViewMode = 'TABLE' | 'BOARD';

const Leads: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('BOARD');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [showNewPartner, setShowNewPartner] = useState(false);
  const [savingPartner, setSavingPartner] = useState(false);
  const [partnerForm, setPartnerForm] = useState({
    partner_type: 'Hospital', full_name: '', company_name: '', email: '', phone: '',
    industry: '', country: '', city: '', website: '', address: '', source: '',
    source_reference: '', campaign_name: '', target_geography: '', owner_name: '',
    data_use_permission: false, notes: ''
  });
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkRows, setBulkRows] = useState<any[]>([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkManual, setBulkManual] = useState('');
  const [manualPartner, setManualPartner] = useState({ full_name: '', email: '', company_name: '', partner_type: 'Doctor', phone: '', industry: 'Healthcare', city: '', country: 'India' });
  const [bulkOwner, setBulkOwner] = useState('');
  const [bulkPermission, setBulkPermission] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await fetchB2BLeads();
    if (error) {
      toast.error('Failed to load business leads');
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  };

  const setPartnerField = (field: string, value: string | boolean) => {
    setPartnerForm(current => ({ ...current, [field]: value }));
  };

  const handleCreatePartner = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!partnerForm.source.trim() || !partnerForm.owner_name.trim() || !partnerForm.partner_type) {
      toast.error('Source, owner, and partner category are required.');
      return;
    }
    if (!partnerForm.full_name.trim()) {
      toast.error('Please enter the primary contact name.');
      return;
    }
    if (partnerForm.email.trim() && !/^\S+@\S+\.\S+$/.test(partnerForm.email.trim())) {
      toast.error('Enter a valid email address or leave the email field blank.');
      return;
    }
    if (!partnerForm.data_use_permission) {
      toast.error('Confirm data-use permission before saving this partner inquiry.');
      return;
    }

    setSavingPartner(true);
    try {
      const { data, error } = await createB2BLead({
        ...partnerForm,
        full_name: partnerForm.full_name.trim(),
        email: partnerForm.email.trim().toLowerCase() || undefined,
        status: 'new',
        estimated_value: null,
        pipeline_stage: 'Imported'
      });
      if (error) {
        toast.error(`Could not create partner: ${error.message || 'Unknown error'}`);
        return;
      }
      if (!data) {
        toast.error('The partner could not be created. No record was returned.');
        return;
      }
      setLeads(current => [data, ...current]);
      toast.success('Partner inquiry created. No outreach or MoU was sent.');
      setShowNewPartner(false);
      setPartnerForm({
        partner_type: 'Hospital', full_name: '', company_name: '', email: '', phone: '',
        industry: '', country: '', city: '', website: '', address: '', source: '',
        source_reference: '', campaign_name: '', target_geography: '', owner_name: '',
        data_use_permission: false, notes: ''
      });
    } catch (error) {
      console.error('Create partner failed', error);
      toast.error('Could not create partner. Please check the form and try again.');
    } finally {
      setSavingPartner(false);
    }
  };

  const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const mapBulkRow = (row: Record<string, unknown>) => {
    const normalized: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => { normalized[normalizeHeader(key)] = value; });
    const get = (...keys: string[]) => {
      for (const key of keys) { const value = normalized[normalizeHeader(key)]; if (value !== undefined && value !== null && String(value).trim()) return String(value).trim(); }
      return '';
    };
    return {
      partner_type: get('partner_type', 'partnertype', 'type') || 'Doctor',
      full_name: get('full_name', 'fullname', 'name', 'doctor_name', 'contact_name'),
      company_name: get('company_name', 'company', 'hospital', 'clinic', 'organization', 'organisation'),
      email: get('email', 'email_address', 'emailaddress').toLowerCase(),
      phone: get('phone', 'mobile', 'telephone', 'contact_number'),
      industry: get('industry', 'specialty', 'speciality', 'department') || 'Healthcare',
      country: get('country'), city: get('city'), website: get('website', 'url'), address: get('address'),
      source: get('source') || 'Bulk Import', source_reference: get('source_reference', 'reference'),
      campaign_name: get('campaign_name', 'campaign') || 'Bulk Partner Outreach',
      target_geography: get('target_geography', 'geography'), owner_name: get('owner_name', 'owner', 'bdm') || bulkOwner.trim(),
      notes: get('notes', 'remarks', 'comments'),
    };
  };
  const handleBulkFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) { toast.error('Upload a CSV or Excel (.xlsx/.xls) file.'); return; }
    try {
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
      const mapped = parsed.map(mapBulkRow).filter(row => row.full_name || row.company_name || row.email);
      setBulkRows(mapped); setBulkFileName(file.name);
      if (!mapped.length) toast.error('No partner rows found. Check the first sheet and column headers.');
      else toast.success(`${mapped.length} row(s) loaded for review.`);
    } catch (error) { console.error(error); toast.error('Could not read this file. Please check the CSV/XLSX format.'); }
  };
  const addManualBulkRows = () => {
    const lines = bulkManual.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) { toast.error('Enter partner details first.'); return; }
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(v => v.trim());
    const parsed = lines.slice(1).map(line => {
      const values = line.split(delimiter);
      return mapBulkRow(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
    }).filter(row => row.full_name || row.company_name || row.email);
    if (!parsed.length) { toast.error('Add a header row and at least one partner row.'); return; }
    setBulkRows(current => [...current, ...parsed]); setBulkManual('');
    toast.success(`${parsed.length} manual row(s) added for review.`);
  };
  const normalizeIdentity = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const normalizePhone = (value: unknown) => String(value ?? '').replace(/\D/g, '');
  const getBulkRowIssues = (row: any, index: number): string[] => {
    const issues: string[] = [];
    const name = String(row.full_name ?? '').trim();
    const email = String(row.email ?? '').trim().toLowerCase();
    const phone = normalizePhone(row.phone);
    const company = normalizeIdentity(row.company_name);
    if (!name) issues.push('Contact name required');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) issues.push('Invalid email');
    if (phone && (phone.length < 7 || phone.length > 15)) issues.push('Invalid phone');

    const isSameIdentity = (other: any) => {
      const otherEmail = normalizeIdentity(other.email);
      const otherPhone = normalizePhone(other.phone);
      const otherName = normalizeIdentity(other.full_name);
      const otherCompany = normalizeIdentity(other.company_name);
      return (!!email && email === otherEmail) ||
        (!!phone && phone === otherPhone) ||
        (!!name && !!company && normalizeIdentity(name) === otherName && company === otherCompany);
    };
    if (leads.some(existing => isSameIdentity(existing))) issues.push('Already exists in CRM');
    if (bulkRows.slice(0, index).some(previous => isSameIdentity(previous))) issues.push('Duplicate in this import');
    return issues;
  };
  const bulkValidation = bulkRows.map((row, index) => ({ row, index, issues: getBulkRowIssues(row, index) }));
  const bulkInvalidCount = bulkValidation.filter(item => item.issues.some(issue => issue === 'Contact name required' || issue === 'Invalid email' || issue === 'Invalid phone')).length;
  const bulkDuplicateCount = bulkValidation.filter(item => item.issues.some(issue => issue.includes('exists') || issue.includes('Duplicate'))).length;

  const processBulkImport = async () => {
    console.info('[Bulk partner import] Button clicked', {
      rows: bulkRows.length,
      owner: bulkOwner.trim(),
      permissionConfirmed: bulkPermission,
      alreadyImporting: bulkSending,
    });

    if (bulkSending) return;
    if (!bulkRows.length) {
      toast.error('Upload a file or add partner rows first.');
      return;
    }
    if (!bulkPermission) {
      toast.error('Confirm that these contact details may be stored and used for partner relationship management.');
      return;
    }

    // Keep the existing validation and duplicate-detection rules intact.
    const validation = bulkRows.map((row, index) => ({
      row,
      issues: getBulkRowIssues(row, index),
    }));
    const readyRows = validation
      .filter(item => item.issues.length === 0)
      .map(item => item.row);
    const invalidCount = validation.filter(item =>
      item.issues.some(issue => ['Contact name required', 'Invalid email', 'Invalid phone'].includes(issue))
    ).length;
    const duplicateCount = validation.filter(item =>
      item.issues.some(issue => issue.includes('exists') || issue.includes('Duplicate'))
    ).length;

    if (!readyRows.length) {
      toast.error(`No rows are ready to import. ${invalidCount} invalid row(s), ${duplicateCount} duplicate row(s). Review the status column.`);
      return;
    }

    // Rows can specify their own owner; otherwise the shared BDM name is required.
    if (!bulkOwner.trim() && readyRows.some(row => !String(row.owner_name ?? '').trim())) {
      toast.error('Enter the BDM / partner owner name, or provide owner_name for every valid row.');
      return;
    }

    setBulkSending(true);
    let created = 0;
    const failures: string[] = [];

    try {
      for (const row of readyRows) {
        try {
          const payload = {
            ...row,
            partner_type: String(row.partner_type || 'Doctor').trim(),
            full_name: String(row.full_name || '').trim(),
            source: String(row.source || 'Bulk Import').trim(),
            owner_name: String(row.owner_name || bulkOwner).trim(),
            data_use_permission: true,
            status: 'new',
            estimated_value: null,
            pipeline_stage: 'Imported',
          };

          const result = await createB2BLead(payload);
          if (result?.error || !result?.data) {
            const message = result?.error?.message || 'No record was returned by Supabase';
            console.error('[Bulk partner import] Supabase insert failed', {
              partner: row.full_name || row.email,
              error: result?.error,
            });
            failures.push(`${row.full_name || row.email || 'Unnamed row'}: ${message}`);
            continue;
          }
          created++;
        } catch (rowError) {
          const message = rowError instanceof Error ? rowError.message : String(rowError);
          console.error('[Bulk partner import] Row failed', row, rowError);
          failures.push(`${row.full_name || row.email || 'Unnamed row'}: ${message}`);
        }
      }

      await loadLeads();

      if (created > 0) {
        toast.success(`Imported ${created} partner(s). Skipped ${invalidCount} invalid and ${duplicateCount} duplicate row(s). No emails were sent.`);
      }
      if (failures.length > 0) {
        console.error('[Bulk partner import] Failed rows:', failures);
        toast.error(`${failures.length} row(s) could not be imported. First error: ${failures[0]}`);
      }
      if (created === 0 && failures.length === 0) {
        toast.error('No partners were imported. Review the validation results and try again.');
      }

      console.info('[Bulk partner import] Completed', {
        created,
        skippedInvalid: invalidCount,
        skippedDuplicates: duplicateCount,
        failures,
      });

      if (created > 0 && failures.length === 0) {
        setShowBulkImport(false);
        setBulkRows([]);
        setBulkFileName('');
        setBulkManual('');
        setBulkPermission(false);
        setBulkOwner('');
      }
    } catch (error) {
      console.error('[Bulk partner import] Unexpected error:', error);
      toast.error(`Bulk import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBulkSending(false);
    }
  };

  const filteredLeads = leads.filter(lead =>
    (lead.full_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (lead.company_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (lead.industry?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new': return 'bg-sky-50 text-sky-600 border-sky-100';
      case 'qualified': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'proposal': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'won': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'lost': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const BusinessLeadCard: React.FC<{ lead: any }> = ({ lead }) => (
    <button type="button" onClick={() => setSelectedLead(lead)} aria-label={`Open workflow for ${lead.company_name || lead.full_name}`} className="text-left w-full bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-indigo-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all group cursor-pointer mb-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <Building size={20} />
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-900 leading-none group-hover:text-indigo-600 transition-colors uppercase truncate max-w-[180px]">{lead.company_name || 'Individual Partner'}</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{lead.industry || 'Medical Sector'}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 bg-slate-50/80 rounded-[1.75rem] p-4 border border-slate-100">
        <div className="flex items-center gap-2 mb-2">
            <User size={12} className="text-slate-400" />
            <p className="text-sm font-bold text-slate-800">{lead.full_name}</p>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/50">
           <div className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-emerald-500" />
              <p className="text-sm font-black text-slate-900">{lead.estimated_value?.toLocaleString() || '---'}</p>
           </div>
           <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${getStatusColor(lead.status || 'new')}`}>
              {lead.status || 'new'}
           </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} />
          <span>{new Date(lead.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex gap-2">
          <div className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-600 transition-all"><Mail size={14} /></div>
          <div className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-600 transition-all"><Phone size={14} /></div>
        </div>
      </div>
    </button>
  );

  const columns = [
    { id: 'new', label: 'Partnership Inquiry', icon: <Target size={14} /> },
    { id: 'qualified', label: 'Qualified Partner', icon: <CheckCircle2 size={14} /> },
    { id: 'proposal', label: 'Contracting / Proposal', icon: <Clock size={14} /> }
  ];

  // The board uses the saved workflow stage as its local display status, so a lead
  // moves to the next board block as its workflow advances without changing DB schema.
  const getWorkflowBoardStatus = (lead: any) => {
    try {
      const archived = JSON.parse(localStorage.getItem(`medical-lead-archive-${lead.id}`) || '{}');
      if (archived.archived || archived.deleted) return 'lost';
      const saved = JSON.parse(localStorage.getItem(`medical-lead-workflow-${lead.id}`) || '{}');
      const stage = Number(saved.stage) || 1;
      return ({ 1: 'new', 2: 'qualified', 3: 'proposal', 4: 'won', 5: 'lost' } as Record<number, string>)[stage] || (lead.status || 'new').toLowerCase();
    } catch { return (lead.status || 'new').toLowerCase(); }
  };

  const MedicalLeadWorkflow: React.FC<{ lead: any; onBack: () => void }> = ({ lead, onBack }) => {
    const stages = [
      { id: 1, name: 'Partnership Inquiry', label: 'Inquiry', status: 'new', tasks: ['Review the partnership inquiry', 'Verify contact and organization details', 'Check for duplicate partner records', 'Confirm the inquiry is genuine', 'Record the inquiry source and owner'] },
      { id: 2, name: 'Qualified Partner', label: 'Qualification', status: 'qualified', tasks: ['Confirm partner type and service fit', 'Understand partnership requirements', 'Verify required organization details', 'Record qualification notes', 'Confirm the next steps with the partner'] },
      { id: 3, name: 'Contracting / Proposal', label: 'MoU, outreach, negotiation & signature', status: 'proposal', tasks: ['Prepare and preview the MoU draft', 'Complete required legal and manager review', 'Send approved MoU to the verified primary contact', 'Record outreach activity and response outcome', 'Record follow-up, negotiation and signature requirements'] },
      { id: 4, name: 'Active Partners', label: 'Active', status: 'won', tasks: ['Confirm the partnership is approved', 'Record final agreement details', 'Assign the ongoing relationship owner', 'Document operational handover and next steps', 'Confirm the partner is active'] },
      { id: 5, name: 'Archived / Deleted Partners', label: 'Archive & retention', status: 'lost', tasks: ['Record archive or deletion reason', 'Confirm active patient-care use is stopped', 'Preserve original lead ID and agreement history', 'Record who archived the partner and when'] },
    ];
    const storageKey = `medical-lead-workflow-${lead.id}`;
    const readState = () => {
      try { const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}'); return { stage: Math.min(5, Math.max(1, Number(parsed.stage) || 1)), checks: parsed.checks || {} }; }
      catch { return { stage: 1, checks: {} }; }
    };
    const [activeStage, setActiveStage] = useState(() => readState().stage);
    const [stage3Agreements, setStage3Agreements] = useState<any[]>([]);
    const [stage3AgreementsLoading, setStage3AgreementsLoading] = useState(false);
    const archiveStorageKey = `medical-lead-archive-${lead.id}`;
    const readArchiveState = () => { try { return JSON.parse(localStorage.getItem(archiveStorageKey) || '{}'); } catch { return {}; } };
    const [archiveState, setArchiveState] = useState<any>(() => readArchiveState());
    const [archiveReason, setArchiveReason] = useState(() => String(readArchiveState().reason || ''));
    const [checks, setChecks] = useState<Record<string, string[]>>(() => readState().checks);
    const qualificationStorageKey = `medical-lead-qualification-${lead.id}`;
    const readQualification = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(qualificationStorageKey) || '{}');
        return {
          relevant: Boolean(saved.relevant),
          contactPlausible: Boolean(saved.contactPlausible),
          category: saved.category ?? lead.partner_type ?? '',
          owner: saved.owner ?? lead.owner_name ?? '',
          priority: saved.priority ?? '',
          highValue: Boolean(saved.highValue),
          managerReviewed: Boolean(saved.managerReviewed),
          reviewNotes: saved.reviewNotes ?? '',
          qualified: Boolean(saved.qualified),
        };
      } catch {
        return { relevant: false, contactPlausible: false, category: lead.partner_type ?? '', owner: lead.owner_name ?? '', priority: '', highValue: false, managerReviewed: false, reviewNotes: '', qualified: false };
      }
    };
    const [qualification, setQualification] = useState(() => readQualification());
    const stage3StorageKey = `medical-lead-stage3-${lead.id}`;
    const readStage3 = () => {
      const defaults = {
        templateType: lead.partner_type || 'Hospital', region: lead.country || 'India', templateVersion: 'HH-MOU-1.0',
        legalName: lead.company_name || lead.full_name || '', scope: '', responsibilities: '', commercialTerms: '', confidentiality: 'Both parties will protect confidential information shared for this partnership and use it only for the agreed purpose.',
        duration: '12 months', termination: 'Either party may terminate with 30 days written notice, subject to the final approved agreement.', signatory: '', nonStandardTerms: false, templateLegalReviewed: false, managerApproved: false, legalApproved: false, approvedToSend: false, primaryEmailVerified: false,
        subject: `Partnership MoU - ${lead.company_name || lead.full_name || 'HealthHub'}`, activityOutcome: 'No Response Yet', activityNote: '', nextActionDate: '', doNotContact: false, optedOut: false,
        activities: [], negotiations: [], sendLogs: [], partnerSignatureName: '', organisationSignatureName: '', partnerSignedDate: '', organisationSignedDate: '', effectiveDate: '', expiryDate: '', finalApproval: false, finalSignatureConfirmed: false,
        lastSavedAt: '', author: qualification.owner || lead.owner_name || '',
      };
      try { return { ...defaults, ...(JSON.parse(localStorage.getItem(stage3StorageKey) || '{}')) }; }
      catch { return defaults; }
    };
    const [stage3, setStage3] = useState<any>(() => readStage3());

    useEffect(() => {
      let cancelled = false;
      const loadStage3Agreements = async () => {
        setStage3AgreementsLoading(true);
        const { data, error } = await fetchMedicalLeadAgreements(String(lead.id));
        if (cancelled) return;
        if (error) {
          console.error('[Medical Leads] Could not load linked MOUs:', error);
          setStage3Agreements([]);
        } else {
          setStage3Agreements(data || []);
        }
        setStage3AgreementsLoading(false);
      };
      void loadStage3Agreements();
      return () => { cancelled = true; };
    }, [lead.id]);
    const stage4StorageKey = `medical-lead-stage4-${lead.id}`;
    const masterPartnerStorageKey = 'healthhub-medical-partner-master-records';
    const readStage4 = () => {
      const defaults = {
        masterRecordId: '', sourceLeadId: String(lead.id), mouVersion: stage3.templateVersion || '',
        partnerType: qualification.category || lead.partner_type || 'Hospital', legalName: stage3.legalName || lead.company_name || lead.full_name || '',
        activeState: 'Onboarding', capabilities: '', serviceArea: [lead.city, lead.country].filter(Boolean).join(', '),
        primaryContact: lead.full_name || '', primaryEmail: lead.email || '', primaryPhone: lead.phone || '',
        relationshipOwner: qualification.owner || lead.owner_name || '', lifecycle: 'Onboarding',
        performanceNotes: '', qualityIssues: '', contactChanges: '', contractExpiryDate: stage3.expiryDate || '', renewalReminderDate: '',
        legalEntityChange: false, bankDetailsChange: false, termsChange: false, changeReviewApproved: false,
        activatedAt: '', auditHistory: [], lastSavedAt: '', signedMouPath: '', signedConsentPath: '',
      };
      try { return { ...defaults, ...(JSON.parse(localStorage.getItem(stage4StorageKey) || '{}')) }; }
      catch { return defaults; }
    };
    const [stage4, setStage4] = useState<any>(() => readStage4());
    const [uploadingStage4Document, setUploadingStage4Document] = useState<'MOU' | 'CONSENT' | null>(null);
    const [showMoUPreview, setShowMoUPreview] = useState(false);
    const [showConsentLetter, setShowConsentLetter] = useState(false);
    const [activityType, setActivityType] = useState('Email');
    const [negotiationNote, setNegotiationNote] = useState('');
    const [sendingMoU, setSendingMoU] = useState(false);
    const saveStage3 = (updates: Record<string, any>, message?: string) => {
      setStage3((current: any) => {
        const next = { ...current, ...updates, lastSavedAt: new Date().toISOString() };
        localStorage.setItem(stage3StorageKey, JSON.stringify(next));
        return next;
      });
      if (message) toast.success(message);
    };
    const saveStage4 = (updates: Record<string, any>, message?: string) => {
      setStage4((current: any) => {
        const now = new Date().toISOString();
        const next = { ...current, ...updates, lastSavedAt: now };
        const changedFields = Object.keys(updates).filter(key => !['auditHistory','lastSavedAt'].includes(key));
        next.auditHistory = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: now, owner: current.relationshipOwner || qualification.owner || lead.owner_name || 'Unassigned', action: message || 'Partner record updated', fields: changedFields }, ...(current.auditHistory || [])];
        localStorage.setItem(stage4StorageKey, JSON.stringify(next));
        return next;
      });
      if (message) toast.success(message);
    };
    const updateStage4Field = (field: string, value: any) => {
      const sensitive = ['legalEntityChange','bankDetailsChange','termsChange'];
      saveStage4({ [field]: value, ...(sensitive.includes(field) || ['legalName','contractExpiryDate'].includes(field) ? { changeReviewApproved: false } : {}) });
    };
    const uploadStage4SignedDocument = async (kind: 'MOU' | 'CONSENT', file?: File) => {
      if (!file) return;
      if (!String(lead.id || '').trim()) { toast.error('Original lead ID is missing.'); return; }
      setUploadingStage4Document(kind);
      try {
        const result = kind === 'MOU'
          ? await uploadSignedMou(String(lead.id), file, stage4.legalName || lead.company_name || lead.full_name || 'partner')
          : await uploadSignedConsentLetter(String(lead.id), file, stage4.legalName || lead.company_name || lead.full_name || 'partner');
        if (result.error || !result.filePath) throw result.error || new Error('Supabase Storage did not return a file path.');

        // Save the Storage path in the originating medical_leads database row.
        const dbResult = await saveMedicalLeadSignedDocumentPath(String(lead.id), kind, result.filePath);
        if (dbResult.error) {
          console.error(`[Stage 4] PDF uploaded, but database path save failed for ${kind}:`, dbResult.error);
          toast.error(`PDF uploaded to Storage, but its path could not be saved to medical_leads: ${dbResult.error.message}. Run the Stage 4 SQL update and check the table's UPDATE policy.`);
        }

        const field = kind === 'MOU' ? 'signedMouPath' : 'signedConsentPath';
        saveStage4({ [field]: result.filePath }, dbResult.error
          ? `Signed ${kind} uploaded to Storage; database path save needs attention.`
          : `Signed ${kind === 'MOU' ? 'MOU' : 'Consent Letter'} uploaded and saved.`);
        if (!dbResult.error) toast.success('Document uploaded and linked to this medical lead.');
      } catch (error: any) {
        console.error(`[Stage 4] Signed ${kind} upload failed:`, error);
        toast.error(error?.message || `Could not upload signed ${kind === 'MOU' ? 'MOU' : 'Consent Letter'}. Check the signedmou bucket and its Storage policies.`);
      } finally {
        setUploadingStage4Document(null);
      }
    };
    const openStage4SignedDocument = async (filePath: string) => {
      if (!filePath) return;
      const { data, error } = await getSignedMouUrl(filePath);
      if (error || !data) { toast.error(error?.message || 'Could not create a secure document link.'); return; }
      window.open(data, '_blank', 'noopener,noreferrer');
    };
    const activatePartner = () => {
      if (!(stage3.finalApproval && stage3.finalSignatureConfirmed && stage3.partnerSignatureName?.trim() && stage3.organisationSignatureName?.trim() && stage3.partnerSignedDate && stage3.organisationSignedDate && stage3.effectiveDate)) {
        toast.error('Stage 3 approval and both parties’ signature details must be complete before activation.'); return;
      }
      if (!stage4.partnerType || !stage4.legalName.trim() || !stage4.relationshipOwner.trim() || !stage4.primaryContact.trim() || !stage4.primaryEmail.trim() || !stage4.capabilities.trim() || !stage4.serviceArea.trim()) {
        toast.error('Complete partner type, legal name, owner, contact, capabilities and service area before activation.'); return;
      }
      let records: any[] = [];
      try { records = JSON.parse(localStorage.getItem(masterPartnerStorageKey) || '[]'); if (!Array.isArray(records)) records = []; } catch { records = []; }
      const existing = records.find((record: any) => String(record.sourceLeadId) === String(lead.id));
      const now = new Date().toISOString();
      const masterRecord = { ...(existing || {}), ...stage4, masterRecordId: existing?.masterRecordId || `partner-${lead.id}`, sourceLeadId: String(lead.id), mouVersion: stage3.templateVersion, lifecycle: 'Active', activeState: 'Active', activatedAt: existing?.activatedAt || now, updatedAt: now };
      records = existing ? records.map((record: any) => String(record.sourceLeadId) === String(lead.id) ? masterRecord : record) : [masterRecord, ...records];
      localStorage.setItem(masterPartnerStorageKey, JSON.stringify(records));
      saveStage4({ ...masterRecord, lifecycle: 'Active', activeState: 'Active', activatedAt: masterRecord.activatedAt }, 'Partner master record activated locally and linked to the original lead.');
      setChecks((previous: any) => {
        const next = { ...previous, 4: [...new Set([...(previous[4] || []), 'Confirm the partnership is approved', 'Record final agreement details', 'Assign the ongoing relationship owner', 'Document operational handover and next steps', 'Confirm the partner is active'])] };
        localStorage.setItem(storageKey, JSON.stringify({ stage: activeStage, checks: next }));
        return next;
      });
    };
    const savePartnerMonitoring = () => {
      const sensitiveChange = stage4.legalEntityChange || stage4.bankDetailsChange || stage4.termsChange;
      if (sensitiveChange && !stage4.changeReviewApproved) { toast.error('Legal entity, bank detail or contract-term changes require review approval before saving.'); return; }
      let records: any[] = [];
      try { records = JSON.parse(localStorage.getItem(masterPartnerStorageKey) || '[]'); if (!Array.isArray(records)) records = []; } catch { records = []; }
      const record = { ...stage4, sourceLeadId: String(lead.id), updatedAt: new Date().toISOString() };
      const exists = records.some((item: any) => String(item.sourceLeadId) === String(lead.id));
      if (exists) records = records.map((item: any) => String(item.sourceLeadId) === String(lead.id) ? record : item);
      else if (stage4.lifecycle === 'Active') { toast.error('Activate the partner first so its master record can be created.'); return; }
      localStorage.setItem(masterPartnerStorageKey, JSON.stringify(records));
      saveStage4({ lastSavedAt: record.updatedAt }, 'Partner monitoring and audit record saved.');
    };
    const updateStage3Field = (field: string, value: any) => saveStage3({ [field]: value, approvedToSend: ['templateType','region','templateVersion','legalName','scope','responsibilities','commercialTerms','confidentiality','duration','termination','signatory','nonStandardTerms'].includes(field) ? false : stage3.approvedToSend });

    const openGeneratedMou = async (filePath: string) => {
      try {
        const { data, error } = await getAgreementPdfUrl(filePath);
        if (error) throw error;
        if (!data) throw new Error('Supabase did not return a document URL.');
        window.open(data, '_blank', 'noopener,noreferrer');
      } catch (error: any) {
        console.error('[Medical Leads] Could not open generated MOU:', error);
        toast.error(error?.message || 'Could not open the generated MOU.');
      }
    };
    const stage3DraftReady = Boolean(stage3.legalName.trim() && stage3.scope.trim() && stage3.responsibilities.trim() && stage3.commercialTerms.trim() && stage3.confidentiality.trim() && stage3.duration.trim() && stage3.termination.trim() && stage3.signatory.trim() && stage3.templateVersion.trim() && stage3.author.trim());
    const stage3ApprovalReady = stage3DraftReady && (!stage3.nonStandardTerms || (stage3.templateLegalReviewed && stage3.legalApproved)) && stage3.managerApproved;
    const makeConsentLetterText = () => [
      'PARTNER CONTACT DATA CONSENT / ACKNOWLEDGEMENT — DRAFT',
      `Date: ${new Date().toLocaleDateString()}`,
      `Contact name: ${lead.full_name || 'Not provided'}`,
      `Organisation: ${stage3.legalName || lead.company_name || 'Not provided'}`,
      `Partner category: ${stage3.templateType || lead.partner_type || 'Not provided'}`,
      `Email: ${lead.email || 'Not provided'}`,
      `Phone: ${lead.phone || 'Not provided'}`,
      '',
      'Purpose: The contact details above may be used by HealthHub for legitimate partnership discussions, qualification, agreement preparation, and relationship management, subject to applicable law and the organisation’s privacy notice.',
      'Choice: The contact may ask questions, request correction or deletion where applicable, or withdraw consent where consent is the legal basis. Withdrawal does not affect processing already lawfully performed.',
      'Contact / owner: ' + (stage3.author || qualification.owner || lead.owner_name || 'Not assigned'),
      '',
      'Contact acknowledgement (complete manually):',
      'I confirm that I have read the purpose above and understand how my contact details will be used. I understand that this draft is not evidence that consent has already been obtained.',
      '',
      'Contact name: ______________________________',
      'Signature / approved acknowledgement: ______________________________',
      'Date: ______________________________',
      '',
      'DRAFT ONLY — review against your privacy notice and applicable law before use. This document does not itself record a consent event.'
    ].join('\n');
    const makeMoUText = () => [
      'MEMORANDUM OF UNDERSTANDING — DRAFT', `Partner legal name: ${stage3.legalName || 'Not provided'}`, `Partner type: ${stage3.templateType}`, `Region: ${stage3.region}`, `Template version: ${stage3.templateVersion}`,
      `Scope: ${stage3.scope || 'Not provided'}`, `Responsibilities: ${stage3.responsibilities || 'Not provided'}`, `Commercial terms: ${stage3.commercialTerms || 'Not provided'}`,
      `Confidentiality: ${stage3.confidentiality || 'Not provided'}`, `Duration: ${stage3.duration || 'Not provided'}`, `Termination: ${stage3.termination || 'Not provided'}`, `Partner signatory: ${stage3.signatory || 'Not provided'}`,
      '', 'DRAFT ONLY — not approved, not a signed agreement, and not legal advice. Final terms require authorised review and signature.'
    ].join('\n');
    const addActivity = (type: string, outcome: string, note: string, extras: Record<string, any> = {}) => {
      const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, outcome, note: note.trim(), owner: stage3.author || qualification.owner || lead.owner_name || 'Unassigned', timestamp: new Date().toISOString(), ...extras };
      saveStage3({ activities: [entry, ...(stage3.activities || [])], activityOutcome: outcome, activityNote: '' }, 'Activity recorded.');
    };
    const sendMoUEmail = async () => {
      if (stage3.doNotContact || stage3.optedOut) { toast.error('Outreach is blocked because this contact opted out or is marked do-not-contact.'); return; }
      if (!stage3.approvedToSend || !stage3ApprovalReady) { toast.error('Complete required legal and manager approvals before sending the MoU.'); return; }
      if (!stage3.primaryEmailVerified) { toast.error('Confirm that the primary contact email has been verified before sending.'); return; }
      if (!/^\S+@\S+\.\S+$/.test(String(lead.email || ''))) { toast.error('A valid primary email address is required before sending.'); return; }
      const fingerprint = `${lead.id}|${lead.email}|${stage3.templateVersion}|${stage3.subject}`;
      if ((stage3.sendLogs || []).some((item: any) => item.fingerprint === fingerprint && item.status === 'sent')) { toast.error('This MoU version has already been sent to this recipient. Create a new version or edit the subject to send again.'); return; }
      setSendingMoU(true);
      try {
        const html = `<p>Hello ${String(lead.full_name || 'Partner').replace(/[<>]/g, '')},</p><p>Please review the following approved-to-send MoU draft for ${String(stage3.legalName).replace(/[<>]/g, '')} and reply with your questions or proposed changes.</p><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${makeMoUText().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre><p>Please note: this email does not itself establish acceptance or signature.</p><p>Regards,<br/>${String(stage3.author || 'HealthHub Partnerships').replace(/[<>]/g, '')}</p>`;
        const result = await sendCrmEmail(lead.email, stage3.subject, html, lead.full_name || 'Partner');
        const success = Boolean(result?.success);
        const log = { id: `${Date.now()}`, fingerprint, timestamp: new Date().toISOString(), sender: stage3.author || qualification.owner || lead.owner_name || 'Unassigned', destination: lead.email, templateVersion: stage3.templateVersion, providerMessageId: result?.messageId || result?.message_id || null, status: success ? 'sent' : 'failed', note: success ? 'Email API reported success; this does not prove delivery, reading, or agreement.' : String(result?.error || 'Email service did not confirm success.') };
        saveStage3({ sendLogs: [log, ...(stage3.sendLogs || [])], activities: [{ id: `${Date.now()}-send`, type: 'Email', outcome: success ? 'MoU Sent' : 'Send Failed', note: log.note, owner: log.sender, timestamp: log.timestamp, destination: log.destination }, ...(stage3.activities || [])] });
        if (success) toast.success('Email request sent to the email service. Delivery and reading are not confirmed.'); else toast.error(`MoU email failed: ${log.note}`);
      } catch (error: any) { toast.error(`MoU email failed: ${error?.message || 'Unknown error'}`); }
      finally { setSendingMoU(false); }
    };
    const addNegotiation = () => {
      if (!negotiationNote.trim()) { toast.error('Enter a negotiation update first.'); return; }
      const item = { id: `${Date.now()}`, timestamp: new Date().toISOString(), owner: stage3.author || qualification.owner || lead.owner_name || 'Unassigned', note: negotiationNote.trim(), version: stage3.templateVersion };
      saveStage3({ negotiations: [item, ...(stage3.negotiations || [])], activities: [{ ...item, type: 'Negotiation', outcome: 'Negotiation', note: item.note }, ...(stage3.activities || [])] }, 'Negotiation update recorded.');
      setNegotiationNote('');
    };
    const qualificationReady = Boolean(qualification.owner.trim() && qualification.priority && qualification.category.trim() && qualification.relevant && qualification.contactPlausible && (!qualification.highValue || qualification.managerReviewed));
    const saveQualificationField = (field: string, value: any) => {
      setQualification((current: any) => {
        const next = { ...current, [field]: value, qualified: false };
        localStorage.setItem(qualificationStorageKey, JSON.stringify(next));
        return next;
      });
    };
    const qualifyLead = () => {
      if (!qualificationReady) {
        toast.error('Confirm relevance, plausible contact details, owner, priority, category, and manager review when required.');
        return;
      }
      const next = { ...qualification, qualified: true };
      setQualification(next);
      localStorage.setItem(qualificationStorageKey, JSON.stringify(next));
      // Qualification marks the Stage 2 approval gate only. Do not change stages
      // here; the user must click the explicit Next Stage button to advance.
      toast.success('Lead qualification saved. Click Next Stage when you are ready to continue.');
    };
    const current = stages.find(stage => stage.id === activeStage) || stages[0];
    const toggleTask = (task: string) => {
      const nextStageTasks = (checks[activeStage] || []).includes(task)
        ? (checks[activeStage] || []).filter(item => item !== task)
        : [...(checks[activeStage] || []), task];
      const nextChecks = { ...checks, [activeStage]: nextStageTasks };
      setChecks(nextChecks);
      // Checklist checkboxes only update checklist progress. Stage navigation is
      // deliberately manual and happens only when the user clicks Next Stage.
      localStorage.setItem(storageKey, JSON.stringify({ stage: activeStage, checks: nextChecks }));
    };
    const chooseStage = (stageId: number) => {
      if (stageId > activeStage && (stageId !== activeStage + 1 || !stageGateComplete(activeStage))) {
        toast.error('Complete the current stage checklist and required approval gates before moving forward.');
        return;
      }
      if (stageId >= 3 && !qualification.qualified) {
        toast.error('Complete Stage 2 qualification before proceeding to MoU preparation.');
        return;
      }
      if (stageId >= 4 && !(stage3.finalApproval && stage3.finalSignatureConfirmed)) {
        toast.error('Complete Stage 3 internal approval and signature requirements before activating the partner.');
        return;
      }
      setActiveStage(stageId);
      localStorage.setItem(storageKey, JSON.stringify({ stage: stageId, checks }));
    };
    const doneCount = (id: number) => (checks[id] || []).length;
    const checklistComplete = (id: number) => doneCount(id) >= (stages.find(stage => stage.id === id)?.tasks.length || 0);
    const stageGateComplete = (id: number) => {
      if (!checklistComplete(id)) return false;
      if (id === 2 && !qualification.qualified) return false;
      if (id === 3 && !(stage3.finalApproval && stage3.finalSignatureConfirmed)) return false;
      return true;
    };
    const archivePartner = (deleted = false) => {
      const confirmed = window.confirm(deleted
        ? 'Mark this partner as deleted? This is a recoverable soft-delete in this browser; it will not physically delete the Supabase lead.'
        : 'Archive this partner? It will be moved to Stage 5 and marked unavailable for active use.');
      if (!confirmed) return;
      const now = new Date().toISOString();
      const next = { archived: true, deleted, reason: archiveReason.trim() || (deleted ? 'Marked deleted by user' : 'Archived by user'), archivedAt: archiveState.archivedAt || now, updatedAt: now, archivedBy: qualification.owner || lead.owner_name || 'Unassigned', sourceLeadId: String(lead.id), partnerName: lead.company_name || lead.full_name || 'Unnamed partner' };
      localStorage.setItem(archiveStorageKey, JSON.stringify(next));
      setArchiveState(next);
      setActiveStage(5);
      localStorage.setItem(storageKey, JSON.stringify({ stage: 5, checks }));
      toast.success(deleted ? 'Partner marked deleted in the local archive.' : 'Partner moved to Archived Partners.');
    };
    const restorePartner = () => {
      if (!window.confirm('Restore this partner from the archive?')) return;
      const next = { ...archiveState, archived: false, deleted: false, restoredAt: new Date().toISOString() };
      localStorage.setItem(archiveStorageKey, JSON.stringify(next));
      setArchiveState(next);
      setActiveStage(4);
      localStorage.setItem(storageKey, JSON.stringify({ stage: 4, checks }));
      toast.success('Partner restored from archive. Review its lifecycle before using it.');
    };
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600"><ArrowLeft size={16}/> Back to Medical Leads</button>
        <section className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-2">Medical Lead Workflow</p><h2 className="text-2xl md:text-3xl font-black text-slate-900">{lead.company_name || 'Individual Partner'}</h2><p className="mt-2 text-sm text-slate-500">{lead.full_name || 'Contact not specified'} · {lead.email || 'No email'} · {lead.phone || 'No phone'}</p></div>
            <span className={`self-start text-[10px] font-black px-4 py-2 rounded-full uppercase border ${getStatusColor(qualification.qualified ? 'qualified' : (lead.status || 'new'))}`}>{qualification.qualified ? 'qualified' : (lead.status || 'new')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Industry</p><p className="mt-1 font-bold text-slate-800">{lead.industry || 'Not specified'}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimated Value</p><p className="mt-1 font-bold text-slate-800">{lead.estimated_value?.toLocaleString() || 'Not specified'}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Created</p><p className="mt-1 font-bold text-slate-800">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'Not specified'}</p></div>
          </div>
        </section>
        <section className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-5"><Workflow size={18} className="text-indigo-600"/><h3 className="text-lg font-black text-slate-900">Partnership Workflow Stages</h3><span className="ml-auto text-xs font-bold text-slate-400">Stage {activeStage} of 5</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stages.map(stage => { const complete = stageGateComplete(stage.id); const active = activeStage === stage.id; const locked = stage.id > activeStage && !(stage.id === 5 && (archiveState.archived || archiveState.deleted)); return <button key={stage.id} disabled={locked} onClick={() => chooseStage(stage.id)} className={`text-left rounded-2xl border p-4 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : complete ? 'border-emerald-200 bg-emerald-50/60 hover:border-emerald-400' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}><div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${complete ? 'bg-emerald-600 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{complete ? <Check size={15}/> : stage.id}</span><div className="min-w-0"><p className="font-black text-sm text-slate-800">{stage.name}</p><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stage.label}</p></div></div><div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${complete ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{width: `${Math.min(100, doneCount(stage.id) / stage.tasks.length * 100)}%`}}/></div><p className="mt-2 text-[10px] font-bold text-slate-400">{doneCount(stage.id)} / {stage.tasks.length} tasks complete</p></button>; })}
          </div>
        </section>
        <section className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5"><div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Stage {activeStage} Workspace</p><h3 className="text-xl font-black text-slate-900 mt-1">{current.name}</h3><p className="text-sm text-slate-500 mt-1">{current.label}</p></div><div className="flex flex-wrap gap-2"><button disabled={activeStage === 1} onClick={() => chooseStage(Math.max(1, activeStage - 1))} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold disabled:opacity-40"><ChevronLeft size={15} className="inline"/> Previous</button><button disabled={activeStage >= 4 || !stageGateComplete(activeStage)} onClick={() => { if (!stageGateComplete(activeStage)) { toast.error('Complete every checklist item and the required approval gate before moving to the next stage.'); return; } const nextStage = Math.min(5, activeStage + 1); chooseStage(nextStage); }} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">Next Stage <ChevronRight size={15} className="inline"/></button><button type="button" onClick={() => archivePartner(true)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"><Trash2 size={15}/> Delete Lead</button></div></div>
          <div className="space-y-3">{current.tasks.map(task => { const checked = (checks[activeStage] || []).includes(task); return <button key={task} onClick={() => toggleTask(task)} className={`w-full flex items-center gap-3 text-left p-4 rounded-xl border transition-colors ${checked ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 hover:border-indigo-300 text-slate-700'}`}>{checked ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0"/> : <Circle size={18} className="text-slate-300 shrink-0"/>}<span className="text-sm font-semibold">{task}</span><span className="ml-auto text-[10px] font-black uppercase tracking-widest">{checked ? 'Done' : 'Mark done'}</span></button>; })}</div>
          <p className="mt-5 text-xs text-slate-400">Workflow checklist progress is currently saved in this browser for this medical lead. It does not change the existing database schema or the lead's database status.</p>
        </section>
        {activeStage === 1 && (
          <section className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm">
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Stage 1 · Partnership Inquiry</p>
              <h3 className="text-xl font-black text-slate-900 mt-1">Complete Lead Information</h3>
              <p className="text-sm text-slate-500 mt-1">All lead fields returned by the existing lead query are shown below.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(lead).map(([key, value]) => {
                const label = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/_/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .replace(/\b\w/g, character => character.toUpperCase());
                const displayValue = value === null || value === undefined || value === ''
                  ? 'Not provided'
                  : typeof value === 'boolean'
                    ? (value ? 'Yes' : 'No')
                    : typeof value === 'object'
                      ? JSON.stringify(value, null, 2)
                      : key.endsWith('_at') && !Number.isNaN(Date.parse(String(value)))
                        ? new Date(String(value)).toLocaleString()
                        : String(value);
                return (
                  <div key={key} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800 break-words whitespace-pre-wrap">{displayValue}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {activeStage === 2 && (
          <section className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Stage 2 · BDM Quality Gate</p>
              <h3 className="text-xl font-black text-slate-900 mt-1">Review and Qualify Lead</h3>
              <p className="text-sm text-slate-500 mt-1">Complete this review before moving the lead to MoU preparation. Fields are saved in this browser for this lead.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block"><span className="text-xs font-black uppercase tracking-widest text-slate-500">Assigned BDM / Owner *</span><input value={qualification.owner} onChange={e => saveQualificationField('owner', e.target.value)} placeholder="Enter owner name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200" /></label>
              <label className="block"><span className="text-xs font-black uppercase tracking-widest text-slate-500">Priority *</span><select value={qualification.priority} onChange={e => saveQualificationField('priority', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"><option value="">Select priority</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Urgent">Urgent</option></select></label>
              <label className="block"><span className="text-xs font-black uppercase tracking-widest text-slate-500">Partner Category *</span><select value={qualification.category} onChange={e => saveQualificationField('category', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"><option value="">Select category</option>{['Hospital','Doctor','Clinic','Medical Agency','Corporate','Insurance','Other'].map(category => <option key={category} value={category}>{category}</option>)}{qualification.category && !['Hospital','Doctor','Clinic','Medical Agency','Corporate','Insurance','Other'].includes(qualification.category) && <option value={qualification.category}>{qualification.category}</option>}</select></label>
              <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Quality checks *</p><label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={qualification.relevant} onChange={e => saveQualificationField('relevant', e.target.checked)} className="mt-1"/><span>Partner is relevant and service fit is confirmed</span></label><label className="flex items-start gap-3 text-sm text-slate-700 mt-3"><input type="checkbox" checked={qualification.contactPlausible} onChange={e => saveQualificationField('contactPlausible', e.target.checked)} className="mt-1"/><span>Contact details are plausible and reviewed</span></label></div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3"><label className="flex items-start gap-3 text-sm font-semibold text-amber-950"><input type="checkbox" checked={qualification.highValue} onChange={e => saveQualificationField('highValue', e.target.checked)} className="mt-1"/><span>Flag this as a high-value lead (manager review required)</span></label>{qualification.highValue && <label className="flex items-start gap-3 text-sm text-amber-950"><input type="checkbox" checked={qualification.managerReviewed} onChange={e => saveQualificationField('managerReviewed', e.target.checked)} className="mt-1"/><span>Manager review completed and approved</span></label>}</div>
            <label className="block"><span className="text-xs font-black uppercase tracking-widest text-slate-500">BDM Review Notes</span><textarea value={qualification.reviewNotes} onChange={e => saveQualificationField('reviewNotes', e.target.value)} rows={4} placeholder="Record relevance, contact verification, requirements, concerns, manager feedback and next steps…" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200" /></label>
            <div className={`rounded-2xl border p-4 ${qualification.qualified ? 'border-emerald-200 bg-emerald-50' : qualificationReady ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}><div className="flex items-start gap-3"><CheckCircle2 size={20} className={qualification.qualified ? 'text-emerald-600' : 'text-slate-400'}/><div><p className="font-black text-sm text-slate-900">Qualification exit gate</p><p className="text-xs text-slate-600 mt-1">Owner, priority and category must be confirmed. Relevance and contact checks must pass. High-value leads also require manager review.</p><p className="text-xs font-bold mt-2">{qualification.qualified ? 'Qualified · Pipeline stage: Qualified' : qualificationReady ? 'Ready for qualification' : 'Incomplete — MoU preparation must remain blocked'}</p></div></div><button type="button" onClick={qualifyLead} disabled={!qualificationReady || qualification.qualified} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{qualification.qualified ? 'Lead Qualified' : 'Confirm Qualification'}</button></div>
          </section>
        )}
        {activeStage === 3 && (
          <section className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm space-y-7">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Stage 3 · BDM / Legal / Manager</p><h3 className="text-xl font-black text-slate-900 mt-1">Contracting & Partner Outreach</h3><p className="text-sm text-slate-500 mt-1">Create and manage MoUs and Consent Letters in the Agreement and Consent Center. Use this stage for review records, partner follow-up, negotiation, and relationship tracking.</p><div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><h4 className="font-black text-indigo-950">Agreement and Consent Center</h4><p className="mt-1 text-sm text-indigo-800">Create and manage MoUs and Consent Letters in the central document modules. Stage 3 no longer generates document drafts.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={()=>{const categoryMap:Record<string,string>={'Hospital':'Hospital','Doctor':'Hospital','Visa Facilitator':'Visa Facilitators','Visa Facilitators':'Visa Facilitators','Nursing Facilitator':'Nursing Facilitators','Nursing Facilitators':'Nursing Facilitators','Travel Partner':'Travel Partners','Travel Partners':'Travel Partners'};const handoff={sourceLeadId:String(lead.id),documentKind:'MOU',partnerName:String(stage3.legalName||lead.company_name||lead.full_name||''),partnerCategory:categoryMap[String(qualification.category||lead.partner_type||'Hospital')]||'Hospital',partnerAddress:String(lead.address||lead.city||''),partnerCountry:String(lead.country||'India'),representativeName:String(lead.full_name||''),representativeDesignation:String(lead.job_title||lead.designation||''),representativeEmail:String(lead.email||''),representativePhone:String(lead.phone||''),executionCity:[lead.city,lead.country].filter(Boolean).join(', '),registrationNumber:String(lead.registration_number||lead.license_number||''),version:String(stage3.templateVersion||'v1.0')};localStorage.setItem('healthhub-agreement-prefill',JSON.stringify(handoff));window.location.hash='#/agreements';}} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700"><FileText size={16}/> Create MoU for this Lead</button><button type="button" onClick={()=>{const categoryMap:Record<string,string>={'Hospital':'Hospital','Doctor':'Hospital','Visa Facilitator':'Visa Facilitators','Visa Facilitators':'Visa Facilitators','Nursing Facilitator':'Nursing Facilitators','Nursing Facilitators':'Nursing Facilitators','Travel Partner':'Travel Partners','Travel Partners':'Travel Partners'};const handoff={sourceLeadId:String(lead.id),documentKind:'Consent Letter',partnerName:String(stage3.legalName||lead.company_name||lead.full_name||''),partnerCategory:categoryMap[String(qualification.category||lead.partner_type||'Hospital')]||'Hospital',partnerAddress:String(lead.address||lead.city||''),partnerCountry:String(lead.country||'India'),representativeName:String(lead.full_name||''),representativeDesignation:String(lead.job_title||lead.designation||''),representativeEmail:String(lead.email||''),representativePhone:String(lead.phone||''),executionCity:[lead.city,lead.country].filter(Boolean).join(', '),registrationNumber:String(lead.registration_number||lead.license_number||''),version:String(stage3.templateVersion||'v1.0')};localStorage.setItem('healthhub-agreement-prefill',JSON.stringify(handoff));window.location.hash='#/consent';}} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700"><ShieldCheck size={16}/> Create Consent for this Lead</button></div><p className="mt-3 text-xs text-indigo-800">Opening these centers does not itself create, send, approve, or sign a document.</p></div></div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div><h4 className="font-black text-emerald-950">Generated MoUs for this lead</h4><p className="text-xs text-emerald-800 mt-1">Draft PDFs saved in the private agreements bucket.</p></div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800">{stage3Agreements.length}</span>
              </div>
              {stage3AgreementsLoading ? (
                <p className="text-sm text-slate-500">Loading linked agreements…</p>
              ) : stage3Agreements.length ? (
                <div className="space-y-2">
                  {stage3Agreements.map((agreement: any) => (
                    <div key={agreement.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white p-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 truncate">{agreement.partner_name || 'Memorandum of Understanding'}</p>
                        <p className="text-xs text-slate-500">Version {agreement.version || 'v1.0'} · {agreement.status || 'Draft'} · {agreement.created_at ? new Date(agreement.created_at).toLocaleDateString() : 'Date unavailable'}</p>
                        <p className="text-[11px] text-slate-400 break-all">{agreement.pdf_path || 'PDF path not saved'}</p>
                      </div>
                      {agreement.pdf_path ? (
                        <button type="button" onClick={() => openGeneratedMou(agreement.pdf_path)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800"><FileText size={14}/> View MOU</button>
                      ) : <span className="text-xs font-bold text-amber-700">PDF not uploaded</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No generated MOU is linked to this lead yet. Use “Create MoU for this Lead”; after saving in the Agreement Center, return here to see it.</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">MoU Draft</p><p className="mt-1 text-sm font-bold">{stage3DraftReady ? 'Fields complete' : 'Draft incomplete'}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">Approval Gate</p><p className="mt-1 text-sm font-bold">{stage3ApprovalReady ? 'Approved to send' : 'Review required'}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">Contact</p><p className="mt-1 text-sm font-bold break-words">{lead.email || 'No primary email'}</p></div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-black text-slate-900">Document preparation moved</p><p className="mt-1 text-sm text-slate-600">MoU template fields, MoU preview, Consent Letter draft preview, and draft downloads have been removed from this stage. Use the Agreement Center and Consent Center above to prepare documents.</p></div>
            <div className="border-t border-slate-100 pt-6 space-y-4"><h4 className="font-black text-slate-900">Stage 3 review and authorisation record</h4><label className="block"><span className="text-xs font-bold text-slate-500">Draft author / BDM *</span><input value={stage3.author} onChange={e=>updateStage3Field('author',e.target.value)} placeholder="Name of responsible BDM" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><div className="grid md:grid-cols-2 gap-3"><label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" checked={stage3.managerApproved} onChange={e=>updateStage3Field('managerApproved',e.target.checked)} className="mt-1"/><span><strong>Manager approval</strong><br/>Manager confirms this version may proceed.</span></label><label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" checked={stage3.legalApproved} onChange={e=>updateStage3Field('legalApproved',e.target.checked)} className="mt-1"/><span><strong>Legal approval</strong><br/>Legal has reviewed this draft and its terms.</span></label><label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm md:col-span-2"><input type="checkbox" checked={stage3.templateLegalReviewed} onChange={e=>updateStage3Field('templateLegalReviewed',e.target.checked)} className="mt-1"/><span><strong>Legal review of new/edited template</strong><br/>Required for non-standard terms or any new/edited template.</span></label></div><p className="text-xs text-slate-500">Manager/legal review checks are retained as workflow records. Create and approve the actual document in the Agreement Center. This is not an electronic signature.</p></div>
            <div className="border-t border-slate-100 pt-6 space-y-3"><h4 className="font-black text-slate-900">Partner outreach</h4><p className="text-sm text-slate-600">Use the activity tracker below to record calls, emails, replies, meetings, and follow-ups. Document creation and MoU sending are not performed from this stage.</p><label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm text-rose-800"><input type="checkbox" checked={stage3.optedOut} onChange={e=>updateStage3Field('optedOut',e.target.checked)} className="mt-1"/>Contact has opted out — block outreach</label><label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm text-rose-800"><input type="checkbox" checked={stage3.doNotContact} onChange={e=>updateStage3Field('doNotContact',e.target.checked)} className="mt-1"/>Do not contact — block all outreach</label></div>
            <div className="border-t border-slate-100 pt-6 space-y-4"><h4 className="font-black text-slate-900">Feature 7 · Track outreach and response</h4><div className="grid md:grid-cols-2 gap-4"><label className="block"><span className="text-xs font-bold text-slate-500">Activity type</span><select value={activityType} onChange={e=>setActivityType(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{['Call','Email','Reply','Meeting','Note'].map(v=><option key={v}>{v}</option>)}</select></label><label className="block"><span className="text-xs font-bold text-slate-500">Outcome</span><select value={stage3.activityOutcome} onChange={e=>updateStage3Field('activityOutcome',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{['Not Answered','No Response Yet','Interested','Not Interested','Not Reachable/Invalid','Asked for More Information','MoU Under Review','Negotiation','Follow-up Scheduled','MoU Sent'].map(v=><option key={v}>{v}</option>)}</select></label><label className="block md:col-span-2"><span className="text-xs font-bold text-slate-500">Call/email/reply notes</span><textarea rows={2} value={stage3.activityNote} onChange={e=>updateStage3Field('activityNote',e.target.value)} placeholder="Record the conversation, reply or outcome" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="block"><span className="text-xs font-bold text-slate-500">Next action date</span><input type="date" value={stage3.nextActionDate} onChange={e=>updateStage3Field('nextActionDate',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label></div><button type="button" onClick={()=>addActivity(activityType,stage3.activityOutcome,stage3.activityNote,{nextActionDate:stage3.nextActionDate})} disabled={stage3.optedOut||stage3.doNotContact} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Record Activity</button><p className="text-xs text-slate-500">Contactability and partner decision are recorded separately. An email send result does not mean delivery, reading, or agreement.</p>{(stage3.activities||[]).length>0&&<div className="space-y-2"><h5 className="text-sm font-black">Activity history</h5>{stage3.activities.map((item:any)=><div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-bold">{item.type} · {item.outcome}</p><p className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</p></div><p className="mt-1 text-sm text-slate-700">{item.note || 'No notes provided'}</p><p className="mt-1 text-xs text-slate-400">Owner: {item.owner}{item.nextActionDate ? ` · Next action: ${item.nextActionDate}` : ''}</p></div>)}</div>}</div>
            <div className="border-t border-slate-100 pt-6 space-y-4"><h4 className="font-black text-slate-900">Feature 8 · Follow-up and negotiation</h4><label className="block"><span className="text-xs font-bold text-slate-500">Negotiation update / requested term changes</span><textarea rows={3} value={negotiationNote} onChange={e=>setNegotiationNote(e.target.value)} placeholder="Record requested changes; edit and save a new MoU draft version rather than overwriting an approved version." className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><button type="button" onClick={addNegotiation} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black">Add Negotiation Record</button><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">When terms change, update the draft and save a new version. Stop all outreach immediately if the contact opts out, refuses, or is marked do-not-contact. Set a next-action date above for follow-up.</div>{(stage3.negotiations||[]).length>0&&<div className="space-y-2"><h5 className="text-sm font-black">Negotiation history</h5>{stage3.negotiations.map((item:any)=><div key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm"><p>{item.note}</p><p className="mt-1 text-xs text-slate-400">Version {item.version} · {item.owner} · {new Date(item.timestamp).toLocaleString()}</p></div>)}</div>}</div>
            <div className="border-t border-slate-100 pt-6 space-y-4"><h4 className="font-black text-slate-900">Feature 9 · Approval and signature record</h4><p className="text-xs text-slate-500">Record the approval and signature details only after they are actually completed through your organisation's approved method. This UI does not create a signature or store a signed document.</p><div className="grid md:grid-cols-2 gap-4">{([['partnerSignatureName','Partner signatory'],['organisationSignatureName','HealthHub signatory'],['partnerSignedDate','Partner signed date'],['organisationSignedDate','HealthHub signed date'],['effectiveDate','Effective date'],['expiryDate','Expiry date']] as const).map(([key,label])=><label key={key} className="block"><span className="text-xs font-bold text-slate-500">{label}</span><input type={key.toLowerCase().includes('date')? 'date':'text'} value={stage3[key]} onChange={e=>updateStage3Field(key,e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>)}</div><label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" checked={stage3.finalApproval} onChange={e=>updateStage3Field('finalApproval',e.target.checked)} className="mt-1"/><span>Final internal approval has been recorded by authorised Manager / Legal.</span></label><label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" checked={stage3.finalSignatureConfirmed} onChange={e=>updateStage3Field('finalSignatureConfirmed',e.target.checked)} className="mt-1"/><span>Both parties' signatures have been obtained and verified using the approved method.</span></label><button type="button" onClick={()=>{if(!stage3.finalApproval||!stage3.finalSignatureConfirmed||!stage3.partnerSignatureName.trim()||!stage3.organisationSignatureName.trim()||!stage3.partnerSignedDate||!stage3.organisationSignedDate||!stage3.effectiveDate){toast.error('Final approval, both signatories, signature dates and effective date are required.');return;}saveStage3({finalisedAt:new Date().toISOString()},'Final approval and signature record saved locally.');}} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Save Final Approval & Signature Record</button></div>
            <p className="text-xs text-slate-400">Local browser record only. It is not a substitute for legal review, secure agreement storage, access controls, a reliable audit log, or an approved e-signature service. No public agreement link is generated.</p>
          </section>
        )}
        {activeStage === 4 && !archiveState.archived && (
          <section className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm space-y-7">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Stage 4 · Operations / BDM</p><h3 className="text-xl font-black text-slate-900 mt-1">Activate & Manage Partner</h3><p className="text-sm text-slate-500 mt-1">Create or update the partner master record, preserve the original lead ID, and maintain lifecycle, service coverage, quality and renewal information. Signed document paths are linked to the medical lead in Supabase.</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">Original Lead ID</p><p className="mt-1 text-sm font-bold break-all">{String(lead.id)}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">MoU Version</p><p className="mt-1 text-sm font-bold">{stage3.templateVersion || 'Not recorded'}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">Lifecycle</p><p className="mt-1 text-sm font-bold">{stage4.lifecycle}</p></div></div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 space-y-4">
              <div><h4 className="font-black text-indigo-950">Signed document repository</h4><p className="mt-1 text-sm text-indigo-800">Upload the final, fully signed PDF copies. Both documents are stored privately in the Supabase <strong>signedmou</strong> bucket under this lead ID.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-indigo-100 bg-white p-4 space-y-3"><div><p className="text-sm font-black text-slate-900">Signed copy of MOU</p><p className="text-xs text-slate-500 mt-1">PDF only · maximum 20 MB</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"><Upload size={16}/> {uploadingStage4Document === 'MOU' ? 'Uploading MOU…' : 'Upload signed copy of MOU'}<input disabled={uploadingStage4Document !== null} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e=>{void uploadStage4SignedDocument('MOU',e.target.files?.[0]);e.currentTarget.value='';}}/></label>{stage4.signedMouPath ? <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-semibold text-emerald-700">Signed MOU uploaded</span><button type="button" onClick={()=>void openStage4SignedDocument(stage4.signedMouPath)} className="text-xs font-bold text-indigo-700 underline">View / Download</button></div> : <p className="text-xs text-amber-700">No signed MOU uploaded yet.</p>}</div>
                <div className="rounded-xl border border-indigo-100 bg-white p-4 space-y-3"><div><p className="text-sm font-black text-slate-900">Signed copy of Consent Letter</p><p className="text-xs text-slate-500 mt-1">PDF only · maximum 20 MB</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"><Upload size={16}/> {uploadingStage4Document === 'CONSENT' ? 'Uploading consent letter…' : 'Upload signed copy of consent letter'}<input disabled={uploadingStage4Document !== null} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e=>{void uploadStage4SignedDocument('CONSENT',e.target.files?.[0]);e.currentTarget.value='';}}/></label>{stage4.signedConsentPath ? <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-semibold text-emerald-700">Signed Consent Letter uploaded</span><button type="button" onClick={()=>void openStage4SignedDocument(stage4.signedConsentPath)} className="text-xs font-bold text-indigo-700 underline">View / Download</button></div> : <p className="text-xs text-amber-700">No signed Consent Letter uploaded yet.</p>}</div>
              </div>
              <p className="text-xs text-indigo-800">The PDFs are stored privately in Supabase Storage. Their file paths are also saved on the originating medical_leads database record and in this browser's Stage 4 record.</p>
            </div>
            <div className="space-y-4"><h4 className="font-black text-slate-900">Feature 10 · Activate partner and create/update master record</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block"><span className="text-xs font-bold text-slate-500">Partner type *</span><select value={stage4.partnerType} onChange={e=>updateStage4Field('partnerType',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">{['Doctor','Hospital','Visa Facilitator','Nursing Facilitator','Travel Partner','Clinic','Medical Agency','Other'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
              <label className="block"><span className="text-xs font-bold text-slate-500">Legal / master record name *</span><input value={stage4.legalName} onChange={e=>updateStage4Field('legalName',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Registered legal entity name"/></label>
              <label className="block"><span className="text-xs font-bold text-slate-500">Lifecycle state</span><select value={stage4.lifecycle} onChange={e=>updateStage4Field('lifecycle',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">{['Onboarding','Active','Suspended','Inactive','Terminated'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
              <label className="block"><span className="text-xs font-bold text-slate-500">Relationship owner *</span><input value={stage4.relationshipOwner} onChange={e=>updateStage4Field('relationshipOwner',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Operations / BDM owner"/></label>
              <label className="block"><span className="text-xs font-bold text-slate-500">Primary contact *</span><input value={stage4.primaryContact} onChange={e=>updateStage4Field('primaryContact',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
              <label className="block"><span className="text-xs font-bold text-slate-500">Primary email *</span><input type="email" value={stage4.primaryEmail} onChange={e=>updateStage4Field('primaryEmail',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
              <label className="block"><span className="text-xs font-bold text-slate-500">Primary phone</span><input value={stage4.primaryPhone} onChange={e=>updateStage4Field('primaryPhone',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
              <label className="block"><span className="text-xs font-bold text-slate-500">Service area *</span><input value={stage4.serviceArea} onChange={e=>updateStage4Field('serviceArea',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="City, region, country or coverage area"/></label>
              <label className="block md:col-span-2"><span className="text-xs font-bold text-slate-500">Capabilities / services *</span><textarea rows={3} value={stage4.capabilities} onChange={e=>updateStage4Field('capabilities',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Services offered, specialties, capacity, operating hours, supported patient needs…"/></label>
            </div><button type="button" onClick={activatePartner} disabled={stage4.lifecycle !== 'Onboarding' && stage4.lifecycle !== 'Active'} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{stage4.activatedAt ? 'Update / Reconfirm Master Record' : 'Activate Partner & Create Master Record'}</button><p className="text-xs text-slate-500">Activation requires Stage 3 approval and signature records. The master record is upserted by original lead ID to prevent duplicates; activation is not based on an interested reply alone.</p></div>
            <div className="border-t border-slate-100 pt-6 space-y-4"><h4 className="font-black text-slate-900">Feature 11 · Monitor partnership and renew</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block"><span className="text-xs font-bold text-slate-500">Contract expiry date</span><input type="date" value={stage4.contractExpiryDate} onChange={e=>updateStage4Field('contractExpiryDate',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
              <label className="block"><span className="text-xs font-bold text-slate-500">Renewal reminder date</span><input type="date" value={stage4.renewalReminderDate} onChange={e=>updateStage4Field('renewalReminderDate',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
              <label className="block md:col-span-2"><span className="text-xs font-bold text-slate-500">Performance notes / service coverage</span><textarea rows={3} value={stage4.performanceNotes} onChange={e=>updateStage4Field('performanceNotes',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Service performance, coverage gaps, KPIs, review outcomes…"/></label>
              <label className="block md:col-span-2"><span className="text-xs font-bold text-slate-500">Quality issues</span><textarea rows={2} value={stage4.qualityIssues} onChange={e=>updateStage4Field('qualityIssues',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Incidents, complaints, corrective action and owner…"/></label>
              <label className="block md:col-span-2"><span className="text-xs font-bold text-slate-500">Contact changes</span><textarea rows={2} value={stage4.contactChanges} onChange={e=>updateStage4Field('contactChanges',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Record contact updates and when they were verified…"/></label>
            </div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3"><p className="text-sm font-black text-amber-950">Sensitive changes require review</p>{([['legalEntityChange','Legal entity changed'],['bankDetailsChange','Bank details changed'],['termsChange','Contract terms changed']] as const).map(([key,label])=><label key={key} className="flex items-start gap-3 text-sm text-amber-950"><input type="checkbox" checked={stage4[key]} onChange={e=>updateStage4Field(key,e.target.checked)} className="mt-1"/><span>{label}</span></label>)}<label className="flex items-start gap-3 text-sm text-amber-950"><input type="checkbox" checked={stage4.changeReviewApproved} onChange={e=>updateStage4Field('changeReviewApproved',e.target.checked)} className="mt-1"/><span>Authorised review completed for the sensitive changes above</span></label></div>
            <button type="button" onClick={savePartnerMonitoring} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">Save Monitoring & Renewal Record</button>
            <div className="rounded-2xl border border-slate-200 p-4"><h5 className="font-black text-slate-900">Audit history</h5>{(stage4.auditHistory||[]).length ? <div className="mt-3 space-y-2">{stage4.auditHistory.map((item:any)=><div key={item.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold">{item.action}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()} · {item.owner}</p><p className="mt-1 text-xs text-slate-500">Fields: {(item.fields||[]).join(', ') || 'Record event'}</p></div>)}</div> : <p className="mt-2 text-sm text-slate-500">No monitoring changes recorded yet.</p>}</div>
            {['Suspended','Inactive','Terminated'].includes(stage4.lifecycle) && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">This partner is marked {stage4.lifecycle.toLowerCase()} and must not be selected for active patient-care workflows. This local UI status does not enforce blocking in other application modules.</p>}
            <p className="text-xs text-slate-400">Master records and audit entries are browser-local only; no Supabase master table, renewal scheduler, automated reminders or patient-care workflow enforcement is connected by this component.</p></div>
          </section>
        )}
        {activeStage === 5 && (
          <section className="bg-white border border-amber-200 rounded-[2rem] p-5 md:p-7 shadow-sm space-y-5">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Stage 5 · Dropped Medical Lead</p><h3 className="text-xl font-black text-slate-900 mt-1">Dropped / Archived Medical Lead</h3><p className="text-sm text-slate-500 mt-1">Retain the original lead ID, agreement history and archive audit details. Archived or deleted partners must not be treated as active partners.</p></div>
            <div className={`rounded-2xl border p-4 ${archiveState.archived ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}><p className="font-black text-slate-900">Current record status: {archiveState.deleted ? 'Marked deleted (soft delete)' : archiveState.archived ? 'Archived' : 'Not archived'}</p>{archiveState.archived && <p className="mt-2 text-sm text-slate-600">Archived by {archiveState.archivedBy || 'Unassigned'} · {archiveState.archivedAt ? new Date(archiveState.archivedAt).toLocaleString() : 'Timestamp not recorded'}</p>}<p className="mt-2 text-sm text-slate-600">Reason: {archiveState.reason || 'No archive reason recorded yet.'}</p><p className="mt-2 text-xs text-slate-500">Original lead ID: {String(lead.id)}</p></div>
            <label className="block"><span className="text-xs font-black uppercase tracking-widest text-slate-500">Archive / deletion reason</span><textarea rows={3} value={archiveReason} onChange={e=>setArchiveReason(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Reason for archiving or marking this partner deleted…"/></label>
            <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>archivePartner(false)} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white"><Archive size={16}/> Archive Partner</button><button type="button" onClick={()=>archivePartner(true)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white"><Trash2 size={16}/> Mark as Deleted</button>{archiveState.archived && <button type="button" onClick={restorePartner} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700"><RotateCcw size={16}/> Restore Partner</button>}</div>
            <p className="text-xs text-slate-400">Delete is a recoverable soft-delete in browser storage only. This does not physically delete the lead from Supabase, delete signed agreements, or enforce access restrictions in other modules.</p>
          </section>
        )}

      </div>
    );
  };

  if (selectedLead) return <MedicalLeadWorkflow lead={selectedLead} onBack={() => setSelectedLead(null)} />;

  return (
    <>

      {showNewPartner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="new-partner-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5 md:px-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Stage 1 · Partnership Inquiry</p>
                <h3 id="new-partner-title" className="mt-1 text-2xl font-black text-slate-900">Create New Partner</h3>
                <p className="mt-1 text-sm text-slate-500">Capture a prospective partner. Saving does not send outreach or an MoU.</p>
              </div>
              <button type="button" onClick={() => setShowNewPartner(false)} aria-label="Close form" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-7 px-6 py-6 md:px-8">
              <section>
                <h4 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-700">Partner and contact details</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold text-slate-600">Partner category <span className="text-rose-500">*</span>
                    <select required value={partnerForm.partner_type} onChange={e => setPartnerField('partner_type', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium outline-none focus:border-indigo-500">
                      {['Doctor', 'Hospital', 'Visa Facilitator', 'Nursing Facilitator', 'Travel Partner'].map(option => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-slate-600">Primary contact name <span className="text-rose-500">*</span>
                    <input required value={partnerForm.full_name} onChange={e => setPartnerField('full_name', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="Full name" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Organisation / legal name
                    <input value={partnerForm.company_name} onChange={e => setPartnerField('company_name', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="Company, hospital or agency" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Industry / specialty
                    <input value={partnerForm.industry} onChange={e => setPartnerField('industry', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="e.g. Cardiology, Medical Tourism" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Work email
                    <input type="email" value={partnerForm.email} onChange={e => setPartnerField('email', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="name@organisation.com" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Phone (include country code)
                    <input type="tel" value={partnerForm.phone} onChange={e => setPartnerField('phone', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="+91 ..." />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Website / domain
                    <input type="url" value={partnerForm.website} onChange={e => setPartnerField('website', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="https://" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Country
                    <input value={partnerForm.country} onChange={e => setPartnerField('country', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="Country" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">City
                    <input value={partnerForm.city} onChange={e => setPartnerField('city', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="City" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Address
                    <input value={partnerForm.address} onChange={e => setPartnerField('address', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="Street / office address" />
                  </label>
                </div>
              </section>

              <section>
                <h4 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-700">Source and campaign</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold text-slate-600">Lead source <span className="text-rose-500">*</span>
                    <select required value={partnerForm.source} onChange={e => setPartnerField('source', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium outline-none focus:border-indigo-500">
                      <option value="">Select source</option>
                      {['Referral', 'Conference / Event', 'Web Research', 'Website', 'Existing Network', 'Campaign', 'Other'].map(option => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-slate-600">BDM / owner <span className="text-rose-500">*</span>
                    <input required value={partnerForm.owner_name} onChange={e => setPartnerField('owner_name', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="Responsible BDM" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Campaign / sourcing batch
                    <input value={partnerForm.campaign_name} onChange={e => setPartnerField('campaign_name', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="Campaign name or batch" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Target geography
                    <input value={partnerForm.target_geography} onChange={e => setPartnerField('target_geography', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="Target country / region" />
                  </label>
                  <label className="text-sm font-bold text-slate-600 md:col-span-2">Source URL / reference
                    <input value={partnerForm.source_reference} onChange={e => setPartnerField('source_reference', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="URL, event, referral reference, or evidence ID" />
                  </label>
                  <label className="text-sm font-bold text-slate-600 md:col-span-2">Notes
                    <textarea rows={3} value={partnerForm.notes} onChange={e => setPartnerField('notes', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-medium outline-none focus:border-indigo-500" placeholder="Initial context only — no outreach is sent from this form." />
                  </label>
                </div>
                <label className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <input type="checkbox" required checked={partnerForm.data_use_permission} onChange={e => setPartnerField('data_use_permission', e.target.checked)} className="mt-1 h-4 w-4 accent-indigo-600" />
                  <span><strong>Data-use permission confirmed.</strong> I have a valid basis/permission to store and use these contact details for partner relationship management.</span>
                </label>
              </section>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowNewPartner(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={savingPartner} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                  <Save size={16} /> {savingPartner ? 'Saving...' : 'Create Partner Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    {showBulkImport && <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-5 flex items-center justify-between rounded-t-3xl"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">BDM Tools</p><h2 className="text-2xl font-black text-slate-900 mt-1">Bulk Partner Import</h2><p className="text-sm text-slate-500 mt-1">Upload doctors, hospitals, clinics, or other partner contacts.</p></div><button onClick={() => setShowBulkImport(false)} className="p-2 rounded-xl hover:bg-slate-100" aria-label="Close bulk import"><X size={20}/></button></div>
        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4"><label className="block"><span className="text-xs font-black uppercase tracking-widest text-slate-500">BDM / Owner Name *</span><input value={bulkOwner} onChange={e => setBulkOwner(e.target.value)} placeholder="e.g. A. Sharma" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"/></label><div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4"><p className="font-bold text-indigo-900 text-sm">Supported formats</p><p className="text-xs text-indigo-800 mt-1">CSV, XLSX, XLS. Use the first worksheet and include a header row.</p><button type="button" onClick={() => { const sample = 'full_name,company_name,partner_type,email,phone,industry,country,city,source,owner_name\nDr Example,Example Hospital,Doctor,doctor@example.com,9876543210,Cardiology,India,Jaipur,BDM Outreach,Your Name'; const blob = new Blob([sample], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='medical-partner-template.csv'; a.click(); URL.revokeObjectURL(url); }} className="mt-2 text-xs font-black underline">Download CSV template</button></div></div>
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center"><FileSpreadsheet size={28} className="mx-auto text-indigo-600"/><p className="mt-2 font-black text-slate-800">Upload partner spreadsheet</p><p className="text-xs text-slate-500 mt-1">Required column: full_name. Email is optional; company, type, phone, specialty, location, source and notes are optional.</p><input type="file" accept=".csv,.xlsx,.xls" onChange={e => handleBulkFile(e.target.files?.[0])} className="mt-4 block w-full max-w-sm mx-auto text-sm"/>{bulkFileName && <p className="mt-2 text-xs font-bold text-emerald-700">Loaded: {bulkFileName}</p>}</div>
          <details className="rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-black text-sm text-slate-800">Or enter a partner manually</summary><div className="grid sm:grid-cols-2 gap-3 mt-4">{([['full_name','Contact / Doctor Name *'],['email','Email Address (optional)'],['company_name','Hospital / Company'],['partner_type','Partner Type'],['phone','Phone'],['industry','Specialty / Industry'],['city','City'],['country','Country']] as const).map(([key,label])=><label key={key} className="block"><span className="text-xs font-bold text-slate-500">{label}</span><input value={manualPartner[key]} onChange={e=>setManualPartner(current=>({...current,[key]:e.target.value}))} placeholder={label.replace(' *','')} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label>)}</div><button type="button" onClick={()=>{if(!manualPartner.full_name.trim()||(manualPartner.email.trim()&&!/^\S+@\S+\.\S+$/.test(manualPartner.email.trim()))){toast.error('Enter a contact name and a valid email address if one is provided.');return;}setBulkRows(current=>[...current,{...manualPartner,email:manualPartner.email.trim().toLowerCase(),source:'Manual Bulk Entry',campaign_name:'Bulk Partner Outreach',owner_name:bulkOwner.trim(),target_geography:'',source_reference:'',website:'',address:'',notes:''}]);setManualPartner({full_name:'',email:'',company_name:'',partner_type:'Doctor',phone:'',industry:'Healthcare',city:'',country:'India'});toast.success('Partner added to preview.');}} className="mt-3 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-black">Add partner to preview</button><div className="border-t border-slate-100 mt-5 pt-4"><p className="text-xs font-black text-slate-700">Or paste multiple rows</p><p className="text-xs text-slate-500 mt-1">Paste CSV-style text with a header row: full_name,email,company_name,partner_type,phone</p><textarea value={bulkManual} onChange={e => setBulkManual(e.target.value)} rows={3} placeholder={'full_name,email,company_name,partner_type,phone\nDr Example,doctor@example.com,Example Hospital,Doctor,9876543210'} className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm font-mono"/><button onClick={addManualBulkRows} type="button" className="mt-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-black">Add pasted rows</button></div></details>
          <div className="rounded-2xl border border-slate-200 overflow-hidden"><div className="px-4 py-3 bg-slate-50 flex flex-wrap items-center justify-between gap-2"><p className="font-black text-sm text-slate-800">Import preview & validation</p><div className="flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">{bulkRows.length} total</span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">{bulkValidation.filter(item => item.issues.length === 0).length} ready</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">{bulkInvalidCount} invalid</span><span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">{bulkDuplicateCount} duplicate</span></div></div>{bulkRows.length ? <div className="overflow-x-auto max-h-64"><table className="min-w-full text-xs"><thead className="sticky top-0 bg-white"><tr>{['Name','Email','Organization','Type','Validation status'].map(h => <th key={h} className="text-left px-4 py-2 font-black text-slate-500">{h}</th>)}</tr></thead><tbody>{bulkRows.slice(0,100).map((row,index)=>{const issues=getBulkRowIssues(row,index);return <tr key={`${row.email}-${index}`} className="border-t border-slate-100"><td className="px-4 py-2">{row.full_name || '—'}</td><td className="px-4 py-2">{row.email || '—'}</td><td className="px-4 py-2">{row.company_name || '—'}</td><td className="px-4 py-2">{row.partner_type}</td><td className="px-4 py-2"><span className={`inline-block rounded-full px-2 py-1 font-bold ${issues.length ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{issues.length ? issues.join(' · ') : 'Ready to import'}</span></td></tr>})}</tbody></table>{bulkRows.length>100 && <p className="p-3 text-xs text-slate-500">Showing first 100 rows.</p>}</div>:<p className="p-4 text-xs text-slate-400">Your rows will appear here before import.</p>}<p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-500">Duplicate checks compare email, phone number, and matching contact name plus organization against existing CRM leads and earlier rows in this import. Invalid and duplicate rows are skipped automatically.</p></div>
          <label className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-950"><input type="checkbox" checked={bulkPermission} onChange={e=>setBulkPermission(e.target.checked)} className="mt-1"/><span><strong>Permission confirmation required.</strong> I confirm that these contacts were obtained lawfully and that we have an appropriate permission or lawful basis to store and use their details for partner relationship management. No emails will be sent by bulk import.</span></label>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"><button onClick={()=>setShowBulkImport(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Cancel</button><button type="button" disabled={bulkSending} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void processBulkImport(); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white px-6 py-3 text-sm font-black hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">{bulkSending ? 'Importing…' : <><Upload size={16}/> Import partners</>}</button></div>
          <p className="text-[11px] leading-5 text-slate-400">Each partner is saved as a Stage 1 partnership inquiry. Bulk import does not send email or initiate outreach.</p>
        </div>
      </div>
    </div>}
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Business Partnerships</h2>
          <p className="text-slate-500 font-medium mt-1">Manage B2B referrals, medical agency contracts, and corporate partnerships.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-200/50 p-1.5 rounded-[1.5rem] shadow-inner">
            <button 
              onClick={() => setViewMode('BOARD')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'BOARD' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutGrid size={16} /> Pipeline
            </button>
            <button 
              onClick={() => setViewMode('TABLE')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'TABLE' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List size={16} /> Registry
            </button>
          </div>
          <button onClick={() => setShowBulkImport(true)} className="flex items-center gap-2 px-5 py-3.5 bg-white text-indigo-700 border border-indigo-200 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95">
            <Upload size={16} /> Bulk Import
          </button>
          <button type="button" onClick={() => setShowNewPartner(true)} className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all active:scale-95">
            <Plus size={18} /> New Partner
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search partners, agencies, or medical reps..."
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white outline-none font-bold text-slate-700 transition-all focus:ring-4 focus:ring-indigo-500/10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-all border border-slate-100">
            <Filter size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
           <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
           <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Syncing Partner Data...</p>
        </div>
      ) : viewMode === 'BOARD' ? (
        <div className="flex gap-6 overflow-x-auto pb-10 custom-scrollbar-hide pt-4">
          {columns.map(col => (
            <div key={col.id} className="flex-shrink-0 w-[400px]">
              <div className="flex items-center justify-between mb-6 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-600">{col.icon}</span>
                  <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-[0.2em]">{col.label}</h3>
                </div>
                <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-lg">
                  {leads.filter(l => getWorkflowBoardStatus(l) === col.id).length}
                </span>
              </div>
              <div className="space-y-4 bg-slate-100/50 p-5 rounded-[3rem] min-h-[700px] border-2 border-dashed border-slate-200">
                {filteredLeads.filter(l => getWorkflowBoardStatus(l) === col.id).map(lead => (
                   <BusinessLeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </div>
          ))}

          <div className="flex-shrink-0 w-[400px]">
            <div className="flex items-center justify-between mb-6 px-4">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600"><CheckCircle2 size={14} /></span>
                <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-[0.2em]">Active Partners</h3>
              </div>
              <span className="text-[10px] font-black bg-emerald-600 text-white px-3 py-1 rounded-lg">
                {leads.filter(l => getWorkflowBoardStatus(l) === 'won').length}
              </span>
            </div>
            <div className="space-y-4 bg-emerald-50/30 p-5 rounded-[3rem] min-h-[700px] border-2 border-dashed border-emerald-100/50">
              {filteredLeads.filter(l => getWorkflowBoardStatus(l) === 'won').map(lead => (
                 <BusinessLeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 w-[400px]">
            <div className="flex items-center justify-between mb-6 px-4">
              <div className="flex items-center gap-2">
                <span className="text-rose-600"><Archive size={14} /></span>
                <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-[0.2em]">Dropped Medical Leads</h3>
              </div>
              <span className="text-[10px] font-black bg-rose-600 text-white px-3 py-1 rounded-lg">
                {leads.filter(l => getWorkflowBoardStatus(l) === 'lost').length}
              </span>
            </div>
            <div className="space-y-4 bg-rose-50/30 p-5 rounded-[3rem] min-h-[700px] border-2 border-dashed border-rose-100/70">
              {filteredLeads.filter(l => getWorkflowBoardStatus(l) === 'lost').map(lead => (
                <BusinessLeadCard key={lead.id} lead={lead} />
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
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Partner / Lead</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Organization</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Est. Annual Value</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-slate-50 transition-all duration-300 group cursor-pointer">
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          {lead.full_name?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900 leading-tight mb-1">{lead.full_name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{lead.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Landmark size={14} className="text-slate-400" />
                        <p className="text-sm font-bold">{lead.company_name || 'Individual'}</p>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <p className="text-base font-black text-slate-900">${lead.estimated_value?.toLocaleString() || '---'}</p>
                    </td>
                    <td className="px-10 py-8">
                      <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border ${getStatusColor(lead.status || 'new')}`}>
                        {lead.status || 'new'}
                      </span>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <button onClick={(event) => { event.stopPropagation(); setSelectedLead(lead); }} className="p-3 bg-white text-slate-400 hover:text-indigo-600 rounded-2xl shadow-sm border border-slate-100 transition-all">
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
    </>
  );
};

export default Leads;
