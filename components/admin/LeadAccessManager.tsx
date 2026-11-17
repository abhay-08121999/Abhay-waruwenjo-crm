import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { fetchCrmUsers } from '../../services/roles';
import { fetchB2BLeads } from '../../services/supabase';
import {
  fetchAllLeadGrants,
  grantLeadAccess,
  revokeLeadAccess,
  type LeadGrant,
  type LeadType,
} from '../../services/leadAccess';

type LeadRow = { id: string; label: string; sub: string };

const db = supabase as any;

/* Lets the super admin choose a BDM and decide which leads that BDM may write to.
   BDMs still see every lead; this only controls editing. */
const LeadAccessManager = () => {
  const [bdms, setBdms] = useState<{ user_id: string; name: string }[]>([]);
  const [selectedBdm, setSelectedBdm] = useState<string | null>(null);
  const [leadType, setLeadType] = useState<LeadType>('patient');
  const [patientLeads, setPatientLeads] = useState<LeadRow[]>([]);
  const [medicalLeads, setMedicalLeads] = useState<LeadRow[]>([]);
  const [grants, setGrants] = useState<LeadGrant[]>([]);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result: any = await fetchCrmUsers();
        const users: any[] = Array.isArray(result) ? result : result?.data ?? [];

        setBdms(
          users
            .filter((user) =>
              (user.roles || []).some((role: any) => role.key === 'bdm')
            )
            .map((user) => ({
              user_id: user.user_id,
              name: user.full_name || user.email,
            }))
        );

        const [{ data: patients }, { data: medical }, grantRows] =
          await Promise.all([
            db.from('patient_enquiries').select('*').limit(1000),
            fetchB2BLeads(),
            fetchAllLeadGrants(),
          ]);

        setPatientLeads(
          (patients || []).map((row: any) => ({
            id: String(row.id),
            label: row.full_name || row.name || 'Unnamed patient',
            sub: row.phone || row.email || '',
          }))
        );

        setMedicalLeads(
          (medical || []).map((row: any) => ({
            id: String(row.id),
            label: row.company_name || row.full_name || 'Unnamed partner',
            sub: row.full_name && row.company_name ? row.full_name : row.email || '',
          }))
        );

        setGrants(grantRows);
      } catch (error) {
        console.error(error);
        toast.error('Could not load lead access data.');
      }
    };

    void load();
  }, []);

  const grantedCount = (type: LeadType) =>
    grants.filter((g) => g.user_id === selectedBdm && g.lead_type === type)
      .length;

  const leads = leadType === 'patient' ? patientLeads : medicalLeads;

  const visibleLeads = leads.filter((lead) => {
    const term = search.trim().toLowerCase();
    return !term || `${lead.label} ${lead.sub}`.toLowerCase().includes(term);
  });

  const toggle = async (lead: LeadRow, granted: boolean) => {
    if (!selectedBdm) return;
    setBusyId(lead.id);

    try {
      if (granted) {
        await revokeLeadAccess(leadType, lead.id, selectedBdm);
        setGrants((rows) =>
          rows.filter(
            (g) =>
              !(
                g.user_id === selectedBdm &&
                g.lead_type === leadType &&
                g.lead_id === lead.id
              )
          )
        );
        toast.success('Write access removed.');
      } else {
        await grantLeadAccess(leadType, lead.id, selectedBdm);
        setGrants((rows) => [
          ...rows,
          {
            id: `${leadType}-${lead.id}-${selectedBdm}`,
            lead_type: leadType,
            lead_id: lead.id,
            user_id: selectedBdm,
          },
        ]);
        toast.success('Write access granted.');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Only the super admin can change lead access.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-lg font-black text-slate-900">BDM Lead Access</h2>
        <p className="text-sm text-slate-500 mt-1">
          BDMs can see all patient and medical leads. They can write only to the
          leads granted below.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* BDM list */}
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            BDMs
          </p>

          {bdms.length === 0 && (
            <p className="text-sm text-slate-400">No BDM accounts yet.</p>
          )}

          {bdms.map((bdm) => (
            <button
              key={bdm.user_id}
              type="button"
              onClick={() => setSelectedBdm(bdm.user_id)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition-colors ${
                selectedBdm === bdm.user_id
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-700 hover:border-indigo-300'
              }`}
            >
              {bdm.name}
              {selectedBdm === bdm.user_id && (
                <span className="block text-[11px] font-semibold text-slate-500 mt-1">
                  Patient: {grantedCount('patient')} · Medical:{' '}
                  {grantedCount('medical')} granted
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lead grants */}
        <div className="space-y-4">
          {!selectedBdm ? (
            <p className="text-sm text-slate-400 py-10 text-center">
              Select a BDM to manage their lead access.
            </p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="inline-flex rounded-xl border border-slate-200 p-1">
                  {(['patient', 'medical'] as LeadType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setLeadType(type);
                        setSearch('');
                      }}
                      className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest ${
                        leadType === type
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      {type === 'patient' ? 'Patient leads' : 'Medical leads'}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search leads"
                    className="w-full sm:w-64 rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-sm"
                  />
                </div>
              </div>

              <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                {visibleLeads.length === 0 && (
                  <p className="p-6 text-sm text-slate-400 text-center">
                    No leads found.
                  </p>
                )}

                {visibleLeads.map((lead) => {
                  const granted = grants.some(
                    (g) =>
                      g.user_id === selectedBdm &&
                      g.lead_type === leadType &&
                      g.lead_id === lead.id
                  );

                  return (
                    <label
                      key={lead.id}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={granted}
                        disabled={busyId === lead.id}
                        onChange={() => void toggle(lead, granted)}
                        className="h-4 w-4 accent-indigo-600"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {lead.label}
                        </p>
                        {lead.sub && (
                          <p className="text-xs text-slate-400 truncate">
                            {lead.sub}
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${
                          granted ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      >
                        {granted ? 'Can write' : 'Read only'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default LeadAccessManager;