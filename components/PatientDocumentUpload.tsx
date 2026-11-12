import React, { useRef, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, Plus, X, AlertCircle, FileText, IdCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { uploadEnquiryDocument } from '../services/supabase.ts';

type ItemStatus = 'pending' | 'uploading' | 'done' | 'error';
type UploadItem = { key: string; file: File; status: ItemStatus; error?: string };

const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// National ID files are stored with a prefix so the clinical team can tell them apart from medical documents.
const NATIONAL_ID_PREFIXES = { patient: 'NATIONAL_ID_PATIENT__', companion: 'NATIONAL_ID_COMPANION__' } as const;
type NationalIdKind = keyof typeof NATIONAL_ID_PREFIXES;

const readFlag = (key: string) => {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
};
const writeFlag = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* storage may be blocked */ }
};

// One upload box for a national ID card (patient or companion). At least one uploaded file is compulsory.
const NationalIdUploader: React.FC<{
  leadId: string;
  kind: NationalIdKind;
  label: string;
  hint: string;
  alreadyUploaded: boolean;
  onUploaded: () => void;
  onBusyChange: (busy: boolean) => void;
}> = ({ leadId, kind, label, hint, alreadyUploaded, onUploaded, onBusyChange }) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const doneCount = items.filter(i => i.status === 'done').length;
  const toUpload = items.filter(i => i.status === 'pending' || i.status === 'error');
  const isUploaded = alreadyUploaded || doneCount > 0;

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    setMessage('');
    setItems(prev => {
      const existing = new Set(prev.map(i => i.key));
      const fresh = incoming
        .filter(f => !existing.has(fileKey(f)))
        .map<UploadItem>(f => ({ key: fileKey(f), file: f, status: 'pending' }));
      return [...prev, ...fresh];
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));
  const patchItem = (key: string, patch: Partial<UploadItem>) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)));

  const submit = async () => {
    if (!toUpload.length) return setMessage(`Choose the ${label.toLowerCase()} national ID first.`);
    setUploading(true);
    onBusyChange(true);
    setMessage('');
    let ok = 0;
    let failed = 0;
    for (const item of toUpload) {
      patchItem(item.key, { status: 'uploading', error: undefined });
      const taggedFile = new File([item.file], `${NATIONAL_ID_PREFIXES[kind]}${item.file.name}`, {
        type: item.file.type,
        lastModified: item.file.lastModified,
      });
      const result = await uploadEnquiryDocument(leadId, taggedFile);
      if (result.error) {
        console.error('National ID upload failed:', result.error);
        failed += 1;
        patchItem(item.key, { status: 'error', error: result.error.message || 'Upload failed. Please try again.' });
      } else {
        ok += 1;
        patchItem(item.key, { status: 'done' });
      }
    }
    setUploading(false);
    onBusyChange(false);
    if (ok) onUploaded();
    setMessage(failed ? `${ok} uploaded, ${failed} failed. Fix or remove the failed file(s) and try again.` : '');
  };

  return (
    <div className={`p-4 rounded-2xl border ${isUploaded ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">{label} national ID <span className="text-rose-500">*</span></p>
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        </div>
        {isUploaded
          ? <span className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">Uploaded</span>
          : <span className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest">Required</span>}
      </div>

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(e) => addFiles(e.target.files)}
      />

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!uploading) addFiles(e.dataTransfer.files); }}
        className="mt-3 w-full border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-xl p-4 text-center cursor-pointer transition-colors"
      >
        <IdCard className="mx-auto text-teal-600" size={20} />
        <p className="text-xs font-bold text-slate-700 mt-1.5">{items.length || isUploaded ? 'Add another file (e.g. back side)' : `Choose the ${label.toLowerCase()} national ID`}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">PDF, JPG, JPEG or PNG. You can add front and back sides.</p>
      </div>

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map(item => (
            <li key={item.key} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <FileText size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{item.file.name}</p>
                <p className="text-[10px] text-slate-400">{formatSize(item.file.size)}</p>
                {item.status === 'error' && <p className="text-[11px] text-rose-600 mt-1">{item.error}</p>}
              </div>
              {item.status === 'uploading' && <Loader2 size={16} className="animate-spin text-teal-600 shrink-0" />}
              {item.status === 'done' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
              {item.status === 'error' && <AlertCircle size={16} className="text-rose-600 shrink-0" />}
              {(item.status === 'pending' || item.status === 'error') && !uploading && (
                <button onClick={() => removeItem(item.key)} aria-label={`Remove ${item.file.name}`} className="text-slate-400 hover:text-rose-600 shrink-0">
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {message && <p className="text-xs mt-3 text-rose-600">{message}</p>}

      {toUpload.length > 0 && (
        <button
          onClick={submit}
          disabled={uploading}
          className="mt-3 w-full py-3 rounded-xl bg-teal-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
        >
          {uploading
            ? <><Loader2 className="inline mr-2 animate-spin" size={14} /> Uploading...</>
            : `Upload ${label.toLowerCase()} ID`}
        </button>
      )}
    </div>
  );
};

const PatientDocumentUpload: React.FC<{ leadId: string }> = ({ leadId }) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  // 'form' = medical documents, 'national_id' = step 2 (patient + companion national ID, compulsory),
  // 'thanks' = just confirmed, 'recorded' = confirmed earlier (page reopened)
  const storageKey = `documents_confirmed_${leadId}`;
  const stepKey = `documents_step_${leadId}`;
  const patientIdKey = `national_id_patient_${leadId}`;
  const companionIdKey = `national_id_companion_${leadId}`;
  const [view, setView] = useState<'form' | 'national_id' | 'thanks' | 'recorded'>(() => {
    if (readFlag(storageKey)) return 'recorded';
    try {
      return localStorage.getItem(stepKey) === 'national_id' ? 'national_id' : 'form';
    } catch {
      return 'form';
    }
  });
  const [patientIdUploaded, setPatientIdUploaded] = useState(() => readFlag(patientIdKey));
  const [companionIdUploaded, setCompanionIdUploaded] = useState(() => readFlag(companionIdKey));
  const [idUploadBusy, setIdUploadBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doneCount = items.filter(i => i.status === 'done').length;
  const toUpload = items.filter(i => i.status === 'pending' || i.status === 'error');

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    setMessage('');
    setItems(prev => {
      const existing = new Set(prev.map(i => i.key));
      const fresh = incoming
        .filter(f => !existing.has(fileKey(f)))
        .map<UploadItem>(f => ({ key: fileKey(f), file: f, status: 'pending' }));
      return [...prev, ...fresh];
    });
    // Allow picking the same file again later.
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));

  const patchItem = (key: string, patch: Partial<UploadItem>) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)));

  const submit = async () => {
    if (!toUpload.length) return setMessage('Add at least one document to upload.');
    setUploading(true);
    setMessage('');
    let ok = 0;
    let failed = 0;
    // Upload one by one; a failed file does not stop the others.
    for (const item of toUpload) {
      patchItem(item.key, { status: 'uploading', error: undefined });
      const result = await uploadEnquiryDocument(leadId, item.file);
      if (result.error) {
        console.error('Document upload failed:', result.error);
        failed += 1;
        patchItem(item.key, { status: 'error', error: result.error.message || 'Upload failed. Please try again.' });
      } else {
        ok += 1;
        patchItem(item.key, { status: 'done' });
      }
    }
    setUploading(false);
    setMessage(
      failed
        ? `${ok} uploaded, ${failed} failed. Fix or remove the failed file(s) and press upload again.`
        : `${ok} document${ok === 1 ? '' : 's'} uploaded. Add more, or press Next when you are done.`
    );
  };

  // Step 1 -> step 2: medical documents are uploaded, now the national IDs are required.
  const goToNationalId = () => {
    writeFlag(stepKey, 'national_id');
    setView('national_id');
  };

  const backToDocuments = () => {
    writeFlag(stepKey, 'form');
    setView('form');
  };

  const confirmDocuments = () => {
    // National ID of both the patient and the companion is compulsory.
    if (!patientIdUploaded || !companionIdUploaded) return;
    writeFlag(storageKey, '1');
    setView('thanks');
  };

  // Closes this page and returns the patient to their email inbox.
  // Browsers only allow closing a tab that was opened by a script or a link, so if the tab
  // stays open we send the patient to their inbox instead.
  const exitToEmail = () => {
    window.close();
    setTimeout(() => {
      window.location.href = 'https://mail.google.com/mail/u/0/#inbox';
    }, 300);
  };

  if (view === 'recorded') {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <section className="w-full max-w-xl bg-white rounded-[2rem] p-8 shadow-2xl text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Your response is recorded</h1>
          <p className="text-sm text-slate-500 mt-3">
            Thank you. We have your documents, and our clinical team will review them and get back to you shortly.
          </p>
          <button
            onClick={exitToEmail}
            className="mt-8 w-full py-4 rounded-2xl bg-teal-600 text-white font-black uppercase tracking-widest hover:bg-teal-700 transition-all"
          >
            Exit
          </button>
        </section>
      </main>
    );
  }

  if (view === 'thanks') {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <section className="w-full max-w-xl bg-white rounded-[2rem] p-8 shadow-2xl text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Thank you!</h1>
          <p className="text-sm text-slate-500 mt-3">
            We have received {doneCount} document{doneCount === 1 ? '' : 's'}. Our clinical team will review them and get back to you shortly.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('form')}
              className="w-full py-4 rounded-2xl bg-slate-100 text-slate-700 font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Back
            </button>
            <button
              onClick={exitToEmail}
              className="w-full py-4 rounded-2xl bg-teal-600 text-white font-black uppercase tracking-widest hover:bg-teal-700 transition-all"
            >
              Exit
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (view === 'national_id') {
    const canConfirm = patientIdUploaded && companionIdUploaded && !idUploadBusy;
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <section className="w-full max-w-xl bg-white rounded-[2rem] p-8 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-5"><IdCard size={28} /></div>
          <p className="text-[11px] font-black uppercase tracking-widest text-teal-700">Step 2 of 2</p>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Submit national ID</h1>
          <p className="text-sm text-slate-500 mt-2">
            Please upload a national ID card for the patient and for the companion. Both are required to complete your submission.
          </p>

          <div className="mt-6 space-y-4">
            <NationalIdUploader
              leadId={leadId}
              kind="patient"
              label="Patient"
              hint="Government-issued national ID of the patient."
              alreadyUploaded={patientIdUploaded}
              onUploaded={() => { writeFlag(patientIdKey, '1'); setPatientIdUploaded(true); }}
              onBusyChange={setIdUploadBusy}
            />
            <NationalIdUploader
              leadId={leadId}
              kind="companion"
              label="Companion"
              hint="Government-issued national ID of the person travelling with the patient."
              alreadyUploaded={companionIdUploaded}
              onUploaded={() => { writeFlag(companionIdKey, '1'); setCompanionIdUploaded(true); }}
              onBusyChange={setIdUploadBusy}
            />
          </div>

          {!canConfirm && !idUploadBusy && (
            <p className="text-xs text-rose-600 mt-4">
              {!patientIdUploaded && !companionIdUploaded
                ? 'The patient and companion national IDs are both required.'
                : !patientIdUploaded
                  ? 'The patient national ID is required.'
                  : 'The companion national ID is required.'}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={backToDocuments}
              disabled={idUploadBusy}
              className="w-full py-4 rounded-2xl bg-slate-100 text-slate-700 font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-60"
            >
              <ChevronLeft size={16} className="inline mr-1" /> Back
            </button>
            <button
              onClick={confirmDocuments}
              disabled={!canConfirm}
              className="w-full py-4 rounded-2xl bg-teal-600 text-white font-black uppercase tracking-widest hover:bg-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </div>
        </section>
      </main>
    );
  }

  const readyToConfirm = doneCount > 0 && toUpload.length === 0 && !uploading;

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <section className="w-full max-w-xl bg-white rounded-[2rem] p-8 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-5"><FileUp size={28} /></div>
        <p className="text-[11px] font-black uppercase tracking-widest text-teal-700">Step 1 of 2</p>
        <h1 className="text-2xl font-black text-slate-900 mt-1">Upload medical documents</h1>
        <p className="text-sm text-slate-500 mt-2">
          Upload reports, test results, X-rays, MRI/CT scans, prescriptions, or previous treatment records for your medical enquiry.
        </p>

        {doneCount > 0 && !uploading && (
          <div className="mt-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold flex gap-3 text-sm">
            <CheckCircle2 className="shrink-0" size={20} />
            <span>{doneCount} document{doneCount === 1 ? '' : 's'} received. Our clinical team will review them shortly. You can keep adding more.</span>
          </div>
        )}

        <input
          ref={inputRef}
          className="hidden"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => addFiles(e.target.files)}
        />

        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (!uploading) addFiles(e.dataTransfer.files); }}
          className="mt-6 w-full border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-2xl p-6 text-center cursor-pointer transition-colors"
        >
          <Plus className="mx-auto text-teal-600" size={22} />
          <p className="text-sm font-bold text-slate-700 mt-2">{items.length ? 'Add more documents' : 'Choose documents or drop them here'}</p>
          <p className="text-xs text-slate-400 mt-1">PDF, JPG, JPEG or PNG, up to 20 MB each. Other image formats (such as WEBP) are converted automatically. Select several files at once, or add them one at a time.</p>
        </div>

        {items.length > 0 && (
          <ul className="mt-4 space-y-2 max-h-72 overflow-auto">
            {items.map(item => (
              <li key={item.key} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <FileText size={18} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.file.name}</p>
                  <p className="text-[10px] text-slate-400">{formatSize(item.file.size)}</p>
                  {item.status === 'error' && <p className="text-[11px] text-rose-600 mt-1">{item.error}</p>}
                </div>
                {item.status === 'uploading' && <Loader2 size={16} className="animate-spin text-teal-600 shrink-0" />}
                {item.status === 'done' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
                {item.status === 'error' && <AlertCircle size={16} className="text-rose-600 shrink-0" />}
                {(item.status === 'pending' || item.status === 'error') && !uploading && (
                  <button onClick={() => removeItem(item.key)} aria-label={`Remove ${item.file.name}`} className="text-slate-400 hover:text-rose-600 shrink-0">
                    <X size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {message && <p className={`text-sm mt-4 ${message.includes('failed') || message.startsWith('Add at least') ? 'text-rose-600' : 'text-slate-600'}`}>{message}</p>}

        {readyToConfirm ? (
          <button
            onClick={goToNationalId}
            className="mt-6 w-full py-4 rounded-2xl bg-teal-600 text-white font-black uppercase tracking-widest hover:bg-teal-700 transition-all"
          >
            Next <ChevronRight size={16} className="inline ml-1" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={uploading || toUpload.length === 0}
            className="mt-6 w-full py-4 rounded-2xl bg-teal-600 text-white font-black uppercase tracking-widest disabled:opacity-60"
          >
            {uploading
              ? <><Loader2 className="inline mr-2 animate-spin" size={16} /> Uploading...</>
              : toUpload.length
                ? `Upload ${toUpload.length} document${toUpload.length === 1 ? '' : 's'}`
                : 'Upload documents'}
          </button>
        )}
      </section>
    </main>
  );
};

export default PatientDocumentUpload;