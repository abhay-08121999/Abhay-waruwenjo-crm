import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const standardRoles = [
  'super_admin',
  'admin',
  'bdm',
  'in_house_doctor',
  'cdm',
  'waru_buddy',
];

const protectedSystemRoles = new Set([
  'super_admin',
  'admin',
  'bdm',
  'in_house_doctor',
  'cdm',
  'waru_buddy',
]);

const nonCrmRoles = new Set([
  'patient',
  'user',
  'users',
  'specialist_doctor',
]);

type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
};

const CRM_PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    key: 'dashboard.read',
    label: 'Dashboard',
    description: 'View the CRM dashboard.',
  },
  {
    key: 'hospitals.read',
    label: 'Hospitals - Read',
    description: 'View hospitals.',
  },
  {
    key: 'hospitals.write',
    label: 'Hospitals - Create/Edit',
    description: 'Create and modify hospitals.',
  },
  {
    key: 'doctors.read',
    label: 'Doctors - Read',
    description: 'View doctors.',
  },
  {
    key: 'doctors.write',
    label: 'Doctors - Create/Edit',
    description: 'Create and modify doctors.',
  },
  {
    key: 'patient_leads.read',
    label: 'Patient Leads - Read',
    description: 'View patient leads.',
  },
  {
    key: 'patient_leads.write',
    label: 'Patient Leads - Create/Edit',
    description: 'Create and modify patient leads.',
  },
  {
    key: 'automation.read',
    label: 'Automation - Read',
    description: 'View automation configuration and activity.',
  },
  {
    key: 'automation.write',
    label: 'Automation - Create/Edit',
    description: 'Create and modify automation.',
  },
  {
    key: 'bridge.read',
    label: 'Bridge - Read',
    description: 'View bridge records.',
  },
  {
    key: 'bridge.write',
    label: 'Bridge - Create/Edit',
    description: 'Create and modify bridge records.',
  },
  {
    key: 'consent.read',
    label: 'Consent - Read',
    description: 'View consent records.',
  },
  {
    key: 'consent.write',
    label: 'Consent - Create/Edit',
    description: 'Create and modify consent records.',
  },
  {
    key: 'travel_mgmt.read',
    label: 'Travel Management - Read',
    description: 'View travel management records.',
  },
  {
    key: 'travel_mgmt.write',
    label: 'Travel Management - Create/Edit',
    description: 'Create and modify travel management records.',
  },
  {
    key: 'agreements.read',
    label: 'Agreements - Read',
    description: 'View agreements.',
  },
  {
    key: 'agreements.write',
    label: 'Agreements - Create/Edit',
    description: 'Create and modify agreements.',
  },
  {
    key: 'quotations.read',
    label: 'Quotations - Read',
    description: 'View quotations.',
  },
  {
    key: 'quotations.write',
    label: 'Quotations - Create/Edit',
    description: 'Create and modify quotations.',
  },
  {
    key: 'finance.read',
    label: 'Finance - Read',
    description: 'View finance information.',
  },
  {
    key: 'finance.write',
    label: 'Finance - Create/Edit',
    description: 'Create and modify finance information.',
  },
  {
    key: 'disputes.read',
    label: 'Disputes - Read',
    description: 'View disputes.',
  },
  {
    key: 'disputes.write',
    label: 'Disputes - Create/Edit',
    description: 'Create and modify disputes.',
  },
  {
    key: 'communications.read',
    label: 'Communications - Read',
    description: 'View communications.',
  },
  {
    key: 'communications.write',
    label: 'Communications - Create/Edit',
    description: 'Create and modify communications.',
  },
  {
    key: 'whatsapp.read',
    label: 'WhatsApp - Read',
    description: 'View WhatsApp communication records.',
  },
  {
    key: 'whatsapp.write',
    label: 'WhatsApp - Create/Edit',
    description: 'Create and modify WhatsApp communication records.',
  },
  {
    key: 'vault.read',
    label: 'Vault - Read',
    description: 'View vault records.',
  },
  {
    key: 'vault.write',
    label: 'Vault - Create/Edit',
    description: 'Create and modify vault records.',
  },
  {
    key: 'logistics.read',
    label: 'Logistics - Read',
    description: 'View logistics information.',
  },
  {
    key: 'logistics.write',
    label: 'Logistics - Create/Edit',
    description: 'Create and modify logistics information.',
  },
  {
    key: 'leads.read',
    label: 'Leads - Read',
    description: 'View leads.',
  },
  {
    key: 'leads.write',
    label: 'Leads - Create/Edit',
    description: 'Create and modify leads.',
  },
  {
    key: 'pipeline.read',
    label: 'Pipeline - Read',
    description: 'View pipeline information.',
  },
  {
    key: 'pipeline.write',
    label: 'Pipeline - Create/Edit',
    description: 'Create and modify pipeline information.',
  },
  {
    key: 'patients.read',
    label: 'Patients - Read',
    description: 'View patients.',
  },
  {
    key: 'patients.write',
    label: 'Patients - Create/Edit',
    description: 'Create and modify patients.',
  },
  {
    key: 'cases.read',
    label: 'Cases - Read',
    description: 'View medical cases.',
  },
  {
    key: 'cases.write',
    label: 'Cases - Create/Edit',
    description: 'Create and modify medical cases.',
  },
  {
    key: 'orders.read',
    label: 'Orders - Read',
    description: 'View orders.',
  },
  {
    key: 'orders.write',
    label: 'Orders - Create/Edit',
    description: 'Create and modify orders.',
  },
  {
    key: 'inventory.read',
    label: 'Inventory - Read',
    description: 'View inventory.',
  },
  {
    key: 'inventory.write',
    label: 'Inventory - Create/Edit',
    description: 'Create and modify inventory.',
  },
  {
    key: 'insights.read',
    label: 'Insights - Read',
    description: 'View business insights.',
  },
  {
    key: 'reports.read',
    label: 'Reports - Read',
    description: 'View reports.',
  },
  {
    key: 'settings.read',
    label: 'Settings - Read',
    description: 'View CRM settings.',
  },
  {
    key: 'settings.write',
    label: 'Settings - Create/Edit',
    description: 'Modify CRM settings.',
  },
  {
    key: 'users.manage',
    label: 'Users & Roles Management',
    description: 'Create, edit and manage CRM users and roles.',
  },
];

