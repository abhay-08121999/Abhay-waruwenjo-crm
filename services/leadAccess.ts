import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';

export type LeadType = 'patient' | 'medical';

export type LeadGrant = {
  id: string;
  lead_type: LeadType;
  lead_id: string;
  user_id: string;
};

const db = supabase as any;

export const leadGrantKey = (type: LeadType, leadId: string | number) =>
  `${type}:${String(leadId)}`;

/* A BDM is restricted to granted leads. Admins and super admins are not. */
export const isLeadRestrictedUser = (roles: Array<{ key?: string }>) => {
  const keys = roles.map((role) => String(role.key || ''));
  return (
    keys.includes('bdm') &&
    !keys.some((key) => key === 'super_admin' || key === 'admin')
  );
};

export const fetchMyLeadGrantKeys = async (): Promise<Set<string>> => {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await db
    .from('crm_lead_access')
    .select('lead_type, lead_id')
    .eq('user_id', auth.user?.id ?? '');

  if (error) throw error;

  return new Set(
    (data || []).map((row: any) => leadGrantKey(row.lead_type, row.lead_id))
  );
};

/* Hook used by the lead screens. */
export const useLeadGrants = (roles: Array<{ key?: string }>) => {
  const restricted = isLeadRestrictedUser(roles);
  const [keys, setKeys] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    if (!restricted) return;
    fetchMyLeadGrantKeys()
      .then(setKeys)
      .catch((error) => console.error('Failed to load lead grants', error));
  }, [restricted]);

  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  return {
    restricted,
    isGranted: (type: LeadType, leadId: string | number) =>
      keys.has(leadGrantKey(type, leadId)),
  };
};

/* Admin side: every grant, for the access manager. */
export const fetchAllLeadGrants = async (): Promise<LeadGrant[]> => {
  const { data, error } = await db.from('crm_lead_access').select('*');
  if (error) throw error;
  return (data || []) as LeadGrant[];
};

export const grantLeadAccess = async (
  type: LeadType,
  leadId: string | number,
  userId: string
) => {
  const { data: auth } = await supabase.auth.getUser();

  const { error } = await db.from('crm_lead_access').upsert(
    {
      lead_type: type,
      lead_id: String(leadId),
      user_id: userId,
      granted_by: auth.user?.id ?? null,
    },
    { onConflict: 'lead_type,lead_id,user_id' }
  );

  if (error) throw error;
};

export const revokeLeadAccess = async (
  type: LeadType,
  leadId: string | number,
  userId: string
) => {
  const { error } = await db
    .from('crm_lead_access')
    .delete()
    .eq('lead_type', type)
    .eq('lead_id', String(leadId))
    .eq('user_id', userId);

  if (error) throw error;
};