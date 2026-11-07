import React, { useState } from 'react';
import QuotationsList from './QuotationsList';
import QuotationBuilder from './QuotationBuilder';
import TemplateManager from './TemplateManager';
import { FileText, FileSignature, LayoutTemplate } from 'lucide-react';

const Quotations = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'builder' | 'templates'>('list');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [initialPreview, setInitialPreview] = useState(false);

  const handleCreateNew = () => {
    setSelectedQuotationId(null);
    setInitialPreview(false);
    setActiveTab('builder');
  };

  const handleEdit = (id: string) => {
    setSelectedQuotationId(id);
    setInitialPreview(false);
    setActiveTab('builder');
  };

  const handlePreview = (id: string) => {
    setSelectedQuotationId(id);
    setInitialPreview(true);
    setActiveTab('builder');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Quotations</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage clinical and business quotations, templates, and approvals</p>
        </div>
        
        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'list' 
                ? 'bg-teal-50 text-teal-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileText size={16} />
            All Quotations
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'builder' 
                ? 'bg-teal-50 text-teal-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileSignature size={16} />
            Builder
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'templates' 
                ? 'bg-teal-50 text-teal-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <LayoutTemplate size={16} />
            Templates
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-6">
        {activeTab === 'list' && <QuotationsList onCreateNew={handleCreateNew} onEdit={handleEdit} onPreview={handlePreview} />}
        {activeTab === 'builder' && (
          <QuotationBuilder 
            quotationId={selectedQuotationId} 
            onBack={() => { setActiveTab('list'); setInitialPreview(false); }}
            initialPreview={initialPreview}
          />
        )}
        {activeTab === 'templates' && <TemplateManager />}
      </div>
    </div>
  );
};

export default Quotations;