const VALID_PERMISSION_KEYS = new Set(
  CRM_PERMISSION_CATALOG.map((permission) => permission.key),
);

const LEGACY_PERMISSION_KEYS = new Set([
  'crm.read',
  'crm.write',
  'clinical.read',
  'clinical.write',
  'documents.read',
  'documents.write',
  'analytics.read',
  'settings.read',
  'settings.write',
  'travel.read',
  'travel.write',
  'leads.read',
  'leads.write',
  'communications.read',
  'communications.write',
  'cases.read',
  'cases.write',
  'finance.read',
  'finance.write',
  'users.manage',
]);

const ALL_VALID_PERMISSION_KEYS = new Set([
  ...VALID_PERMISSION_KEYS,
  ...LEGACY_PERMISSION_KEYS,
]);

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
};

const slugify = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
};

const normalizePermissions = (
  input: unknown,
): Record<string, boolean> => {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const result: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(
    input as Record<string, unknown>,
  )) {
    if (
      ALL_VALID_PERMISSION_KEYS.has(key) &&
      value === true
    ) {
      result[key] = true;
    }
  }

  return result;
};

const findInvalidPermissions = (
  input: unknown,
): string[] => {
  if (!input || typeof input !== 'object') {
    return [];
  }

  return Object.keys(
    input as Record<string, unknown>,
  ).filter(
    (key) => !ALL_VALID_PERMISSION_KEYS.has(key),
  );
};

const getPermissionCatalog = () =>
  CRM_PERMISSION_CATALOG.map((permission) => ({
    ...permission,
  }));

const requireSuperAdmin = async (
  serviceClient: ReturnType<typeof createClient>,
  callerUserId: string,
) => {
  const { data, error } = await serviceClient
    .from('crm_user_role_assignments')
    .select(
      `
        role_id,
        crm_roles!inner (
          role_key,
          is_system
        )
      `,
    )
    .eq('user_id', callerUserId);

  if (error) {
    throw new Error(
      `Unable to verify CRM role: ${error.message}`,
    );
  }

  const isSuperAdmin = (data || []).some(
    (assignment: any) =>
      assignment.crm_roles?.role_key ===
      'super_admin',
  );

  if (!isSuperAdmin) {
    return false;
  }

  return true;
};

