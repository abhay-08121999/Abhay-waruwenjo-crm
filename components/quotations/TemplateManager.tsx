import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Plus, Edit2, Trash2, LayoutTemplate, Eye, X, Download, Printer } from 'lucide-react';

const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('clinical');
  const [htmlContent, setHtmlContent] = useState('');

  // Preview State
  const [previewTemplate, setPreviewTemplate] = useState<{ name: string; html: string } | null>(null);

  const PROFESSIONAL_TEMPLATE = {
    name: 'Template 1 - WaruWenJo Proposal',
    type: 'clinical',
    html_content: `<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
.email-container {
    max-width: 800px;
    margin: 30px auto;
    background: #fff;
    font-family: 'DM Sans', sans-serif;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.email-header {
    background: linear-gradient(135deg, #0D6E6E 0%, #084F4F 100%);
    padding: 60px 55px 80px;
    position: relative;
    overflow: hidden;
}
.email-header::before {
    content: "";
    position: absolute;
    top: -80px;
    right: -80px;
    width: 240px;
    height: 240px;
    border: 2px solid rgba(201, 168, 76, 0.25);
    border-radius: 50%;
}
.email-header::after {
    content: "";
    position: absolute;
    bottom: -90px;
    left: -70px;
    width: 170px;
    height: 170px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 50%;
}
.logo-wrap {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 40px;
}
.logo-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: #C9A84C;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    font-family: 'Playfair Display', serif;
}
.logo-title {
    color: #fff;
    font-size: 26px;
    font-weight: 700;
    font-family: 'Playfair Display', serif;
}
.logo-sub {
    color: rgba(255, 255, 255, 0.65);
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
}
.stage {
    color: #E4C56A;
    text-transform: uppercase;
    font-size: 14px;
    letter-spacing: 3px;
    font-weight: 700;
    margin-bottom: 18px;
}
.main-title {
    color: #fff;
    font-family: 'Playfair Display', serif;
    font-size: 58px;
    line-height: 1.1;
    font-weight: 600;
    margin-bottom: 18px;
}
.subtitle {
    color: rgba(255, 255, 255, 0.75);
    font-size: 18px;
    line-height: 1.6;
}
.content {
    padding: 60px;
    min-height: 250px;
}
.signature {
    color: #4A5568;
    font-size: 18px;
    line-height: 1.8;
}
.signature strong {
    color: #2C3E50;
}
.email-footer {
    background: #2E4258;
    text-align: center;
    padding: 40px 60px;
}
.footer-brand {
    color: #fff;
    font-size: 22px;
    font-family: 'Playfair Display', serif;
    margin-bottom: 20px;
}
.footer-divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    margin-bottom: 20px;
}
.footer-text {
    color: rgba(255, 255, 255, 0.55);
    font-size: 14px;
    line-height: 1.8;
}
.footer-text a {
    color: rgba(255, 255, 255, 0.65);
}
</style>
<div class="email-container">
    <!-- HEADER -->
    <div class="email-header">
        <div class="logo-wrap">
            <div class="logo-icon">W</div>
            <div>
                <div class="logo-title">WaruWenJo</div>
                <div class="logo-sub">Medical Tourism Partners</div>
            </div>
        </div>
        <div class="stage">
            Stage 6–7 · Negotiation & Video Call
        </div>
        <h1 class="main-title">
            Your Proposal &<br>
            Consultation Details
        </h1>
        <div class="subtitle">
            Your personalised quotation and surgeon consultation are ready.
        </div>
    </div>

    <!-- CONTENT -->
    <div class="content">
        <p><strong>Date:</strong> {{date}}</p>
        <br>
        <p>To,</p>
        <p>
            {{patient_name}}<br>
            {{patient_email}}
        </p>
        <br>
        <p>
            <strong>Subject:</strong> Medical Quotation for Proposed Treatment
        </p>
        <br>
        <p>Dear {{patient_name}},</p>
        <br>
        <p>
            We are pleased to provide you with the comprehensive medical quotation
            for your proposed treatment plan at WaruWenJo. Our priority is to ensure
            you receive world-class healthcare with complete financial transparency.
        </p>
        <br><br>
        <h3 style="color:#0D6E6E; margin-bottom: 15px;">
            Quotation Details
        </h3>
        <table style="
            width:100%;
            border-collapse:collapse;
            font-size:14px;
        ">
            <thead>
                <tr style="background:#0D6E6E;color:white;">
                    <th style="padding:12px;border:1px solid #ddd;text-align:left;">Description</th>
                    <th style="padding:12px;border:1px solid #ddd;text-align:center;">Qty</th>
                    <th style="padding:12px;border:1px solid #ddd;text-align:right;">Unit Price</th>
                    <th style="padding:12px;border:1px solid #ddd;text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
                {{items}}
            </tbody>
            <tfoot>
                <tr style="font-weight:bold;background:#f5f5f5;">
                    <td colspan="3"
                        style="padding:12px;border:1px solid #ddd;text-align:right;">
                        Grand Total
                    </td>
                    <td style="
                        padding:12px;
                        border:1px solid #ddd;
                        color:#0D6E6E;
                        text-align:right;
                    ">
                        {{currency}} {{total_amount}}
                    </td>
                </tr>
            </tfoot>
        </table>
    </div>

    <!-- CONTENT -->
    <div class="content" style="padding-top: 0;">
        <div class="signature">
            Warm regards,<br>
            <strong>The WaruWenJo Care Team</strong>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="email-footer">
        <div class="footer-brand">
            WaruWenJo Medical Tourism
        </div>
        <hr class="footer-divider">
        <div class="footer-text">
            This email was sent to {{patient_email}} · Stage 6–7 Communication
            <br>
            © 2025 WaruWenJo Sdn Bhd · All rights reserved ·
            <a href="#" style="color:rgba(255,255,255,.65);">Privacy Policy</a>
        </div>
    </div>
</div>`
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setTemplates(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (t: any) => {
    setEditingId(t.id);
    setName(t.name);
    setType(t.type);
    setHtmlContent(t.html_content || '');
  };

  const handleCreateNew = () => {
    setEditingId('new');
    setName('');
    setType('clinical');
    setHtmlContent(`<div class="waruwenjo-template" style="font-family: 'Inter', sans-serif; color: #1e293b; line-height: 1.5;">
  <!-- Header -->
  <div style="padding: 20px; border-bottom: 2px solid #0d9488; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <img src="/logo.png" alt="WaruWenJo" style="height: 40px; margin-bottom: 5px;" />
      <div style="font-size: 14px; font-weight: bold; color: #0d9488;">Your Health, Our Priority</div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding: 40px 20px;">
    <h1 style="text-align: center; font-size: 20px; font-weight: 900; letter-spacing: 1px; margin-bottom: 30px; text-transform: uppercase;">Quotation</h1>
    <p>Dear {{patient_name}},</p>
    <p>We are pleased to provide you with the following quotation for your medical services.</p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
          <th style="text-align: left; padding: 10px; font-size: 11px;">DESCRIPTION</th>
          <th style="text-align: right; padding: 10px; font-size: 11px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        {{items}}
      </tbody>
    </table>

    <div style="text-align: right; margin-top: 20px;">
      <div style="font-size: 18px; font-weight: 900; color: #0d9488;">Total: {{currency}} {{total_amount}}</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding: 20px; border-top: 2px solid #f1f5f9; font-size: 10px; color: #64748b;">
    <div>132/6, Navodayanagar, J P Nagar, Bangalore 560078</div>
    <div>contact@waruwenjo.com | www.waruwenjo.com</div>
  </div>
</div>`);
  };

  const handleSave = async () => {
    try {
      const payload = { name, type, html_content: htmlContent };
      if (editingId === 'new') {
        await supabase.from('templates').insert([payload]);
      } else if (editingId) {
        await supabase.from('templates').update(payload).eq('id', editingId);
      }
      alert('Template saved successfully!');
      setEditingId(null);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert('Failed to save template.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      await supabase.from('templates').delete().eq('id', id);
      fetchTemplates();
    }
  };

  const handlePreview = (templateName: string, html: string) => {
    setPreviewTemplate({ name: templateName, html });
  };

  const handlePrint = () => {
    const iframe = document.getElementById('template-preview-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  const seedProfessionalTemplate = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('templates').insert([PROFESSIONAL_TEMPLATE]);
      if (error) throw error;
      alert('Standard WaruWenJo template added to your library!');
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert('Failed to add template.');
    } finally {
      setLoading(false);
    }
  };

  if (editingId) {
    return (
      <>
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-800">{editingId === 'new' ? 'Create Template' : 'Edit Template'}</h2>
          <div className="flex gap-3">
            {htmlContent && (
              <button
                onClick={() => handlePreview(name || 'Template Preview', htmlContent)}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 border border-indigo-200 transition-all"
              >
                <Eye size={16} /> Preview PDF
              </button>
            )}
            <button onClick={() => setEditingId(null)} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20">Save Template</button>
          </div>
        </div>
        <div className="p-6 flex-1 flex flex-col gap-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-700 mb-2">Template Name</label>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
            <div className="w-64">
              <label className="block text-sm font-bold text-slate-700 mb-2">Type</label>
              <select 
                value={type} onChange={e => setType(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              >
                <option value="clinical">Clinical</option>
                <option value="business">Business</option>
              </select>
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-bold text-slate-700 mb-2">HTML Content</label>
            <textarea 
              value={htmlContent} onChange={e => setHtmlContent(e.target.value)}
              className="flex-1 w-full p-4 bg-slate-900 text-teal-400 font-mono text-sm rounded-xl outline-none focus:ring-2 focus:ring-teal-500/50"
              placeholder="<html>..."
            />
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewTemplate(null); }}
        >
          <div
            style={{
              width: '100%', maxWidth: '900px', height: '90vh',
              background: 'white', borderRadius: '20px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  borderRadius: '10px', padding: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Eye size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>
                    {previewTemplate.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                    PDF Preview — Template looks exactly like this when generated
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={handlePrint}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 18px',
                    background: 'linear-gradient(135deg, #0d9488, #006680)',
                    color: 'white', border: 'none', borderRadius: '10px',
                    fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
                  }}
                >
                  <Printer size={15} /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '36px', height: '36px',
                    background: '#f1f5f9', border: 'none', borderRadius: '8px',
                    cursor: 'pointer', color: '#64748b',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* A4 Page Preview Area */}
            <div style={{
              flex: 1, overflow: 'auto',
              background: '#94a3b8',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              padding: '32px 24px',
            }}>
              <div style={{
                width: '794px',
                minHeight: '1123px',
                background: 'white',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                borderRadius: '4px',
                flexShrink: 0,
                overflow: 'hidden',
              }}>
                <iframe
                  id="template-preview-iframe"
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0;}body{background:white;}</style><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></head><body>${previewTemplate.html}</body></html>`}
                  style={{ width: '100%', height: '1123px', border: 'none', display: 'block' }}
                  title="Template Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-800">Document Templates</h2>
          <p className="text-sm font-medium text-slate-500">Manage HTML templates for your quotations</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={seedProfessionalTemplate}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
          >
            <LayoutTemplate size={18} /> Restore Standard
          </button>
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20"
          >
            <Plus size={18} /> New Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map(t => (
          <div 
            key={t.id} 
            className="border border-slate-200 rounded-2xl p-5 hover:border-teal-500 transition-all group bg-slate-50/50 hover:shadow-md"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <LayoutTemplate className="text-teal-600" size={24} />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handlePreview(t.name, t.html_content || '')}
                  title="Preview as PDF"
                  className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white rounded-lg shadow-sm transition-colors"
                >
                  <Eye size={16} />
                </button>
                <button 
                  onClick={() => handleEdit(t)} 
                  title="Edit template"
                  className="p-1.5 text-slate-400 hover:text-teal-600 bg-white rounded-lg shadow-sm transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(t.id)} 
                  title="Delete template"
                  className="p-1.5 text-slate-400 hover:text-red-600 bg-white rounded-lg shadow-sm transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">{t.name}</h3>
            <span className="inline-block px-2.5 py-1 bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-md">
              {t.type}
            </span>
            {/* Preview CTA row */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => handlePreview(t.name, t.html_content || '')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
              >
                <Eye size={13} /> Preview
              </button>
              <button
                onClick={() => handleEdit(t)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-100"
              >
                <Edit2 size={13} /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal (template list view) */}
      {previewTemplate && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewTemplate(null); }}
        >
          <div
            style={{
              width: '100%', maxWidth: '900px', height: '90vh',
              background: 'white', borderRadius: '20px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  borderRadius: '10px', padding: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Eye size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>
                    {previewTemplate.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                    PDF Preview — Template looks exactly like this when generated
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={handlePrint}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 18px',
                    background: 'linear-gradient(135deg, #0d9488, #006680)',
                    color: 'white', border: 'none', borderRadius: '10px',
                    fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
                  }}
                >
                  <Printer size={15} /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '36px', height: '36px',
                    background: '#f1f5f9', border: 'none', borderRadius: '8px',
                    cursor: 'pointer', color: '#64748b',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* A4 Page Preview Area */}
            <div style={{
              flex: 1, overflow: 'auto',
              background: '#94a3b8',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              padding: '32px 24px',
            }}>
              <div style={{
                width: '794px',
                minHeight: '1123px',
                background: 'white',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                borderRadius: '4px',
                flexShrink: 0,
                overflow: 'hidden',
              }}>
                <iframe
                  id="template-preview-iframe"
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0;}body{background:white;}</style><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></head><body>${previewTemplate.html}</body></html>`}
                  style={{ width: '100%', height: '1123px', border: 'none', display: 'block' }}
                  title="Template Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;
