import { supabase } from '../integrations/supabase/client';

/* ============================================================
   TYPES
============================================================ */

export type CrmRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  is_system: boolean;
};

export type CrmUser = {
  user_id: string;
  username: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  roles: CrmRole[];
  created_at: string;
};

/* ============================================================
   DEFAULT CRM PERMISSIONS
============================================================ */

export const DEFAULT_ROLE_PERMISSIONS = [
  {
    key: 'crm.read',
    label: 'View CRM',
    description: 'Read CRM records and dashboard data',
  },
  {
    key: 'crm.write',
    label: 'Manage CRM',
    description: 'Create and update general CRM records',
  },
  {
    key: 'leads.read',
    label: 'View Leads',
    description: 'View patient leads and pipelines',
  },
  {
    key: 'leads.write',
    label: 'Manage Leads',
    description: 'Create/update leads and lead stages',
  },
  {
    key: 'clinical.read',
    label: 'View Clinical',
    description: 'View clinical and doctor workflows',
  },
  {
    key: 'clinical.write',
    label: 'Manage Clinical',
    description: 'Update clinical workflows',
  },
  {
    key: 'documents.read',
    label: 'View Documents',
    description: 'View patient documents and vault',
  },
  {
    key: 'documents.write',
    label: 'Manage Documents',
    description: 'Upload and manage patient documents',
  },
  {
    key: 'communications.read',
    label: 'View Communications',
    description: 'View CRM communications',
  },
  {
    key: 'communications.write',
    label: 'Manage Communications',
    description: 'Send/manage communications',
  },
  {
    key: 'cases.read',
    label: 'View Cases',
    description: 'View medical cases and patient journeys',
  },
  {
    key: 'cases.write',
    label: 'Manage Cases',
    description: 'Update cases and handovers',
  },
  {
    key: 'finance.read',
    label: 'View Finance',
    description: 'View quotations and finance',
  },
  {
    key: 'finance.write',
    label: 'Manage Finance',
    description: 'Manage quotations and finance',
  },
  {
    key: 'travel.read',
    label: 'View Travel & Logistics',
    description: 'View travel and logistics modules',
  },
  {
    key: 'travel.write',
    label: 'Manage Travel & Logistics',
    description: 'Manage travel and logistics',
  },
  {
    key: 'analytics.read',
    label: 'View Analytics',
    description: 'View reports and analytics',
  },
  {
    key: 'settings.read',
    label: 'View Settings',
    description: 'View CRM settings',
  },
  {
    key: 'users.manage',
    label: 'Manage Users & Roles',
    description: 'Create and manage CRM accounts',
  },
] as const;

export type CrmPermission =
  (typeof DEFAULT_ROLE_PERMISSIONS)[number]['key'];

/* ============================================================
   ROLE → PERMISSION MAP
============================================================ */

export const CRM_ROLE_ROUTE_ACCESS: Record<
  string,
  CrmPermission[]
> = {
  super_admin: [
    'crm.read',
    'crm.write',
    'users.manage',
  ],

  admin: [
    'crm.read',
    'crm.write',
    'leads.read',
    'leads.write',
    'clinical.read',
    'clinical.write',
    'documents.read',
    'documents.write',
    'communications.read',
    'communications.write',
    'cases.read',
    'cases.write',
    'finance.read',
    'finance.write',
    'travel.read',
    'travel.write',
    'analytics.read',
    'settings.read',
  ],

  bdm: [
    'crm.read',
    'leads.read',
    'leads.write',
    'communications.read',
    'communications.write',
    'finance.read',
    'finance.write',
    'travel.read',
    'travel.write',
    'analytics.read',
  ],

  in_house_doctor: [
    'crm.read',
    'leads.read',
    'clinical.read',
    'clinical.write',
    'documents.read',
    'documents.write',
    'cases.read',
  ],

  specialist_doctor: [
    'crm.read',
    'leads.read',
    'clinical.read',
    'clinical.write',
    'documents.read',
    'cases.read',
  ],

  cdm: [
    'crm.read',
    'leads.read',
    'clinical.read',
    'documents.read',
    'cases.read',
    'cases.write',
    'communications.read',
    'communications.write',
    'travel.read',
    'travel.write',
    'analytics.read',
  ],

  waru_buddy: [
    'crm.read',
    'leads.read',
    'documents.read',
    'cases.read',
    'cases.write',
    'communications.read',
    'communications.write',
    'travel.read',
    'travel.write',
  ],
};

/* ============================================================
   ROUTE → REQUIRED PERMISSION
============================================================ */

