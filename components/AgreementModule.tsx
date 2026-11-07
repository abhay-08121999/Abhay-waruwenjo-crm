

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '../integrations/supabase/client';

import { fetchAgreements, createAgreement, updateAgreement } from '../services/supabase.ts';

import { Agreement } from '../types.ts';

import {

  ArrowLeft, Building2, Calendar, Check, ChevronDown, Download, Eye, FilePlus2,

  FileSignature, FileText, LayoutTemplate, Loader2, Pencil, Plus, Save, Search,

  Trash2, X

} from 'lucide-react';

import { jsPDF } from 'jspdf';

import html2canvas from 'html2canvas';

import { toast } from 'sonner';



type Tab = 'list' | 'builder' | 'templates';

type PartnerCategory = 'Hospital' | 'Travel Partners' | 'Visa Facilitators' | 'Nursing Facilitators';



type AgreementRow = {

  id: string;

  partner_name: string;

  type: string;

  status: string | null;

  valid_until: string | null;

  version: string | null;

  partner_category?: string | null;

  document_content?: string | null;

  pdf_path?: string | null;
  source_lead_id?: string | null;

  created_at?: string | null;

};



type MouTemplate = {

  id: string;

  name: string;

  type: string;

  html_content: string | null;

  created_at?: string;

};



const PARTNER_CATEGORIES: PartnerCategory[] = [

  'Hospital',

  'Travel Partners',

  'Visa Facilitators',

  'Nursing Facilitators'

];



const DEFAULT_TEMPLATE = `<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:794px;margin:0 auto;background:#fff;padding:48px;line-height:1.65">

  <div style="border-bottom:3px solid #0f766e;padding-bottom:20px;margin-bottom:28px">

    <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#0f766e;font-weight:bold">HealthHub • Partnership Framework</div>

    <h1 style="font-size:28px;margin:12px 0 4px;text-align:center">MEMORANDUM OF UNDERSTANDING</h1>

    <p style="text-align:center;color:#64748b;margin:0">Version {{version}} · Effective {{effective_date}}</p>

  </div>



  <p>This Memorandum of Understanding (“MOU”) is entered into on <strong>{{effective_date}}</strong> between <strong>HealthHub</strong> and <strong>{{partner_name}}</strong>, classified as <strong>{{partner_category}}</strong>.</p>



  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">Partner Contact Information</h2>

  <table style="width:100%;border-collapse:collapse;margin-top:12px">

    <tr>

      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold;width:35%">Contact Person</td>

      <td style="padding:8px;border:1px solid #cbd5e1">{{contact_person}}</td>

    </tr>

    <tr>

      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Contact Email</td>

      <td style="padding:8px;border:1px solid #cbd5e1">{{contact_email}}</td>

    </tr>

    <tr>

      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Contact Phone</td>

      <td style="padding:8px;border:1px solid #cbd5e1">{{contact_phone}}</td>

    </tr>

    <tr>

      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Partner Address</td>

      <td style="padding:8px;border:1px solid #cbd5e1">{{partner_address}}</td>

    </tr>

    <tr>

      <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold">Registration / Licence Number</td>

      <td style="padding:8px;border:1px solid #cbd5e1">{{registration_number}}</td>

    </tr>

  </table>



  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">1. Purpose</h2>

  <p>{{purpose}}</p>



  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">2. Scope of Collaboration</h2>

  <p>{{scope}}</p>



  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">3. Roles and Responsibilities</h2>

  <p>{{responsibilities}}</p>



  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">4. Term and Review</h2>

  <p>This MOU becomes effective on {{effective_date}} and remains in effect until {{valid_until}}, unless amended or ended in writing by mutual agreement.</p>



  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">5. Confidentiality and Data Use</h2>

  <p>{{confidentiality}}</p>



  <h2 style="font-size:17px;color:#0f766e;margin-top:26px">6. General Understanding</h2>

  <p>{{general_terms}}</p>



  <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:56px">

    <div style="border-top:1px solid #94a3b8;padding-top:12px">

      <strong>For HealthHub</strong>

      <p>Name: {{healthhub_signatory}}</p>

      <p>Title: {{healthhub_title}}</p>

      <p>Date: __________________</p>

      <p>Signature: ______________</p>

    </div>

    <div style="border-top:1px solid #94a3b8;padding-top:12px">

      <strong>For {{partner_name}}</strong>

      <p>Name: {{partner_signatory}}</p>

      <p>Title: {{partner_title}}</p>

      <p>Date: __________________</p>

      <p>Signature: ______________</p>

    </div>

  </div>

</div>`;



