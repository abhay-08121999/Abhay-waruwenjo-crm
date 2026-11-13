import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Eye, EyeOff, ExternalLink, RefreshCw, FileText, CheckCircle2, Send, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { sendQuotationEmail } from '../lib/quotationEmail';

interface LeadQuotationPanelProps {
  lead: {
    id: string;
    name?: string;
    email?: string;
  };
  /** Quotation the patient chose (saved in the lead's Stage 6 data) */
  selectedQuotationId?: string | null;
  /** When the chosen quotation was emailed to the patient */
  selectedQuotationSentAt?: string | null;
  /** Called when staff record which quotation the patient chose */
  onSelectQuotation?: (quotation: { id: string; label: string; total: number; currency: string }) => void;
  /** Called after the chosen quotation was emailed successfully */
  onQuotationSent?: (quotation: { id: string; label: string }) => void;
  readOnly?: boolean;
}

type QuotationItem = {
  id: string;
  pdfPath: string;
  pdfUrl: string;
  generatedAt: string;
  currency: string;
  total: number;
};

const LeadQuotationPanel: React.FC<LeadQuotationPanelProps> = ({
  lead,
  selectedQuotationId = null,
  selectedQuotationSentAt = null,
  onSelectQuotation,
  onQuotationSent,
  readOnly = false,
}) => {
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // All quotation PDFs saved for this lead in the Quotations module, newest first
  useEffect(() => {
    let cancelled = false;
    const loadQuotations = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('quotations')
        .select('id, pdf_path, pdf_generated_at, currency, total_amount')
        .eq('lead_id', lead.id)
        .not('pdf_path', 'is', null)
        .order('pdf_generated_at', { ascending: false });
      if (cancelled) return;
      setLoading(false);

      if (error) {
        console.error('Error loading quotations:', error);
        setQuotations([]);
        return;
      }

      setQuotations(
        (data || []).map((row: any) => ({
          id: row.id,
          pdfPath: row.pdf_path,
          pdfUrl: supabase.storage.from('quotation-pdfs').getPublicUrl(row.pdf_path).data.publicUrl,
          generatedAt: row.pdf_generated_at,
          currency: row.currency,
          total: row.total_amount,
        })),
      );
    };
    loadQuotations();
    return () => {
      cancelled = true;
    };
  }, [lead.id, refreshKey]);

  // Reload the list when the staff member returns from the Quotations module
  useEffect(() => {
    const onFocus = () => setRefreshKey((k) => k + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Opens the Quotations module, pre-selecting this patient.
  // Without a quotation id it starts a NEW quotation; with one it opens that quotation for editing.
  const openQuotations = (quotationId?: string) => {
    sessionStorage.setItem('quotation_prefill_lead_id', lead.id);
    if (quotationId) sessionStorage.setItem('quotation_open_id', quotationId);
    else sessionStorage.removeItem('quotation_open_id');
    window.location.hash = '#/quotations';
  };

  const labelFor = (q: QuotationItem) => {
    const idx = quotations.findIndex((item) => item.id === q.id);
    return `Quotation ${quotations.length - idx}`;
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read the quotation PDF.'));
      reader.readAsDataURL(blob);
    });

  const selectQuotation = (q: QuotationItem) => {
    if (readOnly || !onSelectQuotation) return;
    setSendMessage(null);
    onSelectQuotation({ id: q.id, label: labelFor(q), total: Number(q.total || 0), currency: q.currency });
  };

  // Emails ONLY the quotation the patient chose
  const sendSelectedQuotation = async () => {
    const chosen = quotations.find((q) => q.id === selectedQuotationId);
    if (!chosen) {
      setSendMessage({ type: 'error', text: 'Select the quotation the patient chose first.' });
      return;
    }
    if (!lead.email) {
      setSendMessage({ type: 'error', text: 'This lead has no email address. Add one before sending.' });
      return;
    }
    setSending(true);
    setSendMessage(null);
    try {
      const { data: blob, error } = await supabase.storage.from('quotation-pdfs').download(chosen.pdfPath);
      if (error || !blob) throw new Error(error?.message || 'Could not download the quotation PDF.');
      const pdfBase64 = await blobToBase64(blob);
      await sendQuotationEmail({ toEmail: lead.email, toName: lead.name || 'Patient', pdfBase64 });
      setSendMessage({ type: 'success', text: `${labelFor(chosen)} sent to ${lead.email}.` });
      onQuotationSent?.({ id: chosen.id, label: labelFor(chosen) });
    } catch (e: any) {
      console.error('Send quotation failed:', e);
      setSendMessage({ type: 'error', text: e?.message || 'Quotation could not be sent.' });
    } finally {
      setSending(false);
    }
  };

  const btnPrimary = 'flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm';
  const btnSoft = 'flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all';
  const btnGreen = 'flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all';

  const chosenQuotation = quotations.find((q) => q.id === selectedQuotationId) || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap pl-1">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
          Quotations {quotations.length > 0 && <span className="text-indigo-600">({quotations.length})</span>}
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => openQuotations()} className={btnPrimary}>
            <Plus size={12} /> Create Quotation
          </button>
        </div>
      </div>

      {quotations.length === 0 ? (
        <div className="p-8 border-2 border-dashed border-slate-100 rounded-[2rem] text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {loading ? 'Loading quotations...' : 'No quotation PDF yet'}
          </p>
        </div>
      ) : (
        <>
          {quotations.length > 1 && !selectedQuotationId && (
            <p className="text-[10px] font-bold text-slate-500 pl-1">
              The patient has {quotations.length} quotations to choose from. Mark the one they selected, then email it.
            </p>
          )}

          {quotations.map((q, idx) => {
            const isOpen = expandedId === q.id;
            const isChosen = q.id === selectedQuotationId;
            return (
              <div
                key={q.id}
                className={`bg-white border rounded-2xl overflow-hidden ${isChosen ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-100'}`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isChosen ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {isChosen ? <CheckCircle2 size={16} /> : <FileText size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-800">
                        Quotation {quotations.length - idx} · {q.currency} {Number(q.total || 0).toLocaleString()}
                        {isChosen && <span className="ml-2 text-[9px] text-emerald-600 uppercase tracking-widest">Patient's choice</span>}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        Generated {new Date(q.generatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!readOnly && onSelectQuotation && !isChosen && (
                      <button onClick={() => selectQuotation(q)} className={btnGreen}>
                        <CheckCircle2 size={12} /> Patient selected this
                      </button>
                    )}
                    <button onClick={() => setExpandedId(isOpen ? null : q.id)} className={btnSoft}>
                      {isOpen ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Preview</>}
                    </button>
                    <button onClick={() => openQuotations(q.id)} className={btnSoft}>
                      <Pencil size={12} /> Edit
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quotation PDF</p>
                      <a href={q.pdfUrl} target="_blank" rel="noreferrer" className={btnSoft}>
                        <ExternalLink size={12} /> Open in new tab
                      </a>
                    </div>
                    <iframe src={q.pdfUrl} title={`Quotation ${quotations.length - idx}`} className="w-full h-[600px]" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Patient's choice: the one quotation that gets emailed */}
          {selectedQuotationId && (
            <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3">
              <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Patient's Choice</p>
              {chosenQuotation ? (
                <p className="text-xs font-black text-slate-800">
                  {labelFor(chosenQuotation)} · {chosenQuotation.currency} {Number(chosenQuotation.total || 0).toLocaleString()}
                </p>
              ) : (
                <p className="text-xs font-bold text-amber-700">
                  The selected quotation is no longer in the list. Select the patient's quotation again.
                </p>
              )}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[10px] font-bold text-slate-500">
                  {selectedQuotationSentAt
                    ? `Emailed to ${lead.email || 'patient'} on ${new Date(selectedQuotationSentAt).toLocaleString()}`
                    : 'Not emailed to the patient yet'}
                </p>
                {!readOnly && (
                  <button
                    onClick={sendSelectedQuotation}
                    disabled={sending || !chosenQuotation}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {sending ? 'Sending...' : selectedQuotationSentAt ? 'Resend selected quotation' : 'Send selected quotation'}
                  </button>
                )}
              </div>
              {sendMessage && (
                <p className={`text-[10px] font-bold ${sendMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {sendMessage.text}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeadQuotationPanel;