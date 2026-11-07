
import React from 'react';
import { User, Bell, Lock, Database, Globe, Smartphone } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Control Center</h2>
        <p className="text-slate-500 text-sm">Configure your WaruWenJo instance and connections.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <nav className="space-y-1">
          {[
            { name: 'User Profile', icon: <User size={18} />, active: true },
            { name: 'Integrations', icon: <Database size={18} />, active: false },
            { name: 'Notifications', icon: <Bell size={18} />, active: false },
            { name: 'Security', icon: <Lock size={18} />, active: false },
            { name: 'Compliance', icon: <Globe size={18} />, active: false },
          ].map((item) => (
            <button
              key={item.name}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-all ${item.active ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              {item.icon}
              {item.name}
            </button>
          ))}
        </nav>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">User Profile</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-6 mb-6">
                <img src="https://images.unsplash.com/photo-1559839734-2b71f1536783?auto=format&fit=crop&q=80&w=80&h=80" className="w-20 h-20 rounded-2xl object-cover shadow-md" />
                <button className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200">
                  Change Photo
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">First Name</label>
                  <input type="text" defaultValue="James" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Last Name</label>
                  <input type="text" defaultValue="Wilson" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Medical NPI (Optional)</label>
                <input type="text" placeholder="1234567890" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Database className="text-teal-600" size={20} /> Supabase Connection
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl">
                <p className="text-xs text-teal-800 font-medium">
                  Connection active. Syncing encrypted data to your cloud instance.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Project URL</label>
                <input type="text" value="https://healthhub-main.supabase.co" readOnly className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button className="px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100">
                  Disconnect
                </button>
                <button className="px-6 py-2 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 shadow-sm">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
