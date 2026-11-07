
import React, { useState } from 'react';
import { Wallet, Plus, Camera, CreditCard, Clock, CheckCircle2 } from 'lucide-react';
import { Expense } from '../types.ts';

const MOCK_EXPENSES: Expense[] = [
  { id: '1', category: 'Travel', amount: 45.20, date: '2024-05-18', status: 'Pending', description: 'Uber to Metropolitan General' },
  { id: '2', category: 'Meals', amount: 120.00, date: '2024-05-17', status: 'Approved', description: 'Lunch with Dr. Thorne' },
  { id: '3', category: 'Lodging', amount: 450.00, date: '2024-05-15', status: 'Approved', description: 'Conference Stay (2 Nights)' }
];

const Expenses: React.FC = () => {
  const [expenses] = useState(MOCK_EXPENSES);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Reimbursements</h2>
          <p className="text-slate-500 text-sm font-medium">Business expenditures and claim status center.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all active:scale-95">
          <Camera size={16} /> Scan Receipt
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
          <CreditCard className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 mb-2">Total Claimed</p>
          <p className="text-4xl font-black">$615.20</p>
          <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-indigo-100 bg-white/10 w-fit px-3 py-1.5 rounded-full">
            <CheckCircle2 size={12} /> 2 Approved This Month
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Pending Approval</p>
          <p className="text-4xl font-black text-slate-800">$45.20</p>
          <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 w-fit px-3 py-1.5 rounded-full">
            <Clock size={12} /> 1 Claim Reviewing
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center">
           <button className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-slate-200 rounded-3xl hover:border-teal-500 hover:bg-teal-50 transition-all text-slate-400 hover:text-teal-600 group">
             <Plus size={32} />
             <span className="text-[10px] font-black uppercase tracking-widest">Manual Entry</span>
           </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-200">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Description</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((exp) => (
              <tr key={exp.id} className="hover:bg-slate-50/80 transition-all group">
                <td className="px-8 py-6">
                  <p className="text-sm font-black text-slate-800 leading-none mb-1">{exp.description}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{exp.date}</p>
                </td>
                <td className="px-8 py-6">
                   <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase tracking-tighter">
                     {exp.category}
                   </span>
                </td>
                <td className="px-8 py-6 text-sm font-black text-slate-900">
                  ${exp.amount.toFixed(2)}
                </td>
                <td className="px-8 py-6">
                  <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter ${
                    exp.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {exp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Expenses;
