import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Truck, 
  Plane, 
  Clock, 
  User, 
  MapPin, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  AlertTriangle,
  Plus,
  ArrowRight,
  MoreVertical,
  X,
  Phone,
  ShieldCheck,
  Search,
  Globe,
  CreditCard,
  Loader2
} from 'lucide-react';
import { COUNTRY_COLORS } from '../constants.tsx';
import { PatientArrival, ArrivalStatus, TransportTeam } from '../types.ts';
import { 
    fetchPatientArrivals, 
    fetchTransportTeams, 
    createPatientArrival, 
    updateArrivalStatus,
    assignTransportToArrival
} from '../services/supabase.ts';
import { toast } from 'sonner';

const LogisticsHub: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newArrivalData, setNewArrivalData] = useState<Partial<PatientArrival>>({
    countryCode: 'UAE',
    status: ArrivalStatus.EXPECTED,
    arrivalDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [arrivalsRes, teamsRes] = await Promise.all([
      fetchPatientArrivals(),
      fetchTransportTeams()
    ]);
    if (arrivalsRes.data) setArrivals(arrivalsRes.data);
    if (teamsRes.data) setTeams(teamsRes.data);
    setLoading(false);
  };

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const filteredArrivals = useMemo(() => {
    return arrivals.filter(a => a.arrivalDate === selectedDate);
  }, [arrivals, selectedDate]);

  const handleStatusChange = async (id: string, newStatus: ArrivalStatus) => {
    try {
        const { error } = await updateArrivalStatus(id, newStatus);
        if (error) throw error;
        setArrivals(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
        toast.success(`Arrival status updated to ${newStatus}`);
    } catch (error: any) {
        toast.error('Failed to update status: ' + error.message);
    }
  };

  const assignTransport = async (arrivalId: string, transportId: string) => {
    try {
        const { error } = await assignTransportToArrival(arrivalId, transportId);
        if (error) throw error;
        
        setArrivals(prev => prev.map(a => 
          a.id === arrivalId ? { ...a, assignedTransportId: transportId } : a
        ));
        
        setShowAssignModal(null);
        toast.success('Transport team assigned successfully');
    } catch (error: any) {
        toast.error('Assignment failed: ' + error.message);
    }
  };

  const handleSaveArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArrivalData.patientName || !newArrivalData.flightNumber) return;

    const { error } = await createPatientArrival({
      patient_id: newArrivalData.patientId,
      patient_name: newArrivalData.patientName,
      flight_number: newArrivalData.flightNumber,
      carrier: newArrivalData.carrier,
      arrival_date: newArrivalData.arrivalDate,
      arrival_time: newArrivalData.arrivalTime,
      country_code: newArrivalData.countryCode,
      status: newArrivalData.status,
      notes: newArrivalData.notes
    } as any);
    
    if (error) {
        toast.error('Failed to schedule arrival: ' + error.message);
    } else {
        toast.success('Arrival record created');
        setShowAddModal(false);
        loadData();
    }
  };

  const renderCalendar = () => {
    const totalDays = daysInMonth(currentDate);
    const startOffset = firstDayOfMonth(currentDate);
    const days = [];
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50/50 rounded-2xl opacity-30 border border-slate-100"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      const dayStr = dayDate.toISOString().split('T')[0];
      const isToday = new Date().toISOString().split('T')[0] === dayStr;
      const dayArrivals = arrivals.filter(a => a.arrivalDate === dayStr);
      const isSelected = selectedDate === dayStr;

      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDate(dayStr)}
          className={`h-24 bg-white border rounded-2xl p-2 cursor-pointer transition-all hover:shadow-lg flex flex-col gap-1 relative overflow-hidden ${
            isSelected ? 'border-teal-500 ring-2 ring-teal-500/20 z-10' : 'border-slate-100'
          } ${isToday ? 'bg-teal-50/30' : ''}`}
        >
          <div className="flex justify-between items-center">
            <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg ${
              isToday ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {d}
            </span>
            {dayArrivals.length > 0 && (
              <span className="text-[8px] font-black bg-slate-800 text-white px-1.5 py-0.5 rounded-md">
                {dayArrivals.length}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1 mt-1 overflow-hidden">
             {dayArrivals.map(arrival => (
               <div 
                 key={arrival.id} 
                 className={`w-1.5 h-1.5 rounded-full ${COUNTRY_COLORS[arrival.countryCode] || 'bg-slate-400'}`}
                 title={`${arrival.patientName} (${arrival.countryCode})`}
               />
             ))}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative">
        {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-[2.5rem]">
                <Loader2 size={32} className="animate-spin text-teal-600" />
            </div>
        )}
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
              <h3 className="text-xl font-black text-slate-800">{monthName} <span className="text-slate-400">{year}</span></h3>
              <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                 <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-all text-slate-600"><ChevronLeft size={16} /></button>
                 <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800">Today</button>
                 <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-all text-slate-600"><ChevronRight size={16} /></button>
              </div>
           </div>
           
           <div className="hidden lg:flex gap-4">
              {Object.entries(COUNTRY_COLORS).slice(0, 5).map(([code, color]) => (
                <div key={code} className="flex items-center gap-1.5">
                   <div className={`w-2 h-2 rounded-full ${color.split(' ')[0]}`}></div>
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{code}</span>
                </div>
              ))}
           </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
           {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
             <div key={day} className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center py-2">{day}</div>
           ))}
           {days}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-teal-100 text-teal-600 rounded-2xl shadow-sm">
              <Truck size={28} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Logistics Hub</h2>
          </div>
          <p className="text-slate-500 font-medium">Smart scheduling for patient arrivals, pickups, and local transport resources.</p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 hover:shadow-md transition-all flex items-center gap-2"
          >
            <Plus size={18} /> Add Arrival
          </button>
          <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all flex items-center gap-2">
            <CalendarIcon size={18} /> Schedule Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Main Smart Calendar */}
        <div className="xl:col-span-8">
           {renderCalendar()}
           
           <div className="mt-8 bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden group">
              <div className="absolute right-0 bottom-0 opacity-10 scale-150 rotate-12 transition-transform duration-1000 group-hover:scale-[1.6]">
                  <Truck size={200} />
              </div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                 <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-teal-400">
                    <Truck size={18} /> Transport Fleet Status
                 </h3>
                 <button className="text-[10px] font-black uppercase tracking-widest text-teal-400 hover:underline">Manage Fleet</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                 {teams.map(team => (
                   <div key={team.id} className="bg-white/5 border border-white/10 p-5 rounded-3xl hover:bg-white/10 transition-all cursor-pointer group/team">
                      <div className="flex justify-between items-start mb-4">
                         <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${
                           team.status === 'Available' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                         }`}>
                            {team.status}
                         </div>
                         <div className="text-slate-500 group-hover/team:text-white transition-colors">
                            <ArrowRight size={14} />
                         </div>
                      </div>
                      <h4 className="font-black text-sm mb-1">{team.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold mb-4">{team.vehicle_type}</p>
                      <div className="flex items-center gap-2 text-[10px] font-black text-teal-400">
                         <Phone size={12} /> {team.contact_number}
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Daily Pickup Queue */}
        <div className="xl:col-span-4 space-y-6">
           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Arrival List</h3>
                    <div className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500">
                       {new Date(selectedDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </div>
                 </div>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input type="text" placeholder="Filter arrivals..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-[10px] font-bold outline-none" />
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 max-h-[600px]">
                 {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <Truck size={32} className="text-slate-200 mb-2" />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Syncing Logistics...</p>
                    </div>
                 ) : filteredArrivals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                       <Plane size={48} className="text-slate-300 mb-4" />
                       <p className="text-xs font-bold text-slate-500">No arrivals scheduled for this date.</p>
                    </div>
                 ) : filteredArrivals.map(arrival => (
                    <div key={arrival.id} className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                       <div className={`absolute left-0 top-0 bottom-0 w-2 ${COUNTRY_COLORS[arrival.countryCode] || 'bg-slate-200'}`}></div>
                       
                       <div className="flex justify-between items-start mb-4">
                          <div>
                             <h4 className="font-black text-sm text-slate-800 group-hover:text-teal-600 transition-colors uppercase tracking-tight">{arrival.patientName}</h4>
                             <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{arrival.countryCode} • Case {arrival.patientId?.slice(0, 6)}</p>
                          </div>
                          <button className="text-slate-300 hover:text-slate-600"><MoreVertical size={16} /></button>
                       </div>

                       <div className="grid grid-cols-2 gap-3 mb-6">
                          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100/50">
                             <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Flight</p>
                             <p className="text-[10px] font-black text-slate-700">{arrival.carrier} {arrival.flightNumber}</p>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100/50">
                             <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Time</p>
                             <p className="text-[10px] font-black text-slate-700">{arrival.arrivalTime}</p>
                          </div>
                       </div>

                       <div className="flex items-center justify-between mb-4">
                          <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                            arrival.status === ArrivalStatus.AT_FACILITY ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            arrival.status === ArrivalStatus.PICKED_UP ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                             {arrival.status}
                          </div>
                          {arrival.assigned_transport_id ? (
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-teal-600 uppercase">
                               <Truck size={12} /> Dispatched
                            </div>
                          ) : (
                            <button 
                              onClick={() => setShowAssignModal(arrival.id)}
                              className="text-[9px] font-black text-indigo-600 uppercase hover:underline"
                            >
                              Assign Transport
                            </button>
                          )}
                       </div>

                       {arrival.status === ArrivalStatus.EXPECTED && (
                         <button 
                           onClick={() => handleStatusChange(arrival.id, ArrivalStatus.PICKED_UP)}
                           className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                         >
                            Confirm Pickup
                         </button>
                       )}
                    </div>
                 ))}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
                 <ShieldCheck size={18} className="text-teal-600" />
                 <p className="text-[9px] text-slate-500 font-bold leading-relaxed italic">
                   Dynamic manifest sync active.
                 </p>
              </div>
           </div>
        </div>
      </div>

      {/* Add Arrival Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-teal-600 text-white">
                 <div>
                    <h3 className="text-xl font-black tracking-tight leading-none mb-1">Inbound Manifest</h3>
                    <p className="text-[10px] font-bold text-teal-100 uppercase tracking-widest">Global Logistics Registry</p>
                 </div>
                 <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-2xl transition-all">
                    <X size={24} />
                 </button>
              </div>
              
              <form onSubmit={handleSaveArrival} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Patient Identity</label>
                       <input 
                         required
                         type="text" 
                         className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-teal-500/10 font-bold"
                         onChange={(e) => setNewArrivalData({...newArrivalData, patientName: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Origin Code</label>
                       <select 
                         className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-teal-500/10 font-bold"
                         onChange={(e) => setNewArrivalData({...newArrivalData, countryCode: e.target.value})}
                         value={newArrivalData.countryCode}
                       >
                          {Object.keys(COUNTRY_COLORS).map(code => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Manifest Date</label>
                       <input 
                         required
                         type="date" 
                         className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-teal-500/10 font-bold"
                         value={newArrivalData.arrivalDate}
                         onChange={(e) => setNewArrivalData({...newArrivalData, arrivalDate: e.target.value})}
                       />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                        <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase mb-1">Carrier</label>
                           <input type="text" placeholder="e.g. Emirates" className="w-full bg-transparent text-xs font-bold outline-none" onChange={(e) => setNewArrivalData({...newArrivalData, carrier: e.target.value})} />
                        </div>
                        <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase mb-1">Flight No</label>
                           <input type="text" placeholder="e.g. EK202" className="w-full bg-transparent text-xs font-bold outline-none" onChange={(e) => setNewArrivalData({...newArrivalData, flightNumber: e.target.value})} />
                        </div>
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 bg-teal-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-teal-500/20">Record Arrival Plan</button>
              </form>
           </div>
        </div>
      )}

      {/* Dispatch Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-teal-600 text-white">
                 <h3 className="text-xl font-black tracking-tight">Dispatch Fleet</h3>
                 <button onClick={() => setShowAssignModal(null)} className="p-2 hover:bg-white/10 rounded-2xl"><X size={24} /></button>
              </div>
              <div className="p-8 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                 {teams.filter(t => t.status === 'Available').map(team => (
                    <button 
                      key={team.id}
                      onClick={() => assignTransport(showAssignModal, team.id)}
                      className="w-full p-6 text-left border border-slate-100 rounded-3xl hover:border-teal-500 hover:shadow-xl transition-all flex items-center justify-between group"
                    >
                       <div>
                          <h4 className="font-black text-slate-800">{team.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{team.vehicle_type}</p>
                       </div>
                       <Plus size={16} className="text-slate-300 group-hover:text-teal-600" />
                    </button>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default LogisticsHub;
