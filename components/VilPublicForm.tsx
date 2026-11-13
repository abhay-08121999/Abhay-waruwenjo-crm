import React, { useState } from 'react';
import { CheckCircle2, FileText, Loader2, ShieldCheck, Upload, X, Camera, User, Users, Briefcase, Plane, Phone } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { uploadEnquiryDocument } from '../services/supabase.ts';

export const VIL_FILE_ITEMS = [
  {
    key: 'recent_photo',
    label: 'Recent colour photograph',
    help: '2 in × 2 in · JPEG · 10 KB – 1 MB · minimum 350 × 350 px · front-facing, plain white or light background.',
    photo: true,
  },
  { key: 'medical_invitation', label: 'Medical invitation letter (system-generated, Indian hospital)', help: 'The letter issued by the hospital in India.' },
  { key: 'proof_residence', label: 'Proof of residence (home country)', help: 'Any official document showing your current address.' },
  { key: 'proof_occupation', label: 'Proof of occupation', help: 'Employment letter, business registration or similar.' },
  { key: 'vaccination', label: 'Polio & Yellow Fever vaccination certificate', help: 'Both certificates in one file is fine.' },
];

export const VIL_TEXT_ITEMS = [
  { key: 'identification_marks', label: 'Visible identification marks', kind: 'textarea', placeholder: 'e.g. mole on left cheek, scar on right hand' },
  { key: 'education', label: 'Educational qualification', kind: 'textarea', placeholder: 'Highest qualification first, with institution and year' },
  { key: 'residential_address', label: 'Complete residential address', kind: 'textarea', placeholder: 'House no., street, city, province, postal code, country' },
  { key: 'father_name', label: "Father's full name" },
  { key: 'father_birthplace', label: "Father's birthplace" },
  { key: 'mother_name', label: "Mother's full name" },
  { key: 'mother_birthplace', label: "Mother's birthplace" },
  { key: 'spouse_name', label: "Spouse's full name", optional: true, hint: 'Leave blank if not married' },
  { key: 'spouse_birthplace', label: "Spouse's birthplace", optional: true, hint: 'Leave blank if not married' },
  { key: 'employer_name', label: 'Employer / business name' },
  { key: 'designation', label: 'Designation' },
  { key: 'employer_address', label: 'Employer / business address', kind: 'textarea' },
  { key: 'reference_name', label: 'Reference name (home country)' },
  { key: 'reference_address', label: 'Reference address (home country)', kind: 'textarea' },
  { key: 'reference_phone', label: 'Reference phone number', placeholder: 'Include country code' },
];

// Groups the same keys into sections so the form reads like a proper application.
const SECTIONS = [
  { title: 'Photograph', icon: Camera, files: ['recent_photo'], texts: [] as string[] },
  { title: 'Personal details', icon: User, files: [] as string[], texts: ['identification_marks', 'education', 'residential_address'] },
  { title: 'Family details', icon: Users, files: [] as string[], texts: ['father_name', 'father_birthplace', 'mother_name', 'mother_birthplace', 'spouse_name', 'spouse_birthplace'] },
  { title: 'Occupation', icon: Briefcase, files: ['proof_occupation'], texts: ['employer_name', 'designation', 'employer_address'] },
  { title: 'Residence & medical documents', icon: Plane, files: ['proof_residence', 'medical_invitation', 'vaccination'], texts: [] as string[] },
  { title: 'Reference in home country', icon: Phone, files: [] as string[], texts: ['reference_name', 'reference_address', 'reference_phone'] },
];

const FILE_BY_KEY: Record<string, any> = Object.fromEntries(VIL_FILE_ITEMS.map((i) => [i.key, i]));
const TEXT_BY_KEY: Record<string, any> = Object.fromEntries(VIL_TEXT_ITEMS.map((i) => [i.key, i]));

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const validatePhoto = (file: File) =>
  new Promise<string | null>((resolve) => {
    const isJpeg = /jpe?g/i.test(file.type) || /\.jpe?g$/i.test(file.name);
    if (!isJpeg) return resolve('Photo must be a JPEG (.jpg / .jpeg) file.');
    if (file.size < 10 * 1024) return resolve('Photo must be at least 10 KB.');
    if (file.size > 1024 * 1024) return resolve('Photo must be 1 MB or smaller.');

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      if (width < 350 || height < 350) resolve('Photo must be at least 350 × 350 pixels.');
      else if (Math.abs(width - height) / Math.max(width, height) > 0.05) resolve('Photo must be square (2 in × 2 in).');
      else resolve(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('Could not read this image.');
    };
    img.src = url;
  });

export default function VilPublicForm({ leadId }: { leadId: string }) {
  const [text, setText] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const totalFields = VIL_FILE_ITEMS.length + VIL_TEXT_ITEMS.length;
  const completed =
    VIL_FILE_ITEMS.filter((i) => files[i.key]).length +
    VIL_TEXT_ITEMS.filter((i) => (text[i.key] || '').trim()).length;
  const percent = totalFields ? Math.round((completed / totalFields) * 100) : 0;

  const handleFile = async (key: string, file: File | undefined, isPhoto: boolean) => {
    if (!file) return;
    if (isPhoto) {
      const err = await validatePhoto(file);
      if (err) {
        setErrors((e) => ({ ...e, [key]: err }));
        setFiles((f) => ({ ...f, [key]: null }));
        return;
      }
      setPreviews((p) => {
        if (p[key]) URL.revokeObjectURL(p[key]);
        return { ...p, [key]: URL.createObjectURL(file) };
      });
    }
    setErrors((e) => ({ ...e, [key]: '' }));
    setFiles((f) => ({ ...f, [key]: file }));
  };

  const removeFile = (key: string) => {
    setFiles((f) => ({ ...f, [key]: null }));
    setPreviews((p) => {
      if (p[key]) URL.revokeObjectURL(p[key]);
      const next = { ...p };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const documents: Record<string, unknown>[] = [];
      for (const item of VIL_FILE_ITEMS) {
        const original = files[item.key];
        if (!original) continue; // documents are optional
        setProgress(`Uploading ${item.label}…`);
        // Prefix the stored name so the CRM can match each upload to its VIL item.
        const renamed = new File([original], `VIL_${item.key}__${original.name}`, { type: original.type });
        const { data, error } = await uploadEnquiryDocument(leadId, renamed);
        if (error || !data) throw new Error(`Could not upload ${item.label}: ${error?.message || 'unknown error'}`);
        documents.push({
          field: item.key,
          file_name: data.file_name,
          file_path: data.file_path,
          file_url: data.file_url,
          mime_type: data.mime_type,
          file_size: data.file_size,
        });
      }

      setProgress('Saving your form…');
      const { error: rpcError } = await supabase.rpc('submit_vil_form', {
        p_lead_id: leadId,
        p_form: text,
        p_documents: documents,
      });
      if (rpcError) throw rpcError;
      setDone(true);
    } catch (err: any) {
      setSubmitError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 overflow-y-auto overscroll-contain flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full text-center space-y-4 bg-white p-10 rounded-3xl border border-slate-100 shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center">
            <CheckCircle2 className="text-teal-600" size={36} />
          </div>
          <h1 className="text-xl font-black text-slate-800">Thank you, your form is submitted</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            We have received your VIL medical visa form and documents. Our team will review them and contact you with the next steps.
          </p>
          <p className="text-[11px] text-slate-400">You can close this page now.</p>
        </div>
      </div>
    );
  }

  const renderFile = (key: string) => {
    const item = FILE_BY_KEY[key];
    const file = files[key];
    const preview = previews[key];
    return (
      <div key={key} id={`vil-${key}`} className="space-y-2">
        <div>
          <p className="text-sm font-bold text-slate-800">
            {item.label}
          </p>
          {item.help && <p className="text-[11px] text-slate-500 mt-0.5">{item.help}</p>}
        </div>

        {file ? (
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-teal-200 bg-teal-50/60">
            {preview ? (
              <img src={preview} alt="Photo preview" className="w-16 h-16 rounded-lg object-cover border border-white shadow-sm" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white border border-teal-100 flex items-center justify-center">
                <FileText size={22} className="text-teal-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-teal-800 truncate">{file.name}</p>
              <p className="text-[11px] text-teal-700">{formatSize(file.size)} · Ready to submit</p>
            </div>
            <button
              type="button"
              onClick={() => removeFile(key)}
              disabled={submitting}
              className="p-2 rounded-lg text-slate-500 hover:bg-white disabled:opacity-50"
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center gap-1 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
              errors[key] ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
            } ${submitting ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Upload size={20} className="text-indigo-500" />
            <span className="text-xs font-bold text-indigo-700">Choose file</span>
            <span className="text-[10px] text-slate-400">{item.photo ? 'JPEG only' : 'JPG, PNG or PDF'}</span>
            <input
              type="file"
              className="hidden"
              accept={item.photo ? 'image/jpeg' : 'image/*,application/pdf'}
              disabled={submitting}
              onChange={(e) => {
                handleFile(key, e.target.files?.[0], !!item.photo);
                e.target.value = '';
              }}
            />
          </label>
        )}
        {errors[key] && <p className="text-[11px] text-rose-600 font-bold">{errors[key]}</p>}
      </div>
    );
  };

  const renderText = (key: string) => {
    const item = TEXT_BY_KEY[key];
    const value = text[key] || '';
    const common = `w-full px-4 py-3 bg-white border rounded-xl text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 ${
      errors[key] ? 'border-rose-300' : 'border-slate-200'
    }`;
    return (
      <div key={key} id={`vil-${key}`} className={item.kind === 'textarea' ? 'md:col-span-2 space-y-1.5' : 'space-y-1.5'}>
        <label className="block text-sm font-bold text-slate-800">
          {item.label}
        </label>
        {item.hint && <p className="text-[11px] text-slate-400">{item.hint}</p>}
        {item.kind === 'textarea' ? (
          <textarea
            disabled={submitting}
            value={value}
            placeholder={item.placeholder}
            onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))}
            className={`${common} min-h-[90px]`}
          />
        ) : (
          <input
            disabled={submitting}
            value={value}
            placeholder={item.placeholder}
            onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))}
            className={common}
          />
        )}
        {errors[key] && <p className="text-[11px] text-rose-600 font-bold">{errors[key]}</p>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-contain bg-slate-50 pb-28">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 text-white">
        <div className="max-w-3xl mx-auto px-5 py-8 md:py-10">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">WaruWenJo Medical Tourism</p>
          <h1 className="text-2xl md:text-3xl font-black mt-2">VIL Medical Visa Application Form</h1>
          <p className="text-sm text-indigo-100 mt-2 leading-relaxed">
            Please fill in the details and upload the documents you have. You can submit even if some fields are left blank. Your information is shared only with our medical visa team.
          </p>
          <div className="mt-5 flex items-start gap-3 bg-white/10 rounded-2xl p-4">
            <ShieldCheck size={18} className="shrink-0 mt-0.5 text-indigo-100" />
            <p className="text-xs text-indigo-50 leading-relaxed">
              Photo: 2 in × 2 in, JPEG, 10 KB – 1 MB, minimum 350 × 350 px, front-facing with a plain white or light background. Do not crop your passport photo; upload a separate photograph.
            </p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-4">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{completed} of {totalFields} filled</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        {SECTIONS.map((section, idx) => {
          const Icon = section.icon;
          return (
            <section key={section.title} className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Section {idx + 1}</p>
                  <h2 className="text-base font-black text-slate-800">{section.title}</h2>
                </div>
              </div>

              <div className="space-y-6">
                {section.files.map(renderFile)}
                {section.texts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {section.texts.map(renderText)}
                  </div>
                )}
              </div>
            </section>
          );
        })}

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          {progress && (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> {progress}
            </p>
          )}
          {submitError && (
            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-700 font-bold">
              {submitError}
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            By submitting, you confirm that the information and documents are true and belong to you.
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit VIL Form'}
          </button>
        </div>
      </div>
    </div>
  );
}