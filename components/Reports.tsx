import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  RefreshCw, Users, Building2, TrendingUp, Trophy, Medal, Download, Search, Sparkles, CalendarDays, Target,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { fetchCrmUsers } from '../services/roles';

const UNASSIGNED = 'unassigned';
const TEAL = '#0d9488';
const INDIGO = '#6366f1';
const AMBER = '#f59e0b';
const ROSE = '#f43f5e';

const RANGE_OPTIONS = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
  { key: 'all', label: 'All time', days: null as number | null },
];

const MEDICAL_STAGE_NAMES: Record<number, string> = {
  1: 'Inquiry',
  2: 'Qualified',
  3: 'Contracting',
  4: 'Active',
  5: 'Archived',
};

// A patient lead is converted once Stage 8 "Convert Lead to Medical Case" has a converted_at time.
const patientConvertedAt = (row: any): string | null =>
  row?.workflow_state?.stage_data?.stage8?.data?.converted_at ?? null;

const withinRange = (iso: string | null | undefined, days: number | null) => {
  if (!iso) return false;
  if (days === null) return true;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
};

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [medical, setMedical] = useState<any[]>([]);
  const [bdmNames, setBdmNames] = useState<Record<string, string>>({});
  const [rangeKey, setRangeKey] = useState('all');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const range = RANGE_OPTIONS.find(option => option.key === rangeKey) || RANGE_OPTIONS[3];
  const days = range.days;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const errors: string[] = [];
    try {
      const [patientResult, medicalResult, usersResult] = await Promise.all([
        supabase.from('patient_enquiries').select('id, assigned_bdm_id, workflow_state, created_at'),
        supabase.from('medical_leads').select('id, converted_at, converted_by, workflow_stage, created_at'),
        fetchCrmUsers(),
      ]);
      if (patientResult.error) errors.push(`Patient leads: ${patientResult.error.message}`);
      if (medicalResult.error) errors.push(`Medical leads: ${medicalResult.error.message}`);
      if (usersResult.error) errors.push(`BDM names: ${(usersResult.error as any).message || 'failed to load'}`);

      const names: Record<string, string> = {};
      ((usersResult.data as any[]) || []).forEach((user: any) => {
        if ((user.roles || []).some((role: any) => role.key === 'bdm')) {
          names[user.user_id] = user.full_name || user.username || user.email || 'BDM';
        }
      });
      setBdmNames(names);
      setPatients(patientResult.data || []);
      setMedical(medicalResult.data || []);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Analytics load failed:', error);
      errors.push(error?.message || 'Unknown error');
    } finally {
      setLoadError(errors.length ? errors.join(' | ') : null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Filtered data for the selected period ----
  const patientsInRange = useMemo(() => patients.filter(p => withinRange(p.created_at, days)), [patients, days]);
  const medicalInRange = useMemo(() => medical.filter(m => withinRange(m.created_at, days)), [medical, days]);
  const patientConvertedRows = useMemo(
    () => patients.filter(p => withinRange(patientConvertedAt(p), days)),
    [patients, days],
  );
  const medicalConvertedRows = useMemo(
    () => medical.filter(m => withinRange(m.converted_at, days)),
    [medical, days],
  );

  const summary = useMemo(() => {
    const patientConverted = patientConvertedRows.length;
    const medicalConverted = medicalConvertedRows.length;
    return {
      patientTotal: patientsInRange.length,
      patientConverted,
      patientRate: pct(patientConverted, patientsInRange.length),
      medicalTotal: medicalInRange.length,
      medicalConverted,
      medicalRate: pct(medicalConverted, medicalInRange.length),
      totalConverted: patientConverted + medicalConverted,
    };
  }, [patientConvertedRows, medicalConvertedRows, patientsInRange, medicalInRange]);

  // ---- Per-BDM leaderboard ----
  const bdmRows = useMemo(() => {
    const rows = new Map<string, any>();
    const rowFor = (key: string) => {
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          name: key === UNASSIGNED ? 'Unassigned' : bdmNames[key] || 'Former / unknown BDM',
          patientAssigned: 0,
          patientConverted: 0,
          medicalConverted: 0,
        });
      }
      return rows.get(key);
    };
    patientsInRange.forEach(p => { rowFor(p.assigned_bdm_id || UNASSIGNED).patientAssigned += 1; });
    patientConvertedRows.forEach(p => { rowFor(p.assigned_bdm_id || UNASSIGNED).patientConverted += 1; });
    medicalConvertedRows.forEach(m => { rowFor(m.converted_by || UNASSIGNED).medicalConverted += 1; });

    return Array.from(rows.values())
      .map(row => ({
        ...row,
        totalConverted: row.patientConverted + row.medicalConverted,
        rate: pct(row.patientConverted, row.patientAssigned),
      }))
      .filter(row => row.key !== UNASSIGNED || row.patientAssigned > 0 || row.medicalConverted > 0)
      .sort((a, b) => b.totalConverted - a.totalConverted || b.rate - a.rate);
  }, [patientsInRange, patientConvertedRows, medicalConvertedRows, bdmNames]);

  const visibleBdmRows = useMemo(
    () => bdmRows.filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase())),
    [bdmRows, search],
  );

  const podium = bdmRows.filter(row => row.key !== UNASSIGNED && row.totalConverted > 0).slice(0, 3);
  const maxTotal = Math.max(1, ...bdmRows.map(row => row.totalConverted));

  // ---- Monthly trend: last 6 months of conversions ----
  const trendData = useMemo(() => {
    const buckets: { key: string; label: string; patient: number; medical: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: monthKey(date),
        label: date.toLocaleString('en-US', { month: 'short' }),
        patient: 0,
        medical: 0,
      });
    }
    const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]));
    patients.forEach(p => {
      const iso = patientConvertedAt(p);
      if (!iso) return;
      const bucket = byKey.get(monthKey(new Date(iso)));
      if (bucket) bucket.patient += 1;
    });
    medical.forEach(m => {
      if (!m.converted_at) return;
      const bucket = byKey.get(monthKey(new Date(m.converted_at)));
      if (bucket) bucket.medical += 1;
    });
    return buckets;
  }, [patients, medical]);

  // ---- Medical pipeline by stage ----
  const stageData = useMemo(() => {
    return [1, 2, 3, 4, 5].map(stage => ({
      name: MEDICAL_STAGE_NAMES[stage],
      count: medicalInRange.filter(m => Number(m.workflow_stage) === stage).length,
    }));
  }, [medicalInRange]);

  const splitData = [
    { name: 'Patient leads', value: summary.patientConverted, color: TEAL },
    { name: 'Medical leads', value: summary.medicalConverted, color: INDIGO },
  ];

  const exportCsv = () => {
    const header = ['BDM', 'Patient leads assigned', 'Patient leads converted', 'Conversion %', 'Medical leads converted', 'Total converted'];
    const lines = bdmRows.map(row => [
      row.name, row.patientAssigned, row.patientConverted, `${row.rate}%`, row.medicalConverted, row.totalConverted,
    ]);
    const csv = [header, ...lines]
      .map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversions-${rangeKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  const kpis = [
    {
      label: 'Patient leads converted',
      value: summary.patientConverted,
      sub: `${summary.patientRate}% of ${summary.patientTotal} patient leads`,
      icon: Users,
      gradient: 'from-teal-500 to-emerald-600',
      progress: summary.patientRate,
    },
    {
      label: 'Medical leads converted',
      value: summary.medicalConverted,
      sub: `${summary.medicalRate}% of ${summary.medicalTotal} medical leads`,
      icon: Building2,
      gradient: 'from-indigo-500 to-violet-600',
      progress: summary.medicalRate,
    },
    {
      label: 'Total converted',
      value: summary.totalConverted,
      sub: `${bdmRows.filter(row => row.key !== UNASSIGNED && row.totalConverted > 0).length} BDMs with conversions`,
      icon: TrendingUp,
      gradient: 'from-amber-500 to-orange-600',
      progress: pct(summary.totalConverted, summary.patientTotal + summary.medicalTotal),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-900 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-teal-300">
              <Sparkles size={14} /> Conversion analytics
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Performance overview</h2>
            <p className="mt-1 text-sm text-slate-300">
              Converted patient and medical leads, and who converted them.
              {lastUpdated && <span className="text-slate-400"> · Updated {lastUpdated.toLocaleTimeString()}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl bg-white/10 p-1 backdrop-blur">
              {RANGE_OPTIONS.map(option => (
                <button
                  key={option.key}
                  onClick={() => setRangeKey(option.key)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                    rangeKey === option.key ? 'bg-white text-slate-900 shadow' : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              onClick={exportCsv}
              disabled={bdmRows.length === 0}
              className="flex items-center gap-2 rounded-2xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-teal-500/30 hover:bg-teal-400 disabled:opacity-50"
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          <p className="font-bold">Could not load all conversion data.</p>
          <p className="mt-1 break-words text-xs">{loadError}</p>
          <p className="mt-2 text-xs text-rose-600">
            If the error mentions a missing column (for example workflow_stage or converted_at), run
            medical_lead_access_and_conversions.sql in the Supabase SQL editor, then press Refresh.
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="group relative overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className={`absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br ${kpi.gradient} opacity-15 transition group-hover:opacity-25`} />
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${kpi.gradient} text-white shadow-md`}>
                <Icon size={20} />
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">{kpi.label}</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-slate-900">{loading ? '–' : kpi.value}</p>
              <p className="mt-1 text-xs text-slate-500">{kpi.sub}</p>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full bg-gradient-to-r ${kpi.gradient} transition-all duration-700`} style={{ width: `${Math.min(100, kpi.progress)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Podium + trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 lg:col-span-1">
          <h3 className="flex items-center gap-2 text-base font-black text-slate-800">
            <Trophy size={18} className="text-amber-500" /> Top performers
          </h3>
          <p className="text-xs text-slate-500">Most conversions in the selected period</p>
          {podium.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No conversions in this period yet.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {podium.map((row, index) => {
                const medalColor = index === 0 ? 'from-amber-400 to-yellow-500' : index === 1 ? 'from-slate-300 to-slate-400' : 'from-orange-300 to-amber-600';
                return (
                  <div key={row.key} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${medalColor} text-white shadow-md`}>
                      <Medal size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-800">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.patientConverted} patient · {row.medicalConverted} medical
                      </p>
                    </div>
                    <p className="text-2xl font-black text-slate-900">{row.totalConverted}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Converted split</p>
            <div className="mt-2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={splitData} innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                    {splitData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={28} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-base font-black text-slate-800">
                <CalendarDays size={18} className="text-teal-600" /> Conversion trend
              </h3>
              <p className="text-xs text-slate-500">Conversions per month, last 6 months</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPatient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TEAL} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradMedical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={INDIGO} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={INDIGO} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="patient" name="Patient leads" stroke={TEAL} strokeWidth={3} fill="url(#gradPatient)" />
                <Area type="monotone" dataKey="medical" name="Medical leads" stroke={INDIGO} strokeWidth={3} fill="url(#gradMedical)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* BDM leaderboard table */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-slate-800">
              <Target size={18} className="text-indigo-600" /> Conversions by BDM
            </h3>
            <p className="text-xs text-slate-500">Patient leads are credited to the assigned BDM; medical leads to the BDM who converted them.</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search BDM"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-teal-400 focus:bg-white md:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 py-8">
            {[0, 1, 2].map(i => <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        ) : bdmRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No leads in this period yet.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  <th className="py-3 pr-4">#</th>
                  <th className="py-3 pr-4">BDM</th>
                  <th className="py-3 pr-4 text-right">Patient assigned</th>
                  <th className="py-3 pr-4 text-right">Patient converted</th>
                  <th className="py-3 pr-4 w-48">Conversion rate</th>
                  <th className="py-3 pr-4 text-right">Medical converted</th>
                  <th className="py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibleBdmRows.map((row, index) => (
                  <tr key={row.key} className="border-b border-slate-100 transition hover:bg-slate-50/70">
                    <td className="py-3.5 pr-4 font-bold text-slate-400">{index + 1}</td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-indigo-500 text-xs font-black text-white">
                          {row.name.split(' ').map((part: string) => part[0]).slice(0, 2).join('').toUpperCase() || '?'}
                        </div>
                        <span className="font-semibold text-slate-800">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-right text-slate-600">{row.patientAssigned}</td>
                    <td className="py-3.5 pr-4 text-right font-bold text-teal-700">{row.patientConverted}</td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500" style={{ width: `${Math.min(100, row.rate)}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs font-bold text-slate-600">{row.rate}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-right font-bold text-indigo-700">{row.medicalConverted}</td>
                    <td className="py-3.5 text-right">
                      <span className="inline-flex min-w-[2.5rem] justify-center rounded-xl bg-slate-900 px-2.5 py-1 text-xs font-black text-white">
                        {row.totalConverted}
                      </span>
                    </td>
                  </tr>
                ))}
                {visibleBdmRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-slate-400">No BDM matches "{search}".</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom row: per-BDM bars + medical pipeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <h3 className="text-base font-black text-slate-800">Total converted by BDM</h3>
          <p className="text-xs text-slate-500">Relative performance in the selected period</p>
          <div className="mt-5 space-y-4">
            {bdmRows.filter(row => row.totalConverted > 0).length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No conversions yet.</p>
            )}
            {bdmRows.filter(row => row.totalConverted > 0).map(row => (
              <div key={row.key}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{row.name}</span>
                  <span className="font-black text-slate-900">{row.totalConverted}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-500 to-indigo-500 transition-all duration-700"
                    style={{ width: `${(row.totalConverted / maxTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <h3 className="text-base font-black text-slate-800">Medical leads by stage</h3>
          <p className="text-xs text-slate-500">Where medical leads sit in the partnership workflow</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" name="Leads" radius={[8, 8, 0, 0]}>
                  {stageData.map((entry, index) => (
                    <Cell key={entry.name} fill={[ '#94a3b8', AMBER, INDIGO, TEAL, ROSE ][index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-slate-400">
        Patient leads count as converted when the Stage 8 medical case conversion is recorded. Medical leads count as converted when they reach Stage 4 (Active Partners).
      </p>
    </div>
  );
};

export default Reports;