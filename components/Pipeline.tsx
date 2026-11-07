
import React from 'react';
import { MOCK_LEADS } from '../constants.tsx';
import { LeadStatus } from '../types.ts';
import { MoreHorizontal, Plus } from 'lucide-react';

const Pipeline: React.FC = () => {
  const columns = Object.values(LeadStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Sales Pipeline</h2>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          Customize Pipeline
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
        {columns.map((column) => {
          const leadsInColumn = MOCK_LEADS.filter(l => l.status === column);
          return (
            <div key={column} className="flex-shrink-0 w-80">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-700">{column}</h3>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                    {leadsInColumn.length}
                  </span>
                </div>
                <button className="p-1 hover:bg-slate-200 rounded">
                  <Plus size={16} />
                </button>
              </div>

              <div className="space-y-3 bg-slate-100 p-2 rounded-xl min-h-[500px]">
                {leadsInColumn.map((lead) => (
                  <div 
                    key={lead.id} 
                    className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">{lead.company}</p>
                      <button className="text-slate-400 hover:text-slate-600">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">{lead.name}</h4>
                    <p className="text-sm font-medium text-slate-700">${lead.value.toLocaleString()}</p>
                    
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex -space-x-2">
                         <img src={`https://picsum.photos/24/24?random=${lead.id}`} className="w-6 h-6 rounded-full border-2 border-white" alt="Owner" />
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">
                        {new Date(lead.lastContact).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Pipeline;
