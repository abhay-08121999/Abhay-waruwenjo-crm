import React, { useState, useEffect } from 'react';
import { Mail, MessageCircle, Zap, Loader2, CheckCircle, ArrowRight, ShieldCheck, RefreshCcw, Info } from 'lucide-react';
import { parseRawMessageToLead } from '../services/automationService.ts';
import { createPatientEnquiry, fetchPatientEnquiries } from '../services/supabase.ts';
import { Lead } from '../types.ts';
import { toast } from 'sonner';

const MOCK_INBOUND_FEED = [
  { id: 'm1', sender: '+44 7700 900077', content: 'Hi, I need a liver transplant consultation for my father in London. How do I start?', source: 'WhatsApp', receivedAt: '2 mins ago', status: 'Pending' },
  { id: 'm2', sender: 'ahmed.mansour@gmail.com', content: 'Inquiry regarding robotic prostatectomy costs and surgeon availability for next month.', source: 'Email', receivedAt: '15 mins ago', status: 'Pending' },
  { id: 'm3', sender: '+971 50 123 4567', content: 'Looking for IVF specialized clinics in Dubai with high success rates.', source: 'WhatsApp', receivedAt: '1 hour ago', status: 'Pending' }
];

const LeadAutomation: React.FC = () => {
  const [messages, setMessages] = useState<any[]>(MOCK_INBOUND_FEED);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [lastConvertedLead, setLastConvertedLead] = useState<Partial<Lead> | null>(null);

  const handleProcess = async (msg: any) => {
    setProcessingId(msg.id);
    setLastConvertedLead(null);
    
    try {
        const result = await parseRawMessageToLead(msg.content, msg.source as any);
        
        if (result) {
          // Sync with Supabase
          const { error } = await createPatientEnquiry({
            full_name: result.name || 'AI Extracted Lead',
            email: result.email || '',
            phone: result.phone || msg.sender,
            treatment_interest: result.treatmentInterest || 'General',
            message: msg.content,
            notes: result.notes || 'AI Parsed from inbound feed',
            status: 'new'
          } as any);

          if (error) throw error;

          setLastConvertedLead(result);
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'Converted' } : m));
          toast.success('Lead successfully extracted and synced');
        }
    } catch (error: any) {
        toast.error('AI Extraction failed: ' + error.message);
    } finally {
        setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg">
              <Zap size={24} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Lead Automation</h2>
          </div>
          <p className="text-slate-500 font-medium max-w-xl">
            AI-powered zero-touch lead capture. Incoming queries from WhatsApp and Email are instantly structured using Gemini.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl border border-green-100">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-black uppercase tracking-widest text-[9px]">Live Engine Active</span>
          </div>
          <button onClick={() => setMessages(MOCK_INBOUND_FEED)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all">
            <RefreshCcw size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Source Control */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-teal-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl">
                  <MessageCircle size={32} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-xl tracking-tight">WhatsApp Tunnel</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">+971 7700 900077</p>
                </div>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Received</p>
                 <p className="text-2xl font-black text-slate-800">42</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Converted</p>
                 <p className="text-2xl font-black text-teal-600">28</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Mail size={32} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-xl tracking-tight">Email Gate</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">inbound@healthhub.io</p>
                </div>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Emails</p>
                 <p className="text-2xl font-black text-slate-800">124</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Parsed</p>
                 <p className="text-2xl font-black text-indigo-600">102</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Processing Preview */}
        <div className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-12 opacity-5">
              <Zap size={300} className="text-white" />
          </div>
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-teal-400">
                <Zap size={20} />
              </div>
              <h3 className="text-white font-black uppercase tracking-widest text-xs">Extraction Core</h3>
            </div>
            <ShieldCheck className="text-teal-400" size={24} />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            {processingId ? (
              <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
                <Loader2 className="w-20 h-20 text-teal-400 animate-spin mx-auto" strokeWidth={3} />
                <div>
                   <p className="text-teal-400 font-black uppercase tracking-[0.3em] text-[10px] mb-2">Analyzing Clinical Intent</p>
                   <p className="text-white/40 text-[9px] font-medium uppercase tracking-widest">Applying Medical Entity Recognition</p>
                </div>
              </div>
            ) : lastConvertedLead ? (
              <div className="w-full space-y-6 animate-in slide-in-from-bottom-6 duration-500">
                <div className="p-8 bg-white/5 border border-white/10 rounded-[2rem] space-y-6 backdrop-blur-sm">
                   <div className="flex justify-between items-center pb-4 border-b border-white/10">
                      <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Synthesis Results</span>
                      <CheckCircle className="text-green-400" size={16} />
                   </div>
                   <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Identified Patient</p>
                        <p className="text-base font-black text-white">{lastConvertedLead.name}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Treatment Area</p>
                        <p className="text-base font-black text-white">{lastConvertedLead.company || 'Unknown'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Clinical Context</p>
                        <p className="text-sm text-slate-300 leading-relaxed italic">"{lastConvertedLead.notes}"</p>
                      </div>
                   </div>
                </div>
                <div className="bg-teal-600/20 p-5 rounded-2xl border border-teal-500/30 flex items-center justify-between group cursor-pointer hover:bg-teal-600/30 transition-all">
                   <div className="flex items-center gap-3">
                      <Zap className="text-teal-400" size={20} />
                      <span className="text-xs font-black text-white uppercase tracking-widest">Pushed to Patient Discovery</span>
                   </div>
                   <ArrowRight className="text-white group-hover:translate-x-2 transition-transform" size={18} />
                </div>
              </div>
            ) : (
              <div className="text-center opacity-30">
                <div className="w-20 h-20 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                    <Info size={40} className="text-white" />
                </div>
                <p className="text-white font-black uppercase tracking-widest text-xs">Observation Mode</p>
                <p className="text-slate-500 text-[10px] font-medium mt-2 max-w-[200px] mx-auto uppercase">Select an inbound signal from the feed to initiate AI extraction</p>
              </div>
            )}
          </div>
          <div className="pt-8 border-t border-white/5 relative z-10 flex justify-between items-center">
             <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Engine: Gemini 1.5 Pro</p>
             <p className="text-[9px] text-teal-900 font-black uppercase tracking-widest px-2 py-1 bg-teal-400 rounded-md">Validated</p>
          </div>
        </div>
      </div>

      {/* Inbound Feed */}
      <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-10">
            <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <RefreshCcw size={20} className="text-indigo-500" /> Live Signal Feed
            </h3>
            <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1.5 rounded-xl uppercase tracking-widest">
                {messages.filter(m => m.status === 'Pending').length} Pending
            </span>
        </div>
        
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`group p-8 rounded-[2.5rem] border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-8 ${
              msg.status === 'Converted' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-500/5'
            }`}>
              <div className="flex items-start gap-6 flex-1">
                <div className={`p-5 rounded-2xl shrink-0 shadow-sm ${
                  msg.source === 'WhatsApp' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                }`}>
                  {msg.source === 'WhatsApp' ? <MessageCircle size={28} /> : <Mail size={28} />}
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-black text-slate-900 text-base leading-none tracking-tight">{msg.sender}</p>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{msg.receivedAt}</span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{msg.content}"</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 shrink-0">
                {msg.status === 'Converted' ? (
                  <div className="flex items-center gap-2 px-6 py-3 bg-white text-green-600 rounded-2xl border border-green-100 font-black text-[10px] uppercase tracking-widest shadow-sm">
                    <CheckCircle size={16} /> Lead Identified
                  </div>
                ) : (
                  <button 
                    onClick={() => handleProcess(msg)}
                    disabled={processingId !== null}
                    className="flex items-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {processingId === msg.id ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    Sync with AI
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default LeadAutomation;
