import React, { useState, useMemo, useEffect } from 'react';
import { PHYSICIANS, AVAILABLE_STAFF, MOCK_TASKS } from '../constants.tsx';
import { PatientStatus, PatientPriority, Patient, Task, TaskPriority, HistoryEvent, MedicalFile, Gender } from '../types.ts';
import { supabase } from '../services/supabase.ts';
import {
  Plus,
  Stethoscope,
  UserRound,
  Users,
  Check,
  X,
  Search,
  UserPlus,
  ClipboardList,
  LayoutGrid,
  Calendar as CalendarIcon,
  Clock,
  Languages,
  Loader2,
  FileText,
  Mail,
  History as HistoryIcon,
  Info,
  UserCheck,
  ShieldCheck,
  MoreVertical,
  CheckCircle2,
  ChevronRight,
  ListTodo,
  Circle,
  AlertCircle,
  FileDigit,
  Upload,
  Eye,
  Download,
  Trash2,
  HardDrive,
  ChevronLeft,
  Fingerprint,
  Activity as ActivityIcon,
  Apple,
  Bone,
  UserCog
} from 'lucide-react';
import { translateMedicalContent } from '../services/geminiService.ts';
import { fetchPatientJourneys, fetchCRMTasks, createCRMTask, updateCRMTask, updatePatientJourney } from '../services/supabase.ts';
import { toast } from 'sonner';

const LANGUAGES = [
  'Arabic', 'French', 'Spanish', 'Russian', 'Chinese', 'Hindi', 'Portuguese', 'German', 'Bengali', 'Japanese'
];