const validateCustomRolePermissions = (
  permissions: Record<string, boolean>,
) => {
  if (permissions['users.manage']) {
    throw new Error(
      'The users.manage permission is reserved for Super Admin and cannot be assigned to a custom role.',
    );
  }
};

const isReservedRoleKey = (
  roleKey: string,
) => {
  return (
    protectedSystemRoles.has(roleKey) ||
    nonCrmRoles.has(roleKey) ||
    roleKey === 'unassigned'
  );
};

const createRole = async (
  serviceClient: ReturnType<typeof createClient>,
  callerUserId: string,
  payload: Record<string, unknown>,
) => {
  const name =
    typeof payload.name === 'string'
      ? payload.name.trim()
      : '';

  const description =
    typeof payload.description === 'string'
      ? payload.description.trim()
      : '';

  if (!name) {
    return jsonResponse(
      {
        error: 'Role name is required.',
      },
      422,
    );
  }

  if (name.length > 100) {
    return jsonResponse(
      {
        error:
          'Role name must be 100 characters or less.',
      },
      422,
    );
  }

  const roleKey = slugify(name);

  if (!roleKey) {
    return jsonResponse(
      {
        error:
          'Role name must contain at least one valid character.',
      },
      422,
    );
  }

  if (isReservedRoleKey(roleKey)) {
    return jsonResponse(
      {
        error:
          'This role name is reserved and cannot be used for a custom CRM role.',
      },
      409,
    );
  }

  const invalidPermissions =
    findInvalidPermissions(
      payload.permissions,
    );

  if (invalidPermissions.length) {
    return jsonResponse(
      {
        error: 'Invalid permission key(s).',
        invalid_permissions:
          invalidPermissions,
        permission_catalog:
          getPermissionCatalog(),
      },
      422,
    );
  }

  const permissions =
    normalizePermissions(
      payload.permissions,
    );

  try {
    validateCustomRolePermissions(
      permissions,
    );
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Invalid permissions.',
      },
      403,
    );
  }

  const { data: existingRole, error: lookupError } =
    await serviceClient
      .from('crm_roles')
      .select('id, role_key, name')
      .eq('role_key', roleKey)
      .maybeSingle();

  if (lookupError) {
    return jsonResponse(
      {
        error:
          `Unable to check existing roles: ${lookupError.message}`,
      },
      500,
    );
  }

  if (existingRole) {
    return jsonResponse(
      {
        error:
          `A role with the key "${roleKey}" already exists.`,
      },
      409,
    );
  }

  const { data: role, error } =
    await serviceClient
      .from('crm_roles')
      .insert({
        role_key: roleKey,
        name,
        description: description || null,
        permissions,
        is_system: false,
        created_by: callerUserId,
      })
      .select(
        'id, role_key, name, description, permissions, is_system',
      )
      .single();

  if (error) {
    return jsonResponse(
      {
        error:
          `Unable to create role: ${error.message}`,
      },
      500,
    );
  }

  return jsonResponse({
    success: true,
    role,
    permission_catalog:
      getPermissionCatalog(),
  });
};

