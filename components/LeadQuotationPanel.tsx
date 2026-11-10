import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Eye, EyeOff, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface LeadQuotationPanelProps {
  lead: {
    id: string;
    name?: string;
    email?: string;
  };
}

const LeadQuotationPanel: React.FC<LeadQuotationPanelProps> = ({ lead }) => {
  const [quotationPdf, setQuotationPdf] = useState<any | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Latest quotation PDF saved for this lead in the Quotations module
  useEffect(() => {
    let cancelled = false;
    const loadQuotationPdf = async () => {
      setLoadingPdf(true);
      const { data, error } = await supabase
        .from('quotations')
        .select('id, pdf_path, pdf_generated_at, currency, total_amount')
        .eq('lead_id', lead.id)
        .not('pdf_path', 'is', null)
        .order('pdf_generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLoadingPdf(false);

      if (error) {
        console.error('Error loading quotation PDF:', error);
        setQuotationPdf(null);
        return;
      }
      if (!data) {
        setQuotationPdf(null);
        return;
      }

      const { data: publicData } = supabase.storage
        .from('quotation-pdfs')
        .getPublicUrl(data.pdf_path);

      setQuotationPdf({
        id: data.id,
        pdfUrl: publicData.publicUrl,
        generatedAt: data.pdf_generated_at,
        currency: data.currency,
        total: data.total_amount,
      });
    };
    loadQuotationPdf();
    return () => {
      cancelled = true;
    };
  }, [lead.id, refreshKey]);

  // Opens the Quotations module, pre-selecting this patient (or an existing quotation)
  const openQuotations = (quotationId?: string) => {
    sessionStorage.setItem('quotation_prefill_lead_id', lead.id);
    if (quotationId) sessionStorage.setItem('quotation_open_id', quotationId);
    else sessionStorage.removeItem('quotation_open_id');
    window.location.hash = '#/quotations';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pl-1">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quotation</label>
        <button
          onClick={() => openQuotations(quotationPdf?.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm"
        >
          {quotationPdf ? <><Pencil size={12} /> Edit Quotation</> : <><Plus size={12} /> Create Quotation</>}
        </button>
      </div>

      {quotationPdf?.pdfUrl ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl">
            <div>
              <p className="text-[11px] font-black text-slate-800">
                {quotationPdf.currency} {Number(quotationPdf.total || 0).toLocaleString()}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Generated {new Date(quotationPdf.generatedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
            >
              {showPreview ? <><EyeOff size={12} /> Hide Preview</> : <><Eye size={12} /> Preview</>}
            </button>
          </div>

          {showPreview && (
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quotation PDF</p>
                <a
                  href={quotationPdf.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                >
                  <ExternalLink size={12} /> Open in new tab
                </a>
              </div>
              <iframe src={quotationPdf.pdfUrl} title="Quotation PDF" className="w-full h-[600px]" />
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-slate-100 rounded-[2rem] text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {loadingPdf ? 'Loading quotation...' : 'No quotation PDF yet'}
          </p>
          {!loadingPdf && (
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadQuotationPanel;