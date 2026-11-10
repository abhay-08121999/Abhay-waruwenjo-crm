import React, { useRef, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, Plus, X, AlertCircle, FileText } from 'lucide-react';
import { uploadEnquiryDocument } from '../services/supabase.ts';

type ItemStatus = 'pending' | 'uploading' | 'done' | 'error';
type UploadItem = { key: string; file: File; status: ItemStatus; error?: string };

const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const PatientDocumentUpload: React.FC<{ leadId: string }> = ({ leadId }) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  // 'form' = upload screen, 'thanks' = just confirmed, 'recorded' = confirmed earlier (page reopened)
  const storageKey = `documents_confirmed_${leadId}`;
  const [view, setView] = useState<'form' | 'thanks' | 'recorded'>(() => {
    try {
      return localStorage.getItem(storageKey) === '1' ? 'recorded' : 'form';
    } catch {
      return 'form';
    }
  });
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
        : `${ok} document${ok === 1 ? '' : 's'} uploaded. Add more, or press Confirm when you are done.`
    );
  };

  const confirmDocuments = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // Storage may be blocked; the thank-you screen still shows for this visit.
    }
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

  const readyToConfirm = doneCount > 0 && toUpload.length === 0 && !uploading;

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <section className="w-full max-w-xl bg-white rounded-[2rem] p-8 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-5"><FileUp size={28} /></div>
        <h1 className="text-2xl font-black text-slate-900">Upload medical documents</h1>
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
            onClick={confirmDocuments}
            className="mt-6 w-full py-4 rounded-2xl bg-teal-600 text-white font-black uppercase tracking-widest hover:bg-teal-700 transition-all"
          >
            Confirm
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