const updateRole = async (
  serviceClient: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) => {
  const roleId =
    typeof payload.role_id === 'string'
      ? payload.role_id.trim()
      : '';

  if (!roleId) {
    return jsonResponse(
      {
        error: 'role_id is required.',
      },
      422,
    );
  }

  const { data: existingRole, error: lookupError } =
    await serviceClient
      .from('crm_roles')
      .select(
        'id, role_key, name, description, permissions, is_system',
      )
      .eq('id', roleId)
      .maybeSingle();

  if (lookupError) {
    return jsonResponse(
      {
        error:
          `Unable to load role: ${lookupError.message}`,
      },
      500,
    );
  }

  if (!existingRole) {
    return jsonResponse(
      {
        error: 'Role not found.',
      },
      404,
    );
  }

  if (existingRole.is_system) {
    return jsonResponse(
      {
        error:
          'System roles cannot be modified.',
      },
      403,
    );
  }

  const name =
    typeof payload.name === 'string'
      ? payload.name.trim()
      : existingRole.name;

  const description =
    typeof payload.description === 'string'
      ? payload.description.trim()
      : existingRole.description || '';

  if (!name) {
    return jsonResponse(
      {
        error: 'Role name is required.',
      },
      422,
    );
  }

  if (name.length > 100) {
    return jsonResponse(
      {
        error:
          'Role name must be 100 characters or less.',
      },
      422,
    );
  }

  const requestedRoleKey = slugify(name);

  if (!requestedRoleKey) {
    return jsonResponse(
      {
        error:
          'Role name must contain at least one valid character.',
      },
      422,
    );
  }

  if (isReservedRoleKey(requestedRoleKey)) {
    return jsonResponse(
      {
        error:
          'This role name is reserved and cannot be used for a custom CRM role.',
      },
      409,
    );
  }

  const invalidPermissions =
    findInvalidPermissions(
      payload.permissions,
    );

  if (invalidPermissions.length) {
    return jsonResponse(
      {
        error: 'Invalid permission key(s).',
        invalid_permissions:
          invalidPermissions,
        permission_catalog:
          getPermissionCatalog(),
      },
      422,
    );
  }

  const permissions =
    payload.permissions === undefined
      ? normalizePermissions(
          existingRole.permissions,
        )
      : normalizePermissions(
          payload.permissions,
        );

  try {
    validateCustomRolePermissions(
      permissions,
    );
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Invalid permissions.',
      },
      403,
    );
  }

  if (
    requestedRoleKey !==
    existingRole.role_key
  ) {
    const { data: duplicateRole, error } =
      await serviceClient
        .from('crm_roles')
        .select('id')
        .eq('role_key', requestedRoleKey)
        .neq('id', roleId)
        .maybeSingle();

    if (error) {
      return jsonResponse(
        {
          error:
            `Unable to check role key: ${error.message}`,
        },
        500,
      );
    }

    if (duplicateRole) {
      return jsonResponse(
        {
          error:
            `A role with the key "${requestedRoleKey}" already exists.`,
        },
        409,
      );
    }
  }

  const { data: role, error } =
    await serviceClient
      .from('crm_roles')
      .update({
        role_key: requestedRoleKey,
        name,
        description:
          description || null,
        permissions,
      })
      .eq('id', roleId)
      .select(
        'id, role_key, name, description, permissions, is_system',
      )
      .single();

  if (error) {
    return jsonResponse(
      {
        error:
          `Unable to update role: ${error.message}`,
      },
      500,
    );
  }

  return jsonResponse({
    success: true,
    role,
    permission_catalog:
      getPermissionCatalog(),
  });
};

const deleteRole = async (
  serviceClient: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) => {
  const roleId =
    typeof payload.role_id === 'string'
      ? payload.role_id.trim()
      : '';

  if (!roleId) {
    return jsonResponse(
      {
        error: 'role_id is required.',
      },
      422,
    );
  }

  const { data: role, error: roleError } =
    await serviceClient
      .from('crm_roles')
      .select(
        'id, role_key, name, is_system',
      )
      .eq('id', roleId)
      .maybeSingle();

  if (roleError) {
    return jsonResponse(
      {
        error:
          `Unable to load role: ${roleError.message}`,
      },
      500,
    );
  }

  if (!role) {
    return jsonResponse(
      {
        error: 'Role not found.',
      },
      404,
    );
  }

  if (role.is_system) {
    return jsonResponse(
      {
        error:
          'System roles cannot be deleted.',
      },
      403,
    );
  }

  const {
    count: assignedUserCount,
    error: assignmentError,
  } = await serviceClient
    .from('crm_user_role_assignments')
    .select('user_id', {
      count: 'exact',
      head: true,
    })
    .eq('role_id', roleId);

  if (assignmentError) {
    return jsonResponse(
      {
        error:
          `Unable to check role assignments: ${assignmentError.message}`,
      },
      500,
    );
  }

  const count =
    assignedUserCount || 0;

  if (count > 0) {
    return jsonResponse(
      {
        error:
          `This role cannot be deleted because ${count} user${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} still assigned to it. Reassign ${count === 1 ? 'the user' : 'those users'} to another role first.`,
        assigned_user_count: count,
        role,
      },
      409,
    );
  }

  const { error: deleteError } =
    await serviceClient
      .from('crm_roles')
      .delete()
      .eq('id', roleId);

  if (deleteError) {
    return jsonResponse(
      {
        error:
          `Unable to delete role: ${deleteError.message}`,
      },
      500,
    );
  }

  return jsonResponse({
    success: true,
    deleted_role: role,
  });
};

