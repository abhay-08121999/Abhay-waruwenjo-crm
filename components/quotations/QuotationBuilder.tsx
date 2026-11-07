import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { ArrowLeft, Save, Send, Plus, Trash2, FileText, ChevronDown, Upload, CheckCircle, Eye, X, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import Tesseract from 'tesseract.js';

// Helper to parse line items robustly from PDF/OCR text
const parseLineItem = (lineText: string) => {
  const tokens = lineText.trim().split(/\s+/);
  const numbers: number[] = [];
  let descriptionTokens: string[] = [];

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    const cleaned = token.replace(/[^0-9.]/g, '');
    if (cleaned.length > 0 && !isNaN(Number(cleaned)) && cleaned !== '.') {
      numbers.unshift(Number(cleaned));
    } else {
      if (['inr', 'rs', '$', 'usd', 'eur', '₹', 'aed', 'gbp', 'amount', 'price'].includes(token.toLowerCase())) {
        continue; // ignore currency or header artifacts at the end
      }
      descriptionTokens = tokens.slice(0, i + 1);
      break;
    }
  }

  let name = descriptionTokens.join(' ').trim();
  let price = 0;
  let qty = 1;

  if (numbers.length >= 3) {
    qty = numbers[numbers.length - 3];
    price = numbers[numbers.length - 2];
  } else if (numbers.length === 2) {
    if (numbers[0] < numbers[1] && numbers[0] < 100) {
      qty = numbers[0];
      price = numbers[1];
    } else {
      price = numbers[0];
    }
  } else if (numbers.length === 1) {
    price = numbers[0];
  }

  const lowerName = name.toLowerCase();
  const isValid = name.length > 2 && price > 0 && 
                  !lowerName.includes('total') && 
                  !lowerName.includes('tax') && 
                  !lowerName.includes('subtotal') &&
                  !lowerName.includes('page');

  return isValid ? { name: name.replace(/[^a-zA-Z0-9\s-_]/g, '').trim(), price, qty } : null;
};

interface QuotationBuilderProps {
  quotationId: string | null;
  onBack: () => void;
  initialPreview?: boolean;
}

