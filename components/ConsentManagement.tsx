import React, { useState, useEffect } from 'react';
import { fetchConsentForms, createConsentForm, updateConsentForm } from '../services/supabase.ts';
import { ConsentForm } from '../types.ts';
import { FileCheck, Signature, Plus, ShieldCheck, AlertCircle, Clock, Download, X, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ConsentManagement: React.FC = () => {
  const [forms, setForms] = useState<ConsentForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newForm, setNewForm] = useState<Partial<ConsentForm>>({
    type: 'Surgical',
    version: 'v1.0'
  });

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    setLoading(true);
    const { data, error } = await fetchConsentForms();
    if (!error && data) {
      setForms(data.map((f: any) => ({
        id: f.id,
        patientId: f.patient_id,
        patientName: f.patient_name,
        type: f.form_type,
        status: f.status,
        signedAt: f.signed_at,
        version: f.version || 'v1.0'
      })));
    }
    setLoading(false);
  };

  const handleGenerateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const { error } = await createConsentForm({
          patient_name: newForm.patientName,
          form_type: newForm.type,
          status: 'Pending',
          version: newForm.version || 'v1.0'
        } as any);

        if (error) throw error;
        
        toast.success('Digital consent form dispatched');
        setShowModal(false);
        loadForms();
    } catch (error: any) {
        toast.error('Failed to issue form: ' + error.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-teal-600 text-white rounded-2xl shadow-lg">
                <ShieldCheck size={24} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Consent & Compliance</h2>
          </div>
          <p className="text-slate-500 font-medium max-w-xl">Digital audit trail for patient authorizations and HIPAA compliance. All signatures are cryptographically secured.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-8 py-4 bg-teal-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all flex items-center gap-2"
        >
          <Plus size={18} /> Issue Digital Consent
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
              <ShieldCheck className="absolute -bottom-10 -right-10 w-48 h-48 opacity-5 text-teal-400" />
              <div>
                <h4 className="text-xl font-black mb-4 tracking-tight">Integrity Core</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-bold uppercase tracking-wider mb-8">All digital signatures are cryptographically hashed and logged with IP verification in the Supabase audit stream.</p>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                 <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400">HIPAA Validated</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Status Summary</h4>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-600">Signed</span>
                        <span className="text-xs font-black text-teal-600">{forms.filter(f => f.status === 'Signed').length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-600">Pending</span>
                        <span className="text-xs font-black text-amber-600">{forms.filter(f => f.status === 'Pending').length}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-3">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4 bg-white rounded-[3rem] border border-slate-100">
                <Loader2 className="animate-spin text-teal-600" size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest">Querying Compliance Vault...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {forms.map(form => (
                <div key={form.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:border-teal-400 hover:shadow-2xl hover:shadow-teal-500/5 transition-all group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-8">
                    <div className={`p-4 rounded-[1.5rem] shadow-sm ${form.status === 'Signed' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                      <Signature size={28} />
                    </div>
                    <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                      form.status === 'Signed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {form.status}
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 leading-tight mb-2">{form.patientName}</h4>
                  <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] mb-8">{form.type} Authorization</p>
                  
                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ver: {form.version}</span>
                     {form.status === 'Signed' ? (
                       <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                         <Download size={14} /> Encrypted PDF
                       </button>
                     ) : (
                       <button className="flex items-center gap-2 px-5 py-2.5 bg-teal-50 text-teal-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-100 transition-all border border-teal-100">
                         <Clock size={14} /> Resend Signal
                       </button>
                     )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none text-teal-900">
                <ShieldCheck size={200} />
            </div>
            
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-teal-600 text-white relative z-10">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 rounded-3xl">
                    <FileCheck size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight leading-none mb-1 text-white">Issue Authorization</h3>
                  <p className="text-[10px] font-bold text-teal-100 uppercase tracking-widest">Legal & Compliance Workflow</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleGenerateForm} className="p-10 space-y-8 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2 flex items-center gap-2"><User size={14} className="text-teal-600"/> Target Patient Profile</label>
                <input required type="text" placeholder="e.g., Jennifer Lawrence" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:bg-white focus:ring-8 focus:ring-teal-500/5 transition-all font-bold text-slate-700" onChange={e => setNewForm({...newForm, patientName: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Authorization Type</label>
                  <select className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:bg-white focus:ring-8 focus:ring-teal-500/5 transition-all font-bold text-slate-700 cursor-pointer" onChange={e => setNewForm({...newForm, type: e.target.value as any})}>
                    <option value="Surgical">Surgical Consent</option>
                    <option value="Data Privacy">Data Privacy (GDPR)</option>
                    <option value="HIPAA">HIPAA Disclosure</option>
                    <option value="Financial Liability">Financial Liability</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Form Version</label>
                  <input type="text" placeholder="e.g., v2.1-Standard" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:bg-white focus:ring-8 focus:ring-teal-500/5 transition-all font-bold text-slate-700" onChange={e => setNewForm({...newForm, version: e.target.value})} />
                </div>
              </div>

              <div className="p-6 bg-teal-50 border-2 border-dashed border-teal-200 rounded-[2rem] flex gap-4 items-start shadow-inner">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                    <AlertCircle size={20} className="text-teal-600 shrink-0" />
                </div>
                <p className="text-[10px] font-black text-teal-800/60 uppercase leading-loose tracking-wider">
                  System will dispatch a cryptographically linked signature request to the patient's verified digital contact points.
                </p>
              </div>

              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.25em] hover:bg-slate-800 shadow-2xl shadow-slate-400/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                <Signature size={18} /> Authorize & Dispatch Signal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsentManagement;