const createUser = async (
  serviceClient: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) => {
  const username =
    typeof payload.username === 'string'
      ? payload.username.trim()
      : '';

  const fullName =
    typeof payload.full_name === 'string'
      ? payload.full_name.trim()
      : '';

  const email =
    typeof payload.email === 'string'
      ? payload.email.trim().toLowerCase()
      : '';

  const password =
    typeof payload.password === 'string'
      ? payload.password
      : '';

  const roleId =
    typeof payload.role_id === 'string'
      ? payload.role_id.trim()
      : '';

  if (
    !username ||
    !fullName ||
    !email ||
    !password ||
    !roleId
  ) {
    return jsonResponse(
      {
        error:
          'Username, full name, email, password and role are required.',
      },
      422,
    );
  }

  if (password.length < 8) {
    return jsonResponse(
      {
        error:
          'Password must be at least 8 characters.',
      },
      422,
    );
  }

  const { data: role, error: roleError } =
    await serviceClient
      .from('crm_roles')
      .select(
        'id, role_key, name, is_system',
      )
      .eq('id', roleId)
      .maybeSingle();

  if (roleError) {
    return jsonResponse(
      {
        error:
          `Unable to load selected role: ${roleError.message}`,
      },
      500,
    );
  }

  if (!role) {
    return jsonResponse(
      {
        error: 'Selected CRM role was not found.',
      },
      404,
    );
  }

  if (
    nonCrmRoles.has(role.role_key) ||
    role.role_key ===
      'specialist_doctor'
  ) {
    return jsonResponse(
      {
        error:
          'This role cannot be assigned to a CRM user.',
      },
      403,
    );
  }

  const { data: duplicateUsername } =
    await serviceClient
      .from('crm_user_profiles')
      .select('user_id')
      .eq('username', username)
      .maybeSingle();

  if (duplicateUsername) {
    return jsonResponse(
      {
        error:
          'That username is already in use.',
      },
      409,
    );
  }

  const {
    data: authUser,
    error: authError,
  } =
    await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
      },
    });

  if (authError || !authUser.user) {
    return jsonResponse(
      {
        error:
          authError?.message ||
          'Unable to create Auth user.',
      },
      400,
    );
  }

  const userId = authUser.user.id;

  const { error: profileError } =
    await serviceClient
      .from('crm_user_profiles')
      .upsert(
        {
          user_id: userId,
          email,
          username,
          full_name: fullName,
          is_active: true,
          job_title: role.name,
        },
        {
          onConflict: 'user_id',
        },
      );

  if (profileError) {
    await serviceClient.auth.admin.deleteUser(
      userId,
    );

    return jsonResponse(
      {
        error:
          `Unable to create CRM profile: ${profileError.message}`,
      },
      500,
    );
  }

  const { error: assignmentError } =
    await serviceClient
      .from('crm_user_role_assignments')
      .insert({
        user_id: userId,
        role_id: role.id,
      });

  if (assignmentError) {
    await serviceClient
      .from('crm_user_profiles')
      .delete()
      .eq('user_id', userId);

    await serviceClient.auth.admin.deleteUser(
      userId,
    );

    return jsonResponse(
      {
        error:
          `Unable to assign CRM role: ${assignmentError.message}`,
      },
      500,
    );
  }

  if (
    standardRoles.includes(
      role.role_key,
    )
  ) {
    await serviceClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    const { error: legacyError } =
      await serviceClient
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role.role_key,
        });

    if (legacyError) {
      await serviceClient
        .from(
          'crm_user_role_assignments',
        )
        .delete()
        .eq('user_id', userId)
        .eq('role_id', role.id);

      await serviceClient
        .from('crm_user_profiles')
        .delete()
        .eq('user_id', userId);

      await serviceClient.auth.admin.deleteUser(
        userId,
      );

      return jsonResponse(
        {
          error:
            `Unable to synchronize CRM role: ${legacyError.message}`,
        },
        500,
      );
    }
  }

  return jsonResponse({
    success: true,
    user_id: userId,
    role,
  });
};

