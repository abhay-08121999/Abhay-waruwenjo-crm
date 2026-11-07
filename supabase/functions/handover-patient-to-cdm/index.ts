import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PatientAccountPayload = {
  lead_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  medical_history?: string | null;
  allergies?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  treatment_interest?: string | null;
  urgency?: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizedEmail = (email: string) => email.trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase function environment is not configured' }, 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'Authentication is required' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Invalid CRM session' }, 401);

  const { data: canCreate, error: permissionError } = await adminClient.rpc('crm_has_permission', {
    _user_id: authData.user.id,
    _permission: 'leads.write',
  });
  if (permissionError || !canCreate) {
    return json({ error: 'You do not have permission to create patient accounts' }, 403);
  }

  let payload: PatientAccountPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400);
  }

  const email = normalizedEmail(payload.email || '');
  const fullName = String(payload.full_name || '').trim();
  if (!payload.lead_id || !fullName || !email || !email.includes('@')) {
    return json({ error: 'lead_id, full_name, and a valid email are required' }, 400);
  }

  const { data: lead, error: leadError } = await adminClient
    .from('patient_enquiries')
    .select('id, user_id, patient_profile_id, email, full_name')
    .eq('id', payload.lead_id)
    .maybeSingle();
  if (leadError || !lead) return json({ error: 'Patient enquiry was not found' }, 404);

  if (lead.email && normalizedEmail(lead.email) !== email) {
    return json({ error: 'The account email must match the patient enquiry email' }, 409);
  }

  let userId = lead.user_id as string | null;
  let accountStatus: 'invited' | 'linked_existing' = 'linked_existing';
  let invitationSentAt: string | null = null;

  if (!userId) {
    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) return json({ error: `Could not check existing accounts: ${usersError.message}` }, 500);

    const existingUser = usersData.users.find((user) => normalizedEmail(user.email || '') === email);
    if (existingUser) {
      userId = existingUser.id;
      accountStatus = 'linked_existing';
    } else {
      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          phone: payload.phone || null,
          source: 'crm_stage_8',
        },
      });
      if (inviteError || !invited.user) {
        return json({ error: `Patient account invitation failed: ${inviteError?.message || 'No user returned'}` }, 500);
      }
      userId = invited.user.id;
      accountStatus = 'invited';
      invitationSentAt = new Date().toISOString();
    }
  }

  const profileValues = {
    lead_id: payload.lead_id,
    user_id: userId,
    full_name: fullName,
    email,
    phone: payload.phone || null,
    country: payload.country || null,
    date_of_birth: payload.date_of_birth || null,
    gender: payload.gender || null,
    medical_history: payload.medical_history || null,
    allergies: payload.allergies || null,
    emergency_contact_name: payload.emergency_contact_name || null,
    emergency_contact_phone: payload.emergency_contact_phone || null,
    treatment_interest: payload.treatment_interest || null,
    urgency: payload.urgency || null,
    source: 'crm_stage_8',
    account_status: accountStatus,
    ...(invitationSentAt ? { invitation_sent_at: invitationSentAt } : {}),
  };

  const { data: profile, error: profileError } = await adminClient
    .from('patient_profiles')
    .upsert(profileValues, { onConflict: 'lead_id' })
    .select()
    .single();
  if (profileError || !profile) {
    return json({ error: `Patient profile could not be saved: ${profileError?.message || 'Unknown error'}` }, 500);
  }

  const { error: linkError } = await adminClient
    .from('patient_enquiries')
    .update({ user_id: userId, patient_profile_id: profile.id })
    .eq('id', payload.lead_id);
  if (linkError) return json({ error: `Patient lead could not be linked: ${linkError.message}` }, 500);

  // The main website normally creates this row through its auth trigger. This
  // best-effort update keeps the basic profile synchronized when that table is present.
  await adminClient.from('profiles').upsert({
    id: userId,
    full_name: fullName,
    email,
    phone: payload.phone || null,
    country: payload.country || null,
  }, { onConflict: 'id' });

  return json({
    profile,
    user_id: userId,
    account_status: accountStatus,
    invitation_sent_at: invitationSentAt,
  });
});