export const ROUTE_PERMISSION: Record<
  string,
  CrmPermission
> = {
  '#/': 'crm.read',

  '#/hospitals': 'clinical.read',
  '#/doctors': 'clinical.read',

  '#/patient-leads': 'leads.read',
  '#/automation': 'leads.write',
  '#/leads': 'leads.read',
  '#/pipeline': 'leads.read',

  '#/bridge': 'clinical.read',

  '#/consent': 'documents.read',
  '#/vault': 'documents.read',

  '#/travel-mgmt': 'travel.read',
  '#/logistics': 'travel.read',

  '#/agreements': 'finance.read',
  '#/quotations': 'finance.read',
  '#/finance': 'finance.read',

  '#/disputes': 'crm.write',

  '#/communications': 'communications.read',
  '#/whatsapp': 'communications.read',

  '#/patients': 'cases.read',

  '#/orders': 'crm.write',
  '#/inventory': 'crm.write',

  '#/insights': 'analytics.read',
  '#/reports': 'analytics.read',

  '#/settings': 'settings.read',
};

/* ============================================================
   INTERNAL EDGE FUNCTION HELPER
============================================================ */

const invokeRoleFunction = async (
  body: Record<string, unknown>,
) => {
  try {
    const {
      data,
      error,
    } = await supabase.functions.invoke(
      'create-crm-user',
      {
        body,
      },
    );

    if (error) {
      console.error(
        'CRM Edge Function error:',
        error,
      );

      return {
        data: null,
        error,
      };
    }

    if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      data.error
    ) {
      const functionError =
        new Error(
          String(data.error),
        );

      console.error(
        'CRM Edge Function returned error:',
        functionError,
      );

      return {
        data: null,
        error: functionError,
      };
    }

    return {
      data,
      error: null,
    };
  } catch (error) {
    console.error(
      'CRM Edge Function invocation failed:',
      error,
    );

    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error(
              'Unable to communicate with the CRM server.',
            ),
    };
  }
};

/* ============================================================
   GET CURRENT USER CRM ACCESS
============================================================ */

/**
 * Gets the CRM profile, assigned roles and permissions
 * for the currently authenticated CRM user.
 *
 * IMPORTANT:
 *
 * Do NOT call:
 *   supabase.auth.refreshSession()
 *
 * from this function.
 *
 * AdminLogin already receives a valid session from
 * signInWithPassword(). The Supabase client automatically
 * attaches the authenticated session to these database
 * requests.
 */
// Matches a stored role to its code definition by key or name, ignoring case, underscores and spaces
// (so "waru_buddy", "warubuddy" and "WaruBuddy" all match).
const normalizeRoleName = (value: string) =>
  String(value || '').toLowerCase().replace(/[^a-z]/g, '');

const codeDefaultPermissionsFor = (role: CrmRole): CrmPermission[] => {
  const keyTarget = normalizeRoleName(role.key);
  const nameTarget = normalizeRoleName(role.name);
  const match = Object.keys(CRM_ROLE_ROUTE_ACCESS).find((definedKey) => {
    const normalized = normalizeRoleName(definedKey);
    return normalized === keyTarget || normalized === nameTarget;
  });
  return match ? CRM_ROLE_ROUTE_ACCESS[match] : [];
};

