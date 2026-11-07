import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Receipt, TrendingUp, ArrowUpRight, ArrowDownRight, 
  Search, Filter, Plus, Calendar, CreditCard, Building, User,
  ChevronRight, MoreVertical, Loader2, CheckCircle2, AlertCircle, PieChart
} from 'lucide-react';
import { fetchFinanceRecords } from '../services/supabase.ts';
import { toast } from 'sonner';

const FinanceModule: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFinance();
  }, []);

  const loadFinance = async () => {
    setLoading(true);
    const { data, error } = await fetchFinanceRecords();
    if (error) {
      toast.error('Failed to sync financial data');
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  };

  const filteredRecords = records.filter(r => 
    (r.patient_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (r.transaction_id?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const totalInvoiced = records.reduce((acc, r) => acc + (r.amount || 0), 0);
  const pendingCollection = records.filter(r => r.status === 'pending').reduce((acc, r) => acc + (r.amount || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Financial Treasury</h2>
          <p className="text-slate-500 font-medium mt-1">Real-time revenue tracking, invoicing, and medical contract valuations.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
            <PieChart size={18} /> Treasury Report
          </button>
          <button className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2">
            <Plus size={18} /> New Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <DollarSign size={160} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Managed Volume</p>
          <p className="text-4xl font-black text-slate-800">${totalInvoiced.toLocaleString()}</p>
          <div className="mt-4 flex items-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase">
             <ArrowUpRight size={14} /> 12.5% increase
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
           <div className="absolute -right-4 -bottom-4 opacity-[0.05] group-hover:scale-110 transition-transform">
            <Receipt size={160} />
          </div>
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Pending Collections</p>
          <p className="text-4xl font-black text-white">${pendingCollection.toLocaleString()}</p>
          <p className="mt-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest">Awaiting clearing verification</p>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <TrendingUp size={160} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Conversion Efficiency</p>
          <p className="text-4xl font-black text-slate-800">88.4%</p>
          <div className="mt-4 flex items-center gap-1.5 text-indigo-600 font-black text-[10px] uppercase">
             <CheckCircle2 size={14} /> Optimized Flow
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="relative flex-1">
             <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
               type="text" 
               placeholder="Search transactions, patients, or invoices..." 
               className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-8 focus:ring-emerald-500/5 transition-all"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
           <div className="flex items-center gap-3">
             <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-emerald-600 border border-slate-100 transition-all"><Filter size={20} /></button>
             <button className="px-6 py-4 bg-slate-50 text-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all">Export CSV</button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction ID</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payer / Agency</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Item</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Settlement</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center"><Loader2 size={32} className="mx-auto animate-spin text-slate-300" /></td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center opacity-30"><DollarSign size={48} className="mx-auto mb-4" /><p className="font-black uppercase tracking-widest text-[10px]">No financial matching records found</p></td></tr>
              ) : filteredRecords.map(record => (
                <tr key={record.id} className="hover:bg-slate-50/80 transition-all group cursor-pointer">
                   <td className="px-10 py-7">
                     <p className="text-sm font-black text-slate-800 group-hover:text-emerald-600 transition-colors uppercase tracking-widest">{record.transaction_id || `WJ-${record.id.slice(0, 6)}`}</p>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Logged {new Date(record.created_at).toLocaleDateString()}</p>
                   </td>
                   <td className="px-10 py-7">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold group-hover:bg-emerald-600 group-hover:text-white transition-all text-xs">
                          {record.patient_name?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 leading-tight">{record.patient_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{record.payer_type || 'Self-Pay'}</p>
                        </div>
                      </div>
                   </td>
                   <td className="px-10 py-7">
                      <div className="flex items-center gap-2">
                         <CreditCard size={14} className="text-slate-400" />
                         <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{record.service_type || 'Medical Procedure'}</span>
                      </div>
                   </td>
                   <td className="px-10 py-7 text-right">
                      <p className="text-base font-black text-slate-900">${record.amount?.toLocaleString()}</p>
                   </td>
                   <td className="px-10 py-7 text-right">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        record.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'
                      }`}>
                         {record.status}
                      </span>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinanceModule;
