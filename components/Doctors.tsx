import React, { useState, useEffect, useRef } from 'react';
import { fetchDoctors, createDoctor, fetchHospitals, updateDoctor, deleteDoctor, uploadFile } from '../services/supabase.ts';
import { Doctor, Hospital } from '../types.ts';
import {
  Stethoscope,
  UserPlus,
  Search,
  Filter,
  X,
  Building,
  Mail,
  Phone,
  ChevronRight,
  CheckCircle2,
  Clock,
  MoreVertical,
  Activity,
  Edit,
  Trash2,
  Image as ImageIcon,
  Upload,
  Loader2,
  Eye,
  EyeOff,
  Briefcase,
  GraduationCap,
  Languages as LanguagesIcon,
  Calendar as CalendarIcon
} from 'lucide-react';
import { fetchLeads, createConsultationFromEnquiry } from '../services/supabase.ts';
import { LeadStatus, Lead } from '../types.ts';
import { toast } from 'sonner';
import ImageCropper from './ui/ImageCropper';

const Doctors: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [languagesInput, setLanguagesInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('All');
  const [visibilityFilter, setVisibilityFilter] = useState('All');
  const [selectedDoctorForDetails, setSelectedDoctorForDetails] = useState<Doctor | null>(null);
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Image Cropping State
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({
    status: 'Active',
    availableForOnline: true,
    experienceYears: 0,
    consultationFee: 0,
    languages: [],
    doctor_type: 'Specialist'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [doctorsRes, hospitalsRes] = await Promise.all([
      fetchDoctors(),
      fetchHospitals()
    ]);

    if (doctorsRes.data) {
      const mappedDoctors = doctorsRes.data.map((d: any) => ({
        ...d,
        hospitalName: d.hospital?.name || 'Unknown',
        hospitalId: d.hospital_id,
        imageUrl: d.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=0d9488&color=fff`,
        experienceYears: d.experience_years,
        consultationFee: d.consultation_fee,
        availableForOnline: d.available_for_online,
        is_active: d.is_active,
        qualifications: d.qualifications,
        availability: d.availability,
        rating: d.rating
      }));
      setDoctors(mappedDoctors);
    }

    if (hospitalsRes.data) {
      setHospitals(hospitalsRes.data as unknown as Hospital[]);
    }
    
    // Load leads for assignment
    const { data: leadsData } = await fetchLeads();
    if (leadsData) {
      const mappedLeads: Lead[] = (leadsData as any[]).map((item: any) => ({
        id: item.id,
        name: item.full_name,
        email: item.email,
        phone: item.phone,
        status: item.status as LeadStatus,
        treatmentInterest: item.treatment_interest,
        urgency: item.urgency || 'Standard',
      }));
      setAvailableLeads(mappedLeads.filter(l => l.status === 'qualified' || l.status === 'new'));
    }
    
    setLoading(false);
  };

  const filteredDoctors = doctors.filter(d => {
    const matchesSearch = d.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.specialty?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesHospital = selectedHospital === 'All' || d.hospitalId === selectedHospital;
    
    let matchesVisibility = true;
    if (visibilityFilter === 'Visible') matchesVisibility = d.is_active === true;
    else if (visibilityFilter === 'Hidden') matchesVisibility = d.is_active === false;
    else if (visibilityFilter === 'Pending') matchesVisibility = d.is_active === false; // Usually pending are hidden anyway
    
    return matchesSearch && matchesHospital && matchesVisibility;
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size before processing (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large. Please select a file under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setCropSrc(reader.result as string);
      setShowCropper(true);
    });
    reader.readAsDataURL(file);
    
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setShowCropper(false);
    setIsUploading(true);
    
    try {
      // Create a file from the blob
      const file = new File([croppedBlob], "doctor-profile.jpg", { type: "image/jpeg" });
      
      const { publicUrl, error } = await uploadFile(file, 'medical-docs');
      if (error) throw error;
      if (publicUrl) {
        setNewDoctor({ ...newDoctor, imageUrl: publicUrl });
        toast.success("Profile photo adjusted and uploaded!");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Failed to upload image: " + (err.message || "Unknown error"));
    } finally {
      setIsUploading(false);
      setCropSrc(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const doctorData: any = {
        name: newDoctor.name!,
        specialty: newDoctor.specialty!,
        hospital_id: newDoctor.hospitalId || null,
        available_for_online: newDoctor.availableForOnline,
        experience_years: newDoctor.experienceYears || 0,
        consultation_fee: newDoctor.consultationFee || 0,
        bio: newDoctor.bio || '',
        image_url: newDoctor.imageUrl || '',
        languages: languagesInput.split(',').map(l => l.trim()).filter(l => l !== ''),
        doctor_type: newDoctor.doctor_type || 'Specialist',
        email: newDoctor.email || '',
        phone: newDoctor.phone || '',
        is_active: newDoctor.is_active ?? true,
        qualifications: newDoctor.qualifications || '',
        availability: newDoctor.availability || {},
        rating: newDoctor.rating || 0,
      };

      if (isEditing && editingDoctorId) {
        const { error } = await updateDoctor(editingDoctorId, doctorData);
        if (error) throw error;
        toast.success('Doctor updated successfully');
      } else {
        const { error } = await createDoctor(doctorData);
        if (error) throw error;
        toast.success('Doctor onboarded successfully');
      }

      setShowModal(false);
      setIsEditing(false);
      setEditingDoctorId(null);
      loadData();
    } catch (err: any) {
      console.error("Save error full object:", JSON.stringify(err, null, 2));
      const errorDetail = err.details ? ` (${err.details})` : '';
      const errorHint = err.hint ? ` - ${err.hint}` : '';
      toast.error(`${err.message || 'Check console for object'}${errorDetail}${errorHint}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (doctor: Doctor) => {
    setNewDoctor({
      name: doctor.name,
      specialty: doctor.specialty,
      hospitalId: doctor.hospitalId,
      availableForOnline: doctor.availableForOnline,
      experienceYears: doctor.experienceYears || 0,
      consultationFee: doctor.consultationFee || 0,
      bio: doctor.bio || '',
      imageUrl: doctor.imageUrl || '',
      languages: doctor.languages || [],
      email: doctor.email || '',
      phone: doctor.phone || '',
      doctor_type: doctor.doctor_type || 'Specialist',
      is_active: doctor.is_active,
      qualifications: doctor.qualifications || '',
      availability: doctor.availability || {},
      rating: doctor.rating || 0
    });
    setLanguagesInput(doctor.languages?.join(', ') || '');
    setEditingDoctorId(doctor.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this specialist profile?')) return;

    try {
      const { error } = await deleteDoctor(id);
      if (error) throw error;
      toast.success('Doctor profile deleted');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete doctor');
    }
  };

  const handleToggleActive = async (doctor: Doctor) => {
    try {
      const newStatus = !doctor.is_active;
      const { error } = await updateDoctor(doctor.id, { is_active: newStatus });
      if (error) throw error;
      toast.success(`Specialist marked as ${newStatus ? 'Visible' : 'Hidden'}`);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update visibility');
    }
  };

  const handleAssignPatient = async (leadId: string, doctorId: string) => {
    setIsAssigning(true);
    try {
      const { error } = await createConsultationFromEnquiry(
        leadId,
        doctorId,
        'Initial Specialist Consultation'
      );

      if (error) throw error;
      toast.success('Patient assigned for consultation');
      // Refresh leads
      const { data: leadsData } = await fetchLeads();
      if (leadsData) {
         const mapped = (leadsData as any[]).map(l => ({ ...l, name: l.full_name, status: l.status as LeadStatus }));
         setAvailableLeads(mapped.filter(l => l.status === 'qualified' || l.status === 'new'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to assign patient: ' + (err.message || 'Unknown error'));
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Medical Directory</h2>
          <p className="text-slate-500 font-medium mt-1">Registry of specialists and clinical practitioners across partner hospitals.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-3 bg-teal-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all flex items-center gap-2"
        >
          <UserPlus size={18} /> Onboard Doctor
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, specialty..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-teal-500/10"
          value={selectedHospital}
          onChange={(e) => setSelectedHospital(e.target.value)}
        >
          <option value="All">All Hospitals</option>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select
          className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-teal-500/10"
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Visible">Visible Only</option>
          <option value="Hidden">Hidden / Pending</option>
        </select>
        <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-teal-600 transition-all"><Filter size={20} /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredDoctors.map(doctor => (
          <div key={doctor.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-teal-400 transition-all group overflow-hidden">
            <div className="relative h-24 bg-slate-50">
              <div className={`absolute top-4 left-4 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter ${doctor.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                {doctor.is_active ? 'Visible' : 'Hidden'}
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={() => handleToggleActive(doctor)}
                  title={doctor.is_active ? "Hide Profile" : "Show Profile"}
                  className={`p-1.5 shadow-sm border rounded-lg transition-all ${doctor.is_active ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}
                >
                  {doctor.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button 
                  onClick={() => handleEdit(doctor)}
                  className="p-1.5 bg-white shadow-sm border border-slate-200 rounded-lg text-slate-400 hover:text-teal-600 transition-all"
                >
                  <Edit size={14} />
                </button>
                <button 
                  onClick={() => handleDelete(doctor.id)}
                  className="p-1.5 bg-white shadow-sm border border-slate-200 rounded-lg text-slate-400 hover:text-red-600 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="px-6 pb-6 -mt-10 text-center relative z-10">
              <div className="w-20 h-20 rounded-3xl mx-auto border-4 border-white shadow-lg overflow-hidden group-hover:scale-105 transition-transform">
                <img src={doctor.imageUrl || doctor.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.name)}&background=0d9488&color=fff`} className="w-full h-full object-cover" alt={doctor.name} />
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-900 leading-tight truncate">{doctor.name}</h3>
              <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mt-1 mb-4">{doctor.specialty}</p>

              <div className="flex items-center justify-center gap-2 text-slate-400 mb-6">
                <Building size={14} />
                <span className="text-[10px] font-bold uppercase truncate">{doctor.hospitalName}</span>
              </div>

              <div className="flex gap-2 justify-center pt-6 border-t border-slate-50">
                <button 
                  onClick={() => {
                    if (doctor.email) {
                      localStorage.setItem('crm_target_recipient_email', doctor.email || '');
                      localStorage.setItem('crm_target_recipient_name', doctor.name || doctor.email || '');
                      window.location.hash = '#/communications';
                    } else {
                      toast.error("Email not available");
                    }
                  }}
                  className="flex-1 py-2.5 bg-slate-50 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all"
                >
                  <Mail size={16} className="mx-auto" />
                </button>
                <button 
                  onClick={() => {
                    if (doctor.phone) window.location.href = `tel:${doctor.phone}`;
                    else toast.error("Phone not available");
                  }}
                  className="flex-1 py-2.5 bg-slate-50 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all"
                >
                  <Phone size={16} className="mx-auto" />
                </button>
                <button 
                  onClick={() => setSelectedDoctorForDetails(doctor)}
                  className="flex-1 py-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  <ChevronRight size={16} className="mx-auto" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-teal-600 text-white">
              <div>
                <h3 className="text-xl font-black tracking-tight leading-none mb-1">
                  {isEditing ? 'Update Specialist' : 'Practitioner Registry'}
                </h3>
                <p className="text-[10px] font-bold text-teal-100 uppercase tracking-widest">
                  {isEditing ? 'Modify professional credentials' : 'Credentialing & specialist Onboarding'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setIsEditing(false);
                  setEditingDoctorId(null);
                }} 
                className="p-2 hover:bg-white/10 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Doctor Name (With Prefix)</label>
                <input required minLength={3} type="text" value={newDoctor.name || ''} placeholder="e.g. Dr. Arthur Miller" className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewDoctor({ ...newDoctor, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Doctor Type</label>
                  <select required value={newDoctor.doctor_type || 'Specialist'} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold cursor-pointer" onChange={e => setNewDoctor({ ...newDoctor, doctor_type: e.target.value })}>
                    <option value="Specialist">Specialist</option>
                    <option value="Consultant">Consultant</option>
                    <option value="Surgeon">Surgeon</option>
                    <option value="Resident">Resident</option>
                    <option value="Visiting Faculty">Visiting Faculty</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Visibility Status</label>
                  <select value={newDoctor.is_active ? 'Active' : 'Inactive'} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold cursor-pointer" onChange={e => setNewDoctor({ ...newDoctor, is_active: e.target.value === 'Active' })}>
                    <option value="Active">Visible on Website</option>
                    <option value="Inactive">Hidden (Pending)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Qualifications / Degrees</label>
                <input required type="text" value={newDoctor.qualifications || ''} placeholder="e.g. MBBS, MD, FRCS" className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewDoctor({ ...newDoctor, qualifications: e.target.value })} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Specialty</label>
                <input required type="text" value={newDoctor.specialty || ''} placeholder="e.g. Oncology" className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewDoctor({ ...newDoctor, specialty: e.target.value })} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Hospital Affiliation</label>
                <select required value={newDoctor.hospitalId || ''} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold cursor-pointer" onChange={e => setNewDoctor({ ...newDoctor, hospitalId: e.target.value })}>
                  <option value="">Select Hospital</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Experience (Years)</label>
                  <input required min="0" max="60" type="number" value={newDoctor.experienceYears || 0} placeholder="e.g. 15" className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewDoctor({ ...newDoctor, experienceYears: parseInt(e.target.value) })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Consultation Fee ($)</label>
                  <input required min="0" type="number" value={newDoctor.consultationFee || 0} placeholder="e.g. 100" className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewDoctor({ ...newDoctor, consultationFee: parseInt(e.target.value) })} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Professional Bio</label>
                <textarea required minLength={20} rows={3} value={newDoctor.bio || ''} placeholder="Brief background and expertise (min 20 chars)..." className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewDoctor({ ...newDoctor, bio: e.target.value })} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Availability Schedule (JSON or Text)</label>
                <textarea rows={2} value={typeof newDoctor.availability === 'string' ? newDoctor.availability : JSON.stringify(newDoctor.availability || {})} placeholder='e.g. {"Mon": "9AM-5PM"}' className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setNewDoctor({ ...newDoctor, availability: parsed });
                  } catch {
                    setNewDoctor({ ...newDoctor, availability: e.target.value });
                  }
                }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Languages (Comma separated)</label>
                  <input type="text" value={languagesInput} placeholder="English, Arabic..." className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setLanguagesInput(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Online Availability</label>
                  <div className="flex items-center gap-2 mt-4 ml-2">
                    <input type="checkbox" checked={newDoctor.availableForOnline} className="w-5 h-5 rounded-lg text-teal-600 focus:ring-teal-500 border-slate-300" onChange={e => setNewDoctor({ ...newDoctor, availableForOnline: e.target.checked })} />
                    <span className="text-xs font-bold text-slate-600 italic">Available for Consultations</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Profile Photo</label>
                <div className="flex items-center gap-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center relative shadow-sm">
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                    ) : newDoctor.imageUrl ? (
                      <img src={newDoctor.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-teal-400 transition-all text-slate-600 shadow-sm"
                    >
                      {isUploading ? 'Uploading...' : <><Upload size={14} className="text-teal-600" /> Select Image</>}
                    </button>
                    <p className="text-[9px] text-slate-400 mt-2 font-bold italic">Max size 2MB (JPG, PNG)</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Contact Email</label>
                  <input type="email" value={newDoctor.email || ''} placeholder="doctor@example.com" className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewDoctor({ ...newDoctor, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Contact Phone</label>
                  <input type="tel" value={newDoctor.phone || ''} placeholder="+123..." className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewDoctor({ ...newDoctor, phone: e.target.value })} />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSaving}
                className={`w-full py-4 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Synchronizing...
                  </>
                ) : (
                  isEditing ? 'Save Changes' : 'Authorize Specialist'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {showCropper && cropSrc && (
        <ImageCropper
          image={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropper(false);
            setCropSrc(null);
          }}
          aspectRatio={1} // Square for doctors
        />
      )}

      {selectedDoctorForDetails && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row h-[85vh]">
            {/* Left Sidebar - Profile Summary */}
            <div className="md:w-1/3 bg-slate-50 border-r border-slate-100 p-10 flex flex-col items-center text-center overflow-y-auto">
              <div className="w-32 h-32 rounded-[2.5rem] border-4 border-white shadow-2xl overflow-hidden mb-6">
                <img src={selectedDoctorForDetails.imageUrl} className="w-full h-full object-cover" alt={selectedDoctorForDetails.name} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 leading-tight mb-2 uppercase">{selectedDoctorForDetails.name}</h3>
              <p className="px-4 py-1.5 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-500/20 mb-8">
                {selectedDoctorForDetails.specialty}
              </p>

              <div className="w-full space-y-4">
                <div className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-4 text-left shadow-sm">
                  <Briefcase size={20} className="text-indigo-600" />
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Experience</p>
                    <p className="text-xs font-black text-slate-800">{selectedDoctorForDetails.experienceYears} Years Practice</p>
                  </div>
                </div>
                <div className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-4 text-left shadow-sm">
                  <GraduationCap size={20} className="text-amber-600" />
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Quals</p>
                    <p className="text-xs font-black text-slate-800 truncate max-w-[140px]">{selectedDoctorForDetails.qualifications || 'Certified Specialist'}</p>
                  </div>
                </div>
                <div className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-4 text-left shadow-sm">
                  <Building size={20} className="text-sky-600" />
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Affiliation</p>
                    <p className="text-xs font-black text-slate-800">{selectedDoctorForDetails.hospitalName}</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto w-full pt-8 space-y-3">
                 <button 
                    onClick={() => {
                      const email = selectedDoctorForDetails.email || '';
                      const name = selectedDoctorForDetails.name || '';
                      localStorage.setItem('crm_target_recipient_email', email);
                      localStorage.setItem('crm_target_recipient_name', name || email);
                      window.location.hash = '#/communications'
                    }}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <Mail size={16} /> Send Direct Mail
                </button>
              </div>
            </div>

            {/* Right Panel - Details & Assignment */}
            <div className="md:w-2/3 p-10 overflow-y-auto custom-scrollbar space-y-10 bg-white relative">
              <button 
                onClick={() => setSelectedDoctorForDetails(null)}
                className="absolute top-6 right-6 p-3 bg-slate-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all z-20"
              >
                <X size={24} />
              </button>

              <div className="space-y-6">
                <div>
                   <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                     <Stethoscope size={16} className="text-teal-600" /> Professional Background
                   </h4>
                   <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 italic">
                     "{selectedDoctorForDetails.bio || 'No professional bio available for this specialist.'}"
                   </p>
                </div>

                <div className="grid grid-cols-2 gap-8">
                   <div>
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <CalendarIcon size={16} className="text-indigo-600" /> Regular Schedule
                      </h4>
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        {typeof selectedDoctorForDetails.availability === 'object' ? (
                          <div className="grid grid-cols-2 gap-y-2">
                            {Object.entries(selectedDoctorForDetails.availability).map(([day, time]) => (
                              <React.Fragment key={day}>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{day}</span>
                                <span className="text-[10px] font-black text-slate-800 text-right">{time as string}</span>
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] font-bold text-slate-500">{selectedDoctorForDetails.availability || 'Schedule not published'}</p>
                        )}
                      </div>
                   </div>
                   <div>
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <LanguagesIcon size={16} className="text-amber-600" /> Linguistics
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoctorForDetails.languages?.map(lang => (
                          <span key={lang} className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-600 uppercase">
                            {lang}
                          </span>
                        )) || <p className="text-[10px] text-slate-400">Not specified</p>}
                      </div>
                   </div>
                </div>
              </div>

              {/* ASSIGNMENT HUB */}
              <div className="pt-10 border-t border-slate-100 flex flex-col h-full min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                      <UserPlus size={16} className="text-teal-600" /> Consultation Assignment Hub
                    </h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Assign qualified patient leads for specialist appraisal</p>
                  </div>
                  <span className="bg-teal-50 text-teal-600 px-3 py-1 rounded-lg text-[10px] font-black">
                    {availableLeads.length} Available Leads
                  </span>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {availableLeads.length > 0 ? (
                    availableLeads.map(lead => (
                      <div key={lead.id} className="p-5 bg-white border border-slate-100 rounded-[2rem] hover:border-teal-400 transition-all flex items-center justify-between shadow-sm group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-black text-xs group-hover:bg-teal-600 group-hover:text-white transition-all">
                            {lead.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 leading-none">{lead.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase truncate max-w-[200px]">{lead.treatmentInterest}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleAssignPatient(lead.id, selectedDoctorForDetails.id)}
                          disabled={isAssigning}
                          className="px-6 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm border border-indigo-100"
                        >
                          {isAssigning ? 'Linking...' : 'Assign Specialist'}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed"> No qualified patient leads <br/> pending clinical triage </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Doctors;
