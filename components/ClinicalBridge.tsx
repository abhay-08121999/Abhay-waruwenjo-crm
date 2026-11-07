import React, { useState, useEffect, useMemo } from 'react';
import {
  Network, Send, UserPlus, Search, X, CheckCircle, Clock, Stethoscope, 
  MessageSquare, ArrowUpRight, ClipboardCheck, Filter, MoreVertical, 
  Plus, ArrowRightLeft, ChevronRight, AlertCircle, Mail, Languages, 
  Loader2, Check, Sparkles, Printer, Download, FileText, ShieldCheck, 
  Building2, Heart, Activity, Link, Copy, ExternalLink, Dna, Syringe
} from 'lucide-react';
import { PHYSICIANS } from '../constants.tsx';
import { ClinicalConsultation, MedicalOpinion, AutomatedMessage, SpecializedPackage } from '../types.ts';
import { translateMedicalContent, generateSpecializedOpinion } from '../services/geminiService.ts';
import { 
  fetchPatientEnquiries, 
  fetchConsultations, 
  updateLeadStatus, 
  createConsultationFromEnquiry,
  updateConsultationStatus
} from '../services/supabase.ts';
import { toast } from 'sonner';

const SPECIALIZED_PACKAGES: SpecializedPackage[] = [
  { id: 'p1', name: 'Liver Transplant', category: 'Transplant', description: 'Comprehensive donor-recipient matching and post-op protocols.' },
  { id: 'p2', name: 'Kidney Transplant', category: 'Transplant', description: 'Renal replacement therapy and long-term immunosuppression care.' },
  { id: 'p3', name: 'Knee Replacement (TKR)', category: 'Ortho', description: 'Minimally invasive orthopedic surgery and physical rehab.' },
  { id: 'p4', name: 'CABG (Heart Bypass)', category: 'Cardiac', description: 'Coronary artery bypass grafting with advanced recovery monitoring.' },
  { id: 'p5', name: 'Brain Tumor Triage', category: 'Neuro', description: 'Neuro-surgical planning and localized radiation therapy consultation.' },
  { id: 'p6', name: 'IVF & Fertility', category: 'General', description: 'Advanced reproductive health assistance and embryology services.' },
  { id: 'p7', name: 'Bone Marrow Transplant', category: 'Transplant', description: 'Stem cell harvesting and hematology-oncology specialized care.' },
  { id: 'p8', name: 'Robotic Prostatectomy', category: 'Neuro', description: 'Precision robotic-assisted urological surgery for oncology.' }
];

const LANGUAGES = [
  'Arabic', 'French', 'Spanish', 'Russian', 'Chinese', 'Hindi', 'Portuguese', 'German', 'Bengali', 'Japanese'
];