const INITIAL_FIELDS: Record<string, string> = {

  partner_name: '',

  partner_category: 'Hospital',

  version: 'v1.0',

  effective_date: new Date().toISOString().slice(0, 10),

  valid_until: '',



  // Additional partner contact information
  contact_person: '',

  contact_email: '',

  contact_phone: '',

  partner_address: '',

  registration_number: '',



  purpose: 'To establish a clear framework for cooperation between HealthHub and the partner.',

  scope: 'The parties will coordinate relevant services, referrals, communication, and operational support as mutually agreed in writing.',

  responsibilities: 'Each party will appoint a point of contact, provide accurate information, follow applicable laws, and promptly communicate material changes.',

  confidentiality: 'Each party will protect confidential information and use personal or business data only for authorised purposes and in accordance with applicable law.',

  general_terms: 'This document records the parties’ present understanding. Any amendment must be documented in writing and accepted by both parties. The parties will discuss concerns in good faith.',

  healthhub_signatory: '',

  healthhub_title: '',

  partner_signatory: '',

  partner_title: ''

};



type FieldProps = {

  label: string;

  field: string;

  fields: Record<string, string>;

  setField: (key: string, value: string) => void;

  type?: string;

  placeholder?: string;

};



const InputField: React.FC<FieldProps> = ({

  label,

  field,

  fields,

  setField,

  type = 'text',

  placeholder = ''

}) => (

  <label className="block space-y-1.5">

    <span className="text-xs font-bold text-slate-600">{label}</span>

    <input

      type={type}

      value={fields[field] || ''}

      onChange={e => setField(field, e.target.value)}

      placeholder={placeholder}

      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"

    />

  </label>

);



const TextAreaField: React.FC<FieldProps & { rows?: number }> = ({

  label,

  field,

  fields,

  setField,

  rows = 3

}) => (

  <label className="block space-y-1.5">

    <span className="text-xs font-bold text-slate-600">{label}</span>

    <textarea

      rows={rows}

      value={fields[field] || ''}

      onChange={e => setField(field, e.target.value)}

      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"

    />

  </label>

);



