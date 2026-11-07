import React, { useState, useEffect, useRef } from 'react';
import { fetchHospitals, createHospital, updateHospital, deleteHospital, uploadFile } from '../services/supabase.ts';
import { Hospital, FacilityType } from '../types.ts';
import {
  Building,
  MapPin,
  Star,
  Phone,
  Mail,
  Plus,
  Search,
  Filter,
  X,
  Globe,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  MoreVertical,
  ChevronRight,
  Edit,
  Trash2,
  Image as ImageIcon,
  Upload,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import ImageCropper from './ui/ImageCropper';

const Hospitals: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [facilitiesInput, setFacilitiesInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingHospitalId, setEditingHospitalId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('All');
  const [selectedHospitalForDetails, setSelectedHospitalForDetails] = useState<Hospital | null>(null);
  
  // Image Cropping State
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  
  const [newHospital, setNewHospital] = useState<Partial<Hospital>>({
    type: FacilityType.HOSPITAL,
    rating: 0,
    description: '',
    is_active: false,
  });

  useEffect(() => {
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    setLoading(true);
    const { data, error } = await fetchHospitals();
    if (error) {
      toast.error('Failed to load hospitals');
    } else if (data) {
      // Map DB snake_case columns to the Hospital interface
      const mapped = (data as any[]).map(h => ({
        ...h,
        contactEmail: h.contact_email,
        contactPhone: h.contact_phone,
        imageUrl: h.image_url,
        bedCount: h.bed_count,
        facilities: h.facilities,
        is_active: h.is_active,
      }));
      setHospitals(mapped as Hospital[]);
    }
    setLoading(false);
  };

  const filteredHospitals = hospitals.filter(h => {
    const matchesSearch = (h.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (h.city?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      
    let matchesVisibility = true;
    if (visibilityFilter === 'Visible') matchesVisibility = h.is_active === true;
    else if (visibilityFilter === 'Hidden') matchesVisibility = h.is_active === false;
    
    return matchesSearch && matchesVisibility;
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB as per tooltip)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large. Please select a file under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setCropSrc(reader.result as string);
      setShowCropper(true);
    });
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setShowCropper(false);
    setIsUploading(true);
    
    try {
      const file = new File([croppedBlob], "hospital-facility.jpg", { type: "image/jpeg" });
      
      const { publicUrl, error } = await uploadFile(file, 'medical-docs');
      if (error) throw error;
      if (publicUrl) {
        setNewHospital({ ...newHospital, imageUrl: publicUrl });
        toast.success("Facility image adjusted and uploaded!");
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
      const hospitalData: any = {
        name: newHospital.name!,
        city: newHospital.city!,
        address: newHospital.address || '',
        contact_email: newHospital.contactEmail,
        contact_phone: newHospital.contactPhone,
        description: newHospital.description || '',
        accreditation: newHospital.accreditation,
        image_url: newHospital.imageUrl,
        facilities: facilitiesInput.split(',').map(f => f.trim()).filter(f => f !== ''),
        // Optional fields that might need migration
        type: newHospital.type || 'Hospital',
        country: newHospital.country,
        rating: newHospital.rating || 0,
        bed_count: newHospital.bedCount || 0,
        is_active: newHospital.is_active ?? false,
      };

      if (isEditing && editingHospitalId) {
        const { error } = await updateHospital(editingHospitalId, hospitalData);
        if (error) throw error;
        toast.success('Hospital updated successfully');
      } else {
        const { error } = await createHospital(hospitalData);
        if (error) throw error;
        toast.success('Hospital added successfully');
      }

      setShowModal(false);
      setIsEditing(false);
      setEditingHospitalId(null);
      loadHospitals();
    } catch (err: any) {
      console.error("Save error full object:", JSON.stringify(err, null, 2));
      const errorDetail = err.details ? ` (${err.details})` : '';
      const errorHint = err.hint ? ` - ${err.hint}` : '';
      toast.error(`${err.message || 'Check console for object'}${errorDetail}${errorHint}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (hospital: Hospital) => {
    setNewHospital({
      ...hospital,
      description: hospital.description || '',
    });
    setFacilitiesInput(hospital.facilities?.join(', ') || '');
    setEditingHospitalId(hospital.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this facility from the network?')) return;

    try {
      const { error } = await deleteHospital(id);
      if (error) throw error;
      toast.success('Hospital removed successfully');
      loadHospitals();
    } catch (err: any) {
      console.error(err);
      const errorDetail = err.details ? ` (${err.details})` : '';
      toast.error(`${err.message || 'Failed to delete hospital'}${errorDetail}`);
    }
  };

  const handleToggleActive = async (hospital: Hospital) => {
    try {
      const newStatus = !hospital.is_active;
      const { error } = await updateHospital(hospital.id, { is_active: newStatus });
      if (error) throw error;
      toast.success(`Facility marked as ${newStatus ? 'Visible' : 'Hidden'}`);
      loadHospitals();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update visibility');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Partner Facilities</h2>
          <p className="text-slate-500 font-medium mt-1">Network of accredited hospitals and specialized clinical centers.</p>
        </div>
        <button
          onClick={() => {
            setNewHospital({ type: FacilityType.HOSPITAL, rating: 0, description: '', is_active: false });
            setIsEditing(false);
            setEditingHospitalId(null);
            setShowModal(true);
          }}
          className="px-6 py-3 bg-teal-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all flex items-center gap-2"
        >
          <Plus size={18} /> Add Hospital
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by facility name or city..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHospitals.map(hospital => (
          <div key={hospital.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-teal-400 transition-all group overflow-hidden">
            <div className="relative h-24 bg-slate-50">
              <div className={`absolute top-4 left-4 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter ${hospital.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {hospital.is_active ? 'Visible' : 'Hidden'}
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={() => handleToggleActive(hospital)}
                  title={hospital.is_active ? "Hide Facility" : "Show Facility"}
                  className={`p-1.5 shadow-sm border rounded-lg transition-all ${hospital.is_active ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}
                >
                  {hospital.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button 
                  onClick={() => handleEdit(hospital)}
                  className="p-1.5 bg-white shadow-sm border border-slate-200 rounded-lg text-slate-400 hover:text-teal-600 transition-all"
                >
                  <Edit size={14} />
                </button>
                <button 
                  onClick={() => handleDelete(hospital.id)}
                  className="p-1.5 bg-white shadow-sm border border-slate-200 rounded-lg text-slate-400 hover:text-red-600 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="px-6 pb-6 -mt-4 relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div 
                onClick={() => setSelectedHospitalForDetails(hospital)}
                className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center border border-teal-100 shadow-inner group-hover:scale-110 transition-transform cursor-pointer"
              >
                <Building size={28} />
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg text-[10px] font-black">
                  <Star size={10} fill="currentColor" /> {hospital.rating || 'N/A'}
                </div>
                <span className="mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">{hospital.type}</span>
              </div>
            </div>

            <h3 className="text-xl font-black text-slate-900 leading-tight mb-2 group-hover:text-teal-600 transition-colors">{hospital.name}</h3>
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs mb-6">
              <MapPin size={14} className="text-slate-400" />
              {hospital.city}, {hospital.country}
            </div>

            <div className="flex items-center gap-2 text-slate-400 font-medium text-[10px] mb-4 overflow-hidden">
              <MapPin size={12} />
              <span className="truncate">{hospital.address || 'Address not listed'}</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-8 space-y-2">
              {hospital.accreditation && (
                <div className="flex items-center gap-2">
                  <ShieldCheck size={12} className="text-teal-600" />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{hospital.accreditation}</span>
                </div>
              )}
              {hospital.bedCount && (
                <div className="flex items-center gap-2">
                  <Activity size={12} className="text-indigo-600" />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{hospital.bedCount} Bed Capacity</span>
                </div>
              )}
              {hospital.facilities && hospital.facilities.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {hospital.facilities.slice(0, 3).map((f, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[8px] font-black text-slate-500 uppercase">
                      {f}
                    </span>
                  ))}
                  {hospital.facilities.length > 3 && (
                    <span className="text-[8px] font-black text-slate-400 ml-1">+{hospital.facilities.length - 3}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (hospital.contactPhone) window.location.href = `tel:${hospital.contactPhone}`;
                    else toast.error("Phone number not available");
                  }}
                  className="p-2.5 bg-slate-50 text-slate-400 hover:text-green-600 rounded-xl transition-all"
                >
                  <Phone size={16} />
                </button>
                <button 
                  onClick={() => {
                    if (hospital.contactEmail) {
                      localStorage.setItem('crm_target_recipient_email', hospital.contactEmail);
                      localStorage.setItem('crm_target_recipient_name', hospital.name || hospital.contactEmail);
                      window.location.hash = '#/communications';
                    } else {
                      toast.error("Email address not available");
                    }
                  }}
                  className="p-2.5 bg-slate-50 text-slate-400 hover:text-sky-600 rounded-xl transition-all"
                >
                  <Mail size={16} />
                </button>
              </div>
              <button 
                onClick={() => setSelectedHospitalForDetails(hospital)}
                className="text-[10px] font-black text-teal-600 uppercase hover:underline flex items-center gap-1"
              >
                Facility Details <ChevronRight size={14} />
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
                  {isEditing ? 'Update Facility' : 'Facility Registry'}
                </h3>
                <p className="text-[10px] font-bold text-teal-100 uppercase tracking-widest">
                  {isEditing ? 'Modify partner information' : 'Onboard New Hospital Partner'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setIsEditing(false);
                  setEditingHospitalId(null);
                }} 
                className="p-2 hover:bg-white/10 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Facility Name</label>
                <input required minLength={3} type="text" value={newHospital.name || ''} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Facility Type</label>
                  <select value={newHospital.type || ''} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, type: e.target.value as any })}>
                    <option value={FacilityType.HOSPITAL}>Hospital</option>
                    <option value={FacilityType.CLINIC}>Specialized Clinic</option>
                    <option value={FacilityType.LAB}>Diagnostic Lab</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Country</label>
                  <input required type="text" value={newHospital.country || ''} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, country: e.target.value })} />
                </div>
              </div>
              {isEditing && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Visibility Status</label>
                <select value={newHospital.is_active ? 'Active' : 'Inactive'} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold cursor-pointer" onChange={e => setNewHospital({ ...newHospital, is_active: e.target.value === 'Active' })}>
                  <option value="Active">Visible on Website</option>
                  <option value="Inactive">Hidden (Pending)</option>
                </select>
              </div>
              )}
              {!isEditing && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <EyeOff size={16} className="text-amber-600" />
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Auto-Hidden on Registration</span>
                  </div>
                  <p className="text-[9px] font-bold text-amber-600 mt-1 pl-6">New facilities are hidden by default. An admin can make it visible later.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">City</label>
                  <input required type="text" value={newHospital.city || ''} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, city: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Capacity (Beds)</label>
                  <input required min="1" type="number" value={newHospital.bedCount || 0} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, bedCount: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Street Address</label>
                <input required type="text" value={newHospital.address || ''} placeholder="e.g. 123 Healthcare Blvd" className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, address: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Accreditation (e.g. JCI, ISO)</label>
                <input type="text" value={newHospital.accreditation || ''} className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, accreditation: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Contact Email</label>
                  <input type="email" value={newHospital.contactEmail || ''} placeholder="contact@hospital.com" className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, contactEmail: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Contact Phone</label>
                  <input type="tel" value={newHospital.contactPhone || ''} placeholder="+123..." className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, contactPhone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Facilities & Amenities (Comma separated)</label>
                <input type="text" value={facilitiesInput} placeholder="ICU, Radiology, Pharmacy, Cafeteria..." className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setFacilitiesInput(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Facility Image</label>
                <div className="flex items-center gap-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center relative shadow-sm">
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                    ) : newHospital.imageUrl ? (
                      <img src={newHospital.imageUrl} className="w-full h-full object-cover" alt="Preview" />
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
                      {isUploading ? 'Uploading...' : <><Upload size={14} className="text-teal-600" /> Upload Photo</>}
                    </button>
                    <p className="text-[9px] text-slate-400 mt-2 font-bold italic">Max size 5MB (JPG, PNG)</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Facility Rating (1-5)</label>
                <input required min="1" max="5" step="0.1" type="number" value={newHospital.rating || 0} placeholder="e.g. 4.8" className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, rating: parseFloat(e.target.value) })} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Detailed Description</label>
                <textarea required minLength={20} rows={3} value={newHospital.description || ''} placeholder="About the facility, history, and specialties (min 20 chars)..." className="w-full mt-2 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 font-bold" onChange={e => setNewHospital({ ...newHospital, description: e.target.value })} />
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
                  isEditing ? 'Save Changes' : 'Add Partner to Network'
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
          aspectRatio={16 / 9} // 16:9 for hospitals
        />
      )}

      {selectedHospitalForDetails && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="relative h-64 bg-slate-100">
              {selectedHospitalForDetails.imageUrl ? (
                <img src={selectedHospitalForDetails.imageUrl} className="w-full h-full object-cover" alt={selectedHospitalForDetails.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Building size={80} />
                </div>
              )}
              <button 
                onClick={() => setSelectedHospitalForDetails(null)}
                className="absolute top-6 right-6 p-3 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
              <div className="absolute bottom-6 left-8">
                <div className="px-4 py-1.5 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                  {selectedHospitalForDetails.type}
                </div>
              </div>
            </div>
            
            <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{selectedHospitalForDetails.name}</h3>
                  <div className="flex items-center gap-3 text-slate-500 font-bold text-sm mt-2">
                    <MapPin size={16} className="text-teal-600" />
                    {selectedHospitalForDetails.address}, {selectedHospitalForDetails.city}, {selectedHospitalForDetails.country}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl text-lg font-black">
                    <Star size={18} fill="currentColor" /> {selectedHospitalForDetails.rating || 'N/A'}
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{selectedHospitalForDetails.is_active ? 'In Network' : 'Off Network'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                  <ShieldCheck size={28} className="text-teal-600" />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Accreditation</p>
                    <p className="text-sm font-black text-slate-800">{selectedHospitalForDetails.accreditation || 'Standard Verification'}</p>
                  </div>
                </div>
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                  <Activity size={28} className="text-indigo-600" />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Capacity</p>
                    <p className="text-sm font-black text-slate-800">{selectedHospitalForDetails.bedCount || '0'} Bed Facility</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">Facility Description</h4>
                <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 italic">
                  "{selectedHospitalForDetails.description || 'No detailed description available for this facility yet.'}"
                </p>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-1">Available Services & Inventory</h4>
                <div className="flex flex-wrap gap-3">
                  {selectedHospitalForDetails.facilities?.map((f, i) => (
                    <div key={i} className="px-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest shadow-sm hover:border-teal-400 transition-all">
                      {f}
                    </div>
                  )) || <p className="text-xs text-slate-400 italic">No facility listing updated.</p>}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => {
                        const email = selectedHospitalForDetails.contactEmail || '';
                        const name = selectedHospitalForDetails.name || '';
                        localStorage.setItem('crm_target_recipient_email', email);
                        localStorage.setItem('crm_target_recipient_name', name || email);
                        window.location.hash = '#/communications';
                    }}
                  className="flex-1 py-4 bg-teal-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Mail size={16} /> Contact Facility
                </button>
                <button 
                  onClick={() => window.location.href = `tel:${selectedHospitalForDetails.contactPhone}`}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  <Phone size={16} /> Direct Hotline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hospitals;
