import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  MessageSquare,
  Send,
  FileText,
  Layers,
  User,
  Info,
  X,
  Edit3,
  ChevronRight,
  Sparkles,
  History,
  ShieldCheck,
  Languages,
  Loader2,
  Eye,
  Plus,
  Tag,
  AlignLeft,
  Heading1,
  Heading2,
  Variable,
  Trash2,
  Copy,
  CheckCheck,
  Activity,
  Stethoscope,
  Building2,
  Handshake,
  DollarSign,
  Truck,
} from 'lucide-react';
import { CommunicationTemplate, MessageLog } from '../types.ts';
import { translateMedicalContent } from '../services/geminiService.ts';
import {
  fetchTemplates,
  createTemplate,
  deleteTemplate,
  sendCrmEmail,
  supabase,
  fetchMasterTemplate,
  updateMasterTemplate,
} from '../services/supabase.ts';
import { toast } from 'sonner';
import {
  buildWaruWenJoEmailFull,
  applyMergeVariables,
  MERGE_VARIABLES,
} from './emailTemplate';

// ─── Constants ────────────────────────────────────────────────

const LANGUAGES = [
  'English', 'Arabic', 'French', 'Spanish', 'Russian',
  'Chinese', 'Hindi', 'Portuguese', 'German', 'Bengali', 'Japanese',
];

const TEMPLATE_CATEGORIES = [
  { id: 'All',       label: 'All',        icon: Layers     },
  { id: 'Patient',   label: 'Patient',    icon: User       },
  { id: 'Doctor',    label: 'Doctor',     icon: Stethoscope},
  { id: 'Hospital',  label: 'Hospital',   icon: Building2  },
  { id: 'Partner',   label: 'Partner',    icon: Handshake  },
  { id: 'Finance',   label: 'Finance',    icon: DollarSign },
  { id: 'Logistics', label: 'Logistics',  icon: Truck      },
  { id: 'Clinical',  label: 'Clinical',   icon: Activity   },
  { id: 'General',   label: 'General',    icon: FileText   },
];

const TARGET_AUDIENCES = [
  'Patient', 'Doctor', 'Hospital', 'Partner', 'Finance', 'Logistics',
];

const CATEGORY_COLORS: Record<string, string> = {
  Patient:   'bg-teal-50 text-teal-700 border-teal-200',
  Doctor:    'bg-blue-50 text-blue-700 border-blue-200',
  Hospital:  'bg-purple-50 text-purple-700 border-purple-200',
  Partner:   'bg-orange-50 text-orange-700 border-orange-200',
  Finance:   'bg-green-50 text-green-700 border-green-200',
  Logistics: 'bg-amber-50 text-amber-700 border-amber-200',
  Clinical:  'bg-red-50 text-red-700 border-red-200',
  General:   'bg-slate-50 text-slate-600 border-slate-200',
};

// ─── Types ────────────────────────────────────────────────────

type ComposerTab = 'compose' | 'preview';

interface NewTemplateForm {
  title: string;
  template_name: string;
  category: string;
  target: string;
  target_audience: string;
  subject: string;
  email_title: string;
  email_subtitle: string;
  email_content: string;
  body: string;
}

// ─── Component ────────────────────────────────────────────────

const CommunicationHub: React.FC = () => {

  // Template library state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | null>(null);
  const [dbTemplates, setDbTemplates] = useState<CommunicationTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  
  // Master email template editor & Admin states
  const [masterTemplateHtmlState, setMasterTemplateHtmlState] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMasterEditorModal, setShowMasterEditorModal] = useState(false);
  const [masterTemplateDraft, setMasterTemplateDraft] = useState('');
  const [isSavingMaster, setIsSavingMaster] = useState(false);
  // If the user navigated here via an envelope shortcut we auto-send after template selection
  const [pendingAutoSend, setPendingAutoSend] = useState(false);
  const [pendingRecipientName, setPendingRecipientName] = useState<string | null>(null);

  // Composer state
  const [composerTab, setComposerTab] = useState<ComposerTab>('compose');
  const [recipient, setRecipient] = useState('');
  const [composedSubject, setComposedSubject] = useState('');
  const [composedEmailTitle, setComposedEmailTitle] = useState('');
  const [composedEmailSubtitle, setComposedEmailSubtitle] = useState('');
  const [composedEmailContent, setComposedEmailContent] = useState('');

  // Actions state
  const [isSending, setIsSending] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState('English');
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Recipient autocomplete
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingUser, setIsFetchingUser] = useState(false);

  // New template modal
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState<NewTemplateForm>({
    title: '',
    template_name: '',
    category: 'Patient',
    target: 'Patient',
    target_audience: 'Patient',
    subject: '',
    email_title: '',
    email_subtitle: '',
    email_content: '',
    body: '',
  });
  const [modalStep, setModalStep] = useState<1 | 2>(1);

  // Dispatch log
  const [sentLogs, setSentLogs] = useState<MessageLog[]>([
    { id: 'l1', recipient: 'Dr. Elizabeth Chen', subject: 'MRI Proposal Revision', sentAt: '10 mins ago', channel: 'Email', status: 'Opened' },
    { id: 'l2', recipient: '+1 (555) 012-3456', subject: 'Consultation Follow-up', sentAt: '2 hours ago', channel: 'WhatsApp', status: 'Delivered' },
  ]);

  // Textarea ref for variable insertion
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // ─── Effects ──────────────────────────────────────────────

  useEffect(() => {
    loadTemplates();
    loadMasterTemplate();
    checkAdminRole();
    const pendingEmail = localStorage.getItem('crm_target_recipient_email');
    const pendingName = localStorage.getItem('crm_target_recipient_name');
    const pendingTemplate = localStorage.getItem('crm_target_template');
    if (pendingEmail) {
      setRecipient(pendingEmail);
      if (pendingName) setPendingRecipientName(pendingName);
      // Clean up quick-action keys
      localStorage.removeItem('crm_target_recipient_email');
      localStorage.removeItem('crm_target_recipient_name');
      // Optionally capture a template id for auto-selection
      if (pendingTemplate) {
        localStorage.removeItem('crm_target_template');
        // try to pre-select that template after templates load
        setTimeout(() => {
          const tId = pendingTemplate;
          const found = dbTemplates.find(t => t.id === tId);
          if (found) selectTemplate(found);
        }, 500);
      }
      // Mark that this navigation was from an external quick-action (envelope)
      setPendingAutoSend(true);
    }
  }, []);

  const loadMasterTemplate = async () => {
    const { data } = await fetchMasterTemplate();
    if (data) {
      setMasterTemplateHtmlState(data);
    } else {
      // Graceful fallback to the embedded raw template
      setMasterTemplateHtmlState(undefined as unknown as string);
    }
  };

  const checkAdminRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.role === 'admin') {
          setIsAdmin(true);
        }
      }
    } catch (err) {
      console.error('Error checking admin role:', err);
    }
  };

  const handleOpenMasterEditor = async () => {
    setIsSavingMaster(true);
    const { data } = await fetchMasterTemplate();
    const masterHtml = data || masterTemplateHtmlState || buildWaruWenJoEmailFull({
      emailTitle: '{{EMAIL_TITLE}}',
      emailSubtitle: '{{EMAIL_SUBTITLE}}',
      emailContent: '{{EMAIL_CONTENT}}'
    });
    setMasterTemplateDraft(masterHtml);
    setShowMasterEditorModal(true);
    setIsSavingMaster(false);
  };

  const handleSaveMasterTemplate = async () => {
    if (!masterTemplateDraft.trim()) {
      toast.error('Master template HTML cannot be empty');
      return;
    }
    
    // Check if placeholders are present
    if (!masterTemplateDraft.includes('{{EMAIL_TITLE}}') || 
        !masterTemplateDraft.includes('{{EMAIL_SUBTITLE}}') || 
        !masterTemplateDraft.includes('{{EMAIL_CONTENT}}')) {
      toast.error('Error: Master template must contain {{EMAIL_TITLE}}, {{EMAIL_SUBTITLE}}, and {{EMAIL_CONTENT}} placeholders.');
      return;
    }

    setIsSavingMaster(true);
    const { error } = await updateMasterTemplate(masterTemplateDraft);
    setIsSavingMaster(false);

    if (error) {
      toast.error('Failed to update master template: ' + error.message);
    } else {
      toast.success('Master email template updated successfully ✓');
      setMasterTemplateHtmlState(masterTemplateDraft);
      setShowMasterEditorModal(false);
    }
  };

  // Auto-suggest recipients from profiles
  useEffect(() => {
    if (recipient.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const delay = setTimeout(async () => {
      setIsFetchingUser(true);
      const q = recipient.trim();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(6);
      if (!error && data) {
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      }
      setIsFetchingUser(false);
    }, 300);
    return () => clearTimeout(delay);
  }, [recipient]);

  // ─── Data Fetching ────────────────────────────────────────

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    const { data } = await fetchTemplates();
    if (data) {
      setDbTemplates(data as unknown as CommunicationTemplate[]);
    }
    setLoadingTemplates(false);
  };

  // ─── Template Selection ───────────────────────────────────

  const selectTemplate = (template: CommunicationTemplate) => {
    setSelectedTemplate(template);
    setComposedSubject(template.subject || '');
    setComposedEmailTitle(template.email_title || template.title || '');
    setComposedEmailSubtitle(template.email_subtitle || '');
    setComposedEmailContent(template.email_content || template.body || '');
    setComposerTab('compose');

    // If we arrived with a quick-action recipient, automatically send this template as an email
    if (pendingAutoSend) {
      // defer slightly to allow state to settle
      setTimeout(() => {
        (async () => {
          try {
            await handleSend('Email');
          } catch (e) {
            console.error('Auto-send failed:', e);
          }
        })();
      }, 300);
      setPendingAutoSend(false);
    }
  };

  const filteredTemplates = selectedCategory === 'All'
    ? dbTemplates
    : dbTemplates.filter(t => t.category === selectedCategory);

  // ─── Recipient Suggestion Handlers ───────────────────────

  const handleSelectSuggestion = (profile: any) => {
    const contactVal = profile.email || profile.phone || profile.full_name;
    setRecipient(contactVal);
    // Auto-replace {{recipient_name}} and {{patient_name}}
    if (profile.full_name) {
      setComposedEmailContent(prev =>
        prev
          .replace(/\{\{recipient_name\}\}/g, profile.full_name)
          .replace(/\{\{patient_name\}\}/g, profile.full_name)
      );
      setComposedSubject(prev =>
        prev
          .replace(/\{\{recipient_name\}\}/g, profile.full_name)
          .replace(/\{\{patient_name\}\}/g, profile.full_name)
      );
    }
    setShowSuggestions(false);
  };

  // ─── Variable Insertion ───────────────────────────────────

  const insertVariable = (varKey: string) => {
    const tag = `{{${varKey}}}`;
    const ta = contentRef.current;
    if (!ta) {
      setComposedEmailContent(prev => prev + tag);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = composedEmailContent.substring(0, start);
    const after  = composedEmailContent.substring(end);
    const updated = before + tag + after;
    setComposedEmailContent(updated);
    // Restore cursor after tag
    setTimeout(() => {
      ta.selectionStart = start + tag.length;
      ta.selectionEnd   = start + tag.length;
      ta.focus();
    }, 0);
  };

  const copyVariable = async (varKey: string) => {
    await navigator.clipboard.writeText(`{{${varKey}}}`);
    setCopiedVar(varKey);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  // ─── Translation ──────────────────────────────────────────

  const handleTranslate = async (lang: string) => {
    if (!composedEmailContent.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      const result = await translateMedicalContent(composedEmailContent, lang);
      if (result) {
        setComposedEmailContent(result);
        toast.success(`Translated to ${lang}`);
      } else {
        toast.error(`Failed to translate`);
      }
    } catch {
      toast.error('Translation error');
    } finally {
      setIsTranslating(false);
    }
  };

  // ─── Send Email / WhatsApp ────────────────────────────────

  const handleSend = async (channel: 'Email' | 'WhatsApp') => {
    if (!recipient) {
      toast.error('Please specify a recipient');
      return;
    }

    setIsSending(true);
    let targetEmail  = recipient;
    let targetName   = 'Valued Partner';
    let finalSubject = composedSubject;
    let finalContent = composedEmailContent;
    let finalTitle   = composedEmailTitle;
    let finalSubtitle = composedEmailSubtitle;

    // Look up profile if recipient matches a user
    try {
      const q = recipient.trim();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(1)
        .maybeSingle();

      if (profile) {
        if (channel === 'Email') {
          if (!profile.email) {
            toast.error('Found user but they have no registered email address');
            setIsSending(false);
            return;
          }
          targetEmail = profile.email;
        } else {
          targetEmail = profile.phone || profile.email || recipient;
        }
        targetName = profile.full_name || targetName;
      } else if (channel === 'Email' && !recipient.includes('@')) {
        toast.error(`"${recipient}" is not a valid email and no matching user found.`);
        setIsSending(false);
        return;
      }
    } catch {
      // Use recipient as-is
    }

    // Build merge variable map
    const mergeVars: Record<string, string> = {
      patient_name:   targetName,
      recipient_name: targetName,
      doctor_name:    '',
      hospital_name:  '',
      appointment_date: '',
      case_id:        '',
      invoice_number: '',
      treatment_name: '',
      contact_email:  targetEmail,
    };

    // Apply merge variables to content
    finalContent  = applyMergeVariables(finalContent,  mergeVars);
    finalTitle    = applyMergeVariables(finalTitle,    mergeVars);
    finalSubtitle = applyMergeVariables(finalSubtitle, mergeVars);
    finalSubject  = applyMergeVariables(finalSubject,  mergeVars);

    if (channel === 'Email') {
      const htmlEmail = buildWaruWenJoEmailFull({
        emailTitle:    finalTitle,
        emailSubtitle: finalSubtitle,
        emailContent:  finalContent.includes('<') ? finalContent : finalContent.replace(/\n/g, '<br/>'),
        masterTemplate: masterTemplateHtmlState || undefined,
      });

      const { success, error } = await sendCrmEmail(targetEmail, finalSubject, htmlEmail, targetName);
      if (!success) {
        toast.error('Dispatch Failed: ' + error);
        setIsSending(false);
        return;
      }
      toast.success('Email dispatched via SMTP ✓');
    } else {
      const plainText = finalContent.replace(/<[^>]*>?/gm, '');
      const waUrl = `https://wa.me/${targetEmail.replace(/\D/g, '')}?text=${encodeURIComponent(plainText)}`;
      window.open(waUrl, '_blank');
      toast.success('WhatsApp session initiated ✓');
    }

    setSentLogs(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      recipient: targetEmail,
      subject: finalSubject,
      sentAt: 'Just now',
      channel,
      status: 'Delivered',
    }, ...prev]);

    setIsSending(false);
    setSelectedTemplate(null);
    setRecipient('');
  };

  // ─── Save New Template ────────────────────────────────────

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.title || !newTemplate.email_content) {
      toast.error('Template name and content are required');
      return;
    }

    const payload = {
      title:           newTemplate.title,
      template_name:   newTemplate.title,
      category:        newTemplate.category,
      target:          newTemplate.target,
      target_audience: newTemplate.target,
      subject:         newTemplate.subject,
      body:            newTemplate.email_content,   // legacy
      email_title:     newTemplate.email_title,
      email_subtitle:  newTemplate.email_subtitle,
      email_content:   newTemplate.email_content,
    };

    const { error } = await createTemplate(payload);
    if (error) {
      toast.error('Failed to save template');
    } else {
      toast.success('Template saved to library ✓');
      loadTemplates();
      setShowNewTemplateModal(false);
      setModalStep(1);
      setNewTemplate({
        title: '', template_name: '', category: 'Patient', target: 'Patient',
        target_audience: 'Patient', subject: '', email_title: '',
        email_subtitle: '', email_content: '', body: '',
      });
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this template?')) return;
    const { error } = await deleteTemplate(id);
    if (error) {
      toast.error('Failed to delete template');
    } else {
      toast.success('Template removed');
      loadTemplates();
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
    }
  };

  // ─── Preview HTML ─────────────────────────────────────────

  const previewHtml = buildWaruWenJoEmailFull({
    emailTitle:    composedEmailTitle   || '{{EMAIL_TITLE}}',
    emailSubtitle: composedEmailSubtitle || '{{EMAIL_SUBTITLE}}',
    emailContent:  (composedEmailContent || '{{EMAIL_CONTENT}}').replace(/\n/g, '<br/>'),
    masterTemplate: masterTemplateHtmlState || undefined,
  });

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-2xl shadow-sm">
              <Mail size={26} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Communication Hub</h2>
          </div>
          <p className="text-slate-500 text-sm font-medium ml-14">
            WaruWenJo master template · structured email fields · live preview · merge variables
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={handleOpenMasterEditor}
              disabled={isSavingMaster}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-amber-300 border border-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md disabled:opacity-50"
            >
              <ShieldCheck size={16} /> {isSavingMaster ? 'Loading...' : 'Edit Master Template'}
            </button>
          )}
          <button
            onClick={() => { setShowNewTemplateModal(true); setModalStep(1); }}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      {/* ── Category Filters ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TEMPLATE_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                active
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                  : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              <Icon size={11} /> {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── Main 3-panel Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* ══ LEFT: Template Library ══ */}
        <div className="xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Layers size={12} /> Template Library
            </h3>
            <span className="text-[9px] font-black text-slate-300 uppercase">
              {filteredTemplates.length} {filteredTemplates.length === 1 ? 'template' : 'templates'}
            </span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
            {loadingTemplates ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <Loader2 size={22} className="text-indigo-500 animate-spin" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading...</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-100 rounded-3xl">
                <Layers size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No templates</p>
                <p className="text-[9px] text-slate-300 mt-1">in {selectedCategory}</p>
              </div>
            ) : (
              filteredTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => selectTemplate(template)}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all group relative ${
                    selectedTemplate?.id === template.id
                      ? 'bg-indigo-600 border-indigo-600 shadow-xl'
                      : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tighter border ${
                      selectedTemplate?.id === template.id
                        ? 'bg-white/20 text-white border-white/20'
                        : (CATEGORY_COLORS[template.category] || CATEGORY_COLORS.General)
                    }`}>
                      {template.category}
                    </span>
                    <button
                      onClick={(e) => handleDeleteTemplate(template.id, e)}
                      className={`p-1 rounded-lg transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'text-white/50 hover:text-white hover:bg-white/10'
                          : 'text-slate-200 hover:text-red-500'
                      }`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <h4 className={`text-xs font-black mb-1 leading-tight ${
                    selectedTemplate?.id === template.id ? 'text-white' : 'text-slate-800 group-hover:text-indigo-600'
                  }`}>
                    {template.title}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-2">
                    <User size={9} className={selectedTemplate?.id === template.id ? 'text-white/60' : 'text-slate-400'} />
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${
                      selectedTemplate?.id === template.id ? 'text-white/70' : 'text-slate-400'
                    }`}>
                      {template.target || template.target_audience || 'General'}
                    </p>
                  </div>
                  {template.email_title && (
                    <p className={`text-[9px] mt-1.5 font-medium truncate italic ${
                      selectedTemplate?.id === template.id ? 'text-white/60' : 'text-slate-400'
                    }`}>
                      "{template.email_title}"
                    </p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Recent Dispatch */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm mt-4">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <History size={14} className="text-slate-400" /> Recent Dispatch
            </h3>
            <div className="space-y-3">
              {sentLogs.slice(0, 4).map(log => (
                <div key={log.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-slate-700 truncate">{log.recipient}</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">{log.channel} · {log.sentAt}</p>
                  </div>
                  <span className={`ml-2 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${
                    log.status === 'Opened'    ? 'bg-green-50 text-green-600' :
                    log.status === 'Delivered' ? 'bg-blue-50 text-blue-600' :
                    'bg-red-50 text-red-500'
                  }`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ CENTRE: Composer ══ */}
        <div className="xl:col-span-5">
          {selectedTemplate ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
              {/* Composer header */}
              <div className="p-6 bg-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-2xl">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black tracking-tight leading-none mb-0.5">Email Composer</h3>
                    <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">{selectedTemplate.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Tabs */}
                  <div className="flex bg-white/10 rounded-xl p-0.5">
                    <button
                      onClick={() => setComposerTab('compose')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[10px] font-black uppercase tracking-widest transition-all ${
                        composerTab === 'compose' ? 'bg-white text-indigo-600' : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <Edit3 size={11} /> Edit
                    </button>
                    <button
                      onClick={() => setComposerTab('preview')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[10px] font-black uppercase tracking-widest transition-all ${
                        composerTab === 'preview' ? 'bg-white text-indigo-600' : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <Eye size={11} /> Preview
                    </button>
                  </div>
                  <button onClick={() => setSelectedTemplate(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {composerTab === 'compose' ? (
                <div className="p-6 space-y-4">

                  {/* Recipient + Subject Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Recipient</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Name, Email or Phone..."
                          className="w-full pl-9 pr-8 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 transition-all"
                          value={recipient}
                          onChange={e => setRecipient(e.target.value)}
                          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        />
                        {isFetchingUser && (
                          <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
                        )}
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                            {suggestions.map(u => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleSelectSuggestion(u)}
                                className="w-full px-4 py-2.5 text-left hover:bg-indigo-50/50 border-b border-slate-50 last:border-0 transition-colors"
                              >
                                <span className="text-xs font-black text-slate-800 block">{u.full_name}</span>
                                <span className="text-[10px] text-slate-400">{u.email || 'No email'}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Subject Line</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Email subject..."
                          className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 transition-all"
                          value={composedSubject}
                          onChange={e => setComposedSubject(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Title */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                      <Heading1 size={11} /> Email Title <span className="text-indigo-400 font-mono normal-case tracking-normal">{'{{EMAIL_TITLE}}'}</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Your Appointment Is Confirmed"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800 transition-all"
                      value={composedEmailTitle}
                      onChange={e => setComposedEmailTitle(e.target.value)}
                    />
                  </div>

                  {/* Email Subtitle */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                      <Heading2 size={11} /> Email Subtitle <span className="text-indigo-400 font-mono normal-case tracking-normal">{'{{EMAIL_SUBTITLE}}'}</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Your consultation has been successfully scheduled."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-700 transition-all"
                      value={composedEmailSubtitle}
                      onChange={e => setComposedEmailSubtitle(e.target.value)}
                    />
                  </div>

                  {/* Language selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Translate Content</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Languages className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <select
                          disabled={isTranslating}
                          className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                          value={targetLang}
                          onChange={e => setTargetLang(e.target.value)}
                        >
                          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <button
                        onClick={() => handleTranslate(targetLang)}
                        disabled={isTranslating}
                        className="px-4 py-3 bg-teal-50 border border-teal-100 text-teal-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-100 disabled:opacity-50 transition-all flex items-center gap-1.5"
                      >
                        {isTranslating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                        AI Translate
                      </button>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between pl-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <AlignLeft size={11} /> Email Content <span className="text-indigo-400 font-mono normal-case tracking-normal">{'{{EMAIL_CONTENT}}'}</span>
                      </label>
                      <span className="text-[9px] font-bold text-slate-300">Supports HTML</span>
                    </div>
                    <textarea
                      ref={contentRef}
                      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm leading-relaxed min-h-[260px] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all font-medium text-slate-700 shadow-inner resize-y"
                      value={composedEmailContent}
                      onChange={e => setComposedEmailContent(e.target.value)}
                      placeholder={`Dear {{patient_name}},\n\nYour appointment with {{doctor_name}} has been confirmed.\n\nDate: {{appointment_date}}\nHospital: {{hospital_name}}\n\nRegards,\nWaruWenJo Clinical Team`}
                    />
                  </div>

                  {/* Send Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={() => handleSend('Email')}
                      disabled={isSending}
                      className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isSending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      Send Branded Email
                    </button>
                    <button
                      onClick={() => handleSend('WhatsApp')}
                      disabled={isSending}
                      className="flex-1 py-3.5 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isSending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                      WhatsApp Dispatch
                    </button>
                  </div>

                  {/* Compliance note */}
                  <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <ShieldCheck size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
                      All messages logged for compliance. The WaruWenJo master template is applied automatically — header, footer, and branding are preserved across all outreach.
                    </p>
                  </div>
                </div>
              ) : (
                /* ── Preview Tab ── */
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 border-b border-slate-100">
                    <Eye size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Email Preview · WaruWenJo Master Template</span>
                  </div>
                  <div className="overflow-hidden" style={{ height: '700px' }}>
                    <iframe
                      srcDoc={previewHtml}
                      title="Email Preview"
                      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                  <div className="p-4 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
                    <Info size={14} className="text-amber-500 flex-shrink-0" />
                    <p className="text-[9px] text-amber-700 font-bold leading-relaxed">
                      Merge variables like <code className="bg-amber-100 px-1 rounded">{'{{patient_name}}'}</code> will be replaced with real values at send time. Switch to Edit tab to modify content.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── No template selected placeholder ── */
            <div className="flex flex-col items-center justify-center py-28 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mb-5">
                <Mail size={40} />
              </div>
              <h3 className="text-lg font-black text-slate-700 tracking-tight">Select a template to compose</h3>
              <p className="text-slate-400 text-xs font-medium mt-1.5 text-center max-w-xs">
                Choose from the library on the left, or create a new template. The WaruWenJo branded layout is applied automatically.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-10 w-full max-w-sm px-6">
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                    <Sparkles size={13} />
                  </div>
                  <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">AI Translate</span>
                </div>
                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-white rounded-xl shadow-sm flex items-center justify-center text-teal-600">
                    <ShieldCheck size={13} />
                  </div>
                  <span className="text-[9px] font-black text-teal-700 uppercase tracking-widest">HIPAA Ready</span>
                </div>
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-600">
                    <Eye size={13} />
                  </div>
                  <span className="text-[9px] font-black text-purple-700 uppercase tracking-widest">Live Preview</span>
                </div>
                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-white rounded-xl shadow-sm flex items-center justify-center text-orange-600">
                    <Variable size={13} />
                  </div>
                  <span className="text-[9px] font-black text-orange-700 uppercase tracking-widest">Merge Vars</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ RIGHT: Merge Variables Panel ══ */}
        <div className="xl:col-span-4 space-y-4">

          {/* Merge Variables */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50 bg-gradient-to-r from-indigo-50 to-purple-50">
              <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <Variable size={13} className="text-indigo-500" /> Merge Variables
              </h3>
              <p className="text-[9px] text-slate-400 mt-1 font-medium">Click to insert at cursor · hover to copy</p>
            </div>
            <div className="p-4 grid grid-cols-1 gap-2">
              {MERGE_VARIABLES.map(v => (
                <div key={v.key} className="flex items-center justify-between group p-2.5 hover:bg-slate-50 rounded-xl transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => selectedTemplate ? insertVariable(v.key) : toast.info('Select a template first')}
                        className="font-mono text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition-colors font-bold whitespace-nowrap"
                      >
                        {`{{${v.key}}}`}
                      </button>
                      <span className="text-[10px] text-slate-500 font-medium truncate">{v.label}</span>
                    </div>
                    <p className="text-[9px] text-slate-300 mt-0.5 pl-0.5 italic">{v.example}</p>
                  </div>
                  <button
                    onClick={() => copyVariable(v.key)}
                    className="ml-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                    title="Copy variable tag"
                  >
                    {copiedVar === v.key ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Template Structure Guide */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50 bg-gradient-to-r from-slate-50 to-blue-50">
              <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <Info size={13} className="text-blue-500" /> Master Template Structure
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {[
                { zone: 'HEADER',    color: 'bg-[#243361]', text: 'Logo · WaruWenJo Branding · Contact', fixed: true  },
                { zone: 'HERO',      color: 'bg-[#243261]', text: '{{EMAIL_TITLE}} + {{EMAIL_SUBTITLE}}', fixed: false },
                { zone: 'CONTENT',   color: 'bg-white border',     text: '{{EMAIL_CONTENT}} — your message',   fixed: false },
                { zone: 'CTA BAND',  color: 'bg-[#faeec2]', text: 'Contact Buttons — fixed branded',     fixed: true  },
                { zone: 'STATS',     color: 'bg-[#f8f5e8]', text: '50+ Hospitals · 15+ Countries',      fixed: true  },
                { zone: 'FOOTER',    color: 'bg-[#243261]', text: 'Social · Address · Unsubscribe',      fixed: true  },
              ].map(row => (
                <div key={row.zone} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${row.color}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{row.zone}</span>
                    <p className="text-[9px] text-slate-400 font-medium truncate">{row.text}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                    row.fixed ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    {row.fixed ? 'Fixed' : 'Dynamic'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ══ New Template Modal ══ */}
      {showNewTemplateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

            {/* Modal header */}
            <div className="p-7 bg-indigo-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight leading-none mb-1">
                  {modalStep === 1 ? 'Template Details' : 'Email Content'}
                </h3>
                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">
                  Step {modalStep} of 2 · New Communication Template
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Step indicator */}
                <div className="flex gap-1.5">
                  <div className={`w-6 h-1.5 rounded-full ${modalStep >= 1 ? 'bg-white' : 'bg-white/30'}`} />
                  <div className={`w-6 h-1.5 rounded-full ${modalStep >= 2 ? 'bg-white' : 'bg-white/30'}`} />
                </div>
                <button onClick={() => { setShowNewTemplateModal(false); setModalStep(1); }} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-7 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {modalStep === 1 ? (
                <>
                  {/* Step 1: Template metadata */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Template Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Appointment Confirmation"
                      className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10"
                      value={newTemplate.title}
                      onChange={e => setNewTemplate({ ...newTemplate, title: e.target.value, template_name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Category</label>
                      <select
                        className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                        value={newTemplate.category}
                        onChange={e => setNewTemplate({ ...newTemplate, category: e.target.value })}
                      >
                        {TEMPLATE_CATEGORIES.filter(c => c.id !== 'All').map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Audience</label>
                      <select
                        className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                        value={newTemplate.target}
                        onChange={e => setNewTemplate({ ...newTemplate, target: e.target.value, target_audience: e.target.value })}
                      >
                        {TARGET_AUDIENCES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Subject Line</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Appointment Confirmed - {{patient_name}}"
                      className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10"
                      value={newTemplate.subject}
                      onChange={e => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                    />
                    <p className="text-[9px] text-slate-400 mt-1.5 pl-1 font-medium">Supports merge variables e.g. <code className="bg-slate-100 px-1 rounded">{'{{patient_name}}'}</code></p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!newTemplate.title || !newTemplate.subject) {
                        toast.error('Please fill in Template Name and Subject');
                        return;
                      }
                      setModalStep(2);
                    }}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    Continue to Email Content <ChevronRight size={14} />
                  </button>
                </>
              ) : (
                <>
                  {/* Step 2: Email content */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                      <Heading1 size={11} /> Email Title <span className="text-indigo-400 font-mono tracking-normal normal-case">{'→ {{EMAIL_TITLE}}'}</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Your Appointment Is Confirmed"
                      className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10"
                      value={newTemplate.email_title}
                      onChange={e => setNewTemplate({ ...newTemplate, email_title: e.target.value })}
                    />
                    <p className="text-[9px] text-slate-400 mt-1.5 pl-1 font-medium">Appears as the large hero headline in the branded email</p>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                      <Heading2 size={11} /> Email Subtitle <span className="text-indigo-400 font-mono tracking-normal normal-case">{'→ {{EMAIL_SUBTITLE}}'}</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Your consultation has been successfully scheduled."
                      className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10"
                      value={newTemplate.email_subtitle}
                      onChange={e => setNewTemplate({ ...newTemplate, email_subtitle: e.target.value })}
                    />
                    <p className="text-[9px] text-slate-400 mt-1.5 pl-1 font-medium">Brief line beneath the title in the hero section</p>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                      <AlignLeft size={11} /> Email Content * <span className="text-indigo-400 font-mono tracking-normal normal-case">{'→ {{EMAIL_CONTENT}}'}</span>
                    </label>
                    <textarea
                      required
                      rows={10}
                      placeholder={`Dear {{patient_name}},\n\nYour appointment with {{doctor_name}} has been confirmed.\n\nDate: {{appointment_date}}\nHospital: {{hospital_name}}\nCase ID: {{case_id}}\n\nRegards,\nWaruWenJo Clinical Team`}
                      className="w-full mt-2 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-700 leading-relaxed outline-none focus:ring-4 focus:ring-indigo-500/10 resize-y"
                      value={newTemplate.email_content}
                      onChange={e => setNewTemplate({ ...newTemplate, email_content: e.target.value, body: e.target.value })}
                    />
                    <p className="text-[9px] text-slate-400 mt-1.5 pl-1 font-medium">Supports plain text and HTML. Merge variables are replaced at send time.</p>
                  </div>

                  {/* Quick variable chips */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Quick Insert Variables</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MERGE_VARIABLES.map(v => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => setNewTemplate(prev => ({ ...prev, email_content: (prev.email_content || '') + `{{${v.key}}}` }))}
                          className="font-mono text-[9px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors font-bold"
                        >
                          {`{{${v.key}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setModalStep(1)}
                      className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Tag size={13} /> Save to Database
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ── Master Template Editor Modal ── */}
      {showMasterEditorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-[32px] border border-slate-100 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-amber-500" size={24} />
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider">Edit Master Email Template</h3>
              </div>
              <button
                onClick={() => setShowMasterEditorModal(false)}
                className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-3">
                <Info size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold uppercase tracking-wider mb-1">Administrator Notice</p>
                  <p className="leading-relaxed">
                    This is the HTML code of the master template (logo, colors, header, footer, etc.) used for all outgoing CRM emails. It must contain the following placeholders exactly:
                  </p>
                  <div className="flex gap-2 mt-2 font-mono text-[10px] font-bold">
                    <span className="bg-white px-2 py-0.5 rounded shadow-sm border border-amber-200">{'{{EMAIL_TITLE}}'}</span>
                    <span className="bg-white px-2 py-0.5 rounded shadow-sm border border-amber-200">{'{{EMAIL_SUBTITLE}}'}</span>
                    <span className="bg-white px-2 py-0.5 rounded shadow-sm border border-amber-200">{'{{EMAIL_CONTENT}}'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Master HTML Template Code</label>
                <textarea
                  rows={20}
                  className="w-full mt-2 p-5 bg-slate-900 text-slate-200 font-mono text-xs leading-relaxed rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 resize-y"
                  value={masterTemplateDraft}
                  onChange={e => setMasterTemplateDraft(e.target.value)}
                />
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-50 bg-slate-50 rounded-b-[32px] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowMasterEditorModal(false)}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMasterTemplate}
                disabled={isSavingMaster}
                className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 shadow-lg transition-all disabled:opacity-50"
              >
                {isSavingMaster ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunicationHub;
