import React, { useState, useEffect } from 'react';
import { fetchTravelBookings, createTravelBooking, updateTravelBooking } from '../services/supabase.ts';
import { TravelBooking } from '../types.ts';
import { Plane, Hotel, Car, Plus, Search, ChevronRight, CheckCircle2, Clock, X, MapPin, Calendar, Briefcase, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

const TravelManagement: React.FC = () => {
  const [bookings, setBookings] = useState<TravelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newBooking, setNewBooking] = useState<Partial<TravelBooking>>({
    type: 'Flight',
    status: 'Pending'
  });

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    const { data, error } = await fetchTravelBookings();
    if (!error && data) {
      setBookings(data.map((b: any) => ({
        id: b.id,
        patientId: b.patient_id,
        patientName: b.patient_name,
        type: b.booking_type,
        provider: b.provider,
        reference: b.reference,
        date: b.booking_date,
        status: b.status,
        details: b.details || ''
      })));
    }
    setLoading(false);
  };

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const { error } = await createTravelBooking({
          patient_name: newBooking.patientName,
          booking_type: newBooking.type,
          provider: newBooking.provider,
          reference: newBooking.reference || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
          booking_date: newBooking.date,
          status: 'Pending',
          details: newBooking.details
        } as any);

        if (error) throw error;
        
        toast.success('Travel booking dispatched to logistics');
        setShowModal(false);
        loadBookings();
    } catch (error: any) {
        toast.error('Booking failed: ' + error.message);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: 'Confirmed' | 'Pending' | 'Cancelled') => {
    try {
        const { error } = await updateTravelBooking(id, { status: newStatus });
        if (error) throw error;
        toast.success(`Booking marked as ${newStatus}`);
        loadBookings();
    } catch (error: any) {
        toast.error('Update failed: ' + error.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg">
                <Plane size={24} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Travel Command</h2>
          </div>
          <p className="text-slate-500 font-medium max-w-xl">Multi-modal booking management for medical travelers. Synchronize flights, hotels, and ground transfers in real-time.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-2"
        >
          <Plus size={18} /> New Logistics Booking
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Active Flights', count: bookings.filter(b => b.type === 'Flight').length, icon: <Plane className="text-sky-600" />, color: 'bg-sky-50' },
          { label: 'Stay Milestones', count: bookings.filter(b => b.type === 'Hotel').length, icon: <Hotel className="text-amber-600" />, color: 'bg-amber-50' },
          { label: 'Ground Transfers', count: bookings.filter(b => b.type === 'Transfer').length, icon: <Car className="text-indigo-600" />, color: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-xl transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                {stat.icon && React.cloneElement(stat.icon as React.ReactElement, { size: 100 })}
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
              <p className="text-5xl font-black text-slate-800 tracking-tighter">{stat.count}</p>
            </div>
            <div className={`p-6 rounded-3xl relative z-10 ${stat.color}`}>{stat.icon}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h3 className="font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3">
            <Clock size={20} className="text-indigo-500" /> Operational Dispatch Queue
          </h3>
          <div className="relative group w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors" size={18} />
            <input type="text" placeholder="Search traveler reference..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all text-slate-700" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest">Accessing Global GDS Streams...</p>
             </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Traveler</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Modal Type</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Provider</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Validation</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map(booking => (
                  <tr key={booking.id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-10 py-8">
                      <p className="text-base font-black text-slate-900 tracking-tight">{booking.patientName}</p>
                      <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mt-1">PNR: {booking.reference}</p>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${
                            booking.type === 'Flight' ? 'bg-sky-50 text-sky-600' : 
                            booking.type === 'Hotel' ? 'bg-amber-50 text-amber-600' : 
                            'bg-indigo-50 text-indigo-600'
                        }`}>
                            {booking.type === 'Flight' && <Plane size={18} />}
                            {booking.type === 'Hotel' && <Hotel size={18} />}
                            {booking.type === 'Transfer' && <Car size={18} />}
                        </div>
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{booking.type}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-sm font-black text-slate-700 tracking-tight">{booking.provider}</td>
                    <td className="px-10 py-8 text-sm font-black text-slate-700 tracking-tight">{booking.date}</td>
                    <td className="px-10 py-8">
                      <button 
                        onClick={() => handleStatusUpdate(booking.id, booking.status === 'Confirmed' ? 'Pending' : 'Confirmed')}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                        booking.status === 'Confirmed' ? 'bg-green-50 text-green-700 border-green-100 shadow-sm' : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {booking.status}
                      </button>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <button className="p-3 bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg rounded-2xl transition-all">
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none text-indigo-900">
                <Plane size={200} />
            </div>
            
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white relative z-10">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 rounded-3xl text-white">
                    <Briefcase size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight leading-none mb-1 text-white">New Dispatch Record</h3>
                  <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Global Logistics Synchronization</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddBooking} className="p-10 space-y-8 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2 flex items-center gap-2"><User size={14} className="text-indigo-600"/> Traveler Profile</label>
                <input required type="text" placeholder="e.g., Sultan Ahmed" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all font-bold text-slate-700" onChange={e => setNewBooking({...newBooking, patientName: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Modal Selection</label>
                  <select className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 cursor-pointer" onChange={e => setNewBooking({...newBooking, type: e.target.value as any})}>
                    <option value="Flight">Flight Logistics</option>
                    <option value="Hotel">Clinical Stay</option>
                    <option value="Transfer">Ground Transfer</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2 flex items-center gap-2"><Calendar size={14} className="text-indigo-600"/> Travel Date</label>
                  <input required type="date" className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700" onChange={e => setNewBooking({...newBooking, date: e.target.value})} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">GDS Provider / Reference</label>
                <div className="grid grid-cols-3 gap-3">
                    <input required type="text" placeholder="Provider" className="col-span-1 px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700" onChange={e => setNewBooking({...newBooking, provider: e.target.value})} />
                    <input required type="text" placeholder="PNR Reference" className="col-span-2 px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700" onChange={e => setNewBooking({...newBooking, reference: e.target.value})} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Ops Notes</label>
                <textarea className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all font-bold text-slate-700 min-h-[100px]" placeholder="Specific arrival instructions or fleet requirements..." onChange={e => setNewBooking({...newBooking, details: e.target.value})} />
              </div>

              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.25em] hover:bg-slate-800 shadow-2xl shadow-slate-400/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                <CheckCircle2 size={18} /> Confirm Logistics Dispatch
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelManagement;
