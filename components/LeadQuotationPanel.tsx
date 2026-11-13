import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Eye, EyeOff, ExternalLink, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface LeadQuotationPanelProps {
  lead: {
    id: string;
    name?: string;
    email?: string;
  };
}

type QuotationItem = {
  id: string;
  pdfUrl: string;
  generatedAt: string;
  currency: string;
  total: number;
};

const LeadQuotationPanel: React.FC<LeadQuotationPanelProps> = ({ lead }) => {
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const btnPrimary = 'flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm';
  const btnSoft = 'flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all';

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
        quotations.map((q, idx) => {
          const isOpen = expandedId === q.id;
          return (
            <div key={q.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 flex-wrap p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-800">
                      Quotation {quotations.length - idx} · {q.currency} {Number(q.total || 0).toLocaleString()}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Generated {new Date(q.generatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
        })
      )}
    </div>
  );
};

export default LeadQuotationPanel;