export const getMyCrmAccess = async (
  userId: string,
) => {
  const emptyResult = {
    roles: [] as CrmRole[],
    primaryRole: null as CrmRole | null,
    permissions: {} as Record<string, boolean>,
    isActive: false,
    error: null as Error | null,
  };

  if (!userId) {
    return {
      ...emptyResult,
      error: new Error(
        'A valid user ID is required to check CRM access.',
      ),
    };
  }

  try {
    /*
     * Read both tables at the same time.
     *
     * crm_user_profiles:
     *   confirms the CRM account exists and is active.
     *
     * crm_user_role_assignments:
     *   gets all roles assigned to the user.
     *
     * crm_roles:
     *   provides the actual role definition and permissions.
     */
    const [
      profileResult,
      assignmentResult,
    ] = await Promise.all([
      supabase
        .from('crm_user_profiles')
        .select(
          'user_id, email, username, full_name, is_active',
        )
        .eq('user_id', userId)
        .maybeSingle(),

      supabase
        .from('crm_user_role_assignments')
        .select(
          `
            user_id,
            role:crm_roles(
              id,
              role_key,
              name,
              description,
              permissions,
              is_system
            )
          `,
        )
        .eq('user_id', userId),
    ]);

    const {
      data: profile,
      error: profileError,
    } = profileResult;

    const {
      data: assignments,
      error: assignmentError,
    } = assignmentResult;

    /* -----------------------------------------------
       PROFILE ERROR
    ----------------------------------------------- */

    if (profileError) {
      console.error(
        'CRM profile lookup failed:',
        profileError,
      );

      return {
        ...emptyResult,
        error: new Error(
          `Unable to read CRM profile: ${profileError.message}`,
        ),
      };
    }

    /* -----------------------------------------------
       ROLE ERROR
    ----------------------------------------------- */

    if (assignmentError) {
      console.error(
        'CRM role assignment lookup failed:',
        assignmentError,
      );

      return {
        ...emptyResult,
        error: new Error(
          `Unable to read CRM roles: ${assignmentError.message}`,
        ),
      };
    }

    /* -----------------------------------------------
       PROFILE NOT FOUND
    ----------------------------------------------- */

    if (!profile) {
      console.error(
        'No CRM profile found for user:',
        userId,
      );

      return {
        ...emptyResult,
        error: new Error(
          'No CRM profile was found for this account.',
        ),
      };
    }

    /* -----------------------------------------------
       ACCOUNT INACTIVE
    ----------------------------------------------- */

    const isActive =
      profile.is_active !== false;

    if (!isActive) {
      console.warn(
        'CRM account is inactive:',
        userId,
      );

      return {
        roles: [],
        primaryRole: null,
        permissions: {},
        isActive: false,
        error: null,
      };
    }

    /* -----------------------------------------------
       NORMALIZE ROLES
    ----------------------------------------------- */

    const roles: CrmRole[] = (
      assignments || []
    )
      .map((assignment: any) => {
        const rawRole =
          assignment?.role;

        /*
         * Supabase relationships can be returned as
         * an object or an array depending on the
         * relationship metadata.
         */
        const role = Array.isArray(
          rawRole,
        )
          ? rawRole[0]
          : rawRole;

        if (!role) {
          return null;
        }

        const normalizedRole: CrmRole = {
          id: String(role.id),

          key: String(
            role.role_key,
          ),

          name: String(
            role.name,
          ),

          description:
            role.description ??
            null,

          permissions:
            role.permissions &&
            typeof role.permissions ===
              'object' &&
            !Array.isArray(
              role.permissions,
            )
              ? (
                  role.permissions as Record<
                    string,
                    boolean
                  >
                )
              : {},

          is_system:
            Boolean(
              role.is_system,
            ),
        };

        return normalizedRole;
      })
      .filter(
        (
          role: CrmRole | null,
        ): role is CrmRole =>
          role !== null,
      );

    /* -----------------------------------------------
       MERGE PERMISSIONS
    ----------------------------------------------- */

    const permissions: Record<
      string,
      boolean
    > = {};

    for (const role of roles) {
      Object.entries(
        role.permissions || {},
      ).forEach(
        ([permission, enabled]) => {
          if (enabled === true) {
            permissions[permission] =
              true;
          }
        },
      );

      // Permissions defined for this role in code also apply, so module access matches the role
      // definition even when the stored role record is missing some of them (e.g. WaruBuddy).
      codeDefaultPermissionsFor(role).forEach(
        permission => {
          permissions[permission] = true;
        },
      );
    }

    /* -----------------------------------------------
       SUPER ADMIN
    ----------------------------------------------- */

    const isSuperAdmin =
      roles.some(
        role =>
          role.key ===
          'super_admin',
      );

    if (isSuperAdmin) {
      /*
       * Wildcard permission.
       */
      permissions['*'] = true;

      /*
       * Explicit user-management permission.
       */
      permissions[
        'users.manage'
      ] = true;

      /*
       * Give Super Admin every known permission.
       *
       * This protects against a component checking
       * an explicit permission instead of '*'.
       */
      DEFAULT_ROLE_PERMISSIONS.forEach(
        permission => {
          permissions[
            permission.key
          ] = true;
        },
      );
    }

    /* -----------------------------------------------
       PRIMARY ROLE
    ----------------------------------------------- */

    const primaryRole =
      roles.find(
        role =>
          role.key ===
          'super_admin',
      ) ??
      roles[0] ??
      null;

    console.log(
      'CRM access resolved:',
      {
        userId,
        email: profile.email,
        isActive,
        roles: roles.map(
          role => role.key,
        ),
        primaryRole:
          primaryRole?.key ??
          null,
        isSuperAdmin,
      },
    );

    return {
      roles,
      primaryRole,
      permissions,
      isActive,
      error: null,
    };
  } catch (error) {
    console.error(
      'Unexpected CRM access error:',
      error,
    );

    return {
      ...emptyResult,
      error:
        error instanceof Error
          ? error
          : new Error(
              'Unable to determine CRM access.',
            ),
    };
  }
};

/* ============================================================
   FETCH CRM ROLES
============================================================ */

export const fetchCrmRoles =
  async () => {
    const {
      data,
      error,
    } = await supabase
      .from('crm_roles')
      .select(
        `
          id,
          role_key,
          name,
          description,
          permissions,
          is_system
        `,
      )
      .order(
        'is_system',
        {
          ascending: false,
        },
      )
      .order('name');

    if (error) {
      return {
        data: null,
        error,
      };
    }

    return {
      data: (data || []).map(
        (role: any): CrmRole => ({
          id: String(role.id),
          key: String(
            role.role_key,
          ),
          name: String(
            role.name,
          ),
          description:
            role.description ??
            null,
          permissions:
            role.permissions &&
            typeof role.permissions ===
              'object' &&
            !Array.isArray(
              role.permissions,
            )
              ? role.permissions
              : {},
          is_system:
            Boolean(
              role.is_system,
            ),
        }),
      ),

      error: null,
    };
  };

/* ============================================================
   CREATE CRM ROLE
============================================================ */

export const createCrmRole =
  async (input: {
    name: string;
    description?: string;
    permissions?: Record<
      string,
      boolean
    >;
  }) =>
    invokeRoleFunction({
      action: 'create_role',
      ...input,
    });

/* ============================================================
   UPDATE CRM ROLE
============================================================ */

export const updateCrmRole =
  async (
    roleId: string,
    input: {
      name?: string;
      description?: string;
      permissions?: Record<
        string,
        boolean
      >;
    },
  ) =>
    invokeRoleFunction({
      action: 'update_role',
      role_id: roleId,
      ...input,
    });

/* ============================================================
   DELETE CRM ROLE
============================================================ */

export const deleteCrmRole =
  async (
    roleId: string,
  ) =>
    invokeRoleFunction({
      action: 'delete_role',
      role_id: roleId,
    });

/* ============================================================
   CREATE CRM USER
============================================================ */

export const createCrmUser =
  async (input: {
    username: string;
    full_name: string;
    email: string;
    password: string;
    role_id: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-crm-user',
        {
          body: {
            action: 'create_user',
            ...input,
          },
        },
      );

      if (error) {
        // supabase-js hides the real reason behind a generic message for non-2xx responses.
        // Read the actual error text returned by the function.
        let message = error.message || 'Unable to create CRM user.';
        const response = (error as any).context;
        if (response && typeof response.json === 'function') {
          try {
            const body = await response.json();
            if (body?.error) message = String(body.error);
          } catch {
            // keep the default message
          }
        }
        console.error('create-crm-user failed:', message, error);
        return { data: null, error: new Error(message) };
      }

      if (data && typeof data === 'object' && 'error' in data && (data as any).error) {
        return { data: null, error: new Error(String((data as any).error)) };
      }

      return { data, error: null };
    } catch (err) {
      console.error('create-crm-user invocation failed:', err);
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unable to create CRM user.'),
      };
    }
  };

/* ============================================================
   ASSIGN CRM ROLE
============================================================ */

export const assignCrmRole =
  async (
    userId: string,
    roleId: string,
  ) =>
    invokeRoleFunction({
      action: 'assign_role',
      user_id: userId,
      role_id: roleId,
    });

/* ============================================================
   SET CRM USER ACTIVE / INACTIVE
============================================================ */

export const setCrmUserActive =
  async (
    userId: string,
    isActive: boolean,
  ) =>
    invokeRoleFunction({
      action: 'set_active',
      user_id: userId,
      is_active: isActive,
    });

/* ============================================================
   FETCH CRM USERS
============================================================ */

export const fetchCrmUsers =
  async () => {
    const {
      data: profiles,
      error: profileError,
    } = await supabase
      .from('crm_user_profiles')
      .select('*')
      .order(
        'created_at',
        {
          ascending: false,
        },
      );

    if (profileError) {
      return {
        data: null,
        error: profileError,
      };
    }

    const {
      data: assignments,
      error: roleError,
    } = await supabase
      .from('crm_user_role_assignments')
      .select(
        `
          user_id,
          role:crm_roles(
            id,
            role_key,
            name,
            description,
            permissions,
            is_system
          )
        `,
      );

    if (roleError) {
      return {
        data: null,
        error: roleError,
      };
    }

    const roleMap =
      new Map<
        string,
        CrmRole[]
      >();

    (
      assignments || []
    ).forEach(
      (assignment: any) => {
        const rawRole =
          assignment?.role;

        const role =
          Array.isArray(
            rawRole,
          )
            ? rawRole[0]
            : rawRole;

        if (!role) {
          return;
        }

        const normalized: CrmRole =
          {
            id: String(
              role.id,
            ),

            key: String(
              role.role_key,
            ),

            name: String(
              role.name,
            ),

            description:
              role.description ??
              null,

            permissions:
              role.permissions &&
              typeof role.permissions ===
                'object' &&
              !Array.isArray(
                role.permissions,
              )
                ? role.permissions
                : {},

            is_system:
              Boolean(
                role.is_system,
              ),
          };

        roleMap.set(
          assignment.user_id,
          [
            ...(roleMap.get(
              assignment.user_id,
            ) || []),
            normalized,
          ],
        );
      },
    );

    return {
      data: (profiles || []).map(
        (profile: any): CrmUser => ({
          user_id:
            profile.user_id,

          username:
            profile.username ??
            null,

          email:
            profile.email,

          full_name:
            profile.full_name ??
            null,

          phone:
            profile.phone ??
            null,

          job_title:
            profile.job_title ??
            null,

          is_active:
            profile.is_active !==
            false,

          roles:
            roleMap.get(
              profile.user_id,
            ) || [],

          created_at:
            profile.created_at,
        }),
      ),

      error: null,
    };
  };

/* ============================================================
   UPDATE CRM USER PROFILE
============================================================ */

export type InHouseDoctorUser = {
  userId: string;
  name: string;
  email: string;
};

/**
 * Live list of active CRM users whose role is `in_house_doctor`.
 * Used by Patient Leads (Stage 4) so the dropdown follows Supabase instead of a hard-coded list.
 */
export const fetchInHouseDoctorUsers = async (): Promise<{
  data: InHouseDoctorUser[];
  error: Error | null;
}> => {
  const { data: assignments, error: assignmentError } = await supabase
    .from('crm_user_role_assignments')
    .select('user_id, role:crm_roles!inner(role_key)')
    .eq('role.role_key', 'in_house_doctor');

  if (assignmentError) {
    console.error('In-house doctor lookup failed:', assignmentError);
    return { data: [], error: assignmentError as unknown as Error };
  }

  const userIds = Array.from(new Set((assignments || []).map((a: any) => a.user_id).filter(Boolean)));
  if (!userIds.length) return { data: [], error: null };

  const { data: profiles, error: profileError } = await supabase
    .from('crm_user_profiles')
    .select('user_id, email, username, full_name, is_active')
    .in('user_id', userIds);

  if (profileError) {
    console.error('In-house doctor profile lookup failed:', profileError);
    return { data: [], error: profileError as unknown as Error };
  }

  const doctors = (profiles || [])
    .filter((profile: any) => profile.is_active !== false)
    .map((profile: any) => ({
      userId: String(profile.user_id),
      name: String(profile.full_name || profile.username || profile.email || 'In-house doctor'),
      email: String(profile.email || ''),
    }))
    .sort((a: InHouseDoctorUser, b: InHouseDoctorUser) => a.name.localeCompare(b.name));

  return { data: doctors, error: null };
};

export const updateCrmUserProfile =
  async (
    userId: string,
    values: {
      full_name?: string;
      phone?: string;
      job_title?: string;
      is_active?: boolean;
    },
  ) =>
    supabase
      .from('crm_user_profiles')
      .update(values)
      .eq(
        'user_id',
        userId,
      );

/* ============================================================
   SUPER ADMIN CHECK
============================================================ */

export const isSuperAdmin = (
  roles: CrmRole[],
) =>
  roles.some(
    role =>
      role.key ===
      'super_admin',
  );

/* ============================================================
   ROUTE ACCESS CHECK
============================================================ */

export const canAccessRoute = (
  roles: CrmRole[],
  permissions: Record<
    string,
    boolean
  >,
  path: string,
) => {
  /*
   * Super Admin has access to everything.
   */
  if (
    permissions['*'] ||
    roles.some(
      role =>
        role.key ===
        'super_admin',
    )
  ) {
    return true;
  }

  const required =
    ROUTE_PERMISSION[path];

  /*
   * Unknown routes are denied by default.
   */
  if (!required) {
    return false;
  }

  return Boolean(
    permissions[required],
  );
};