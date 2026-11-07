
import React, { useMemo, useEffect, useState } from 'react';
import {
   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
   PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { LeadStatus, TaskPriority, ArrivalStatus, Lead, Task, PatientArrival } from '../types.ts';
import {
   TrendingUp,
   Users,
   DollarSign,
   Target,
   Hospital,
   Activity,
   Clock,
   CheckSquare,
   Zap,
   Truck,
   Plane,
   ArrowRight,
   ChevronRight,
   AlertCircle,
   Calendar,
   Mail,
   Sparkles,
   MessageSquare,
   Stethoscope
} from 'lucide-react';
import { fetchLeads, fetchCRMTasks, fetchPatientArrivals, getDashboardStats, fetchRecentChatMessages } from '../services/supabase.ts';

const Dashboard: React.FC = () => {
   const [leads, setLeads] = useState<Lead[]>([]);
   const [tasks, setTasks] = useState<Task[]>([]);
   const [arrivals, setArrivals] = useState<PatientArrival[]>([]);
   const [statsData, setStatsData] = useState<any>(null);
   const [recentMessages, setRecentMessages] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);

   const today = new Date().toISOString().split('T')[0];

   useEffect(() => {
      loadData();
   }, []);

   const loadData = async () => {
      setLoading(true);
      const [leadsData, tasksData, arrivalsData, dashboardStats, chatData] = await Promise.all([
         fetchLeads(),
         fetchCRMTasks(),
         fetchPatientArrivals(),
         getDashboardStats(),
         fetchRecentChatMessages(3)
      ]);

      if (leadsData?.data) {
         const mappedLeads = leadsData.data.map((l: any) => ({
            id: l.id,
            name: l.full_name || 'Unknown',
            company: l.source || 'Direct',
            email: l.email,
            status: (l.status as LeadStatus) || LeadStatus.NEW,
            value: 0,
            facilityType: l.treatment_interest,
         }));
         setLeads(mappedLeads as unknown as Lead[]);
      }

      if (tasksData?.data) {
         const mappedTasks = tasksData.data.map((t: any) => ({
            id: t.id,
            title: t.title,
            dueDate: t.due_date,
            priority: (t.priority as TaskPriority) || TaskPriority.MEDIUM,
            completed: t.status === 'completed',
         }));
         setTasks(mappedTasks as unknown as Task[]);
      }

      if (arrivalsData?.data) {
         const mappedArrivals = arrivalsData.data.map((a: any) => ({
            id: a.id,
            patientName: a.patient_name,
            flightNumber: a.flight_number,
            arrivalDate: a.arrival_date,
            arrivalTime: a.arrival_time || '00:00',
            countryCode: a.origin_country || 'UNK',
            status: (a.status as ArrivalStatus) || ArrivalStatus.EXPECTED
         }));
         setArrivals(mappedArrivals as unknown as PatientArrival[]);
      }

      if (dashboardStats) setStatsData(dashboardStats);
      if (chatData?.data) setRecentMessages(chatData.data);

      setLoading(false);
   };

   const dashboardKpis = useMemo(() => {
      if (!statsData) return [];

      return [
         {
            label: 'Total Enquiries',
            value: statsData.enquiries.toString(),
            icon: <Target className="text-teal-600" />,
            change: '+12%',
            color: 'bg-teal-50'
         },
         {
            label: 'Confirmed Cases',
            value: statsData.appointments.toString(),
            icon: <TrendingUp className="text-indigo-600" />,
            change: '+8%',
            color: 'bg-indigo-50'
         },
         {
            label: 'Support Network',
            value: `${statsData.doctors + statsData.hospitals}`,
            icon: <Stethoscope className="text-cyan-600" />,
            change: 'Active',
            color: 'bg-cyan-50'
         },
         {
            label: 'On-Ground Patients',
            value: arrivals.filter(a => a.status !== ArrivalStatus.EXPECTED).length.toString(),
            icon: <Activity className="text-rose-600" />,
            change: 'Live',
            color: 'bg-rose-50'
         },
      ];
   }, [statsData, arrivals]);

   const todayTasks = useMemo(() => {
      return tasks.filter(t => t.dueDate === today);
   }, [tasks, today]);

   const taskCompletion = useMemo(() => {
      const completed = todayTasks.filter(t => t.completed).length;
      const total = todayTasks.length || 1;
      return Math.round((completed / total) * 100);
   }, [todayTasks]);

   const todayArrivals = useMemo(() => {
      return arrivals.filter(a => a.arrivalDate === today);
   }, [arrivals, today]);

   return (
      <div className="space-y-8 animate-in fade-in duration-700">
         {/* Welcome Header */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
               <h2 className="text-3xl font-black text-slate-800 tracking-tight">Operation Command</h2>
               <div className="flex items-center gap-2 mt-1">
                  <Calendar size={14} className="text-slate-400" />
                  <p className="text-slate-500 font-medium text-sm">
                     {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
               </div>
            </div>

            <div className="flex items-center gap-4 bg-white p-3 rounded-[1.5rem] border border-slate-200 shadow-sm">
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workflow Target</p>
                  <p className="text-sm font-black text-slate-800">{taskCompletion}% Completed</p>
               </div>
               <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 transition-all duration-1000" style={{ width: `${taskCompletion}%` }}></div>
               </div>
            </div>
         </div>

         {/* KPI Stats */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dashboardKpis.map((stat, i) => (
               <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-teal-100 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                     <div className={`p-3 rounded-2xl ${stat.color} group-hover:scale-110 transition-transform`}>{stat.icon}</div>
                     <span className={`text-[10px] font-black px-2 py-1 rounded-full ${stat.change.includes('+') ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'} uppercase tracking-tighter`}>
                        {stat.change}
                     </span>
                  </div>
                  <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none mb-2">{stat.label}</h3>
                  <p className="text-2xl font-black text-slate-900 leading-none">{stat.value}</p>
               </div>
            ))}
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Today's Tasks */}
            <div className="xl:col-span-7 space-y-6">
               <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                  <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                     <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                        <CheckSquare size={18} className="text-indigo-500" /> Critical Actions Today
                     </h3>
                     <a href="#/tasks" className="text-[10px] font-black text-indigo-600 uppercase hover:underline flex items-center gap-1">
                        Manage Queue <ChevronRight size={14} />
                     </a>
                  </div>
                  <div className="p-8 space-y-4">
                     {todayTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 hover:shadow-md transition-all group">
                           <div className={`w-3 h-3 rounded-full border-2 ${task.completed ? 'bg-green-500 border-green-600' : 'border-slate-300'}`}></div>
                           <div className="flex-1">
                              <h4 className={`text-sm font-black ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Priority: {task.priority}</p>
                           </div>
                           <div className="flex items-center gap-3">
                              {task.priority === TaskPriority.HIGH && !task.completed && (
                                 <AlertCircle size={16} className="text-rose-500 animate-pulse" />
                              )}
                              <button className="p-2 text-slate-300 group-hover:text-indigo-500 transition-colors">
                                 <ArrowRight size={18} />
                              </button>
                           </div>
                        </div>
                     ))}
                     {todayTasks.length === 0 && (
                        <div className="py-20 text-center opacity-30">
                           <CheckSquare size={48} className="mx-auto mb-4" />
                           <p className="text-sm font-bold">Workflow clear for today.</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>

            {/* Patient Arrivals */}
            <div className="xl:col-span-5 space-y-6">
               <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden h-full">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                     <Plane size={120} />
                  </div>
                  <div className="relative">
                     <div className="flex items-center justify-between mb-8">
                        <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                           <Plane size={18} className="text-teal-400" /> Arrival Logistics
                        </h3>
                        <span className="px-2 py-0.5 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-tighter text-teal-400 border border-white/10">
                           {todayArrivals.length} Expected
                        </span>
                     </div>

                     <div className="space-y-6">
                        {todayArrivals.map(arrival => (
                           <div key={arrival.id} className="flex items-center justify-between group cursor-pointer">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-white/10 group-hover:border-teal-400 transition-colors bg-white/5">
                                    <p className="text-[10px] font-black text-white">{arrival.countryCode}</p>
                                 </div>
                                 <div>
                                    <p className="text-sm font-black text-white leading-tight">{arrival.patientName}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
                                       {arrival.arrivalTime} • {arrival.flightNumber}
                                    </p>
                                 </div>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${arrival.status === ArrivalStatus.PICKED_UP ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                 }`}>
                                 {arrival.status}
                              </div>
                           </div>
                        ))}
                        {todayArrivals.length === 0 && (
                           <div className="py-12 text-center opacity-20">
                              <Clock size={48} className="mx-auto mb-4" />
                              <p className="text-xs font-bold uppercase tracking-widest">No arrivals scheduled</p>
                           </div>
                        )}
                     </div>

                     <button className="w-full mt-10 py-4 border border-white/10 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                        Open Logistics Console <ChevronRight size={14} />
                     </button>
                  </div>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
            {/* Real-time Inbound Feed */}
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                     <Zap size={18} className="text-teal-500" /> Live Inbound Stream
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                     <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                     Connected
                  </div>
               </div>

               <div className="space-y-4">
                  {recentMessages.map(msg => (
                     <div key={msg.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:border-teal-200 hover:shadow-xl hover:shadow-teal-500/5 transition-all group flex items-start gap-5 cursor-pointer">
                        <div className="p-3 rounded-2xl shrink-0 bg-indigo-100 text-indigo-600">
                           <MessageSquare size={20} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                           <div className="flex items-center justify-between mb-1">
                              <h4 className="text-sm font-black text-slate-800">Session: {msg.session_id.slice(0, 8)}</h4>
                              <span className="text-[9px] font-black text-slate-400 uppercase">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           </div>
                           <p className="text-xs text-slate-500 font-medium truncate italic leading-relaxed">"{msg.content}"</p>
                           <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-teal-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                              Review Conversation <ChevronRight size={12} />
                           </div>
                        </div>
                     </div>
                  ))}
                  {recentMessages.length === 0 && (
                     <div className="py-20 text-center opacity-30">
                        <Mail size={48} className="mx-auto mb-4" />
                        <p className="text-sm font-bold">No active inbound queries.</p>
                     </div>
                  )}
               </div>
            </div>

            {/* AI Advice */}
            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-500/20 flex flex-col justify-between">
               <div>
                  <div className="p-3 bg-white/10 rounded-2xl w-fit mb-6">
                     <Sparkles className="text-indigo-200" size={24} />
                  </div>
                  <h4 className="text-lg font-black mb-4 leading-tight">Gemini Intelligence</h4>
                  <p className="text-sm text-indigo-100 leading-relaxed font-medium italic">
                     "Patient traffic from UAE has increased by 15% this week. Ensure all Arabic-translated treatment brochures are updated in the Digital Vault for the logistics team."
                  </p>
               </div>
               <button className="mt-8 py-4 bg-white text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl">
                  View Traffic Analysis
               </button>
            </div>
         </div>
      </div>
   );
};

export default Dashboard;
