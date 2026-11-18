import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Eye, EyeOff, ExternalLink, RefreshCw, FileText, CheckCircle2, Send, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { sendCrmEmail } from '../services/supabase';
import { buildQuotationChoiceEmailHtml } from '../lib/quotationChoiceEmail';

interface LeadQuotationPanelProps {
  lead: {
    id: string;
    name?: string;
    email?: string;
  };
  /** Quotation number the patient picked (1, 2, ...) from patient_enquiries.selected_quotation_no */
  selectedQuotationNo?: number | null;
  /** When the patient made that choice */
  selectedQuotationAt?: string | null;
  /** When the quotation options email was sent (from patient_enquiries.quotation_choice.sent_at) */
  optionsSentAt?: string | null;
  /** Staff fallback: record the patient's choice manually (e.g. patient told us by phone) */
  onSelectQuotation?: (quotation: { no: number; id: string; label: string; total: number; currency: string }) => void;
  /** Called after the options email was sent successfully */
  onOptionsSent?: (info: { token: string; sentAt: string }) => void;
  /** Re-reads the patient's choice from the database */
  onRefreshChoice?: () => void;
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
  selectedQuotationNo = null,
  selectedQuotationAt = null,
  optionsSentAt = null,
  onSelectQuotation,
  onOptionsSent,
  onRefreshChoice,
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

  // Quotation number: oldest = 1, newest = highest. Older numbers stay the same when new quotations are added.
  const numberFor = (q: QuotationItem) => {
    const idx = quotations.findIndex((item) => item.id === q.id);
    return quotations.length - idx;
  };

  const chosenQuotation = quotations.find((q) => numberFor(q) === selectedQuotationNo) || null;

  const selectQuotation = (q: QuotationItem) => {
    if (readOnly || !onSelectQuotation) return;
    setSendMessage(null);
    onSelectQuotation({
      no: numberFor(q),
      id: q.id,
      label: `Quotation ${numberFor(q)}`,
      total: Number(q.total || 0),
      currency: q.currency,
    });
  };

  // Sends ALL quotations as options; the patient clicks the one they want in the email
  const sendQuotationOptions = async () => {
    if (quotations.length === 0) {
      setSendMessage({ type: 'error', text: 'Create at least one quotation PDF first.' });
      return;
    }
    if (!lead.email) {
      setSendMessage({ type: 'error', text: 'This lead has no email address. Add one before sending.' });
      return;
    }
    setSending(true);
    setSendMessage(null);
    try {
      const options = quotations.map((q) => ({
        no: numberFor(q),
        id: q.id,
        label: `Quotation ${numberFor(q)}`,
        total: Number(q.total || 0),
        currency: q.currency,
        pdf_path: q.pdfPath,
      }));

      // 1. Store the options on the lead and get the secure token for the choice page
      const { data: token, error: rpcError } = await supabase.rpc('create_quotation_choice_request', {
        p_lead_id: lead.id,
        p_options: options,
      });
      if (rpcError || !token) throw new Error(rpcError?.message || 'Could not create the quotation choice link.');

      // 2. Email the options
      const choiceBaseUrl = `${window.location.origin}${window.location.pathname}#/quotation-choice/${token}`;
      const html = buildQuotationChoiceEmailHtml({
        patientName: lead.name || 'Patient',
        options: quotations.map((q) => ({
          id: q.id,
          label: `Quotation ${numberFor(q)}`,
          total: Number(q.total || 0),
          currency: q.currency,
          pdfUrl: q.pdfUrl,
        })),
        choiceBaseUrl,
      });
      const result = await sendCrmEmail(
        lead.email,
        'Please choose your medical tourism quotation - WaruWenJo',
        html,
        lead.name || 'Patient',
      );
      if (!result.success) throw new Error(result.error || 'Email could not be sent');

      const sentAt = new Date().toISOString();
      setSendMessage({ type: 'success', text: `${quotations.length} quotation option(s) sent to ${lead.email}.` });
      onOptionsSent?.({ token: String(token), sentAt });
    } catch (e: any) {
      console.error('Send quotation options failed:', e);
      setSendMessage({ type: 'error', text: e?.message || 'Quotation options could not be sent.' });
    } finally {
      setSending(false);
    }
  };

  const btnPrimary = 'flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm';
  const btnSoft = 'flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all';
  const btnGreen = 'flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all';

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
          {quotations.map((q) => {
            const no = numberFor(q);
            const isOpen = expandedId === q.id;
            const isChosen = no === selectedQuotationNo;
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
                        Quotation {no} · {q.currency} {Number(q.total || 0).toLocaleString()}
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
                    {!readOnly && (
                      <button onClick={() => openQuotations(q.id)} className={btnSoft}>
                        <Pencil size={12} /> Edit
                      </button>
                    )}
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
                    <iframe src={q.pdfUrl} title={`Quotation ${no}`} className="w-full h-[600px]" />
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Options email + patient's choice status */}
      {quotations.length > 0 && (
        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3">
          <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Patient Quotation Choice</p>

          <p className="text-xs font-bold text-slate-700">
            {selectedQuotationNo
              ? chosenQuotation
                ? `Patient chose: Quotation ${selectedQuotationNo} · ${chosenQuotation.currency} ${Number(chosenQuotation.total || 0).toLocaleString()}`
                : `Patient chose Quotation ${selectedQuotationNo}, which is no longer in the list.`
              : optionsSentAt
                ? 'Waiting for the patient to choose one quotation from the email.'
                : 'Email all quotations to the patient so they can choose one.'}
          </p>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] font-bold text-slate-500">
              {optionsSentAt
                ? `Options emailed to ${lead.email || 'patient'} on ${new Date(optionsSentAt).toLocaleString()}`
                : 'Not emailed yet'}
              {selectedQuotationAt && ` · Chosen on ${new Date(selectedQuotationAt).toLocaleString()}`}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {onRefreshChoice && (
                <button
                  onClick={onRefreshChoice}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                >
                  <RefreshCw size={12} /> Check patient's choice
                </button>
              )}
              {!readOnly && (
                <button
                  onClick={sendQuotationOptions}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {sending ? 'Sending...' : optionsSentAt ? 'Resend quotation options' : 'Email quotation options'}
                </button>
              )}
            </div>
          </div>

          {sendMessage && (
            <p className={`text-[10px] font-bold ${sendMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
              {sendMessage.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadQuotationPanel;