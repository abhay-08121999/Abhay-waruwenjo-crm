import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import {
  ArrowLeft, ChevronDown, Download, FilePlus2, FileSignature, FileText,
  LayoutTemplate, Loader2, Pencil, Plus, Save, Search, Trash2, X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toast, Toaster } from 'sonner';

// Consent Letter generator: same format as the MOU / Agreement Builder
// (list + builder with live A4 preview + templates, PDF stored in a private bucket).

type Tab = 'list' | 'builder' | 'templates';

type ConsentLetterRow = {
  id: string;
  patient_name: string;
  patient_email?: string | null;
  consent_type: string;
  status: string | null;
  valid_until: string | null;
  version: string | null;
  document_content?: string | null;
  pdf_path?: string | null;
  created_at?: string | null;
};

type ConsentTemplate = {
  id: string;
  name: string;
  type: string;
  html_content: string | null;
  created_at?: string;
};

const BUCKET = 'consent_letters';
const TEMPLATE_TYPE = 'consent';

const CONSENT_TYPES = [
  'Surgical Procedure',
  'Anesthesia',
  'Medical Travel & Treatment',
  'Data Privacy',
  'Financial Liability'
];

const DEFAULT_TEMPLATE = `<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:794px;margin:0 auto;background:#fff;padding:48px;line-height:1.65">
  <div style="border-bottom:3px solid #0f766e;padding-bottom:20px;margin-bottom:28px">
    <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#0f766e;font-weight:bold">HealthHub • Patient Authorization</div>
    <h1 style="font-size:28px;margin:12px 0 4px;text-align:center">CONSENT LETTER</h1>
    <p style="text-align:center;color:#64748b;margin:0">{{consent_type}} · Version {{version}} · Effective {{effective_date}}</p>
  </div>
  <p>I, <strong>{{patient_name}}</strong>, hereby give my informed and voluntary consent to <strong>HealthHub</strong> and its partner provider <strong>{{hospital_name}}</strong> for the matters described in this letter.</p>
  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">Patient Information</h2>
  <table style="width:100%;border-collapse:collapse;margin-top:12px">
    <tr>
      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold;width:35%">Patient Name</td>
      <td style="padding:8px;border:1px solid #cbd5e1">{{patient_name}}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Date of Birth</td>
      <td style="padding:8px;border:1px solid #cbd5e1">{{patient_dob}}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Passport / ID Number</td>
      <td style="padding:8px;border:1px solid #cbd5e1">{{patient_id_number}}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Email</td>
      <td style="padding:8px;border:1px solid #cbd5e1">{{patient_email}}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Phone</td>
      <td style="padding:8px;border:1px solid #cbd5e1">{{patient_phone}}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Treating Doctor</td>
      <td style="padding:8px;border:1px solid #cbd5e1">{{doctor_name}}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Procedure / Treatment</td>
      <td style="padding:8px;border:1px solid #cbd5e1">{{procedure_name}}</td>
    </tr>
  </table>
  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">1. Purpose of Consent</h2>
  <p>{{purpose}}</p>
  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">2. Risks and Alternatives Explained</h2>
  <p>{{risks}}</p>
  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">3. Use of Personal and Medical Data</h2>
  <p>{{data_use}}</p>
  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">4. Financial Responsibility</h2>
  <p>{{financial_terms}}</p>
  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">5. Validity</h2>
  <p>This consent becomes effective on {{effective_date}} and remains valid until {{valid_until}}, unless withdrawn earlier by the patient in writing.</p>
  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">6. Patient Declaration</h2>
  <p>{{declaration}}</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:56px">
    <div style="border-top:1px solid #94a3b8;padding-top:12px">
      <strong>Patient / Legal Guardian</strong>
      <p>Name: {{patient_name}}</p>
      <p>Date: __________________</p>
      <p>Signature: ______________</p>
    </div>
    <div style="border-top:1px solid #94a3b8;padding-top:12px">
      <strong>For HealthHub</strong>
      <p>Name: {{healthhub_signatory}}</p>
      <p>Title: {{healthhub_title}}</p>
      <p>Witness: {{witness_name}}</p>
      <p>Date: __________________</p>
      <p>Signature: ______________</p>
    </div>
  </div>
</div>`;

