import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Plus, Search, Filter, MoreVertical, FileText, CheckCircle2, XCircle, Clock, Eye, Pencil } from 'lucide-react';

interface QuotationsListProps {
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
}

const QuotationsList: React.FC<QuotationsListProps> = ({ onCreateNew, onEdit, onPreview }) => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchQuotations();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          *,
          patient_enquiries ( name:full_name, id ),
          templates ( name )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotations:', error);
      } else {
        setQuotations(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'sent': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'viewed': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'accepted': return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200'; // draft
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'sent': return <Clock size={14} />;
      case 'viewed': return <Eye size={14} />;
      case 'accepted': return <CheckCircle2 size={14} />;
      case 'rejected': return <XCircle size={14} />;
      default: return <FileText size={14} />;
    }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by Lead or ID..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
            />
          </div>
          <button className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors">
            <Filter size={18} />
          </button>
        </div>
        
        <button 
          onClick={onCreateNew}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20"
        >
          <Plus size={18} />
          New Quotation
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold">
              <th className="px-6 py-4 border-b border-slate-100">Quotation ID</th>
              <th className="px-6 py-4 border-b border-slate-100">Lead / Patient</th>
              <th className="px-6 py-4 border-b border-slate-100">Type</th>
              <th className="px-6 py-4 border-b border-slate-100">Total Amount</th>
              <th className="px-6 py-4 border-b border-slate-100">Status</th>
              <th className="px-6 py-4 border-b border-slate-100">Date</th>
              <th className="px-6 py-4 border-b border-slate-100"></th>
            </tr>
          </thead>
          <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <div className="w-8 h-8 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
                  Loading quotations...
                </td>
              </tr>
            ) : quotations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-base font-bold text-slate-600">No quotations found</p>
                  <p className="text-sm font-medium mt-1">Create your first quotation to get started.</p>
                </td>
              </tr>
            ) : (
              quotations.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => onEdit(q.id)}>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                      {q.id.substring(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-800">{q.patient_enquiries?.name || 'Unknown'}</span>
                  </td>
                  <td className="px-6 py-4 capitalize text-slate-600">
                    {q.type}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {q.currency} {q.total_amount?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(q.status)} capitalize`}>
                      {getStatusIcon(q.status)}
                      {q.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(q.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block" ref={openMenuId === q.id ? menuRef : null}>
                      <button
                        id={`quotation-menu-btn-${q.id}`}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === q.id ? null : q.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown Menu */}
                      {openMenuId === q.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                          style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)' }}
                        >
                          <button
                            id={`quotation-edit-${q.id}`}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              onEdit(q.id);
                            }}
                          >
                            <Pencil size={15} className="text-slate-400" />
                            Edit
                          </button>
                          <button
                            id={`quotation-preview-${q.id}`}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              onPreview(q.id);
                            }}
                          >
                            <Eye size={15} className="text-slate-400" />
                            Preview
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QuotationsList;