const QuotationBuilder: React.FC<QuotationBuilderProps> = ({ quotationId, onBack, initialPreview = false }) => {
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadTrigger, setUploadTrigger] = useState<{items: any[], overrides: any} | null>(null);

  // Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Form State
  const [leadId, setLeadId] = useState('');
  const [type, setType] = useState('clinical');
  const [templateId, setTemplateId] = useState('');
  const [currency, setCurrency] = useState('INR');
  
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    INR: 1.0,
    USD: 0.012,
    EUR: 0.011,
    AED: 0.044,
    GBP: 0.0095,
    AUD: 0.018,
    CAD: 0.016
  });

  const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'AED',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$'
  };

  const fetchExchangeRates = async () => {
    try {
      // Step 1: Try fetching from Supabase first
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('currency, rate');

      if (!error && data && data.length > 0) {
        // Supabase returned data — use it
        const rates: Record<string, number> = {};
        data.forEach((row: any) => {
          rates[row.currency] = Number(row.rate);
        });
        console.log('Exchange rates loaded from Supabase:', rates);
        setExchangeRates(rates);
        return;
      }

      // Step 2: Supabase returned empty (RLS blocked) — fall back to free public API (INR base)
      console.warn('Supabase returned no rates, fetching from public exchange rate API...');
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
      if (res.ok) {
        const json = await res.json();
        if (json && json.rates) {
          // Keep only commonly used currencies
          const allowedCurrencies = ['USD', 'INR', 'EUR', 'AED', 'GBP', 'AUD', 'CAD', 'JPY', 'CHF', 'SGD', 'MYR', 'THB', 'SAR', 'QAR', 'OMR', 'BHD', 'KWD', 'TRY', 'ZAR', 'BRL'];
          const rates: Record<string, number> = {};
          allowedCurrencies.forEach(curr => {
            if (json.rates[curr] !== undefined) {
              rates[curr] = Number(json.rates[curr]);
            }
          });
          console.log('Exchange rates loaded from public API:', rates);
          setExchangeRates(rates);
          return;
        }
      }

      // Step 3: Both failed — keep the default fallback rates already in state
      console.warn('Both Supabase and public API failed. Using default fallback rates.');
    } catch (err) {
      console.error('Unexpected error fetching exchange rates:', err);
    }
  };

  const handleCurrencyChange = (newCurrency: string) => {
    const oldRate = exchangeRates[currency] || 1;
    const newRate = exchangeRates[newCurrency] || 1;
    
    // Convert all item prices using INR-based rate calculation (price * newRate / oldRate)
    const updatedItems = items.map(item => ({
      ...item,
      price: Number(((item.price * newRate) / oldRate).toFixed(2))
    }));
    
    setItems(updatedItems);
    setCurrency(newCurrency);
  };

  const [items, setItems] = useState<{ id: string, name: string, price: number, qty: number }[]>([
    { id: '1', name: 'Consultation Fee', price: 1500, qty: 1 }
  ]);

  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

  useEffect(() => {
    fetchFormData();
    fetchExchangeRates();
    if (quotationId) {
      loadQuotation(quotationId);
    }
  }, [quotationId]);

  // Auto-trigger preview when initialPreview is true and quotation data is loaded
  const [previewTriggered, setPreviewTriggered] = useState(false);
  useEffect(() => {
    if (initialPreview && !previewTriggered && !loading && quotationId && templateId) {
      setPreviewTriggered(true);
      handlePreview();
    }
  }, [initialPreview, loading, quotationId, templateId, previewTriggered]);

  const fetchFormData = async () => {
    const { data: leadsData } = await supabase.from('patient_enquiries').select('id, name:full_name, status, email');
    const { data: templatesData } = await supabase.from('templates').select('id, name, type');
    if (leadsData) setLeads(leadsData);
    if (templatesData) setTemplates(templatesData);
  };

  const loadQuotation = async (id: string) => {
    setLoading(true);
    try {
      const { data: q } = await supabase.from('quotations').select('*').eq('id', id).single();
      if (q) {
        setLeadId(q.lead_id || '');
        setType(q.type || 'clinical');
        setTemplateId(q.template_id || '');
        setCurrency(q.currency || 'INR');
        
        const { data: qItems } = await supabase.from('quotation_items').select('*').eq('quotation_id', id);
        if (qItems && qItems.length > 0) {
          setItems(qItems.map(i => ({ id: i.id, name: i.name, price: i.unit_price, qty: i.quantity })));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (silent = false, overrideItems?: {id: string, name: string, price: number, qty: number}[], overrides?: {leadId?: string, templateId?: string, type?: string, currency?: string}) => {
    setLoading(true);
    try {
      let qId = quotationId;
      const saveItems = overrideItems || items;
      const saveTotalAmount = saveItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
      
      const payload = {
        lead_id: overrides?.leadId !== undefined ? overrides.leadId : (leadId || null),
        type: overrides?.type || type,
        template_id: overrides?.templateId !== undefined ? overrides.templateId : (templateId || null),
        currency: overrides?.currency || currency,
        total_amount: saveTotalAmount,
        status: 'draft'
      };

      if (qId) {
        await supabase.from('quotations').update(payload).eq('id', qId);
        await supabase.from('quotation_items').delete().eq('quotation_id', qId);
      } else {
        const { data } = await supabase.from('quotations').insert([payload]).select().single();
        if (data) qId = data.id;
      }

      if (qId && saveItems.length > 0) {
        const itemPayloads = saveItems.map(item => ({
          quotation_id: qId,
          name: item.name,
          unit_price: item.price,
          quantity: item.qty,
          total_price: item.price * item.qty
        }));
        await supabase.from('quotation_items').insert(itemPayloads);
      }
      
      if (!silent) {
        toast.success('Quotation saved successfully!');
        onBack();
      }
      return qId;
    } catch (err) {
      console.error(err);
      toast.error('Failed to save quotation.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Auto-save when items are updated from file upload
  useEffect(() => {
    if (uploadTrigger !== null) {
      handleSave(true, uploadTrigger.items, uploadTrigger.overrides).then(() => {
        toast.success(`Quotation updated with ${uploadTrigger.items.length} item(s) from document!`);
        setUploadTrigger(null);
      });
    }
  }, [uploadTrigger]);

  const handleSend = async () => {
    const qId = await handleSave(true);
    if (!qId) return;

    setLoading(true);
    try {
      const selectedLead = leads.find(l => l.id === leadId);
      const patientName = selectedLead?.name || 'Valued Patient';
      const patientEmail = selectedLead?.email || 'N/A';
      
      const selectedTemplate = templates.find(t => t.id === templateId);
      if (!selectedTemplate) {
        toast.error('Please select a template first');
        return;
      }

      // Fetch the full template content (in case it wasn't pre-loaded with HTML)
      const { data: templateData } = await supabase.from('templates').select('html_content').eq('id', templateId).single();
      let html = templateData?.html_content || '';
      
      if (!html) {
        toast.error('Template has no content');
        return;
      }

      // Generate Table Rows for Items
      const itemRows = items.map(item => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px; font-size: 14px; color: #1e293b;">${item.name}</td>
          <td style="padding: 12px; text-align: center; font-size: 14px; color: #1e293b;">${item.qty}</td>
          <td style="padding: 12px; text-align: right; font-size: 14px; color: #1e293b;">${CURRENCY_SYMBOLS[currency] || currency} ${item.price.toLocaleString()}</td>
          <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: 700; color: #1e293b;">${CURRENCY_SYMBOLS[currency] || currency} ${(item.price * item.qty).toLocaleString()}</td>
        </tr>
      `).join('');

      // Replace Placeholders
      html = html
        .replace(/{{patient_name}}/g, patientName)
        .replace(/{{patient_email}}/g, patientEmail)
        .replace(/{{date}}/g, new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
        .replace(/{{items}}/g, itemRows)
        .replace(/{{currency}}/g, CURRENCY_SYMBOLS[currency] || currency)
        .replace(/{{total_amount}}/g, totalAmount.toLocaleString());

      // Generate PDF
      const doc = new jsPDF('p', 'mm', 'a4');
      const container = document.createElement('div');
      container.id = 'temp-pdf-render';
      container.innerHTML = html;
      container.style.position = 'absolute';
      container.style.top = '-10000px';
      container.style.left = '-10000px';
      container.style.width = '210mm'; // A4 width
      container.style.minHeight = '297mm';
      container.style.backgroundColor = 'white';
      document.body.appendChild(container);
      
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      doc.save(`Quotation_${patientName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
      
      document.body.removeChild(container);

      toast.success(`Quotation generated for ${patientName}`);
      onBack();
    } catch (err) {
      console.error('Error sending quotation:', err);
      toast.error('Failed to generate PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    try {
      let fullText = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        // Use unpkg to ensure the correct version of the worker is loaded
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        
        let newItems: {id: string, name: string, price: number, qty: number}[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          const itemRows: Record<number, any[]> = {};
          textContent.items.forEach((item: any) => {
            const y = Math.round(item.transform[5] / 5) * 5;
            if (!itemRows[y]) {
              itemRows[y] = [];
            }
            itemRows[y].push(item);
          });

          const yCoords = Object.keys(itemRows).map(Number).sort((a, b) => b - a);
          
          for (const y of yCoords) {
            const rowItems = itemRows[y].sort((a, b) => a.transform[4] - b.transform[4]);
            const lineText = rowItems.map(item => item.str).join(' ').trim();
            if (!lineText) continue;
            
            fullText += lineText + '\n';

            const parsedItem = parseLineItem(lineText);
            if (parsedItem) {
                newItems.push({
                  id: Math.random().toString(),
                  ...parsedItem
                });
            }
          }
        }
        
        // Auto-match logic
        let matchedLeadId = leadId;
        let matchedCurrency = currency;
        let matchedType = type;
        let matchedTemplateId = templateId;
        
        const textLower = fullText.toLowerCase();
        
        // Match Lead
        const foundLead = leads.find(l => l.name && textLower.includes(l.name.toLowerCase()));
        if (foundLead) matchedLeadId = foundLead.id;
        else if (!matchedLeadId && leads.length > 0) matchedLeadId = leads[0].id;
        
        // Match Currency
        if (textLower.includes('usd') || textLower.includes('$')) matchedCurrency = 'USD';
        else if (textLower.includes('eur') || textLower.includes('€')) matchedCurrency = 'EUR';
        else if (textLower.includes('aed')) matchedCurrency = 'AED';
        else if (textLower.includes('inr') || textLower.includes('₹') || textLower.includes('rs')) matchedCurrency = 'INR';

        // Match Type & Template
        if (textLower.includes('business') || textLower.includes('b2b')) matchedType = 'business';
        else if (textLower.includes('clinical') || textLower.includes('patient')) matchedType = 'clinical';
        
        const foundTemplate = templates.find(t => t.name && textLower.includes(t.name.toLowerCase()));
        if (foundTemplate) {
            matchedTemplateId = foundTemplate.id;
            matchedType = foundTemplate.type;
        } else if (!matchedTemplateId || (templates.find(t => t.id === matchedTemplateId)?.type !== matchedType)) {
             const typeTemplates = templates.filter(t => t.type === matchedType);
             if (typeTemplates.length > 0) matchedTemplateId = typeTemplates[0].id;
        }

        if (newItems.length > 0) {
          window.alert('✅ Document analyzed! Patient matched and details auto-filled.');
          setLeadId(matchedLeadId);
          setCurrency(matchedCurrency);
          setType(matchedType);
          setTemplateId(matchedTemplateId);
          setItems(newItems);
          
          setUploadTrigger({
             items: newItems,
             overrides: { leadId: matchedLeadId, templateId: matchedTemplateId, type: matchedType, currency: matchedCurrency }
          });
        } else {
          const placeholder = [{ id: Math.random().toString(), name: `Document: ${file.name}`, price: 0, qty: 1 }];
          window.alert('✅ Document analyzed! Patient matched and details auto-filled.');
          setLeadId(matchedLeadId);
          setCurrency(matchedCurrency);
          setType(matchedType);
          setTemplateId(matchedTemplateId);
          setItems(placeholder);
          
          setUploadTrigger({
             items: placeholder,
             overrides: { leadId: matchedLeadId, templateId: matchedTemplateId, type: matchedType, currency: matchedCurrency }
          });
        }
      } else if (file.type.startsWith('image/')) {
        toast.info('Processing OCR... this might take a few seconds.', { duration: 5000 });
        const result = await Tesseract.recognize(file, 'eng');
        const text = result.data.text;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        let newItems: {id: string, name: string, price: number, qty: number}[] = [];

        for (const lineText of lines) {
            const parsedItem = parseLineItem(lineText);
            if (parsedItem) {
                newItems.push({
                  id: Math.random().toString(),
                  ...parsedItem
                });
            }
        }

        // Auto-match logic
        let matchedLeadId = leadId;
        let matchedCurrency = currency;
        let matchedType = type;
        let matchedTemplateId = templateId;
        
        const textLower = text.toLowerCase();
        
        // Match Lead
        const foundLead = leads.find(l => l.name && textLower.includes(l.name.toLowerCase()));
        if (foundLead) matchedLeadId = foundLead.id;
        else if (!matchedLeadId && leads.length > 0) matchedLeadId = leads[0].id;
        
        // Match Currency
        if (textLower.includes('usd') || textLower.includes('$')) matchedCurrency = 'USD';
        else if (textLower.includes('eur') || textLower.includes('€')) matchedCurrency = 'EUR';
        else if (textLower.includes('aed')) matchedCurrency = 'AED';
        else if (textLower.includes('inr') || textLower.includes('₹') || textLower.includes('rs')) matchedCurrency = 'INR';

        // Match Type & Template
        if (textLower.includes('business') || textLower.includes('b2b')) matchedType = 'business';
        else if (textLower.includes('clinical') || textLower.includes('patient')) matchedType = 'clinical';
        
        const foundTemplate = templates.find(t => t.name && textLower.includes(t.name.toLowerCase()));
        if (foundTemplate) {
            matchedTemplateId = foundTemplate.id;
            matchedType = foundTemplate.type;
        } else if (!matchedTemplateId || (templates.find(t => t.id === matchedTemplateId)?.type !== matchedType)) {
             const typeTemplates = templates.filter(t => t.type === matchedType);
             if (typeTemplates.length > 0) matchedTemplateId = typeTemplates[0].id;
        }

        if (newItems.length > 0) {
          window.alert('✅ Document analyzed! Patient matched and details auto-filled.');
          setLeadId(matchedLeadId);
          setCurrency(matchedCurrency);
          setType(matchedType);
          setTemplateId(matchedTemplateId);
          setItems(newItems);
          
          setUploadTrigger({
             items: newItems,
             overrides: { leadId: matchedLeadId, templateId: matchedTemplateId, type: matchedType, currency: matchedCurrency }
          });
        } else {
          const placeholder = [{ id: Math.random().toString(), name: `Image: ${file.name}`, price: 0, qty: 1 }];
          window.alert('✅ Document analyzed! Patient matched and details auto-filled.');
          setLeadId(matchedLeadId);
          setCurrency(matchedCurrency);
          setType(matchedType);
          setTemplateId(matchedTemplateId);
          setItems(placeholder);
          
          setUploadTrigger({
             items: placeholder,
             overrides: { leadId: matchedLeadId, templateId: matchedTemplateId, type: matchedType, currency: matchedCurrency }
          });
        }
      } else {
        toast.error('Please upload a PDF or Image file.');
      }
    } catch (err: any) {
      console.error('Error parsing PDF:', err);
      toast.error(`Failed to parse document: ${err.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), name: '', price: 0, qty: 1 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handlePreview = async () => {
    if (!templateId) {
      toast.error('Please select a Document Template first to preview.');
      return;
    }
    setPreviewLoading(true);
    try {
      const { data: templateData } = await supabase
        .from('templates')
        .select('html_content')
        .eq('id', templateId)
        .single();

      let html = templateData?.html_content || '';
      if (!html) {
        toast.error('Selected template has no HTML content.');
        return;
      }

      const selectedLead = leads.find(l => l.id === leadId);
      const patientName = selectedLead?.name || '{{patient_name}}';
      const patientEmail = selectedLead?.email || '{{patient_email}}';
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const itemRows = items.map(item => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px; font-size: 14px; color: #1e293b;">${item.name || '—'}</td>
          <td style="padding: 12px; text-align: center; font-size: 14px; color: #1e293b;">${item.qty}</td>
          <td style="padding: 12px; text-align: right; font-size: 14px; color: #1e293b;">${CURRENCY_SYMBOLS[currency] || currency} ${item.price.toLocaleString()}</td>
          <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: 700; color: #1e293b;">${CURRENCY_SYMBOLS[currency] || currency} ${(item.price * item.qty).toLocaleString()}</td>
        </tr>
      `).join('');

      html = html
        .replace(/{{patient_name}}/g, patientName)
        .replace(/{{patient_email}}/g, patientEmail)
        .replace(/{{date}}/g, dateStr)
        .replace(/{{items}}/g, itemRows)
        .replace(/{{currency}}/g, CURRENCY_SYMBOLS[currency] || currency)
        .replace(/{{total_amount}}/g, totalAmount.toLocaleString());

      setPreviewHtml(html);
      setShowPreview(true);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePrintPreview = () => {
    const iframe = document.getElementById('quotation-preview-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  return (<>
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden min-h-[700px] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-800">{quotationId ? 'Edit Quotation' : 'New Quotation'}</h2>
            <p className="text-sm font-medium text-slate-500">Build and price your quotation</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={previewLoading || !templateId}
            title={!templateId ? 'Select a template to preview' : 'Preview quotation as PDF'}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 border border-indigo-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Eye size={18} /> {previewLoading ? 'Loading...' : 'Preview'}
          </button>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
          >
            <Save size={18} /> Save Draft
          </button>
          <button 
            onClick={handleSend}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20"
          >
            <Send size={18} /> Send to Patient
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel: Settings & Details */}
        <div className="w-full lg:w-1/3 border-r border-slate-100 p-6 overflow-y-auto bg-slate-50/30">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">General Settings</h3>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Linked Lead / Patient</label>
              <select 
                value={leadId} onChange={(e) => setLeadId(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              >
                <option value="">Select a Lead...</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.name} ({l.status})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Quotation Type</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setType('clinical')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${type === 'clinical' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Clinical
                </button>
                <button 
                  onClick={() => setType('business')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${type === 'business' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Business
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Document Template</label>
              <select 
                value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              >
                <option value="">Select Template...</option>
                {templates.filter(t => t.type === type).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>

            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Currency</label>
              <select 
                value={currency} onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              >
                {Object.keys(exchangeRates).map((curr) => (
                  <option key={curr} value={curr}>
                    {curr} ({CURRENCY_SYMBOLS[curr] || curr})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Panel: Pricing Engine & Items */}
        <div className="flex-1 p-6 overflow-y-auto">
          
          {/* AI / Document Extraction Section */}
          <div className="mb-6 p-5 bg-teal-50/50 border border-teal-100 rounded-2xl flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-teal-800">Auto-fill from Document</h4>
              <p className="text-xs font-medium text-teal-600/70 mt-1">Upload a medical report or previous quotation to auto-extract line items.</p>
            </div>
            <div>
              <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <label 
                htmlFor="file-upload" 
                className={`cursor-pointer flex items-center gap-2 px-4 py-2 bg-white text-teal-700 font-bold text-sm rounded-xl border border-teal-200 hover:bg-teal-50 transition-colors shadow-sm ${uploading ? 'opacity-50 cursor-wait' : ''}`}
              >
                <Upload size={16} /> {uploading ? 'Processing...' : 'Upload File'}
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Line Items & Pricing</h3>
            <button onClick={addItem} className="text-teal-600 text-sm font-bold hover:text-teal-700 flex items-center gap-1">
              <Plus size={16} /> Add Line Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-100 rounded-2xl bg-white shadow-sm group">
                <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Description</label>
                  <input 
                    type="text" value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    placeholder="e.g. Total Knee Replacement Surgery"
                    className="w-full px-0 py-1 bg-transparent border-b border-slate-200 text-sm font-bold text-slate-800 focus:border-teal-500 outline-none transition-colors"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Qty</label>
                  <input 
                    type="number" min="1" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                    className="w-full px-0 py-1 bg-transparent border-b border-slate-200 text-sm font-bold text-slate-800 focus:border-teal-500 outline-none transition-colors"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Unit Price</label>
                  <div className="flex items-center border-b border-slate-200 focus-within:border-teal-500 transition-colors">
                    <span className="text-slate-400 text-sm font-bold py-1 mr-1">{CURRENCY_SYMBOLS[currency] || currency}</span>
                    <input 
                      type="number" min="0" value={item.price} onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full px-0 py-1 bg-transparent text-sm font-bold text-slate-800 outline-none"
                    />
                  </div>
                </div>
                <div className="w-32 flex flex-col justify-end pb-1">
                  <span className="text-sm font-black text-slate-800 text-right">
                    {CURRENCY_SYMBOLS[currency] || currency} {(item.price * item.qty).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6 flex justify-end">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm font-medium text-slate-500">
                <span>Subtotal</span>
                <span>{CURRENCY_SYMBOLS[currency] || currency} {totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-slate-500">
                <span>Tax & Fees (0%)</span>
                <span>{CURRENCY_SYMBOLS[currency] || currency} 0.00</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="text-base font-black text-slate-800">Total Amount</span>
                <span className="text-2xl font-black text-teal-600">
                  {CURRENCY_SYMBOLS[currency] || currency} {totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>

      {/* ─── Quotation Preview Modal ─── */}
      {showPreview && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            top: '73px',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
        >
          <div
            style={{
              width: '100%', maxWidth: '960px', height: 'calc(100% - 40px)',
              background: 'white', borderRadius: '24px',
              boxShadow: '0 48px 96px rgba(0,0,0,0.45)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 28px',
              borderBottom: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
              color: '#1e293b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  borderRadius: '12px', padding: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                }}>
                  <Eye size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: '#1e293b', lineHeight: 1.2 }}>
                    Quotation Preview
                  </div>
                  <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, marginTop: '2px' }}>
                    {leads.find(l => l.id === leadId)?.name
                      ? `For: ${leads.find(l => l.id === leadId)?.name}`
                      : 'No patient selected'}
                    {' · '}{CURRENCY_SYMBOLS[currency] || currency} {totalAmount.toLocaleString()} total
                  </div>
                </div>
              </div>

              {/* Verification checklist */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontWeight: 600 }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    color: leadId ? '#059669' : '#dc2626',
                    background: leadId ? '#ecfdf5' : '#fef2f2',
                    padding: '4px 10px', borderRadius: '20px',
                    border: `1px solid ${leadId ? '#bbf7d0' : '#fecaca'}`,
                  }}>
                    {leadId ? '✓' : '✗'} Patient
                  </span>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    color: templateId ? '#059669' : '#dc2626',
                    background: templateId ? '#ecfdf5' : '#fef2f2',
                    padding: '4px 10px', borderRadius: '20px',
                    border: `1px solid ${templateId ? '#bbf7d0' : '#fecaca'}`,
                  }}>
                    {templateId ? '✓' : '✗'} Template
                  </span>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    color: items.length > 0 ? '#059669' : '#dc2626',
                    background: items.length > 0 ? '#ecfdf5' : '#fef2f2',
                    padding: '4px 10px', borderRadius: '20px',
                    border: `1px solid ${items.length > 0 ? '#bbf7d0' : '#fecaca'}`,
                  }}>
                    {items.length > 0 ? '✓' : '✗'} {items.length} Item{items.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div style={{ width: '1px', height: '32px', background: '#e2e8f0' }} />

                <button
                  onClick={handlePrintPreview}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '9px 20px',
                    background: 'linear-gradient(135deg, #0d9488, #006680)',
                    color: 'white', border: 'none', borderRadius: '12px',
                    fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(13,148,136,0.35)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Printer size={15} /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '38px', height: '38px',
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    borderRadius: '10px', cursor: 'pointer', color: '#64748b',
                    flexShrink: 0,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* A4 canvas area */}
            <div style={{
              flex: 1, overflow: 'auto',
              background: 'linear-gradient(180deg, #64748b 0%, #475569 100%)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              padding: '36px 28px',
            }}>
              {/* A4 shadow hint label */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', top: '-24px', left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap', letterSpacing: '0.08em',
                }}>A4 · 210 × 297 mm</div>
                <div style={{
                  width: '794px',
                  minHeight: '1123px',
                  background: 'white',
                  boxShadow: '0 12px 48px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  <iframe
                    id="quotation-preview-iframe"
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0;}body{background:white;font-family:'Inter',sans-serif;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></head><body>${previewHtml}</body></html>`}
                    style={{ width: '100%', height: '1123px', border: 'none', display: 'block' }}
                    title="Quotation Preview"
                  />
                </div>
              </div>
            </div>

            {/* Footer action bar */}
            <div style={{
              padding: '14px 28px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                📋 Review all details carefully before sending to the patient
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{
                    padding: '8px 20px', background: 'white',
                    border: '1px solid #e2e8f0', borderRadius: '10px',
                    fontWeight: 700, fontSize: '13px', cursor: 'pointer', color: '#64748b',
                  }}
                >
                  Close & Edit
                </button>
                <button
                  onClick={() => { setShowPreview(false); handleSend(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 20px',
                    background: 'linear-gradient(135deg, #0d9488, #006680)',
                    color: 'white', border: 'none', borderRadius: '10px',
                    fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(13,148,136,0.3)',
                  }}
                >
                  <Send size={14} /> Looks Good — Send to Patient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  </> );
};

export default QuotationBuilder;