const assignRole = async (
  serviceClient: ReturnType<typeof createClient>,
  callerUserId: string,
  payload: Record<string, unknown>,
) => {
  const userId =
    typeof payload.user_id === 'string'
      ? payload.user_id.trim()
      : '';

  const roleId =
    typeof payload.role_id === 'string'
      ? payload.role_id.trim()
      : '';

  if (!userId || !roleId) {
    return jsonResponse(
      {
        error:
          'user_id and role_id are required.',
      },
      422,
    );
  }

  if (userId === callerUserId) {
    const { data: currentRole } =
      await serviceClient
        .from(
          'crm_user_role_assignments',
        )
        .select(
          `
            crm_roles!inner (
              role_key
            )
          `,
        )
        .eq('user_id', userId);

    const currentIsSuperAdmin =
      (currentRole || []).some(
        (item: any) =>
          item.crm_roles?.role_key ===
          'super_admin',
      );

    if (currentIsSuperAdmin) {
      return jsonResponse(
        {
          error:
            'Super Admin cannot change their own role.',
        },
        403,
      );
    }
  }

  const { data: role, error: roleError } =
    await serviceClient
      .from('crm_roles')
      .select(
        'id, role_key, name, is_system',
      )
      .eq('id', roleId)
      .maybeSingle();

  if (roleError) {
    return jsonResponse(
      {
        error:
          `Unable to load role: ${roleError.message}`,
      },
      500,
    );
  }

  if (!role) {
    return jsonResponse(
      {
        error: 'Role not found.',
      },
      404,
    );
  }

  if (nonCrmRoles.has(role.role_key)) {
    return jsonResponse(
      {
        error:
          'This role is not a CRM role.',
      },
      403,
    );
  }

  if (
    role.role_key ===
    'specialist_doctor'
  ) {
    return jsonResponse(
      {
        error:
          'Specialist Doctor is not a supported CRM role.',
      },
      403,
    );
  }

  const { error: deleteError } =
    await serviceClient
      .from(
        'crm_user_role_assignments',
      )
      .delete()
      .eq('user_id', userId);

  if (deleteError) {
    return jsonResponse(
      {
        error:
          `Unable to remove previous role: ${deleteError.message}`,
      },
      500,
    );
  }

  const { error: insertError } =
    await serviceClient
      .from(
        'crm_user_role_assignments',
      )
      .insert({
        user_id: userId,
        role_id: role.id,
      });

  if (insertError) {
    return jsonResponse(
      {
        error:
          `Unable to assign role: ${insertError.message}`,
      },
      500,
    );
  }

  await serviceClient
    .from('user_roles')
    .delete()
    .eq('user_id', userId);

  if (
    standardRoles.includes(
      role.role_key,
    )
  ) {
    const { error: legacyError } =
      await serviceClient
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role.role_key,
        });

    if (legacyError) {
      return jsonResponse(
        {
          error:
            `Unable to synchronize legacy role: ${legacyError.message}`,
        },
        500,
      );
    }
  }

  await serviceClient
    .from('crm_user_profiles')
    .update({
      job_title: role.name,
    })
    .eq('user_id', userId);

  return jsonResponse({
    success: true,
    user_id: userId,
    role,
  });
};

const setActive = async (
  serviceClient: ReturnType<typeof createClient>,
  callerUserId: string,
  payload: Record<string, unknown>,
) => {
  const userId =
    typeof payload.user_id === 'string'
      ? payload.user_id.trim()
      : '';

  const isActive =
    typeof payload.is_active ===
    'boolean'
      ? payload.is_active
      : null;

  if (
    !userId ||
    isActive === null
  ) {
    return jsonResponse(
      {
        error:
          'user_id and is_active are required.',
      },
      422,
    );
  }

  if (
    userId === callerUserId &&
    !isActive
  ) {
    return jsonResponse(
      {
        error:
          'Super Admin cannot deactivate their own account.',
      },
      403,
    );
  }

  const { error: authError } =
    isActive
      ? await serviceClient.auth.admin.updateUserById(
          userId,
          {
            ban_duration: 'none',
          },
        )
      : await serviceClient.auth.admin.updateUserById(
          userId,
          {
            ban_duration: '876000h',
          },
        );

  if (authError) {
    return jsonResponse(
      {
        error:
          `Unable to update Auth account: ${authError.message}`,
      },
      500,
    );
  }

  const { error: profileError } =
    await serviceClient
      .from('crm_user_profiles')
      .update({
        is_active: isActive,
      })
      .eq('user_id', userId);

  if (profileError) {
    return jsonResponse(
      {
        error:
          `Unable to update CRM profile: ${profileError.message}`,
      },
      500,
    );
  }

  return jsonResponse({
    success: true,
    user_id: userId,
    is_active: isActive,
  });
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(
      'ok',
      {
        headers: corsHeaders,
      },
    );
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      {
        error:
          'Method not allowed.',
      },
      405,
    );
  }

  try {
    const supabaseUrl =
      Deno.env.get(
        'SUPABASE_URL',
      );

    const serviceRoleKey =
      Deno.env.get(
        'SUPABASE_SERVICE_ROLE_KEY',
      );

    const anonKey =
      Deno.env.get(
        'SUPABASE_ANON_KEY',
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !anonKey
    ) {
      return jsonResponse(
        {
          error:
            'Supabase environment variables are not configured.',
        },
        500,
      );
    }

    const authorization =
      request.headers.get(
        'Authorization',
      );

    if (!authorization) {
      return jsonResponse(
        {
          error:
            'Missing Authorization header.',
        },
        401,
      );
    }

    const token =
      authorization.replace(
        /^Bearer\s+/i,
        '',
      );

    const authClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },
        },
      );

    const {
      data: {
        user: caller,
      },
      error: authError,
    } =
      await authClient.auth.getUser(
        token,
      );

    if (
      authError ||
      !caller
    ) {
      return jsonResponse(
        {
          error:
            'Invalid or expired authentication session.',
        },
        401,
      );
    }

    const serviceClient =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,
            persistSession: false,
          },
        },
      );

    const isSuperAdmin =
      await requireSuperAdmin(
        serviceClient,
        caller.id,
      );

    if (!isSuperAdmin) {
      return jsonResponse(
        {
          error:
            'Only Super Admin can manage CRM users and roles.',
        },
        403,
      );
    }

    let payload: Record<
      string,
      unknown
    > = {};

    try {
      payload =
        await request.json();
    } catch {
      return jsonResponse(
        {
          error:
            'Invalid JSON request body.',
        },
        400,
      );
    }

    const action =
      typeof payload.action ===
      'string'
        ? payload.action
        : '';

    switch (action) {
      case 'create_role':
        return await createRole(
          serviceClient,
          caller.id,
          payload,
        );

      case 'update_role':
        return await updateRole(
          serviceClient,
          payload,
        );

      case 'delete_role':
        return await deleteRole(
          serviceClient,
          payload,
        );

      case 'create_user':
        return await createUser(
          serviceClient,
          payload,
        );

      case 'assign_role':
        return await assignRole(
          serviceClient,
          caller.id,
          payload,
        );

      case 'set_active':
        return await setActive(
          serviceClient,
          caller.id,
          payload,
        );

      case 'permission_catalog':
        return jsonResponse({
          success: true,
          permission_catalog:
            getPermissionCatalog(),
        });

      default:
        return jsonResponse(
          {
            error:
              'Unknown action.',
            supported_actions: [
              'create_role',
              'update_role',
              'delete_role',
              'create_user',
              'assign_role',
              'set_active',
              'permission_catalog',
            ],
          },
          400,
        );
    }
  } catch (error) {
    console.error(
      'create-crm-user error:',
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error.',
      },
      500,
    );
  }
});