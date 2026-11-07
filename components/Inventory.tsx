
import React, { useState } from 'react';
import { Package, Plus, Search, AlertCircle, History, TrendingDown } from 'lucide-react';
import { InventoryItem } from '../types.ts';

const MOCK_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'CardioShield V2 Samples', type: 'Sample', stock: 142, unit: 'Packs', sku: 'CS-V2-01' },
  { id: '2', name: 'NeuroLite Injectables', type: 'Sample', stock: 8, unit: 'Vials', sku: 'NL-INJ-04' },
  { id: '3', name: 'MRI Buyer Guide 2024', type: 'Collateral', stock: 50, unit: 'Books', sku: 'MKT-MRI-24' },
  { id: '4', name: 'Premium Stethoscopes', type: 'Gift', stock: 5, unit: 'Units', sku: 'GFT-MD-ST' }
];

const Inventory: React.FC = () => {
  const [items] = useState(MOCK_INVENTORY);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Supply & Samples</h2>
          <p className="text-slate-500 text-sm font-medium">Manage distribution and stock of medical samples/collateral.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all">
          <Plus size={16} /> Order Restock
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${
                item.stock < 10 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'
              }`}>
                <Package size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.sku}</span>
            </div>
            <h4 className="font-black text-slate-800 text-lg leading-tight mb-1">{item.name}</h4>
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-4">{item.type}</p>
            
            <div className="flex justify-between items-end pt-4 border-t border-slate-50">
              <div>
                <p className={`text-2xl font-black ${item.stock < 10 ? 'text-red-600' : 'text-slate-900'}`}>{item.stock}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Remaining {item.unit}</p>
              </div>
              {item.stock < 10 && (
                <div className="flex items-center gap-1.5 text-[10px] font-black text-red-600 bg-red-50 px-3 py-1.5 rounded-full animate-pulse">
                  <AlertCircle size={12} /> LOW STOCK
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
             <History className="text-slate-400" size={20} />
             <h3 className="font-black text-slate-800 tracking-tight">Recent Disposals & Gifts</h3>
          </div>
          <button className="text-[10px] font-black text-teal-600 uppercase tracking-widest hover:underline">View Ledger</button>
        </div>
        <div className="space-y-4">
          {[
            { target: 'Dr. Sarah Smith', item: 'NeuroLite Vials', qty: '2', date: '2 hours ago' },
            { target: 'Metropolitan General', item: 'MRI Guide', qty: '5', date: 'Yesterday' },
            { target: 'Marcus Thorne', item: 'CardioShield V2', qty: '1', date: 'May 18' },
          ].map((log, i) => (
            <div key={i} className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 px-4 rounded-2xl transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-black">
                  {log.qty}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">{log.item}</p>
                  <p className="text-xs text-slate-400 font-bold">To: {log.target}</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase">{log.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Inventory;
