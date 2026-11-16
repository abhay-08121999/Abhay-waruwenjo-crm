import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

type QuotationOption = {
  id: string;
  no: number;
  label: string;
  total: number;
  currency: string;
  pdf_path: string;
};

interface QuotationChoicePageProps {
  token: string;
  /** Quotation id pre-selected from the email button (?choose=<id>) */
  initialChoice?: string | null;
}

/**
 * Public page (no login) that the patient opens from the quotation options email.
 * Shows every quotation, lets them pick one and confirm it.
 */
const QuotationChoicePage: React.FC<QuotationChoicePageProps> = ({ token, initialChoice = null }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<QuotationOption[]>([]);
  const [savedChoiceNo, setSavedChoiceNo] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialChoice);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmedLabel, setConfirmedLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('get_quotation_choice_options', { p_token: token });
      if (cancelled) return;
      setLoading(false);

      if (rpcError || !data?.ok) {
        setError(data?.message || rpcError?.message || 'This link is not valid.');
        return;
      }
      const list: QuotationOption[] = data.options || [];
      setOptions(list);
      setSavedChoiceNo(data.chosen_no ?? null);
      setSelectedId((prev) => {
        if (prev) return prev;
        const saved = list.find((o) => o.no === data.chosen_no);
        return saved ? saved.id : null;
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pdfUrlFor = (path: string) => supabase.storage.from('quotation-pdfs').getPublicUrl(path).data.publicUrl;

  const confirmChoice = async () => {
    const option = options.find((o) => o.id === selectedId);
    if (!option || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    const { data, error: rpcError } = await supabase.rpc('submit_quotation_choice', {
      p_token: token,
      p_selected_no: option.no,
    });
    setSubmitting(false);

    if (rpcError || !data?.ok) {
      setSubmitError(data?.message || rpcError?.message || 'Your choice could not be saved. Please try again.');
      return;
    }
    setSavedChoiceNo(option.no);
    setConfirmedLabel(data.label || option.label);
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-teal-700">WaruWenJo</p>
          <p className="text-xs text-slate-500">Medical Tourism</p>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Loading your quotations…
      </div>,
    );
  }

  if (error) {
    return shell(
      <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center space-y-3">
        <h1 className="text-lg font-black text-slate-800">Link unavailable</h1>
        <p className="text-sm text-slate-600">{error}</p>
      </div>,
    );
  }

  if (confirmedLabel) {
    return shell(
      <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center">
          <CheckCircle2 className="text-teal-600" size={30} />
        </div>
        <h1 className="text-xl font-black text-slate-800">Thank you, your choice is recorded</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          You chose <strong>{confirmedLabel}</strong>. Our team will contact you with the next steps.
        </p>
      </div>,
    );
  }

  return shell(
    <>
      <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-2">
        <h1 className="text-lg font-black text-slate-800">Choose your quotation</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Review each quotation below, then select the one you would like to proceed with and confirm.
        </p>
      </div>

      <div className="space-y-3">
        {options.map((o) => {
          const isSelected = selectedId === o.id;
          return (
            <button
              type="button"
              key={o.id}
              onClick={() => setSelectedId(o.id)}
              className={`w-full text-left bg-white rounded-2xl p-5 border-2 transition-all ${
                isSelected ? 'border-teal-500 ring-4 ring-teal-50' : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {isSelected ? <CheckCircle2 size={18} /> : <FileText size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800">{o.label}</p>
                    <p className="text-xs font-bold text-slate-500">
                      Total: {o.currency} {Number(o.total || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <a
                  href={pdfUrlFor(o.pdf_path)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-teal-700 hover:underline"
                >
                  <ExternalLink size={12} /> View PDF
                </a>
              </div>
              {savedChoiceNo === o.no && (
                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-emerald-700">Your current choice</p>
              )}
            </button>
          );
        })}
      </div>

      {submitError && <p className="text-sm font-bold text-rose-600 text-center">{submitError}</p>}

      <button
        type="button"
        onClick={confirmChoice}
        disabled={!selectedId || submitting}
        className="w-full p-4 rounded-2xl bg-teal-600 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting ? 'Saving…' : 'Confirm my choice'}
      </button>
    </>,
  );
};

export default QuotationChoicePage;