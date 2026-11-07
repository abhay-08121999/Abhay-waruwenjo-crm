
import React, { useState } from 'react';
import { MapPin, Navigation, Clock, CheckCircle, AlertCircle, Play } from 'lucide-react';
import { RouteVisit } from '../types.ts';

const MOCK_VISITS: RouteVisit[] = [
  { id: 'v1', leadId: '1', facilityName: 'Metropolitan General', plannedTime: '09:00 AM', status: 'In Progress' },
  { id: 'v2', leadId: '2', facilityName: 'Thorne Orthopedics', plannedTime: '11:30 AM', status: 'Planned' },
  { id: 'v3', leadId: '3', facilityName: 'Mercy Childrens Hospital', plannedTime: '02:00 PM', status: 'Planned' }
];

const FieldRoutes: React.FC = () => {
  const [visits, setVisits] = useState(MOCK_VISITS);

  const handleCheckIn = (id: string) => {
    setVisits(prev => prev.map(v => v.id === id ? { ...v, status: 'Completed', checkedInAt: new Date().toLocaleTimeString() } : v));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Field Operations</h2>
          <p className="text-slate-500 text-sm">Today's planned medical facility tour plan.</p>
        </div>
        <div className="flex items-center gap-2 bg-teal-50 text-teal-700 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest border border-teal-100">
          <Navigation size={14} /> Live GPS Sync Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
            <h3 className="font-bold mb-4 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em] text-teal-400">Current Progress</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-4xl font-black">1/3</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Visits Completed</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">34.5 km</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Est. Distance</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {visits.map((visit) => (
              <div key={visit.id} className={`p-5 rounded-[1.5rem] border-2 transition-all ${
                visit.status === 'Completed' ? 'bg-teal-50/50 border-teal-100' : 
                visit.status === 'In Progress' ? 'bg-white border-teal-500 shadow-lg shadow-teal-500/10 scale-[1.02]' : 
                'bg-white border-slate-100 opacity-80 hover:opacity-100'
              }`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{visit.plannedTime}</span>
                  </div>
                  {visit.status === 'Completed' && <CheckCircle size={16} className="text-teal-600" />}
                </div>
                <h4 className="font-black text-slate-900 mb-1">{visit.facilityName}</h4>
                <p className="text-xs text-slate-500 font-medium mb-4">Site Visit & Equipment Demo</p>
                
                {visit.status !== 'Completed' ? (
                  <button 
                    onClick={() => handleCheckIn(visit.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-all shadow-md"
                  >
                    <MapPin size={14} /> Check In At Facility
                  </button>
                ) : (
                  <div className="text-[10px] font-black text-teal-600 uppercase">Checked In: {visit.checkedInAt}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-100 rounded-[2.5rem] relative overflow-hidden flex items-center justify-center border-4 border-white shadow-inner min-h-[500px]">
           <div className="text-center opacity-40">
             <MapPin size={48} className="mx-auto mb-4 text-slate-400" />
             <p className="font-bold text-slate-500">Facility Proximity Map View</p>
             <p className="text-xs text-slate-400">(Interactive GIS Module)</p>
           </div>
           {/* Simulate a pulsating marker for the rep */}
           <div className="absolute top-1/2 left-1/3 w-4 h-4 bg-teal-500 rounded-full animate-ping"></div>
           <div className="absolute top-1/2 left-1/3 w-3 h-3 bg-teal-600 rounded-full border-2 border-white shadow-lg"></div>
        </div>
      </div>
    </div>
  );
};

export default FieldRoutes;