const INITIAL_FIELDS: Record<string, string> = {
  patient_name: '',
  consent_type: 'Surgical Procedure',
  version: 'v1.0',
  effective_date: new Date().toISOString().slice(0, 10),
  valid_until: '',
  patient_dob: '',
  patient_id_number: '',
  patient_email: '',
  patient_phone: '',
  hospital_name: '',
  doctor_name: '',
  procedure_name: '',
  purpose: 'To authorise the proposed medical evaluation, treatment and related coordination services after the nature, purpose and expected outcome have been explained to me.',
  risks: 'The potential risks, complications, benefits and reasonable alternatives of the proposed treatment have been explained to me, and I have had the opportunity to ask questions.',
  data_use: 'I authorise HealthHub and its partner providers to collect, store and share my personal and medical information only as needed for my care, travel coordination and legal compliance, in line with applicable data protection law.',
  financial_terms: 'I understand the estimated costs shared with me, that final charges may change with my clinical needs, and that I am responsible for payments as agreed in my quotation.',
  declaration: 'I confirm that the information I provided is accurate, that I have read and understood this letter, and that I am signing it voluntarily.',
  healthhub_signatory: '',
  healthhub_title: '',
  witness_name: ''
};

type FieldProps = {
  label: string;
  field: string;
  fields: Record<string, string>;
  setField: (key: string, value: string) => void;
  type?: string;
  placeholder?: string;
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10';

const InputField: React.FC<FieldProps> = ({ label, field, fields, setField, type = 'text', placeholder = '' }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-bold text-slate-600">{label}</span>
    <input
      type={type}
      value={fields[field] || ''}
      onChange={e => setField(field, e.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
  </label>
);

const TextAreaField: React.FC<FieldProps & { rows?: number }> = ({ label, field, fields, setField, rows = 3 }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-bold text-slate-600">{label}</span>
    <textarea rows={rows} value={fields[field] || ''} onChange={e => setField(field, e.target.value)} className={inputClass} />
  </label>
);

const ConsentLetterManager: React.FC = () => {
  const [tab, setTab] = useState<Tab>('list');
  const [docMenuOpen, setDocMenuOpen] = useState(false);
  const [letters, setLetters] = useState<ConsentLetterRow[]>([]);
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [fields, setFields] = useState<Record<string, string>>(INITIAL_FIELDS);
  const [templateHtml, setTemplateHtml] = useState(DEFAULT_TEMPLATE);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateEditorHtml, setTemplateEditorHtml] = useState(DEFAULT_TEMPLATE);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  const db = supabase as any;

  const setField = (key: string, value: string) => setFields(prev => ({ ...prev, [key]: value }));

  const loadLetters = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await db.from('consent_letters').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setLetters((data || []) as ConsentLetterRow[]);
    } catch (e: any) {
      toast.error(`Could not load consent letters: ${e.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    const { data, error } = await db
      .from('templates')
      .select('id,name,type,html_content,created_at')
      .eq('type', TEMPLATE_TYPE)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Could not load consent templates:', error);
      return;
    }
    setTemplates((data || []) as ConsentTemplate[]);
  }, []);

  useEffect(() => {
    void loadLetters();
    void loadTemplates();
  }, [loadLetters, loadTemplates]);

  const buildHtml = useCallback((source: string, values: Record<string, string>) => {
    let html = source || DEFAULT_TEMPLATE;
    Object.entries(values).forEach(([key, value]) => {
      const escaped = String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br/>');
      html = html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), escaped);
    });
    return html.replace(/{{\s*[\w]+\s*}}/g, '________________');
  }, []);

  const currentHtml = useMemo(() => buildHtml(templateHtml, fields), [buildHtml, templateHtml, fields]);

  const startNew = () => {
    setSelectedId(null);
    setTemplateId('');
    setTemplateHtml(DEFAULT_TEMPLATE);
    setFields({ ...INITIAL_FIELDS, effective_date: new Date().toISOString().slice(0, 10) });
    setTab('builder');
  };

  const editLetter = (row: ConsentLetterRow) => {
    try {
      const parsed = row.document_content ? JSON.parse(row.document_content) : null;
      setFields({ ...INITIAL_FIELDS, ...(parsed?.fields || {}), patient_name: row.patient_name });
      setTemplateHtml(parsed?.templateHtml || DEFAULT_TEMPLATE);
    } catch {
      setFields({ ...INITIAL_FIELDS, patient_name: row.patient_name });
      setTemplateHtml(DEFAULT_TEMPLATE);
    }
    setSelectedId(row.id);
    setTemplateId('');
    setTab('builder');
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const found = templates.find(t => t.id === id);
    setTemplateHtml(found?.html_content || DEFAULT_TEMPLATE);
  };

  const makePdfBlob = async (html: string) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:white;z-index:-1;';
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const image = canvas.toDataURL('image/jpeg', 0.92);
      const pageWidth = 210;
      const pageHeight = 297;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let remaining = imageHeight;
      let position = 0;
      pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
      remaining -= pageHeight;
      while (remaining > 0) {
        position = remaining - imageHeight;
        pdf.addPage();
        pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight, undefined, 'FAST');
        remaining -= pageHeight;
      }
      return pdf.output('blob') as Blob;
    } finally {
      document.body.removeChild(container);
    }
  };

  const saveLetter = async () => {
    if (!fields.patient_name.trim()) {
      toast.error('Enter the patient name before saving.');
      return;
    }
    if (!fields.valid_until) {
      toast.error('Select the consent validity end date.');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        patient_name: fields.patient_name.trim(),
        patient_email: fields.patient_email?.trim() || null,
        consent_type: fields.consent_type,
        status: 'Draft',
        valid_until: fields.valid_until || null,
        version: fields.version || 'v1.0',
        document_content: JSON.stringify({ fields, templateHtml }),
        updated_at: new Date().toISOString()
      };
      let saved: any;
      if (selectedId) {
        const result = await db.from('consent_letters').update(payload).eq('id', selectedId).select().single();
        if (result.error) throw result.error;
        saved = result.data;
      } else {
        const result = await db.from('consent_letters').insert(payload).select().single();
        if (result.error) throw result.error;
        saved = result.data;
      }
      if (!saved?.id) throw new Error('The database did not return the saved consent letter ID.');
      setSelectedId(saved.id);

      const pdfBlob = await makePdfBlob(currentHtml);
      const safeName = fields.patient_name.trim().replace(/[^a-z0-9-_]+/gi, '_').slice(0, 70) || 'Patient';
      const filePath = `${saved.id}/${safeName}_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true, cacheControl: '3600' });
      if (uploadError) {
        throw new Error(`Consent letter saved, but PDF upload failed: ${uploadError.message}. Click Save again to retry.`);
      }
      const { error: pathError } = await db.from('consent_letters').update({ pdf_path: filePath }).eq('id', saved.id);
      if (pathError) throw new Error(`Consent letter and PDF were created, but the PDF path could not be saved: ${pathError.message}`);

      toast.success(selectedId ? 'Consent letter updated and PDF saved.' : 'Consent letter created and PDF saved.');
      await loadLetters();
    } catch (e: any) {
      console.error('Save consent letter failed:', e);
      toast.error(e.message || 'Could not save the consent letter. Check database columns, RLS policies and Storage permissions.');
    } finally {
      setSaving(false);
    }
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async (row: ConsentLetterRow) => {
    try {
      const fileName = `${row.patient_name || 'Patient'}_Consent_Letter.pdf`;
      if (row.pdf_path) {
        const { data, error } = await supabase.storage.from(BUCKET).download(row.pdf_path);
        if (error) throw error;
        downloadBlob(data, fileName);
        return;
      }
      if (row.document_content) {
        const parsed = JSON.parse(row.document_content);
        const blob = await makePdfBlob(buildHtml(parsed.templateHtml || DEFAULT_TEMPLATE, { ...INITIAL_FIELDS, ...(parsed.fields || {}) }));
        downloadBlob(blob, fileName);
        return;
      }
      toast.error('This consent letter has no saved document. Open it in the Builder and save it again.');
    } catch (e: any) {
      toast.error(`Could not download the PDF: ${e.message || 'Unknown error'}`);
    }
  };

  const deleteLetter = async (row: ConsentLetterRow) => {
    if (!window.confirm(`Delete the consent letter for ${row.patient_name}?`)) return;
    try {
      if (row.pdf_path) await supabase.storage.from(BUCKET).remove([row.pdf_path]);
      const { error } = await db.from('consent_letters').delete().eq('id', row.id);
      if (error) throw error;
      toast.success('Consent letter deleted.');
      if (selectedId === row.id) setSelectedId(null);
      await loadLetters();
    } catch (e: any) {
      toast.error(`Could not delete: ${e.message || 'Unknown error'}`);
    }
  };

  // ---- Templates ----
  const openTemplateEditor = (template?: ConsentTemplate) => {
    setEditingTemplateId(template?.id || null);
    setTemplateName(template?.name || '');
    setTemplateEditorHtml(template?.html_content || DEFAULT_TEMPLATE);
    setShowTemplateEditor(true);
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error('Enter a template name.');
      return;
    }
    setTemplateSaving(true);
    try {
      const request = editingTemplateId
        ? db.from('templates').update({ name, html_content: templateEditorHtml, updated_at: new Date().toISOString() })
            .eq('id', editingTemplateId).eq('type', TEMPLATE_TYPE)
        : db.from('templates').insert({ name, type: TEMPLATE_TYPE, html_content: templateEditorHtml });
      const { error } = await request;
      if (error) throw error;
      toast.success('Consent template saved.');
      setShowTemplateEditor(false);
      await loadTemplates();
    } catch (e: any) {
      toast.error(`Could not save the template: ${e.message || 'Unknown error'}`);
    } finally {
      setTemplateSaving(false);
    }
  };

  const deleteTemplate = async (template: ConsentTemplate) => {
    if (!window.confirm('Delete this consent template? Existing saved consent letters will not be deleted.')) return;
    const { error } = await db.from('templates').delete().eq('id', template.id).eq('type', TEMPLATE_TYPE);
    if (error) {
      toast.error(`Could not delete the template: ${error.message}`);
      return;
    }
    if (templateId === template.id) {
      setTemplateId('');
      setTemplateHtml(DEFAULT_TEMPLATE);
    }
    await loadTemplates();
  };

  const filtered = letters.filter(row => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [row.patient_name, row.patient_email, row.consent_type, row.status, row.version]
      .some(v => String(v || '').toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 pb-10">
      <Toaster richColors position="top-right" />
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-teal-700 p-3 text-white">
              <FileSignature size={24} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800">Consent Letter Manager</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Create, reuse, edit, and export patient consent letters using reusable templates and an A4 document builder.
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setDocMenuOpen(open => !open)}
            aria-haspopup="menu"
            aria-expanded={docMenuOpen}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-800"
          >
            <Plus size={17} /> Document <ChevronDown size={16} className={`transition-transform ${docMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {docMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDocMenuOpen(false)} />
              <div role="menu" className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                <button
                  role="menuitem"
                  onClick={() => { setDocMenuOpen(false); startNew(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <FileSignature size={16} className="text-teal-700" /> Consent Letter
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        {([
          ['list', FileText, 'All Consent Letters'],
          ['builder', FileSignature, 'Consent Builder'],
          ['templates', LayoutTemplate, 'Templates']
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === key ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      {tab === 'list' && (
        <section className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search consent letters by patient, email, type, or status..."
              className="w-full bg-transparent py-3 text-sm outline-none"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-slate-500">
              <Loader2 className="animate-spin" /> Loading consent letters...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <h3 className="font-bold text-slate-800">No consent letters found</h3>
              <p className="mt-1 text-sm text-slate-500">Create your first consent letter or adjust your search.</p>
              <button
                onClick={startNew}
                className="mt-4 inline-flex items-center gap-1 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white"
              >
                <Plus size={15} /> Create Consent Letter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(row => (
                <article key={row.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-800">{row.patient_name}</h3>
                      <p className="text-xs font-bold uppercase tracking-wider text-teal-700">{row.consent_type} · Consent</p>
                    </div>
                    <span className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                      {row.status || 'Draft'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    <p>Version: {row.version || 'v1.0'}</p>
                    <p>Valid until: {row.valid_until || 'Not set'}</p>
                    {row.patient_email && <p>{row.patient_email}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => editLetter(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Pencil size={14} /> Edit
                    </button>
                    <button onClick={() => void downloadPdf(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Download size={14} /> PDF
                    </button>
                    <button onClick={() => void deleteLetter(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'builder' && (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setTab('list')} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Back to list">
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-lg font-black text-slate-800">{selectedId ? 'Edit Consent Letter' : 'Create Consent Letter'}</h2>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-600">Consent Template</span>
              <select value={templateId} onChange={e => applyTemplate(e.target.value)} className={inputClass}>
                <option value="">Default consent letter template</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField label="Patient full name *" field="patient_name" fields={fields} setField={setField} />
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Consent type</span>
                <select value={fields.consent_type} onChange={e => setField('consent_type', e.target.value)} className={inputClass}>
                  {CONSENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <InputField label="Version" field="version" fields={fields} setField={setField} />
              <InputField label="Effective date" field="effective_date" type="date" fields={fields} setField={setField} />
              <InputField label="Valid until *" field="valid_until" type="date" fields={fields} setField={setField} />
              <InputField label="Date of birth" field="patient_dob" type="date" fields={fields} setField={setField} />
              <InputField label="Passport / ID number" field="patient_id_number" fields={fields} setField={setField} />
              <InputField label="Patient email" field="patient_email" type="email" fields={fields} setField={setField} />
              <InputField label="Patient phone" field="patient_phone" fields={fields} setField={setField} />
              <InputField label="Hospital / provider" field="hospital_name" fields={fields} setField={setField} />
              <InputField label="Treating doctor" field="doctor_name" fields={fields} setField={setField} />
              <InputField label="Procedure / treatment" field="procedure_name" fields={fields} setField={setField} />
            </div>

            <TextAreaField label="Purpose of consent" field="purpose" fields={fields} setField={setField} />
            <TextAreaField label="Risks and alternatives" field="risks" fields={fields} setField={setField} />
            <TextAreaField label="Use of personal and medical data" field="data_use" fields={fields} setField={setField} />
            <TextAreaField label="Financial responsibility" field="financial_terms" fields={fields} setField={setField} />
            <TextAreaField label="Patient declaration" field="declaration" fields={fields} setField={setField} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField label="HealthHub signatory" field="healthhub_signatory" fields={fields} setField={setField} />
              <InputField label="HealthHub title" field="healthhub_title" fields={fields} setField={setField} />
              <InputField label="Witness name" field="witness_name" fields={fields} setField={setField} />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void saveLetter()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving consent letter...' : 'Save Consent Letter & PDF'}
              </button>
              {selectedId && (
                <button onClick={startNew} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
                  <FilePlus2 size={16} /> New Consent Letter
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-100 p-4">
            <div>
              <h2 className="text-xl font-black text-slate-800">A4 Preview</h2>
              <p className="text-xs text-slate-500">Live preview of the consent letter template</p>
            </div>
            <div className="overflow-auto">
              <div
                className="mx-auto w-[794px] max-w-none bg-white shadow-lg"
                dangerouslySetInnerHTML={{ __html: currentHtml }}
              />
            </div>
          </div>
        </section>
      )}

      {tab === 'templates' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <h2 className="text-xl font-black text-slate-800">Consent Templates</h2>
              <p className="text-xs text-slate-500">
                Use placeholders like {'{{patient_name}}'}, {'{{consent_type}}'}, {'{{hospital_name}}'}, {'{{procedure_name}}'}, {'{{valid_until}}'}.
              </p>
            </div>
            <button onClick={() => openTemplateEditor()} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white">
              <Plus size={16} /> New Template
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              No saved consent templates yet. The default template is available in the Builder.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map(template => (
                <article key={template.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
                  <div>
                    <h3 className="font-black text-slate-800">{template.name}</h3>
                    <p className="text-xs text-slate-500">Reusable consent letter template</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openTemplateEditor(template)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Pencil size={14} /> Edit
                    </button>
                    <button onClick={() => { applyTemplate(template.id); setTab('builder'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <FileSignature size={14} /> Use
                    </button>
                    <button onClick={() => void deleteTemplate(template)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {showTemplateEditor && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-6">
              <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <h3 className="text-lg font-black text-slate-800">{editingTemplateId ? 'Edit' : 'New'} Consent Template</h3>
                  <button onClick={() => setShowTemplateEditor(false)} className="rounded-lg p-2 hover:bg-slate-50" aria-label="Close">
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-4 overflow-auto p-5">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">Template name</span>
                    <input
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      placeholder="e.g. Surgical Consent Letter"
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">Template HTML</span>
                    <textarea
                      rows={16}
                      value={templateEditorHtml}
                      onChange={e => setTemplateEditorHtml(e.target.value)}
                      className={`${inputClass} font-mono text-xs`}
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
                  <button onClick={() => setShowTemplateEditor(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">
                    Cancel
                  </button>
                  <button
                    onClick={() => void saveTemplate()}
                    disabled={templateSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {templateSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Template
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default ConsentLetterManager;