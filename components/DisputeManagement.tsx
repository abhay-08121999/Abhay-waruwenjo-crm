import React, { useState, useEffect } from 'react';
import { fetchDisputes, createDispute, updateDispute } from '../services/supabase.ts';
import { Dispute } from '../types.ts';
import { LifeBuoy, AlertCircle, Filter, Search, MoreVertical, MessageSquare, CheckCircle2, X, User, Tag, Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const DisputeManagement: React.FC = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newDispute, setNewDispute] = useState<Partial<Dispute>>({
    category: 'Service Quality',
    priority: 'Medium',
    status: 'Open'
  });

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    setLoading(true);
    const { data, error } = await fetchDisputes();
    if (!error && data) {
      setDisputes(data.map((d: any) => ({
        id: d.id,
        reporterName: d.reporter_name,
        category: d.category,
        priority: d.priority,
        status: d.status,
        subject: d.subject,
        createdAt: d.created_at
      })));
    }
    setLoading(false);
  };

  const handleLogDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const { error } = await createDispute({
          reporter_name: newDispute.reporterName,
          category: newDispute.category,
          priority: newDispute.priority,
          status: 'Open',
          subject: newDispute.subject
        } as any);

        if (error) throw error;
        
        toast.success('Dispute ticket initialized');
        setShowModal(false);
        loadDisputes();
    } catch (error: any) {
        toast.error('Failed to log dispute: ' + error.message);
    }
  };

  const handleResolve = async (id: string) => {
    try {
        const { error } = await updateDispute(id, { status: 'Resolved' });
        if (error) throw error;
        toast.success('Dispute marked as resolved');
        loadDisputes();
    } catch (error: any) {
        toast.error('Failed to resolve: ' + error.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-lg">
                <AlertCircle size={24} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Dispute Center</h2>
          </div>
          <p className="text-slate-500 font-medium max-w-xl">Resolution workflow for patient and partner service issues. Standardized grievance management for quality assurance.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-8 py-4 bg-rose-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-500/20 transition-all flex items-center gap-2"
        >
          <AlertCircle size={18} /> Log Critical Issue
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 opacity-5 text-rose-900 group-hover:scale-110 transition-transform">
                <LifeBuoy size={80} />
             </div>
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 relative z-10">Active Tickets</h4>
             <p className="text-6xl font-black text-slate-800 tracking-tighter relative z-10">{disputes.filter(d => d.status !== 'Closed' && d.status !== 'Resolved').length}</p>
             <div className="mt-6 flex items-center gap-2 relative z-10">
                <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                <p className="text-xs font-black text-rose-600 uppercase tracking-wider">{disputes.filter(d => d.priority === 'Critical' || d.priority === 'High').length} High Priority</p>
             </div>
          </div>
          
          <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10 text-white">
                <CheckCircle2 size={60} />
             </div>
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 relative z-10">Resolution Engine</h4>
             <p className="text-3xl font-black text-white tracking-tight relative z-10">94.2%</p>
             <p className="text-[9px] font-bold text-teal-400 mt-2 uppercase tracking-[0.2em] relative z-10">Satisfaction Rate</p>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4 bg-white rounded-[3rem] border border-slate-100">
                <Loader2 className="animate-spin text-rose-600" size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest">Scanning Grievance Registry...</p>
            </div>
          ) : (
            disputes.map(dispute => (
              <div key={dispute.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:border-rose-300 hover:shadow-2xl hover:shadow-rose-500/5 transition-all group flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform">
                    <AlertCircle size={100} />
                 </div>
                 <div className={`p-5 rounded-[2rem] shrink-0 shadow-sm relative z-10 ${
                   dispute.priority === 'High' || dispute.priority === 'Critical' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                 }`}>
                   <LifeBuoy size={32} />
                 </div>
                 <div className="flex-1 relative z-10 w-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black bg-slate-900 text-white px-3 py-1 rounded-lg uppercase tracking-widest">{dispute.category}</span>
                        <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${
                            dispute.priority === 'Critical' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>{dispute.priority}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Reported {new Date(dispute.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-2xl font-black text-slate-900 mb-2 mt-2 tracking-tight pr-12">{dispute.subject}</h4>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Initiator: <span className="text-slate-800">{dispute.reporterName}</span></p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-8 pt-6 border-t border-slate-50">
                      <div className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                        dispute.status === 'In Review' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                        dispute.status === 'Open' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                        'bg-green-50 text-green-700 border-green-100'
                      }`}>
                        {dispute.status}
                      </div>
                      <button className="flex items-center gap-2 px-5 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100">
                        <MessageSquare size={16} /> Internal Log
                      </button>
                      {dispute.status !== 'Resolved' && (
                        <button 
                          onClick={() => handleResolve(dispute.id)}
                          className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all ml-auto"
                        >
                          <CheckCircle2 size={16} /> Resolve Issue
                        </button>
                      )}
                    </div>
                 </div>
                 <button className="absolute top-8 right-8 p-3 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all"><MoreVertical size={20} /></button>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none text-rose-900">
                <AlertCircle size={200} />
            </div>
            
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-rose-600 text-white relative z-10">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 rounded-3xl">
                    <LifeBuoy size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight leading-none mb-1 text-white">Log Grievance</h3>
                  <p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest">Quality Assurance & Issue Tracking</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleLogDispute} className="p-10 space-y-8 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2 flex items-center gap-2"><User size={14} className="text-rose-600"/> Reported By</label>
                <input required type="text" placeholder="Full name of stakeholder" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:bg-white focus:ring-8 focus:ring-rose-500/5 transition-all font-bold text-slate-700" onChange={e => setNewDispute({...newDispute, reporterName: e.target.value})} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Subject of Issue</label>
                <input required type="text" placeholder="Summarize the core grievance" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:bg-white focus:ring-8 focus:ring-rose-500/5 transition-all font-bold text-slate-700" onChange={e => setNewDispute({...newDispute, subject: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2 flex items-center gap-2"><Tag size={14} className="text-rose-600"/> Category</label>
                  <select className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:bg-white focus:ring-8 focus:ring-rose-500/5 transition-all font-bold text-slate-700 cursor-pointer" onChange={e => setNewDispute({...newDispute, category: e.target.value as any})}>
                    <option value="Service Quality">Service Quality</option>
                    <option value="Billing">Billing</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Medical Outcome">Medical Outcome</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2 flex items-center gap-2"><Flag size={14} className="text-rose-600"/> Escalation</label>
                  <select className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:bg-white focus:ring-8 focus:ring-rose-500/5 transition-all font-bold text-slate-700 cursor-pointer" onChange={e => setNewDispute({...newDispute, priority: e.target.value as any})}>
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Severity</option>
                    <option value="High">High Urgency</option>
                    <option value="Critical">Critical Escalation</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.25em] hover:bg-slate-800 shadow-2xl shadow-slate-400/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                <AlertCircle size={18} /> Initialize Resolution Ticket
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputeManagement;