const ClinicalBridge: React.FC = () => {
  const [inbox, setInbox] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuery, setSelectedQuery] = useState<any | null>(null);
  const [showDoctorOnboard, setShowDoctorOnboard] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);

  // AI Opinion States
  const [showAIPackages, setShowAIPackages] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatedAIOpinion, setGeneratedAIOpinion] = useState<{ content: string, package: string, patient: string, id: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Opinion Submission State
  const [opinionDraft, setOpinionDraft] = useState('');
  const [activeConsultId, setActiveConsultId] = useState<string | null>(null);

  // Translation State
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState('Arabic');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [enquiriesRes, consultationsRes] = await Promise.all([
      fetchPatientEnquiries(),
      fetchConsultations()
    ]);

    if (enquiriesRes.data) setInbox(enquiriesRes.data.filter(e => e.status === 'new' || e.status === 'contacted'));
    if (consultationsRes.data) setConsultations(consultationsRes.data);
    setLoading(false);
  };

  const handleForward = async (query: any, doctorId: string, doctorName: string) => {
    setIsForwarding(true);
    const { error } = await createConsultationFromEnquiry(query.id, doctorId, 'Standard Consultation');
    
    if (error) {
      toast.error('Failed to forward case: ' + error.message);
    } else {
      toast.success(`Case bridged to ${doctorName}`);
      loadData();
      setSelectedQuery(null);
    }
    setIsForwarding(false);
  };

  const handleGenerateAIOpinion = async (pkg: SpecializedPackage) => {
    if (!selectedQuery) return;
    setIsGeneratingAI(true);
    const opinion = await generateSpecializedOpinion(pkg.name, selectedQuery.full_name || 'Patient', selectedQuery.message || selectedQuery.notes || 'No notes provided');
    if (opinion) {
      setGeneratedAIOpinion({
        id: `AI-${Math.floor(Math.random() * 10000)}`,
        content: opinion,
        package: pkg.name,
        patient: selectedQuery.full_name || 'Patient'
      });
      setShowAIPackages(false);
    }
    setIsGeneratingAI(false);
  };

  const copyShareLink = () => {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    const url = `https://healthhub.portal/opinion/${generatedAIOpinion?.id}`;
    navigator.clipboard.writeText(url);
  };

  const handleTranslate = async (consultId: string, opinionId: string, text: string) => {
    setTranslatingId(opinionId);
    const translatedText = await translateMedicalContent(text, selectedLang);
    if (translatedText) {
        toast.success(`Translated to ${selectedLang}`);
        // In a real app, we'd update the record in Supabase
    }
    setTranslatingId(null);
  };

  const submitOpinion = async (consultId: string) => {
    if (!opinionDraft.trim()) return;

    const { error } = await updateConsultationStatus(consultId, 'completed');
    if (error) {
      toast.error('Failed to submit opinion');
    } else {
      toast.success('Clinical opinion recorded');
      setOpinionDraft('');
      setActiveConsultId(null);
      loadData();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-2xl shadow-sm">
              <Network size={28} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Clinical Bridge</h2>
          </div>
          <p className="text-slate-500 font-medium">Bridge the communication gap between patient queries and expert medical personnel.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowDoctorOnboard(true)}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 hover:shadow-md transition-all flex items-center gap-2"
          >
            <UserPlus size={18} /> Specialist Registry
          </button>
          <button className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-2">
            <ArrowRightLeft size={18} /> Multi-Doctor Panel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Inbound Clinical Queue */}
        <div className="xl:col-span-5 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-500" /> Triage Inbound
            </h3>
            <span className="text-[10px] font-black bg-slate-800 text-white px-2.5 py-1 rounded-lg">
              {inbox.length} New Leads
            </span>
          </div>

          <div className="space-y-4">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[3rem] border border-slate-100">
                    <Loader2 size={32} className="animate-spin text-slate-300 mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Syncing Enquiries...</p>
                </div>
            ) : inbox.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <CheckCircle size={48} className="text-slate-200 mb-4" />
                    <p className="text-sm font-bold text-slate-400 text-center px-8">Queue is clear. No pending triage enquiries.</p>
                </div>
            ) : inbox.map((query) => (
              <div
                key={query.id}
                onClick={() => setSelectedQuery(query)}
                className={`group p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer ${
                    selectedQuery?.id === query.id
                      ? 'bg-white border-indigo-50 shadow-2xl shadow-indigo-500/10 scale-[1.02]'
                      : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-xl'
                  }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                       <Stethoscope size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 leading-tight">{query.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {new Date(query.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {query.treatment_interest || 'General'}
                      </p>
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-50 text-slate-300 group-hover:text-indigo-400 transition-colors">
                    <ChevronRight size={18} />
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-2">"{query.message || query.notes || 'Clinical query details pending...'}"</p>

                <div className="mt-6 flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-in fade-in duration-500">
                  Bridge to Specialist <ArrowUpRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Forwarding & Tracking Panel */}
        <div className="xl:col-span-7 space-y-8">
          {selectedQuery ? (
            <div className="bg-white border-4 border-indigo-50 rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-right-8 duration-500 sticky top-24">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-lg">
                    <ArrowRightLeft size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Clinical Triage</h3>
                    <p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.2em]">Forwarding Interface</p>
                  </div>
                </div>
                <button onClick={() => setSelectedQuery(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 col-span-2 md:col-span-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Case Context</p>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed italic line-clamp-3">"{selectedQuery.message || selectedQuery.notes || 'Inquiry details not specified.'}"</p>
                </div>
                <div className="bg-indigo-50 rounded-[2rem] p-6 border border-indigo-100 flex flex-col justify-center gap-3">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Gemini AI Synthesis</p>
                  <button
                    onClick={() => setShowAIPackages(true)}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                  >
                    <Sparkles size={14} /> Generate AI Opinion
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assign Specialist Physician</p>
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-300" />
                    <span className="text-[10px] font-black text-slate-500">All Specialists</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                  {PHYSICIANS.map((doc) => (
                    <button
                      key={doc.name}
                      onClick={() => handleForward(selectedQuery, doc.id || 'system', doc.name)}
                      disabled={isForwarding}
                      className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-3xl hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group/doc relative overflow-hidden"
                    >
                      <img src={doc.avatar} className="w-12 h-12 rounded-2xl object-cover shadow-sm group-hover/doc:scale-110 transition-transform" alt="" />
                      <div className="text-left flex-1 overflow-hidden">
                        <p className="text-sm font-black text-slate-800 leading-none group-hover/doc:text-indigo-600 truncate">{doc.name}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">{doc.specialty}</p>
                      </div>
                      <div className="opacity-0 group-hover/doc:opacity-100 transition-opacity bg-indigo-50 p-2 rounded-xl">
                        <Send size={14} className="text-indigo-600" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {isForwarding && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-[3rem]">
                  <Loader2 size={48} className="animate-spin text-indigo-600 mb-4" />
                  <p className="text-sm font-black text-slate-800 uppercase tracking-widest">Bridging Clinical Case...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-teal-500" /> Multi-Opinion Monitor
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div><span className="text-[9px] font-black text-slate-400 uppercase">Pending Review</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-teal-500"></div><span className="text-[9px] font-black text-slate-400 uppercase">Validated</span></div>
                </div>
              </div>

              <div className="space-y-6">
                {consultations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
                    <Stethoscope size={64} className="text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold">Opinion Tracking Inactive</p>
                    <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest mt-1">Select a triage query to begin</p>
                  </div>
                ) : consultations.map((consult) => (
                  <div key={consult.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-800 font-bold">
                          {consult.doctor?.name?.charAt(0) || 'D'}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 leading-tight">Consultation #{consult.id.slice(0, 8)}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Specialist: {consult.doctor?.name || 'Assigned Specialist'}</p>
                        </div>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${consult.status === 'completed' ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700 animate-pulse'
                        }`}>
                        {consult.status}
                      </div>
                    </div>

                    <div className="p-6">
                      {consult.status === 'completed' ? (
                        <div className="space-y-4">
                           <div className="p-5 bg-teal-50/30 rounded-[1.5rem] border border-teal-100 group/opinion relative">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Medical Opinion Recorded</span>
                                </div>
                                <p className="text-sm font-bold text-slate-700 italic leading-relaxed whitespace-pre-wrap">"{consult.notes || 'Outcome analysis pending...'}"</p>
                            </div>
                          <a
                            href="#/communications"
                            className="w-full py-4 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 flex items-center justify-center gap-2 hover:brightness-110"
                          >
                            <Mail size={14} /> Send Outcome to Patient
                          </a>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 opacity-60">
                            <Clock size={16} className="text-slate-400" />
                            <p className="text-xs font-bold text-slate-500">Awaiting specialist validation... Scheduled for {new Date(consult.scheduled_at).toLocaleDateString()}</p>
                          </div>

                          {activeConsultId === consult.id ? (
                            <div className="space-y-3 animate-in fade-in zoom-in-95">
                              <textarea
                                placeholder="Transcription of doctor's formal opinion..."
                                className="w-full p-5 bg-white border border-indigo-200 rounded-[1.5rem] text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[100px] font-medium"
                                value={opinionDraft}
                                onChange={(e) => setOpinionDraft(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => submitOpinion(consult.id)}
                                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest font-black"
                                >
                                  Submit Clinical Record
                                </button>
                                <button
                                  onClick={() => setActiveConsultId(null)}
                                  className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setActiveConsultId(consult.id)}
                              className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 font-black"
                            >
                              <Plus size={16} /> Record Outcome Decision
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Specialized Package Selection Modal */}
      {showAIPackages && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <div>
                <h3 className="text-xl font-black tracking-tight leading-none mb-1">High Demand AI Opinions</h3>
                <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Select Specialized Treatment Package</p>
              </div>
              <button onClick={() => setShowAIPackages(false)} className="p-2 hover:bg-white/10 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {SPECIALIZED_PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handleGenerateAIOpinion(pkg)}
                  disabled={isGeneratingAI}
                  className="p-6 text-left border-2 border-slate-100 rounded-[2rem] hover:border-indigo-500 hover:shadow-xl transition-all group flex flex-col gap-2 relative overflow-hidden"
                >
                   <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      {pkg.category === 'Transplant' && <Heart size={18} />}
                      {pkg.category === 'Neuro' && <Stethoscope size={18} />}
                      {pkg.category === 'Cardiac' && <Activity size={18} />}
                      {pkg.category === 'Ortho' && <Building2 size={18} />}
                      {pkg.name.includes('Fertility') && <Dna size={18} />}
                    </div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{pkg.category}</span>
                  </div>
                  <h4 className="font-black text-slate-800 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{pkg.name}</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed italic line-clamp-2">"{pkg.description}"</p>
                </button>
              ))}
            </div>
            {isGeneratingAI && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 z-[160]">
                <Loader2 size={64} className="text-indigo-600 animate-spin mb-6" />
                <p className="text-xl font-black text-slate-800 tracking-tight">Gemini clinical synthesis in progress...</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Retrieving procedural benchmarks and recovery stay data</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generated AI Opinion PDF Preview */}
      {generatedAIOpinion && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <Sparkles className="text-indigo-400" size={24} />
                <div>
                  <h3 className="text-xl font-black tracking-tight leading-none">Specialized Clinical Package Opinion</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">AI Generated • {generatedAIOpinion.package}</p>
                </div>
              </div>
              <button onClick={() => setGeneratedAIOpinion(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-12 bg-slate-50">
              <div className="bg-white shadow-2xl min-h-[1000px] w-full p-16 flex flex-col mx-auto border-t-[12px] border-indigo-600 relative">
                <div className="flex justify-between items-start mb-16">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-lg"><Building2 size={32} /></div>
                    <div>
                      <h1 className="text-2xl font-black text-slate-900 tracking-tighter">WaruWenJo Medical Board</h1>
                    </div>
                  </div>
                </div>
                <div className="whitespace-pre-wrap font-serif text-[18px] text-slate-800 leading-relaxed">
                   {generatedAIOpinion.content}
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-white flex justify-between gap-4 shrink-0">
               <button onClick={copyShareLink} className={`flex items-center gap-2 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${copiedLink ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                  <Link size={16} /> {copiedLink ? 'Copied' : 'Copy Link'}
               </button>
               <button onClick={() => setGeneratedAIOpinion(null)} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Close Preview</button>
            </div>
          </div>
        </div>
      )}

      {/* Specialist Registry - Doctor Onboarding Slide-over */}
      {showDoctorOnboard && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <div>
                <h3 className="text-xl font-black tracking-tight leading-none mb-1">Global Registry</h3>
                <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Active specialist physicians</p>
              </div>
              <button onClick={() => setShowDoctorOnboard(false)} className="p-2 hover:bg-white/10 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 max-h-[400px] overflow-y-auto custom-scrollbar space-y-3">
               {PHYSICIANS.map(doc => (
                 <div key={doc.name} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <img src={doc.avatar} className="w-12 h-12 rounded-xl object-cover" alt="" />
                    <div>
                        <p className="text-sm font-black text-slate-800">{doc.name}</p>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{doc.specialty}</p>
                    </div>
                 </div>
               ))}
            </div>
            <div className="p-8 border-t border-slate-50 bg-slate-50/50">
               <button onClick={() => window.location.hash = '/doctors'} className="w-full py-4 bg-indigo-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest">Manage All Doctors</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicalBridge;
