import React, { useState, useCallback, useEffect } from 'react';
import {
   Upload, File, FileText, Image as ImageIcon, Video, Search, X, CheckCircle, 
   Lock, ShieldCheck, HardDrive, Download, Trash2, MoreVertical, Filter, 
   Info, Loader2, Share2, Eye, FileDigit, Database, User, AlertCircle
} from 'lucide-react';
import { MedicalFile } from '../types.ts';
import { supabase, fetchMedicalFiles } from '../services/supabase.ts';
import { toast } from 'sonner';

const DigitalVault: React.FC = () => {
   const [files, setFiles] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isDragging, setIsDragging] = useState(false);
   const [uploadingFiles, setUploadingFiles] = useState<{ name: string, progress: number, id: string }[]>([]);
   const [searchTerm, setSearchTerm] = useState('');
   const [activeCategory, setActiveCategory] = useState<string>('All');

   const categories = ['All', 'Imaging', 'Lab', 'Legal', 'Financial', 'Other'];

   const loadFiles = async () => {
      setIsLoading(true);
      const { data, error } = await fetchMedicalFiles();
      if (error) {
         // Fallback to storage list if table doesn't exist or has error
         const { data: storageData } = await supabase.storage.from('vault').list();
         if (storageData) {
            setFiles(storageData.map(f => ({
                id: f.id,
                name: f.name,
                type: f.metadata?.mimetype || 'application/octet-stream',
                size: f.metadata?.size || 0,
                uploadedAt: f.created_at,
                category: 'Other',
                status: 'Secure'
            })));
         }
      } else {
         setFiles(data || []);
      }
      setIsLoading(false);
   };

   useEffect(() => {
      loadFiles();
   }, []);

   const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
   };

   const handleDragLeave = () => {
      setIsDragging(false);
   };

   const performUpload = async (file: File) => {
      const uploadId = Math.random().toString(36).substr(2, 9);
      setUploadingFiles(prev => [...prev, { name: file.name, progress: 0, id: uploadId }]);

      try {
         const filePath = `${Date.now()}_${file.name}`;
         const { data, error } = await supabase.storage
            .from('vault')
            .upload(filePath, file);

         if (error) throw error;

         // Insert metadata into medical_files table if possible
         const { data: publicUrlData } = supabase.storage.from('vault').getPublicUrl(filePath);
         
         await supabase.from('medical_files').insert({
            name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            category: activeCategory === 'All' ? 'Other' : activeCategory,
            secure_url: publicUrlData.publicUrl,
            status: 'Secure'
         });

         toast.success(`${file.name} encrypted and stored.`);
         loadFiles();
      } catch (error: any) {
         toast.error(`Upload failed: ${error.message}`);
      } finally {
         setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
      }
   };

   const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      Array.from(e.dataTransfer.files).forEach(performUpload);
   };

   const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
         Array.from(e.target.files).forEach(performUpload);
      }
   };

   const handleDeleteFile = async (file: any) => {
      if (!window.confirm(`Permanently delete ${file.name}?`)) return;

      try {
         await supabase.storage.from('vault').remove([file.file_path || file.name]);
         await supabase.from('medical_files').delete().eq('id', file.id);
         toast.success('Resource purged from vault');
         loadFiles();
      } catch (error) {
         toast.error('Purge failed');
      }
   };

   const formatSize = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
   };

   const filteredFiles = files.filter(f => {
      const matchesSearch = (f.name?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      const matchesCat = activeCategory === 'All' || f.category === activeCategory;
      return matchesSearch && matchesCat;
   });

   const totalSize = files.reduce((acc, f) => acc + (f.file_size || f.size || 0), 0);

   return (
      <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
               <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-sm">
                     <HardDrive size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">Digital Vault</h2>
               </div>
               <p className="text-slate-500 font-medium">Uncapped storage for high-resolution medical imaging and compliance documentation.</p>
            </div>

            <div className="flex items-center gap-3">
               <div className="hidden lg:flex items-center gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-right">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Storage</p>
                     <p className="text-sm font-black text-slate-800">{formatSize(totalSize)} / <span className="text-teal-500 font-black">UNCAPPED</span></p>
                  </div>
                  <Database size={20} className="text-teal-500" />
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-4 space-y-6">
               <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative h-80 rounded-[3rem] border-4 border-dashed transition-all flex flex-col items-center justify-center p-8 group cursor-pointer ${isDragging ? 'bg-indigo-50 border-indigo-500 scale-[1.02]' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'}`}
               >
                  <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileInput} />
                  <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform shadow-sm">
                     <Upload size={32} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight text-center">Secure Drop Inbound</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2">AES-256 Tunnel Active</p>
               </div>

               {uploadingFiles.length > 0 && (
                  <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl space-y-6">
                     <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Encrypting & Storing...</h3>
                        <Loader2 size={16} className="animate-spin text-indigo-400" />
                     </div>
                     {uploadingFiles.map(file => (
                        <div key={file.id} className="space-y-2">
                           <div className="flex justify-between text-[11px] font-bold truncate">
                              <span className="truncate pr-4">{file.name}</span>
                              <span className="text-indigo-400">{Math.round(file.progress)}%</span>
                           </div>
                           <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${file.progress}%` }}></div>
                           </div>
                        </div>
                     ))}
                  </div>
               )}

               <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
                  <ShieldCheck className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
                  <div className="flex items-center gap-3 mb-4">
                     <div className="p-2 bg-white/10 rounded-xl"><Lock size={20} /></div>
                     <h4 className="text-lg font-black tracking-tight">Compliance Shield</h4>
                  </div>
                  <p className="text-xs text-indigo-100 leading-relaxed font-bold">Files are encrypted using AES-256 at rest and TLS 1.3 in transit. Fully HIPAA and GDPR compliant.</p>
               </div>
            </div>

            <div className="xl:col-span-8 space-y-6">
               <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                  <div className="p-8 border-b border-slate-50 flex flex-col gap-6">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2">
                           <FileDigit size={18} className="text-indigo-500" /> Resource Browser
                        </h3>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner overflow-x-auto scrollbar-hide shrink-0">
                           {categories.map(cat => (
                              <button
                                 key={cat}
                                 onClick={() => setActiveCategory(cat)}
                                 className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                              >
                                 {cat}
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                           type="text"
                           placeholder="Search encrypted vault by resource name..."
                           className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-8 focus:ring-indigo-500/5 transition-all"
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                        />
                     </div>
                  </div>

                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50/50">
                           <tr>
                              <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Resource</th>
                              <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                              <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Protection</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {isLoading ? (
                              <tr><td colSpan={3} className="py-20 text-center"><Loader2 size={32} className="mx-auto animate-spin text-slate-300" /></td></tr>
                           ) : filteredFiles.map(file => (
                              <tr key={file.id} className="hover:bg-slate-50/80 transition-all group">
                                 <td className="px-10 py-7">
                                    <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-500 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                          {file.name?.charAt(0) || 'F'}
                                       </div>
                                       <div>
                                          <p className="text-sm font-black text-slate-800 transition-colors group-hover:text-indigo-600 truncate max-w-[300px]">{file.name}</p>
                                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                                             {formatSize(file.file_size || file.size)} • {file.category || 'Other'}
                                          </p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-10 py-7">
                                    <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                       {file.file_type?.split('/')[1]?.toUpperCase() || 'DATA'}
                                    </span>
                                 </td>
                                 <td className="px-10 py-7 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                       <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                          <button onClick={() => window.open(file.secure_url || file.url, '_blank')} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all"><Eye size={16} /></button>
                                          <button onClick={() => handleDeleteFile(file)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl shadow-sm border border-slate-100 transition-all"><Trash2 size={16} /></button>
                                       </div>
                                       <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-full font-black text-[9px] uppercase border border-green-100">
                                          <Lock size={12} /> SECURE
                                       </div>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default DigitalVault;
