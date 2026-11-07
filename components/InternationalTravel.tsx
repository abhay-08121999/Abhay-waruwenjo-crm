
import React, { useState, useEffect } from 'react';
import {
   Plane,
   FileText,
   QrCode,
   Send,
   Plus,
   CheckCircle,
   Loader2,
   ShieldCheck,
   Globe,
   Download,
   Printer,
   Search,
   ArrowRight,
   User,
   Calendar,
   CreditCard,
   Briefcase,
   X,
   Building,
   Save,
   Clock,
   ChevronDown,
   MapPin,
   Stamp,
   Lock
} from 'lucide-react';
import { generateVisaInvitationContent } from '../services/geminiService.ts';
import { VisaInvitation, Embassy, Patient } from '../types.ts';
import { MOCK_EMBASSIES, MOCK_PATIENTS } from '../constants.tsx';

const InternationalTravel: React.FC = () => {
   const [invitations, setInvitations] = useState<VisaInvitation[]>([
      { id: 'v1', travelerName: 'Dr. Hiroshi Tanaka', passportNumber: 'TH665219', nationality: 'Japanese', purpose: 'Training', startDate: '2024-06-12', endDate: '2024-06-25', status: 'Issued', verificationCode: 'HH-TYO-992', content: 'We are pleased to invite Dr. Hiroshi Tanaka to participate in the upcoming Medical Equipment Diagnostic Seminar held at our New York facility. Dr. Tanaka will be trained on the latest robotic surgical systems and will observe live procedures. All travel and accommodation expenses will be fully covered by WaruWenJo CRM Operations.' }
   ]);
   const [showGenerator, setShowGenerator] = useState(false);
   const [isGenerating, setIsGenerating] = useState(false);
   const [formData, setFormData] = useState<Partial<VisaInvitation>>({
      purpose: 'Conference',
      status: 'Draft'
   });
   const [previewInvite, setPreviewInvite] = useState<VisaInvitation | null>(null);
   const [selectedEmbassy, setSelectedEmbassy] = useState<Embassy | null>(null);
   const [patientSearch, setPatientSearch] = useState('');
   const [isProfileSaved, setIsProfileSaved] = useState(false);

   // Auto-fill address when embassy changes
   useEffect(() => {
      if (selectedEmbassy) {
         setFormData(prev => ({
            ...prev,
            embassyId: selectedEmbassy.id,
            embassyAddress: selectedEmbassy.address
         }));
      }
   }, [selectedEmbassy]);

   const handlePatientSelect = (patient: Patient) => {
      setFormData(prev => ({
         ...prev,
         travelerName: patient.full_name,
         patientId: patient.id,
         nationality: 'Standardized'
      }));
      setPatientSearch('');
   };

   const handleGenerate = async () => {
      if (!formData.travelerName || !formData.passportNumber || !selectedEmbassy) return;

      setIsGenerating(true);
      const contextData = { ...formData, embassyName: selectedEmbassy.name };
      const content = await generateVisaInvitationContent(contextData);

      const newInvite: VisaInvitation = {
         id: Math.random().toString(36).substr(2, 9),
         travelerName: formData.travelerName,
         passportNumber: formData.passportNumber,
         nationality: formData.nationality || 'Unknown',
         purpose: formData.purpose as any,
         startDate: formData.startDate || '',
         endDate: formData.endDate || '',
         status: 'Issued',
         verificationCode: `HH-VIL-${Math.floor(1000 + Math.random() * 9000)}`,
         content: content || 'Failed to generate content.',
         embassyId: selectedEmbassy.id,
         embassyAddress: selectedEmbassy.address,
         patientId: formData.patientId
      };

      setInvitations([newInvite, ...invitations]);
      setPreviewInvite(newInvite);
      setIsGenerating(false);
      setShowGenerator(false);
      setIsProfileSaved(false);
   };

   const openPreview = (invite: VisaInvitation) => {
      setPreviewInvite(invite);
   };

   return (
      <div className="space-y-8 animate-in fade-in duration-700">
         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
               <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-sky-100 text-sky-600 rounded-2xl shadow-sm">
                     <Plane size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">Travel & Visas</h2>
               </div>
               <p className="text-slate-500 font-medium italic">Automated Visa Invitation Letters (VIL) and embassy-compliant formalities.</p>
            </div>

            <div className="flex gap-3">
               <button
                  onClick={() => setShowGenerator(true)}
                  className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all flex items-center gap-2"
               >
                  <Plus size={18} /> New Invitation
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-3 space-y-6">
               <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Invitations This Month</p>
                  <div className="flex items-end justify-between">
                     <h4 className="text-4xl font-black text-slate-800">12</h4>
                     <div className="text-right">
                        <p className="text-[10px] font-black text-green-600 uppercase">82% Verified</p>
                        <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                           <div className="h-full bg-green-500 w-[82%]"></div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-sky-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-sky-500/20 relative overflow-hidden group">
                  <Globe className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
                  <h4 className="text-lg font-black mb-2">Global Access</h4>
                  <p className="text-xs text-sky-100 leading-relaxed mb-6 font-medium">Standardized VIL templates recognized by 140+ diplomatic missions worldwide.</p>
                  <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 py-2 px-4 rounded-xl transition-all">
                     View Compliance <ArrowRight size={14} />
                  </button>
               </div>
            </div>

            <div className="xl:col-span-9">
               <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                     <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2">
                        <FileText size={18} className="text-slate-400" /> Issued Letters Log
                     </h3>
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input type="text" placeholder="Filter by Name/Passport..." className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:ring-4 focus:ring-sky-500/10 w-48" />
                     </div>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50">
                           <tr>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Traveler</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Embassy Target</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {invitations.map(invite => (
                              <tr key={invite.id} className="hover:bg-slate-50/80 transition-all group">
                                 <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                       <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center font-black">
                                          {invite.travelerName.charAt(0)}
                                       </div>
                                       <div>
                                          <p className="text-sm font-black text-slate-800">{invite.travelerName}</p>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase">{invite.nationality}</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-8 py-5">
                                    <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">
                                       {MOCK_EMBASSIES.find(e => e.id === invite.embassyId)?.name || 'Direct Routing'}
                                    </p>
                                 </td>
                                 <td className="px-8 py-5">
                                    <span className="text-[10px] font-black bg-slate-100 px-3 py-1 rounded-full uppercase tracking-tighter text-slate-600">
                                       {invite.purpose}
                                    </span>
                                 </td>
                                 <td className="px-8 py-5">
                                    <div className="flex items-center gap-1.5 text-green-600 font-black text-[10px] uppercase">
                                       <CheckCircle size={14} /> Issued
                                    </div>
                                 </td>
                                 <td className="px-8 py-5 text-right">
                                    <button
                                       onClick={() => openPreview(invite)}
                                       className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all"
                                    >
                                       <ArrowRight size={18} />
                                    </button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         </div>

         {showGenerator && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
               <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-sky-600 text-white">
                     <div>
                        <h3 className="text-xl font-black tracking-tight leading-none mb-1 text-white">Consular Letter Generator</h3>
                        <p className="text-[10px] font-bold text-sky-100 uppercase tracking-widest">Auto-filled Embassy Formalities</p>
                     </div>
                     <button onClick={() => setShowGenerator(false)} className="p-2 hover:bg-white/10 rounded-2xl transition-all">
                        <X size={24} className="text-white" />
                     </button>
                  </div>

                  <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                           <Clock size={12} /> Recall Traveler Profile
                        </label>
                        <div className="relative">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                           <input
                              type="text"
                              placeholder="Search current patients or recent travelers..."
                              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-sky-500/10 font-bold text-slate-700"
                              value={patientSearch}
                              onChange={(e) => setPatientSearch(e.target.value)}
                           />
                           {patientSearch && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-10 max-h-48 overflow-y-auto">
                                 {MOCK_PATIENTS.filter(p => (p.full_name?.toLowerCase() || "").includes(patientSearch.toLowerCase())).map(p => (
                                    <button
                                       key={p.id}
                                       onClick={() => handlePatientSelect(p)}
                                       className="w-full px-5 py-3 text-left hover:bg-sky-50 flex items-center gap-3 transition-colors"
                                    >
                                       <div className="w-8 h-8 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center text-[10px] font-black">{p.full_name.charAt(0)}</div>
                                       <span className="text-xs font-bold text-slate-700">{p.full_name}</span>
                                    </button>
                                 ))}
                              </div>
                           )}
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                              <User size={12} /> Full Traveler Name (As per Passport)
                           </label>
                           <input
                              type="text"
                              className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-sky-500/10 font-bold text-slate-700"
                              value={formData.travelerName || ''}
                              onChange={(e) => setFormData({ ...formData, travelerName: e.target.value })}
                           />
                        </div>

                        <div className="col-span-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                              <Building size={12} /> Target Consulate / Embassy
                           </label>
                           <select
                              className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-sky-500/10 font-bold text-slate-700 cursor-pointer"
                              value={selectedEmbassy?.id || ''}
                              onChange={(e) => setSelectedEmbassy(MOCK_EMBASSIES.find(emb => emb.id === e.target.value) || null)}
                           >
                              <option value="">Select Embassy (Auto-fills Address)</option>
                              {MOCK_EMBASSIES.map(emb => (
                                 <option key={emb.id} value={emb.id}>{emb.name} ({emb.city})</option>
                              ))}
                           </select>
                        </div>

                        {selectedEmbassy && (
                           <div className="col-span-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Consular Destination</p>
                              <p className="text-[10px] font-bold text-slate-600 leading-snug">{selectedEmbassy.address}</p>
                           </div>
                        )}

                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                              <CreditCard size={12} /> Passport Number
                           </label>
                           <input
                              type="text"
                              className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-sky-500/10 font-bold text-slate-700"
                              onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                           />
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                              <Globe size={12} /> Nationality
                           </label>
                           <input
                              type="text"
                              placeholder="e.g. Japanese"
                              className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-sky-500/10 font-bold text-slate-700"
                              value={formData.nationality || ''}
                              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                           />
                        </div>
                        <div className="col-span-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                              <Briefcase size={12} /> Purpose of Visit
                           </label>
                           <select
                              className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-sky-500/10 font-bold text-slate-700 cursor-pointer"
                              value={formData.purpose}
                              onChange={(e) => setFormData({ ...formData, purpose: e.target.value as any })}
                           >
                              <option value="Conference">Medical Conference Participation</option>
                              <option value="Training">Clinical Equipment Training</option>
                              <option value="Consultation">Peer-to-Peer Medical Consultation</option>
                              <option value="Observation">Surgical Observation Program</option>
                           </select>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                              <Calendar size={12} /> Arrival Date
                           </label>
                           <input
                              type="date"
                              className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-sky-500/10 font-bold text-slate-700"
                              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                           />
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                              <Calendar size={12} /> Departure Date
                           </label>
                           <input
                              type="date"
                              className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-sky-500/10 font-bold text-slate-700"
                              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                           />
                        </div>
                     </div>

                     <div className="flex items-center justify-between px-2 pt-2">
                        <div className="flex items-center gap-2">
                           <button
                              onClick={() => setIsProfileSaved(!isProfileSaved)}
                              className={`w-10 h-6 rounded-full transition-colors relative ${isProfileSaved ? 'bg-sky-600' : 'bg-slate-300'}`}
                           >
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isProfileSaved ? 'translate-x-4' : 'translate-x-0'}`} />
                           </button>
                           <span className="text-[10px] font-black text-slate-500 uppercase">Save Traveler Profile</span>
                        </div>
                        <div className="flex items-center gap-2 text-sky-600">
                           <ShieldCheck size={14} />
                           <span className="text-[10px] font-black uppercase">Consular Compliance Check</span>
                        </div>
                     </div>
                  </div>

                  <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex gap-3">
                     <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !selectedEmbassy}
                        className="flex-1 py-4 bg-sky-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 transition-all shadow-xl shadow-sky-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        Issue Official VIL
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* VIL PREVIEW MODAL (HIGH-FIDELITY PDF VIEW) */}
         {previewInvite && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
               <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[95vh]">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                     <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
                           <FileText size={20} />
                        </div>
                        <div>
                           <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 leading-none">Document Preview</h3>
                           <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Official Consular Correspondence • {previewInvite.verificationCode}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                           <Download size={14} /> PDF
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                           <Printer size={14} /> Print
                        </button>
                        <div className="w-px h-8 bg-slate-200 mx-2" />
                        <button onClick={() => setPreviewInvite(null)} className="p-2.5 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all text-slate-400">
                           <X size={20} />
                        </button>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-12 bg-slate-200/50 flex justify-center">
                     {/* VIRTUAL A4 PAPER */}
                     <div className="bg-white shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] w-[800px] min-h-[1130px] p-[80px] flex flex-col relative overflow-hidden ring-1 ring-slate-300">

                        {/* Watermark Section */}
                        <div className="absolute inset-0 flex items-center justify-center rotate-[-30deg] pointer-events-none opacity-[0.03]">
                           <h2 className="text-[10rem] font-black tracking-tighter whitespace-nowrap uppercase select-none">Consular Official</h2>
                        </div>

                        {/* Official Stamp Marking */}
                        <div className="absolute top-[60px] right-[60px] flex flex-col items-center opacity-80">
                           <div className="w-24 h-24 border-4 border-indigo-600/30 rounded-full flex items-center justify-center p-2 relative">
                              <Stamp size={48} className="text-indigo-600/40" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                 <p className="text-[7px] font-black text-indigo-600/50 text-center uppercase leading-none">Verified<br />Logistics<br />Hub</p>
                              </div>
                           </div>
                        </div>

                        {/* Letterhead */}
                        <div className="flex items-start justify-between mb-16 relative">
                           <div className="flex items-center gap-6">
                              <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center shadow-xl">
                                 <Plane className="text-white" size={40} />
                              </div>
                              <div>
                                 <h1 className="text-3xl font-black text-slate-900 tracking-tighter">WaruWenJo Operations</h1>
                                 <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] mt-1">International Clinical Triage</p>
                                 <div className="mt-4 space-y-0.5">
                                    <p className="text-[9px] font-bold text-slate-400 flex items-center gap-2"><MapPin size={10} /> 100 Medical Plaza, New York, NY 10001, USA</p>
                                    <p className="text-[9px] font-bold text-slate-400 flex items-center gap-2"><Globe size={10} /> www.healthhub-operations.med</p>
                                 </div>
                              </div>
                           </div>
                           <div className="text-right">
                              <div className="bg-slate-900 text-white px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest inline-block mb-4">Confidential</div>
                              <p className="text-xs font-black text-slate-800">Issue Date: {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Reference: {previewInvite.verificationCode}</p>
                           </div>
                        </div>

                        {/* Recipient Details */}
                        <div className="mb-12 text-slate-800">
                           <p className="font-black text-xs uppercase tracking-widest text-slate-400 mb-2">Attention of:</p>
                           <p className="font-black text-sm uppercase tracking-tight leading-tight">
                              {MOCK_EMBASSIES.find(e => e.id === previewInvite.embassyId)?.name || 'THE CONSULAR OFFICER'}
                           </p>
                           <p className="text-xs font-bold text-slate-500 leading-snug mt-1 whitespace-pre-wrap max-w-sm">
                              {previewInvite.embassyAddress}
                           </p>

                           <div className="mt-10 py-4 border-y border-slate-100">
                              <h2 className="font-black text-sm text-slate-900 uppercase tracking-tighter">
                                 Subject: Official Invitation for International Clinical Business Visit
                              </h2>
                           </div>
                        </div>

                        {/* Traveler Metadata Table */}
                        <div className="mb-10 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                           <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Traveler Information Manifest</h4>
                           <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                              <div>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase">Full Legal Name</p>
                                 <p className="text-xs font-black text-slate-800 uppercase">{previewInvite.travelerName}</p>
                              </div>
                              <div>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase">Passport Number</p>
                                 <p className="text-xs font-black text-slate-800 uppercase">{previewInvite.passportNumber}</p>
                              </div>
                              <div>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase">Travel Purpose</p>
                                 <p className="text-xs font-black text-indigo-600 uppercase">{previewInvite.purpose}</p>
                              </div>
                              <div>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase">Schedule of Stay</p>
                                 <p className="text-xs font-black text-slate-800">{previewInvite.startDate} — {previewInvite.endDate}</p>
                              </div>
                           </div>
                        </div>

                        {/* Formal Letter Body */}
                        <div className="flex-1 prose prose-slate max-w-none text-slate-800 leading-[1.8] font-serif text-[15px] space-y-6">
                           <p className="font-bold mb-4">To the Honorable Consular Officer,</p>
                           <div className="whitespace-pre-wrap italic text-slate-700 leading-relaxed border-l-4 border-indigo-50 pl-6 py-2">
                              {previewInvite.content}
                           </div>
                           <p>
                              WaruWenJo Operations hereby guarantees that the aforementioned visitor will abide by all local regulations.
                              We take full responsibility for the logistics, safety, and financial coverage of the traveler during the period specified in this manifest.
                           </p>
                           <p>We remain at your disposal for any further verification required through our secure digital portal.</p>
                        </div>

                        {/* Footer / Sign-off */}
                        <div className="mt-20 flex justify-between items-end border-t pt-10 border-slate-100">
                           <div className="space-y-8">
                              <div className="relative">
                                 {/* Digital Signature Placeholder */}
                                 <div className="absolute -top-14 left-0 select-none pointer-events-none opacity-80">
                                    <p className="font-serif text-3xl italic text-indigo-800/40">Dr. James Wilson</p>
                                 </div>
                                 <div className="pt-2 border-t-2 border-slate-200 w-64">
                                    <p className="text-sm font-black text-slate-900 mb-0.5">Dr. James Wilson</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Medical Director, International Division</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-2xl w-fit">
                                 <Lock className="text-green-600" size={14} />
                                 <span className="text-[8px] font-black text-green-700 uppercase tracking-widest">Cryptographically Signed & Time-Stamped</span>
                              </div>
                           </div>

                           <div className="text-right flex flex-col items-end">
                              <div className="p-3 bg-white border-2 border-slate-100 rounded-[2rem] shadow-2xl mb-4 group hover:scale-105 transition-transform duration-500">
                                 {/* High Density QR Code */}
                                 <div className="w-28 h-28 bg-slate-900 flex flex-wrap p-1 gap-[1px]">
                                    {[...Array(256)].map((_, i) => (
                                       <div key={i} className={`w-[5%] h-[5%] ${Math.random() > 0.4 ? 'bg-white' : 'bg-black'}`}></div>
                                    ))}
                                 </div>
                              </div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Verify Authenticity</p>
                              <p className="text-[11px] font-black text-indigo-600">{previewInvite.verificationCode}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="p-8 border-t border-slate-100 bg-white flex justify-between items-center shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                     <div className="flex items-center gap-3">
                        <ShieldCheck className="text-teal-600" size={24} />
                        <div>
                           <p className="text-xs font-black text-slate-800 uppercase leading-none">Security Clearance</p>
                           <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Standard International Consular Format v3.4</p>
                        </div>
                     </div>
                     <button className="flex items-center gap-3 px-12 py-4 bg-indigo-600 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-2xl shadow-indigo-500/20 transition-all active:scale-95">
                        <Send size={18} /> Transmit Document
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default InternationalTravel;