const AgreementModule: React.FC = () => {

  const [tab, setTab] = useState<Tab>('list');

  const [agreements, setAgreements] = useState<AgreementRow[]>([]);

  const [templates, setTemplates] = useState<MouTemplate[]>([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceLeadId, setSourceLeadId] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState('');

  const [fields, setFields] = useState<Record<string, string>>(INITIAL_FIELDS);

  const [templateHtml, setTemplateHtml] = useState(DEFAULT_TEMPLATE);

  const [preview, setPreview] = useState(false);

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const [templateName, setTemplateName] = useState('');

  const [templateEditorHtml, setTemplateEditorHtml] = useState(DEFAULT_TEMPLATE);

  const [templateSaving, setTemplateSaving] = useState(false);

  const [showTemplateEditor, setShowTemplateEditor] = useState(false);



  const loadAgreements = useCallback(async () => {

    setLoading(true);



    try {

      const { data, error } = await fetchAgreements();

      if (error) throw error;



      setAgreements((data || []).map((row: any) => ({

        ...row,

        type: row.type || 'MOU',

        partner_name: row.partner_name || '',

        status: row.status || 'Draft',

        version: row.version || 'v1.0'

      })));

    } catch (e: any) {

      toast.error(`Could not load MOUs: ${e.message || 'Unknown error'}`);

    } finally {

      setLoading(false);

    }

  }, []);



  const loadTemplates = useCallback(async (showError = false) => {

    try {

      const request = supabase

        .from('templates')

        .select('id,name,type,html_content,created_at')

        .eq('type', 'mou')

        .order('created_at', { ascending: false });



      const timeout = new Promise<never>((_, reject) =>

        window.setTimeout(

          () => reject(new Error('Loading templates timed out after 15 seconds. Check the Network tab and Supabase status.')),

          15000

        )

      );



      const { data, error } = await Promise.race([request, timeout]) as any;



      if (error) {

        console.error('Could not load MOU templates:', {

          message: error.message,

          code: error.code,

          details: error.details,

          hint: error.hint

        });



        if (showError) {

          toast.error(`Could not load MOU templates${error.code ? ` (${error.code})` : ''}: ${error.message}`);

        }



        return false;

      }



      setTemplates((data || []) as MouTemplate[]);

      return true;

    } catch (error: any) {

      console.error('Could not load MOU templates:', error);

      if (showError) toast.error(error?.message || 'Could not load MOU templates.');

      return false;

    }

  }, []);



  useEffect(() => {

    void loadAgreements();

    void loadTemplates();

  }, [loadAgreements, loadTemplates]);



  // Medical Leads hand-off: prefill the existing MOU Builder.
  useEffect(() => {

    try {

      const raw = window.localStorage.getItem('healthhub-agreement-prefill');

      if (!raw) return;



      const incoming = JSON.parse(raw) as Record<string, unknown>;



      const stringValue = (...keys: string[]) => {

        for (const key of keys) {

          const value = incoming[key];

          if (typeof value === 'string' && value.trim()) return value.trim();

        }

        return '';

      };



      const categoryRaw = stringValue('partnerCategory', 'partner_category');



      const categoryAliases: Record<string, PartnerCategory> = {

        hospital: 'Hospital',

        doctor: 'Hospital',

        'travel partner': 'Travel Partners',

        'travel partners': 'Travel Partners',

        'visa facilitator': 'Visa Facilitators',

        'visa facilitators': 'Visa Facilitators',

        'nursing facilitator': 'Nursing Facilitators',

        'nursing facilitators': 'Nursing Facilitators'

      };



      const category = categoryAliases[categoryRaw.toLowerCase()] || 'Hospital';



      const partnerName = stringValue(

        'partnerName',

        'partner_name',

        'institution_name',

        'institution',

        'hospital_name'

      );



      const representativeName = stringValue(

        'representativeName',

        'representative_name',

        'contact_name',

        'full_name'

      );



      const representativeDesignation = stringValue(

        'representativeDesignation',

        'representative_designation',

        'designation',

        'job_title'

      );



      const partnerAddress = stringValue(

        'partnerAddress',

        'partner_address',

        'address',

        'institution_address',

        'hospital_address'

      );



      const partnerCountry = stringValue('partnerCountry', 'country');

      const executionCity = stringValue('executionCity', 'city');



      const registrationNumber = stringValue(

        'registrationNumber',

        'registration_number',

        'license_number',

        'licence_number'

      );



      const contactEmail = stringValue(

        'contactEmail',

        'contact_email',

        'email',

        'email_address'

      );



      const contactPhone = stringValue(

        'contactPhone',

        'contact_phone',

        'phone',

        'phone_number',

        'mobile'

      );



      const effectiveFields: Record<string, string> = {

        ...INITIAL_FIELDS,



        partner_name: partnerName,

        partner_category: category,



        partner_signatory: representativeName,

        partner_title: representativeDesignation,



        contact_person: representativeName,

        contact_email: contactEmail,

        contact_phone: contactPhone,

        partner_address: partnerAddress,

        registration_number: registrationNumber,



        scope: [

          INITIAL_FIELDS.scope,

          partnerCountry && `Country: ${partnerCountry}`,

          executionCity && `Execution location: ${executionCity}`

        ].filter(Boolean).join('\n\n'),



        version: stringValue('version') || INITIAL_FIELDS.version,

        effective_date: new Date().toISOString().slice(0, 10)

      };



      setSelectedId(null);
      setSourceLeadId(stringValue('sourceLeadId', 'source_lead_id') || null);
      setTemplateId('');
      setFields(effectiveFields);

      setTemplateHtml(DEFAULT_TEMPLATE);

      setPreview(true);

      setTab('builder');



      window.localStorage.removeItem('healthhub-agreement-prefill');

    } catch (error) {

      console.error('Could not prefill MOU Builder from Medical Lead:', error);

    }

  }, []);



  const setField = (key: string, value: string) => {

    setFields(previous => ({ ...previous, [key]: value }));

  };



  const activeTemplate = useMemo(

    () => templates.find(template => template.id === templateId),

    [templates, templateId]

  );



  const buildHtml = useCallback((source: string, values: Record<string, string>) => {
    let html = source || DEFAULT_TEMPLATE;

    Object.entries(values).forEach(([key, value]) => {
      const escaped = String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br/>');

      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(placeholder, escaped);
    });

    return html.replace(/{{\s*[\w]+\s*}}/g, '________________');
  }, []);



  const currentHtml = useMemo(

    () => buildHtml(templateHtml, fields),

    [buildHtml, templateHtml, fields]

  );



  const startNew = () => {

    setSelectedId(null);
    setSourceLeadId(null);

    setTemplateId('');

    setFields({

      ...INITIAL_FIELDS,

      effective_date: new Date().toISOString().slice(0, 10)

    });

    setTemplateHtml(DEFAULT_TEMPLATE);

    setPreview(false);

    setTab('builder');

  };



  const editAgreement = async (row: AgreementRow) => {

    setSelectedId(row.id);
    setSourceLeadId(row.source_lead_id || null);



    const saved = row.document_content;



    let loadedFields = {

      ...INITIAL_FIELDS,

      partner_name: row.partner_name,

      partner_category: row.partner_category || 'Hospital',

      version: row.version || 'v1.0',

      valid_until: row.valid_until || ''

    };



    if (saved) {

      try {

        const parsed = JSON.parse(saved);



        if (parsed.fields) {

          loadedFields = { ...loadedFields, ...parsed.fields };

        }



        if (parsed.templateHtml) {

          setTemplateHtml(parsed.templateHtml);

        } else {

          setTemplateHtml(DEFAULT_TEMPLATE);

        }

      } catch {

        // Older rows may not contain the newer JSON document format.
        setTemplateHtml(DEFAULT_TEMPLATE);

      }

    } else {

      setTemplateHtml(DEFAULT_TEMPLATE);

    }



    setTemplateId('');

    setFields(loadedFields);

    setPreview(false);

    setTab('builder');

  };



  const makePdfBlob = async (html: string) => {

    const container = document.createElement('div');



    container.style.cssText =

      'position:fixed;left:-10000px;top:0;width:794px;background:white;z-index:-1;';



    container.innerHTML = html;

    document.body.appendChild(container);



    try {

      const canvas = await html2canvas(container, {

        scale: 2,

        useCORS: true,

        backgroundColor: '#ffffff',

        width: 794

      });



      const pdf = new jsPDF('p', 'mm', 'a4');

      const image = canvas.toDataURL('image/png');



      const pageWidth = 210;

      const pageHeight = 297;

      const imageHeight = canvas.height * pageWidth / canvas.width;



      let remaining = imageHeight;

      let position = 0;



      pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight);



      remaining -= pageHeight;



      while (remaining > 0) {

        position = remaining - imageHeight;

        pdf.addPage();

        pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight);

        remaining -= pageHeight;

      }



      return pdf.output('blob') as Blob;

    } finally {

      document.body.removeChild(container);

    }

  };



  const saveMou = async () => {

    if (!fields.partner_name.trim()) {

      toast.error('Enter the partner legal name before saving.');

      return;

    }



    if (!fields.valid_until) {

      toast.error('Select the MOU validity end date.');

      return;

    }



    setSaving(true);



    try {

      const content = JSON.stringify({

        fields,

        templateHtml

      });



      const payload: any = {

        partner_name: fields.partner_name.trim(),

        type: 'MOU',

        status: 'Draft',

        valid_until: fields.valid_until || null,

        version: fields.version || 'v1.0',

        partner_category: fields.partner_category,

        document_content: content,
        ...(sourceLeadId ? { source_lead_id: sourceLeadId } : {})
      };



      let saved: any;



      if (selectedId) {

        const result = await updateAgreement(selectedId, payload);

        if (result.error) throw result.error;

        saved = result.data;

      } else {

        const result = await createAgreement(payload);

        if (result.error) throw result.error;

        saved = result.data;

      }



      if (!saved?.id) {

        throw new Error('The database did not return the saved MOU ID.');

      }



      const pdfBlob = await makePdfBlob(currentHtml);



      const safeName = fields.partner_name

        .trim()

        .replace(/[^a-z0-9-_]+/gi, '_')

        .slice(0, 70) || 'Partner';



      const filePath = `${saved.id}/${safeName}_${Date.now()}.pdf`;



      const { error: uploadError } = await supabase.storage

        .from('agreements')

        .upload(filePath, pdfBlob, {

          contentType: 'application/pdf',

          upsert: true,

          cacheControl: '3600'

        });



      if (uploadError) {

        throw new Error(`MOU saved, but PDF upload failed: ${uploadError.message}`);

      }



      const { error: pathError } = await updateAgreement(

        saved.id,

        { pdf_path: filePath } as any

      );



      if (pathError) {

        throw new Error(`MOU and PDF were created, but the PDF path could not be saved: ${pathError.message}`);

      }



      toast.success(

        selectedId

          ? 'MOU updated and PDF saved.'

          : 'MOU created and PDF saved.'

      );



      setSelectedId(saved.id);

      await loadAgreements();

    } catch (e: any) {

      console.error('Save MOU failed:', e);



      toast.error(

        e.message ||

        'Could not save MOU. Check database columns, RLS policies, and Storage permissions.'

      );

    } finally {

      setSaving(false);

    }

  };



  const downloadPdf = async (row: AgreementRow) => {

    try {

      if (row.pdf_path) {

        const { data, error } = await supabase.storage

          .from('agreements')

          .download(row.pdf_path);



        if (error) throw error;



        const url = URL.createObjectURL(data);

        const link = document.createElement('a');



        link.href = url;

        link.download = `${row.partner_name || 'MOU'}_MOU.pdf`;

        link.click();



        URL.revokeObjectURL(url);

        return;

      }



      if (row.document_content) {

        const parsed = JSON.parse(row.document_content);



        const html = buildHtml(

          parsed.templateHtml || DEFAULT_TEMPLATE,

          {

            ...INITIAL_FIELDS,

            ...(parsed.fields || {})

          }

        );



        const blob = await makePdfBlob(html);

        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');



        link.href = url;

        link.download = `${row.partner_name || 'MOU'}_MOU.pdf`;

        link.click();



        URL.revokeObjectURL(url);

      } else {

        toast.error('This MOU has no saved document. Open it in Builder and save it again.');

      }

    } catch (e: any) {

      toast.error(`Could not download MOU PDF: ${e.message || 'Unknown error'}`);

    }

  };



  const createTemplate = () => {

    setEditingTemplateId(null);

    setTemplateName('');

    setTemplateEditorHtml(DEFAULT_TEMPLATE);

    setShowTemplateEditor(true);

  };



  const editTemplate = (template: MouTemplate) => {

    setEditingTemplateId(template.id);

    setTemplateName(template.name);

    setTemplateEditorHtml(template.html_content || DEFAULT_TEMPLATE);

    setShowTemplateEditor(true);

  };



  const saveTemplate = async () => {

    const name = templateName.trim();

    const html = templateEditorHtml;



    if (!name || !html.trim()) {

      toast.error('Template name and HTML are required.');

      return;

    }



    if (templateSaving) return;



    setTemplateSaving(true);



    const isEditing = Boolean(editingTemplateId);



    try {

      const payload = {

        name,

        type: 'mou',

        html_content: html,

        updated_at: new Date().toISOString()

      };



      const writeRequest = isEditing

        ? supabase

            .from('templates')

            .update(payload)

            .eq('id', editingTemplateId as string)

            .eq('type', 'mou')

        : supabase

            .from('templates')

            .insert({

              name,

              type: 'mou',

              html_content: html

            });



      const timeout = new Promise<never>((_, reject) =>

        window.setTimeout(

          () => reject(new Error('Saving template timed out after 15 seconds. Check Supabase Network response and RLS policies.')),

          15000

        )

      );



      const result = await Promise.race([writeRequest, timeout]) as any;



      if (result.error) {

        const err = result.error;



        console.error('MOU template save failed:', {

          message: err.message,

          code: err.code,

          details: err.details,

          hint: err.hint

        });



        throw err;

      }



      if (isEditing && editingTemplateId) {

        setTemplates(previous => previous.map(item =>

          item.id === editingTemplateId

            ? { ...item, name, type: 'mou', html_content: html }

            : item

        ));

      }



      setEditingTemplateId(null);

      setTemplateName('');

      setTemplateEditorHtml(DEFAULT_TEMPLATE);

      setShowTemplateEditor(false);



      toast.success(

        isEditing

          ? 'Template update request completed. Refresh the template list to verify it.'

          : 'Template save request completed. Refresh the template list to verify it.'

      );



      void loadTemplates(true);

    } catch (error: unknown) {

      const dbError = error as {

        message?: string;

        code?: string;

        details?: string;

        hint?: string;

      };



      console.error('Could not save MOU template:', error);



      const message = [

        dbError?.message,

        dbError?.details,

        dbError?.hint

      ].filter(Boolean).join(' — ') || 'Unknown database error';



      toast.error(

        `Could not save template${dbError?.code ? ` (${dbError.code})` : ''}: ${message}`

      );

    } finally {

      setTemplateSaving(false);

    }

  };



  const deleteTemplate = async (id: string) => {

    if (!window.confirm('Delete this MOU template? Existing saved MOUs will not be deleted.')) {

      return;

    }



    const { error } = await supabase

      .from('templates')

      .delete()

      .eq('id', id)

      .eq('type', 'mou');



    if (error) {

      toast.error(`Could not delete template: ${error.message}`);

    } else {

      toast.success('Template deleted.');

      await loadTemplates();



      if (templateId === id) {

        setTemplateId('');

      }

    }

  };



  // Read contact information saved in the existing document_content JSON.
  const getAgreementFields = (row: AgreementRow): Record<string, string> => {

    if (!row.document_content) return {};



    try {

      const parsed = JSON.parse(row.document_content);

      return parsed.fields || {};

    } catch {

      return {};

    }

  };



  const filtered = agreements.filter(row => {

    const savedFields = getAgreementFields(row);



    const searchableText = [

      row.partner_name,

      row.type,

      row.status,

      row.partner_category,

      savedFields.contact_person,

      savedFields.contact_email,

      savedFields.contact_phone,

      savedFields.partner_address,

      savedFields.registration_number

    ]

      .filter(Boolean)

      .join(' ')

      .toLowerCase();



    return searchableText.includes(search.toLowerCase());

  });



  return (

    <div className="space-y-6 pb-10">

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>

          <div className="flex items-center gap-3">

            <div className="rounded-2xl bg-teal-700 p-3 text-white">

              <FileSignature size={24} />

            </div>

            <h1 className="text-3xl font-black tracking-tight text-slate-800">

              MOU Agreement Manager

            </h1>

          </div>



          <p className="mt-2 max-w-2xl text-sm text-slate-500">

            Create, reuse, edit, and export multiple Memorandums of Understanding using reusable templates and an A4 document builder.

          </p>

        </div>



        <button

          onClick={startNew}

          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-800"

        >

          <Plus size={17} /> New MOU

        </button>

      </header>



      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">

        {([

          ['list', FileText, 'All MOUs'],

          ['builder', FileSignature, 'MOU Builder'],

          ['templates', LayoutTemplate, 'Templates']

        ] as const).map(([key, Icon, label]) => (

          <button

            key={key}

            onClick={() => setTab(key)}

            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${

              tab === key

                ? 'bg-teal-50 text-teal-800'

                : 'text-slate-500 hover:bg-slate-50'

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

              placeholder="Search MOUs by partner, contact, email, phone, category, or status..."

              className="w-full py-3 outline-none"

            />

          </div>



          {loading ? (

            <div className="flex h-48 items-center justify-center gap-3 text-slate-500">

              <Loader2 className="animate-spin" /> Loading MOUs...

            </div>

          ) : filtered.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">

              <FileText className="mx-auto mb-3 text-slate-400" size={36} />

              <h3 className="font-bold text-slate-800">No MOUs found</h3>

              <p className="mt-1 text-sm text-slate-500">

                Create your first MOU or adjust your search.

              </p>

              <button

                onClick={startNew}

                className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white"

              >

                <Plus size={15} className="mr-1 inline" /> Create MOU

              </button>

            </div>

          ) : (

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

              {filtered.map(row => {

                const contact = getAgreementFields(row);



                return (

                  <article

                    key={row.id}

                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md"

                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="rounded-xl bg-teal-50 p-3 text-teal-700">

                        <FileText size={22} />

                      </div>

                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">

                        {row.status || 'Draft'}

                      </span>

                    </div>



                    <h3 className="mt-4 truncate text-lg font-black text-slate-800">

                      {row.partner_name}

                    </h3>



                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-teal-700">

                      MOU · {row.partner_category || 'Partner'}

                    </p>



                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">

                      <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-xs text-slate-500">Version</p>

                        <p className="font-bold text-slate-800">

                          {row.version || 'v1.0'}

                        </p>

                      </div>



                      <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-xs text-slate-500">Valid until</p>

                        <p className="font-bold text-slate-800">

                          {row.valid_until || 'Not set'}

                        </p>

                      </div>

                    </div>



                    <div className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">

                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">

                        Partner Contact Details

                      </p>



                      {contact.contact_person && (

                        <p className="text-sm text-slate-700">

                          <span className="font-semibold">Contact:</span>{' '}

                          {contact.contact_person}

                        </p>

                      )}



                      {contact.contact_email && (

                        <p className="break-all text-sm text-slate-700">

                          <span className="font-semibold">Email:</span>{' '}

                          {contact.contact_email}

                        </p>

                      )}



                      {contact.contact_phone && (

                        <p className="text-sm text-slate-700">

                          <span className="font-semibold">Phone:</span>{' '}

                          {contact.contact_phone}

                        </p>

                      )}



                      {contact.partner_address && (

                        <p className="text-sm text-slate-700">

                          <span className="font-semibold">Address:</span>{' '}

                          {contact.partner_address}

                        </p>

                      )}



                      {contact.registration_number && (

                        <p className="text-sm text-slate-700">

                          <span className="font-semibold">Registration:</span>{' '}

                          {contact.registration_number}

                        </p>

                      )}



                      {!contact.contact_person &&

                       !contact.contact_email &&

                       !contact.contact_phone &&

                       !contact.partner_address &&

                       !contact.registration_number && (

                        <p className="text-xs text-slate-400">

                          No additional contact details

                        </p>

                      )}

                    </div>



                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">

                      <button

                        onClick={() => void editAgreement(row)}

                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"

                      >

                        <Pencil size={14} /> Edit

                      </button>



                      <button

                        onClick={() => void downloadPdf(row)}

                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800"

                      >

                        <Download size={14} /> PDF

                      </button>

                    </div>

                  </article>

                );

              })}

            </div>

          )}

        </section>

      )}



      {tab === 'builder' && (

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">

          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">

            <div className="flex items-center justify-between gap-3">

              <div>

                <h2 className="text-xl font-black text-slate-800">

                  {selectedId ? 'Edit MOU' : 'Create MOU'}

                </h2>

                <p className="mt-1 text-sm text-slate-500">

                  Fill the variable fields; the selected template renders the document.

                </p>

              </div>



              <button

                onClick={() => setPreview(!preview)}

                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"

              >

                <Eye size={16} /> {preview ? 'Hide preview' : 'Preview'}

              </button>

            </div>



            <div className="grid gap-4 sm:grid-cols-2">

              <label className="block space-y-1.5 sm:col-span-2">

                <span className="text-xs font-bold text-slate-600">MOU Template</span>

                <select

                  value={templateId}

                  onChange={e => {

                    setTemplateId(e.target.value);

                    const t = templates.find(item => item.id === e.target.value);

                    setTemplateHtml(t?.html_content || DEFAULT_TEMPLATE);

                  }}

                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"

                >

                  <option value="">Default MOU template</option>

                  {templates.map(t => (

                    <option key={t.id} value={t.id}>{t.name}</option>

                  ))}

                </select>

              </label>



              <InputField

                label="Partner legal name *"

                field="partner_name"

                fields={fields}

                setField={setField}

                placeholder="Legal registered name"

              />



              <label className="block space-y-1.5">

                <span className="text-xs font-bold text-slate-600">Partner category *</span>

                <select

                  value={fields.partner_category}

                  onChange={e => setField('partner_category', e.target.value)}

                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"

                >

                  {PARTNER_CATEGORIES.map(category => (

                    <option key={category}>{category}</option>

                  ))}

                </select>

              </label>



              <InputField

                label="Version"

                field="version"

                fields={fields}

                setField={setField}

                placeholder="v1.0"

              />



              <InputField

                label="Effective date"

                field="effective_date"

                fields={fields}

                setField={setField}

                type="date"

              />



              <InputField

                label="Valid until *"

                field="valid_until"

                fields={fields}

                setField={setField}

                type="date"

              />



              <InputField

                label="HealthHub signatory"

                field="healthhub_signatory"

                fields={fields}

                setField={setField}

              />



              <InputField

                label="HealthHub signatory title"

                field="healthhub_title"

                fields={fields}

                setField={setField}

              />



              <InputField

                label="Partner signatory"

                field="partner_signatory"

                fields={fields}

                setField={setField}

              />



              <InputField

                label="Partner signatory title"

                field="partner_title"

                fields={fields}

                setField={setField}

              />



              {/* Additional partner contact fields */}

              <div className="sm:col-span-2">

                <h3 className="border-b border-slate-200 pb-2 text-sm font-black text-slate-800">

                  Partner Contact Information

                </h3>

              </div>



              <InputField

                label="Contact person name"

                field="contact_person"

                fields={fields}

                setField={setField}

                placeholder="Contact person's full name"

              />



              <InputField

                label="Contact email"

                field="contact_email"

                fields={fields}

                setField={setField}

                type="email"

                placeholder="contact@example.com"

              />



              <InputField

                label="Contact phone"

                field="contact_phone"

                fields={fields}

                setField={setField}

                type="tel"

                placeholder="+91 XXXXX XXXXX"

              />



              <InputField

                label="Registration / licence number"

                field="registration_number"

                fields={fields}

                setField={setField}

                placeholder="Registration or licence number"

              />



              <div className="sm:col-span-2">

                <TextAreaField

                  label="Partner address"

                  field="partner_address"

                  fields={fields}

                  setField={setField}

                  rows={2}

                />

              </div>



              <div className="sm:col-span-2">

                <TextAreaField

                  label="Purpose"

                  field="purpose"

                  fields={fields}

                  setField={setField}

                />

              </div>



              <div className="sm:col-span-2">

                <TextAreaField

                  label="Scope of collaboration"

                  field="scope"

                  fields={fields}

                  setField={setField}

                />

              </div>



              <div className="sm:col-span-2">

                <TextAreaField

                  label="Roles and responsibilities"

                  field="responsibilities"

                  fields={fields}

                  setField={setField}

                />

              </div>



              <div className="sm:col-span-2">

                <TextAreaField

                  label="Confidentiality and data use"

                  field="confidentiality"

                  fields={fields}

                  setField={setField}

                />

              </div>



              <div className="sm:col-span-2">

                <TextAreaField

                  label="General terms"

                  field="general_terms"

                  fields={fields}

                  setField={setField}

                />

              </div>

            </div>



            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">

              <button

                onClick={() => setPreview(true)}

                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"

              >

                <Eye size={16} /> Apply Details to Template

              </button>



              <button

                onClick={() => void saveMou()}

                disabled={saving}

                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"

              >

                {saving

                  ? <Loader2 size={16} className="animate-spin" />

                  : <Save size={16} />}

                {saving ? 'Saving MOU...' : 'Save MOU & PDF'}

              </button>



              {selectedId && (

                <button

                  onClick={startNew}

                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold"

                >

                  <FilePlus2 size={16} /> New MOU

                </button>

              )}

            </div>

          </div>



          <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${preview ? 'block' : 'hidden xl:block'}`}>

            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">

              <div>

                <h3 className="font-bold text-slate-800">A4 Document Preview</h3>

                <p className="text-xs text-slate-500">Live preview of the MOU template</p>

              </div>



              <button

                onClick={() => setPreview(false)}

                className="rounded-lg p-2 hover:bg-slate-200 xl:hidden"

              >

                <X size={16} />

              </button>

            </div>



            <div className="max-h-[1000px] overflow-auto bg-slate-100 p-3">

              <div

                className="mx-auto min-h-[842px] w-full max-w-[794px] bg-white shadow"

                dangerouslySetInnerHTML={{ __html: currentHtml }}

              />

            </div>

          </div>

        </section>

      )}



      {tab === 'templates' && (

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">

            <div className="flex items-center justify-between gap-3">

              <div>

                <h2 className="text-xl font-black text-slate-800">MOU Templates</h2>

                <p className="mt-1 text-sm text-slate-500">

                  Create reusable templates for different partnership types.

                </p>

              </div>



              <button

                onClick={createTemplate}

                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-sm font-bold text-white"

              >

                <Plus size={15} /> New

              </button>

            </div>



            {templates.length === 0 ? (

              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">

                No saved MOU templates yet. The default template is available in the Builder.

              </p>

            ) : (

              templates.map(template => (

                <div

                  key={template.id}

                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"

                >

                  <div className="min-w-0">

                    <p className="truncate font-bold text-slate-800">{template.name}</p>

                    <p className="text-xs text-slate-500">Reusable MOU template</p>

                  </div>



                  <div className="flex shrink-0 gap-1">

                    <button

                      onClick={() => editTemplate(template)}

                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"

                      title="Edit template"

                    >

                      <Pencil size={16} />

                    </button>



                    <button

                      onClick={() => void deleteTemplate(template.id)}

                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"

                      title="Delete template"

                    >

                      <Trash2 size={16} />

                    </button>

                  </div>

                </div>

              ))

            )}

          </div>



          {showTemplateEditor && (

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">

              <div>

                <h2 className="text-xl font-black text-slate-800">

                  {editingTemplateId ? 'Edit template' : 'Create template'}

                </h2>



                <p className="mt-1 text-sm text-slate-500">

                  Use placeholders such as{' '}

                  <code>{'{{partner_name}}'}</code>,{' '}

                  <code>{'{{valid_until}}'}</code>,{' '}

                  <code>{'{{scope}}'}</code>,{' '}

                  <code>{'{{contact_email}}'}</code>, and{' '}

                  <code>{'{{contact_phone}}'}</code>.

                  These are replaced by Builder values.

                </p>

              </div>



              <label className="block space-y-1.5">

                <span className="text-xs font-bold text-slate-600">Template name</span>

                <input

                  value={templateName}

                  onChange={e => setTemplateName(e.target.value)}

                  placeholder="e.g. Hospital Partnership MOU"

                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"

                />

              </label>



              <label className="block space-y-1.5">

                <span className="text-xs font-bold text-slate-600">Template HTML</span>

                <textarea

                  value={templateEditorHtml}

                  onChange={e => setTemplateEditorHtml(e.target.value)}

                  rows={18}

                  spellCheck={false}

                  className="w-full rounded-xl border border-slate-200 px-3 py-3 font-mono text-xs outline-none focus:border-teal-500"

                />

              </label>



              <div className="flex flex-wrap gap-2">

                <button

                  onClick={() => void saveTemplate()}

                  disabled={templateSaving}

                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"

                >

                  {templateSaving

                    ? <Loader2 size={16} className="animate-spin" />

                    : <Save size={16} />}

                  {templateSaving ? 'Saving...' : 'Save template'}

                </button>



                <button

                  onClick={createTemplate}

                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold"

                >

                  Clear

                </button>



                <button

                  onClick={() => setShowTemplateEditor(false)}

                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold"

                >

                  Cancel

                </button>

              </div>

            </div>

          )}

        </section>

      )}

    </div>

  );

};



export default AgreementModule;