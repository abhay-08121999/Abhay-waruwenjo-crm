
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { TrendingUp, Download, Calendar, Filter, Users, Building2, Briefcase } from 'lucide-react';

const facilityData = [
  { name: 'Public Hospitals', value: 450000, color: '#0d9488' },
  { name: 'Private Clinics', value: 210000, color: '#0891b2' },
  { name: 'Labs & Research', value: 130000, color: '#0369a1' },
  { name: 'Care Homes', value: 85000, color: '#312e81' },
];

const performanceData = [
  { month: 'Jan', revenue: 45000, targets: 40000 },
  { month: 'Feb', revenue: 52000, targets: 42000 },
  { month: 'Mar', revenue: 48000, targets: 45000 },
  { month: 'Apr', revenue: 61000, targets: 48000 },
  { month: 'May', revenue: 55000, targets: 50000 },
];

const Reports: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Facility Analytics</h2>
          <p className="text-slate-500 text-sm">Revenue breakdown across the medical landscape.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
            <Calendar size={18} />
            Last 30 Days
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
            <Download size={18} />
            Export Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Total Forecast</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">$1.2M</p>
          <div className="flex items-center gap-1 mt-2 text-green-600 font-bold text-xs">
            <TrendingUp size={14} /> +14.2% vs prev quarter
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Avg Contract Size</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">$34,500</p>
          <p className="text-slate-500 text-xs mt-2">Up $2k from last month</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Active Facilities</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">124</p>
          <p className="text-slate-500 text-xs mt-2">12 new this week</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Building2 className="text-teal-600" size={20} /> Revenue by Sector
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={facilityData} innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                  {facilityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            {facilityData.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }}></div>
                  <span className="text-xs text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-900">${(item.value/1000).toFixed(0)}k</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Briefcase className="text-indigo-600" size={20} /> Performance Trends
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#0d9488" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                <Area type="monotone" dataKey="targets" stroke="#6366f1" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