const PatientPipeline: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'BOARD' | 'CALENDAR'>('BOARD');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal States
  const [assigningPhysicianId, setAssigningPhysicianId] = useState<string | null>(null);
  const [editingTeamPatientId, setEditingTeamPatientId] = useState<string | null>(null);
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);

  // Detail Modal State
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY' | 'DOCS'>('OVERVIEW');

  // Search & Filter
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PatientPriority | 'ALL'>('ALL');

  // Translation State
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState('Russian');

  // Mock Patient Files
  const [patientFiles, setPatientFiles] = useState<Record<string, MedicalFile[]>>({
    'p1': [
      { id: 'f1', name: 'MRI_Thorax_May.dicom', type: 'application/dicom', size: 1024 * 1024 * 450, uploadedAt: '2024-05-18T10:30:00Z', category: 'Imaging', secureUrl: '#', status: 'Secure' },
      { id: 'f2', name: 'Blood_Report_Q1.pdf', type: 'application/pdf', size: 1024 * 1024 * 1.2, uploadedAt: '2024-05-17T14:20:00Z', category: 'Lab', secureUrl: '#', status: 'Secure' },
    ]
  });

  // New Task State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);

  const columns = Object.values(PatientStatus);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [journeysResult, tasksResult] = await Promise.all([
      fetchPatientJourneys(),
      fetchCRMTasks()
    ]);

    if (journeysResult.data) {
      // Map patient_journey to Patient type.
      // - patient name comes from the joined appointment (appointments.full_name)
      // - medical ID comes from the joined profile (profiles.patient_id)
      // - diagnosis/treatment comes from the joined appointment (appointments.treatment_type)
      const mappedPatients: Patient[] = journeysResult.data.map((j: any) => ({
        id: j.id,
        userId: j.patient_id,
        name: j.patient?.full_name || 'Unknown Patient',
        medicalId: j.patient?.patient_id || 'N/A',
        gender: j.patient?.gender as Gender || Gender.MALE,
        status: (j.status as PatientStatus) || PatientStatus.CONSULTATION,
        priority: (j.priority as PatientPriority) || PatientPriority.STANDARD,
        referralSource: j.source || 'Direct',
        diagnosis: j.title || 'General Case',
        assignedPhysician: j.assigned_doctor_name || 'Unassigned',
        assignedBdmName: j.bdm?.full_name,
        assignedCdmName: j.cdm?.full_name,
        assignedBuddyName: j.buddy?.full_name,
        lastVisit: j.updated_at?.split('T')[0],
        nextAppointment: j.next_appointment_date?.split('T')[0],
        careTeam: [
          j.bdm?.full_name && `BDM: ${j.bdm.full_name}`,
          j.cdm?.full_name && `CDM: ${j.cdm.full_name}`,
          j.buddy?.full_name && `Buddy: ${j.buddy.full_name}`
        ].filter(Boolean) as string[],
        history: []
      }));
      setPatients(mappedPatients);
    }

    if (tasksResult.data) {
      const mappedTasks: Task[] = tasksResult.data.map((t: any) => ({
        id: t.id,
        title: t.title,
        dueDate: t.due_date,
        priority: (t.priority as TaskPriority) || TaskPriority.MEDIUM,
        completed: t.status === 'completed',
        patientId: t.related_entity_id,
        type: 'other' // or map from t.related_entity_type
      }));
      setTasks(mappedTasks);
    }
    setLoading(false);
  };

  const addHistoryEvent = (patientId: string, event: Omit<HistoryEvent, 'id' | 'timestamp'>) => {
    // Ideally this would write to a 'patient_history' table in Supabase
    const newEvent: HistoryEvent = {
      ...event,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString()
    };
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, history: [newEvent, ...(p.history || [])] } : p));
  };

  const handleAssignPhysician = async (patientId: string, physicianName: string) => {
    try {
      const { error } = await updatePatientJourney(patientId, { assigned_doctor: physicianName });
      if (error) throw error;

      setPatients(prev => prev.map(p => p.id === patientId ? { ...p, assignedPhysician: physicianName } : p));
      addHistoryEvent(patientId, {
        type: 'physician_reassignment',
        description: `Assigned Lead Physician: ${physicianName}`,
        user: 'James Wilson'
      });
      toast.success("Physician assigned");
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign physician");
    }
    setAssigningPhysicianId(null);
  };

  const handleUpdateStatus = async (patientId: string, status: PatientStatus) => {
    try {
      const { error } = await updatePatientJourney(patientId, {
        status: status,
        current_stage: status // Keep both in sync if they both exist
      });
      if (error) throw error;

      const currentStatus = patients.find(p => p.id === patientId)?.status;

      setPatients(prev => prev.map(p => p.id === patientId ? { ...p, status } : p));
      addHistoryEvent(patientId, {
        type: 'status_change',
        description: `Status changed from ${currentStatus} to ${status}`,
        user: 'James Wilson'
      });
      toast.success(`Status updated to ${status}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  const handleUpdateGender = async (patientId: string, gender: Gender) => {
    // gender is not in patient_journey; update the profiles table via user_id
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    try {
      // patient.userId was captured from j.user_id during loadData mapping
      const userId = (patient as any).userId;
      if (userId) {
        const { error } = await supabase
          .from('patients' as any)
          .update({ gender: gender } as any)
          .eq('id', userId);
        if (error) {
           await supabase.from('patients' as any).upsert({ id: userId, gender: gender } as any);
        }
      }
    } catch (err) {
      console.error('Gender update error:', err);
    }

    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, gender } : p));
    addHistoryEvent(patientId, {
      type: 'demographic_update',
      description: `Patient gender updated to: ${gender}`,
      user: 'Admin'
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !addingTaskId) return;

    try {
      const { data, error } = await createCRMTask({
        title: newTaskTitle,
        priority: newTaskPriority,
        related_entity_type: 'patient',
        related_entity_id: addingTaskId,
        due_date: new Date().toISOString().split('T')[0],
        // status: 'pending' // default
      });

      if (error) throw error;

      if (data) {
        const newTask: Task = {
          id: data.id,
          title: data.title,
          dueDate: data.due_date!,
          priority: data.priority as TaskPriority,
          completed: false,
          patientId: addingTaskId,
          type: 'other'
        };
        setTasks(prev => [newTask, ...prev]);
        addHistoryEvent(addingTaskId, {
          type: 'task_assignment',
          description: `New task assigned: ${newTaskTitle}`,
          user: 'James Wilson'
        });
        toast.success("Task added");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add task");
    }

    setNewTaskTitle('');
    setAddingTaskId(null);
  };

  const toggleTaskCompletion = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const newStatus = !task.completed;
      const { error } = await updateCRMTask(taskId, {
        status: newStatus ? 'completed' : 'pending',
        completed_at: newStatus ? new Date().toISOString() : undefined
      });

      if (error) throw error;

      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        if (t.patientId) {
          addHistoryEvent(t.patientId, {
            type: 'task_completion',
            description: `Task "${t.title}" ${newStatus ? 'marked as completed' : 'reopened'}.`,
            user: 'James Wilson'
          });
        }
        return { ...t, completed: newStatus };
      }));
      toast.success(newStatus ? "Task completed" : "Task reopened");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update task");
    }
  };

  const getPriorityStyles = (priority: PatientPriority) => {
    switch (priority) {
      case PatientPriority.EMERGENCY: return 'bg-rose-500 text-white border-rose-400';
      case PatientPriority.URGENT: return 'bg-amber-500 text-white border-amber-400';
      case PatientPriority.STANDARD: return 'bg-teal-500 text-white border-teal-400';
      default: return 'bg-slate-400 text-white border-slate-300';
    }
  };

  const filteredPatients = useMemo(() => {
    let result = patients;
    if (patientSearchQuery) {
      const q = patientSearchQuery.toLowerCase();
      result = result.filter(p =>
        (p.name?.toLowerCase() || "").includes(q) ||
        (p.medicalId?.toLowerCase() || "").includes(q)
      );
    }
    if (priorityFilter !== 'ALL') result = result.filter(p => p.priority === priorityFilter);
    return [...result];
  }, [patients, priorityFilter, patientSearchQuery]);

  const selectedPatient = useMemo(() =>
    patients.find(p => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const getStaffIcon = (staffName: string) => {
    const staff = AVAILABLE_STAFF.find(s => s.name === staffName);
    const role = staff?.role || '';
    if (role.includes('RN')) return <ActivityIcon size={12} />;
    if (role.includes('Nutritionist')) return <Apple size={12} />;
    if (role.includes('Physical')) return <Bone size={12} />;
    if (role.includes('Intensive')) return <Stethoscope size={12} />;
    return <UserCog size={12} />;
  };

  const getStaffAvatar = (name: string) => {
    const staff = AVAILABLE_STAFF.find(s => s.name === name);
    return staff?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  };

  const getDocAvatar = (name: string) => {
    const doc = PHYSICIANS.find(p => p.name === name);
    return doc?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Calendar Helpers
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const renderCalendar = () => {
    const totalDays = daysInMonth(currentDate);
    const startOffset = firstDayOfMonth(currentDate);
    const days = [];
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 bg-slate-50/50 rounded-2xl opacity-30 border border-slate-100"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      const dayStr = dayDate.toISOString().split('T')[0];
      const isToday = new Date().toISOString().split('T')[0] === dayStr;

      const dayAppointments = patients.filter(p => p.nextAppointment === dayStr);
      const dayTasks = tasks.filter(t => t.dueDate === dayStr);

      days.push(
        <div
          key={d}
          className={`h-32 bg-white border border-slate-100 rounded-3xl p-3 flex flex-col gap-1 transition-all hover:shadow-xl hover:border-teal-500 relative group ${isToday ? 'bg-teal-50/20' : ''}`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className={`text-[11px] font-black w-7 h-7 flex items-center justify-center rounded-xl ${isToday ? 'bg-teal-600 text-white shadow-lg shadow-teal-200' : 'bg-slate-100 text-slate-500'
              }`}>
              {d}
            </span>
          </div>

          <div className="space-y-1 overflow-y-auto custom-scrollbar-hide flex-1">
            {dayAppointments.map(patient => (
              <div
                key={patient.id}
                onClick={() => { setSelectedPatientId(patient.id); setActiveTab('OVERVIEW'); }}
                className="px-2 py-1 bg-teal-50 text-teal-700 rounded-lg text-[9px] font-black uppercase truncate border border-teal-100 cursor-pointer hover:bg-teal-100"
              >
                <span className="flex items-center gap-1"><Stethoscope size={8} /> {patient.name}</span>
              </div>
            ))}
            {dayTasks.map(task => (
              <div
                key={task.id}
                className={`px-2 py-1 ${task.completed ? 'bg-slate-50 text-slate-400' : 'bg-indigo-50 text-indigo-700'} rounded-lg text-[9px] font-bold truncate border border-indigo-100`}
              >
                <span className="flex items-center gap-1"><ListTodo size={8} /> {task.title}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{monthName} <span className="text-slate-400">{year}</span></h3>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-xl transition-all text-slate-600 shadow-sm"><ChevronLeft size={20} /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800">Today</button>
              <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-xl transition-all text-slate-600 shadow-sm"><ChevronRight size={20} /></button>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-500"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Appointments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Care Tasks</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-3">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <div key={day} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center py-4">{day}</div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Patient Journey Center</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Cross-functional care coordination and clinical triage management.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-200/50 p-1.5 rounded-[1.25rem] shadow-inner">
            <button onClick={() => setViewMode('BOARD')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'BOARD' ? 'bg-white text-teal-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={16} /> Board</button>
            <button onClick={() => setViewMode('CALENDAR')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-teal-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}><CalendarIcon size={16} /> Calendar</button>
          </div>
          <button className="px-5 py-3 bg-teal-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all flex items-center gap-2"><UserPlus size={16} /> New Enrollment</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search patients by name or ID..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white outline-none font-bold text-slate-700 transition-all"
            value={patientSearchQuery}
            onChange={(e) => setPatientSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-teal-500/10"
          >
            <option value="ALL">All Priorities</option>
            {Object.values(PatientPriority).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {viewMode === 'BOARD' ? (
        <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide pt-4">
          {columns.map((column) => {
            const patientsInColumn = filteredPatients.filter(p => p.status === column);
            return (
              <div key={column} className="flex-shrink-0 w-[360px]">
                <div className="flex items-center justify-between mb-5 px-3">
                  <h3 className="font-black text-slate-700 text-[11px] uppercase tracking-[0.2em]">{column}</h3>
                  <span className="text-[10px] font-black bg-slate-800 text-white px-2.5 py-1 rounded-lg">
                    {patientsInColumn.length}
                  </span>
                </div>
                <div className="space-y-6 bg-slate-100/50 p-4 rounded-[2.5rem] min-h-[720px] border-2 border-dashed border-slate-200 transition-colors">
                  {patientsInColumn.map((patient) => {
                    const patientTasks = tasks.filter(t => t.patientId === patient.id);
                    const completedTasksCount = patientTasks.filter(t => t.completed).length;

                    return (
                      <div
                        key={patient.id}
                        className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-teal-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-500/10 transition-all group animate-in slide-in-from-bottom-2 relative overflow-visible"
                      >
                        <div className={`absolute -top-3 right-8 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border-2 z-10 ${getPriorityStyles(patient.priority)}`}>{patient.priority}</div>

                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3" onClick={() => { setSelectedPatientId(patient.id); setActiveTab('OVERVIEW'); }}>
                            <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 border border-teal-100 cursor-pointer hover:bg-teal-100 transition-colors shadow-inner">
                              <UserRound size={24} />
                            </div>
                            <div className="cursor-pointer">
                              <h4 className="text-lg font-black text-slate-900 leading-none group-hover:text-teal-600 transition-colors">{patient.name}</h4>
                              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">{patient.gender || 'Not Specified'}</p>
                            </div>
                          </div>
                          <button className="p-2 text-slate-300 hover:text-slate-600"><MoreVertical size={16} /></button>
                        </div>

                        {/* CLINICAL BRIEF SECTION */}
                        <div className="mb-4 bg-slate-50/80 rounded-[1.75rem] p-4 border border-slate-100 cursor-pointer transition-colors hover:bg-slate-100/80" onClick={() => { setSelectedPatientId(patient.id); setActiveTab('OVERVIEW'); }}>
                          <div className="flex items-center gap-2 mb-3">
                            <Fingerprint size={12} className="text-slate-400" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Medical ID: <span className="text-slate-700">{patient.medicalId}</span></span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <ActivityIcon size={12} className="text-teal-500" />
                              <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Diagnosis</h5>
                            </div>
                            <p className="text-[11px] font-bold text-slate-700 italic leading-snug line-clamp-2 pl-5">{patient.diagnosis}</p>
                          </div>
                        </div>

                        <div className="mb-4 p-4 bg-indigo-50/30 rounded-[1.75rem] border border-indigo-100/50">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                              <ListTodo size={12} /> Care Plan Tasks
                            </h5>
                            <button
                              onClick={() => setAddingTaskId(patient.id)}
                              className="p-1 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <div className="space-y-2">
                            {patientTasks.slice(0, 3).map(task => (
                              <div key={task.id} className="flex items-center gap-2 group/task">
                                <button
                                  onClick={() => toggleTaskCompletion(task.id)}
                                  className={`transition-colors ${task.completed ? 'text-green-500' : 'text-slate-300 hover:text-indigo-400'}`}
                                >
                                  {task.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                                </button>
                                <span className={`text-[11px] font-bold truncate flex-1 ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                  {task.title}
                                </span>
                              </div>
                            ))}
                            {patientTasks.length === 0 && (
                              <p className="text-[10px] text-slate-400 font-medium italic">No pending tasks</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between group/phys bg-white p-2 rounded-2xl border border-slate-50 hover:border-teal-100 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                <img src={getDocAvatar(patient.assignedPhysician)} className="w-full h-full object-cover" alt="" />
                              </div>
                              <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Lead Physician</p>
                                <p className="text-[10px] font-black text-slate-700">{patient.assignedPhysician}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setAssigningPhysicianId(patient.id)}
                              className="p-1.5 bg-slate-50 text-slate-400 hover:text-teal-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-slate-100 shadow-sm"
                            >
                              <UserCheck size={14} />
                            </button>
                          </div>

                          {/* VISUALLY DISTINCT CARE TEAM SECTION */}
                          <div className="group/team pt-3 border-t border-slate-50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Users size={12} className="text-indigo-500" />
                                <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Care Team</h5>
                              </div>
                              <button
                                onClick={() => setEditingTeamPatientId(patient.id)}
                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                              {(patient.careTeam || []).map((staff, idx) => (
                                <div
                                  key={idx}
                                  className="flex-shrink-0 flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 transition-all cursor-default"
                                  title={`${staff} (Care Member)`}
                                >
                                  <div className="text-indigo-500 bg-white p-1 rounded-lg shadow-sm">
                                    {getStaffIcon(staff)}
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-600 whitespace-nowrap">{staff.split(' ')[1] || staff}</span>
                                </div>
                              ))}
                              {(patient.careTeam || []).length === 0 && (
                                <p className="text-[9px] text-slate-300 font-bold italic py-1">No staff assigned yet</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pt-4 pb-12">
          {renderCalendar()}
        </div>
      )}

      {/* Task Creation Modal */}
      {addingTaskId && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <div>
                <h3 className="text-xl font-black tracking-tight leading-none mb-1 text-white">New Care Task</h3>
                <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Assign Action Item to Patient</p>
              </div>
              <button onClick={() => setAddingTaskId(null)} className="p-2 hover:bg-white/10 rounded-2xl transition-all">
                <X size={24} className="text-white" />
              </button>
            </div>
            <form onSubmit={handleAddTask} className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Task Description</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Schedule post-op imaging"
                  className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Priority Level</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Object.values(TaskPriority).map(priority => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setNewTaskPriority(priority)}
                      className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${newTaskPriority === priority
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                        : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'
                        }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all"
              >
                Confirm Assignment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedPatientId && selectedPatient && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-teal-500 rounded-3xl flex items-center justify-center text-white shadow-lg"><UserRound size={32} /></div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight leading-none mb-1">{selectedPatient.name}</h3>
                  <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Medical ID: {selectedPatient.medicalId}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPatientId(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
            </div>

            <div className="flex bg-slate-50 border-b border-slate-100 shrink-0">
              <button onClick={() => setActiveTab('OVERVIEW')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'OVERVIEW' ? 'bg-white text-teal-600 border-b-2 border-teal-600' : 'text-slate-400 hover:text-slate-600'}`}><Info size={16} /> Overview</button>
              <button onClick={() => setActiveTab('DOCS')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'DOCS' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><HardDrive size={16} /> Docs & Imaging</button>
              <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'HISTORY' ? 'bg-white text-teal-600 border-b-2 border-teal-600' : 'text-slate-400 hover:text-slate-600'}`}><HistoryIcon size={16} /> Timeline of Care</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Attending Physician</p>
                      <div className="flex items-center gap-3">
                        <img src={getDocAvatar(selectedPatient.assignedPhysician)} className="w-10 h-10 rounded-xl object-cover" alt="" />
                        <p className="text-sm font-black text-slate-800">{selectedPatient.assignedPhysician}</p>
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Patient Gender</p>
                      <select
                        value={selectedPatient.gender || ''}
                        onChange={(e) => handleUpdateGender(selectedPatient.id, e.target.value as Gender)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-4 focus:ring-teal-500/10 transition-all cursor-pointer text-slate-700"
                      >
                        <option value="">Select Gender</option>
                        {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Journey Status</p>
                      <select
                        value={selectedPatient.status}
                        onChange={(e) => handleUpdateStatus(selectedPatient.id, e.target.value as PatientStatus)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-4 focus:ring-teal-500/10 transition-all cursor-pointer text-slate-700 font-black uppercase tracking-tighter"
                      >
                        {Object.values(PatientStatus).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center pr-2">
                      <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2"><ListTodo size={16} className="text-indigo-600" /> Active Care Plan</h4>
                      <button onClick={() => setAddingTaskId(selectedPatient.id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-all">New Task</button>
                    </div>
                    <div className="space-y-3">
                      {tasks.filter(t => t.patientId === selectedPatient.id).map(task => (
                        <div key={task.id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all group">
                          <button onClick={() => toggleTaskCompletion(task.id)} className={`transition-colors ${task.completed ? 'text-green-500' : 'text-slate-300 hover:text-indigo-400'}`}>
                            {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                          </button>
                          <div className="flex-1">
                            <p className={`text-sm font-bold ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</p>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Priority: {task.priority}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'DOCS' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="p-10 border-4 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-200 transition-all relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" multiple />
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-sm mb-4 group-hover:scale-110 transition-transform">
                      <Upload size={32} />
                    </div>
                    <h4 className="text-lg font-black text-slate-800 tracking-tight">Drop medical files for secure ingestion</h4>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Uncapped Size • Dicom • Imaging • Labs</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                      <FileDigit size={16} className="text-indigo-600" /> Attached Clinical Data
                    </h4>
                    <div className="space-y-3">
                      {(patientFiles[selectedPatient.id] || []).map(file => (
                        <div key={file.id} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 transition-all group">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                            {file.type.includes('dicom') ? <FileDigit size={24} className="text-teal-500" /> : <FileText size={24} className="text-amber-500" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-black text-slate-800 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{formatSize(file.size)} • {file.status}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><Eye size={16} /></button>
                            <button className="p-2 bg-slate-50 text-slate-400 hover:text-teal-600 rounded-xl transition-all"><Download size={16} /></button>
                            <button className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'HISTORY' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] mb-8">Clinical Audit Trail</h4>
                  <div className="relative pl-8 border-l-2 border-slate-100 space-y-8 ml-4">
                    {(selectedPatient.history || []).map((event) => (
                      <div key={event.id} className="relative">
                        <div className={`absolute -left-[41px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-md flex items-center justify-center ${event.type === 'enrollment' ? 'bg-green-500' :
                          event.type === 'document_generated' ? 'bg-sky-500' :
                            event.type === 'communication_sent' ? 'bg-indigo-500' :
                              event.type === 'physician_reassignment' ? 'bg-amber-500' :
                                event.type === 'demographic_update' ? 'bg-indigo-400' :
                                  'bg-teal-500'
                          }`}>
                          {event.type === 'document_generated' && <FileText size={8} className="text-white" />}
                          {event.type === 'demographic_update' && <UserRound size={8} className="text-white" />}
                        </div>
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 hover:border-teal-200 transition-colors shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(event.timestamp).toLocaleString()}</span>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">User: {event.user}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-700 leading-snug">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-between gap-4">
              <button className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-[1.5rem] text-sm font-black uppercase tracking-widest transition-all">Print Record</button>
              <button onClick={() => setSelectedPatientId(null)} className="flex-[2] py-4 bg-slate-900 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-widest shadow-xl transition-all">Close Patient Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientPipeline;