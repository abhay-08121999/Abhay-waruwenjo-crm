import { supabase } from '../integrations/supabase/client';

export const CRM_ROLES = [
  'super_admin',
  'admin',
  'bdm',
  'in_house_doctor',
  'specialist_doctor',
  'cdm',
  'waru_buddy',
  'unassigned',
] as const;

export type CrmRole = typeof CRM_ROLES[number];

export const CRM_ROLE_LABELS: Record<CrmRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  bdm: 'BDM',
  in_house_doctor: 'In-house Doctor',
  specialist_doctor: 'Specialist Doctor',
  cdm: 'CDM',
  waru_buddy: 'WaruBuddy',
  unassigned: 'Unassigned',
};

export type CrmUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  roles: CrmRole[];
  created_at: string;
};

export const fetchCrmUsers = async () => {
  const [{ data: profiles, error: profileError }, { data: assignments, error: roleError }] = await Promise.all([
    supabase.from('crm_user_profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('user_roles').select('user_id, role'),
  ]);
  if (profileError || roleError) return { data: null, error: profileError || roleError };
  const roleMap = new Map<string, CrmRole[]>();
  (assignments || []).forEach((assignment: { user_id: string; role: CrmRole }) => {
    roleMap.set(assignment.user_id, [...(roleMap.get(assignment.user_id) || []), assignment.role]);
  });
  return {
    data: (profiles || []).map((profile: any): CrmUser => ({
      user_id: profile.user_id,
      email: profile.email,
      full_name: profile.full_name,
      phone: profile.phone,
      job_title: profile.job_title,
      is_active: profile.is_active,
      roles: roleMap.get(profile.user_id) || ['unassigned'],
      created_at: profile.created_at,
    })),
    error: null,
  };
};

export const assignCrmRole = async (userId: string, role: CrmRole) => {
  const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);
  if (deleteError) return { error: deleteError };
  return supabase.from('user_roles').insert({ user_id: userId, role });
};

export const updateCrmUserProfile = async (userId: string, values: { full_name?: string; phone?: string; job_title?: string; is_active?: boolean }) => {
  return supabase.from('crm_user_profiles').update(values).eq('user_id', userId);
};

export const getMyCrmRoles = async (userId: string) => {
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  return { roles: (data || []).map((row: { role: CrmRole }) => row.role), error };
};
