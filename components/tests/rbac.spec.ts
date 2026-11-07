import { test, expect, Page } from '@playwright/test';

/**
 * ============================================================
 * WARUWENJO / HEALTHHUB CRM
 * ROLE BASED ACCESS CONTROL TEST SUITE
 * ============================================================
 *
 * Required environment variables:
 *
 * TEST_BASE_URL
 *
 * Super Admin
 * TEST_SUPER_ADMIN_EMAIL
 * TEST_SUPER_ADMIN_PASSWORD
 *
 * Admin
 * TEST_ADMIN_EMAIL
 * TEST_ADMIN_PASSWORD
 *
 * BDM
 * TEST_BDM_EMAIL
 * TEST_BDM_PASSWORD
 *
 * CDM
 * TEST_CDM_EMAIL
 * TEST_CDM_PASSWORD
 *
 * WaruBuddy
 * TEST_WARU_BUDDY_EMAIL
 * TEST_WARU_BUDDY_PASSWORD
 *
 * In-house Doctor
 * TEST_IN_HOUSE_DOCTOR_EMAIL
 * TEST_IN_HOUSE_DOCTOR_PASSWORD
 *
 * Custom Read Only Role
 * TEST_CUSTOM_READONLY_EMAIL
 * TEST_CUSTOM_READONLY_PASSWORD
 *
 * Custom Leads Role
 * TEST_CUSTOM_LEADS_EMAIL
 * TEST_CUSTOM_LEADS_PASSWORD
 *
 * Patient website account
 * TEST_PATIENT_EMAIL
 * TEST_PATIENT_PASSWORD
 *
 * General website user
 * TEST_USER_EMAIL
 * TEST_USER_PASSWORD
 *
 * ============================================================
 */

const BASE_URL =
  process.env.TEST_BASE_URL ||
  'http://192.168.1.3:3002';

const USERS = {
  superAdmin: {
    email: process.env.TEST_SUPER_ADMIN_EMAIL || '',
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || '',
  },

  admin: {
    email: process.env.TEST_ADMIN_EMAIL || '',
    password: process.env.TEST_ADMIN_PASSWORD || '',
  },

  bdm: {
    email: process.env.TEST_BDM_EMAIL || '',
    password: process.env.TEST_BDM_PASSWORD || '',
  },

  cdm: {
    email: process.env.TEST_CDM_EMAIL || '',
    password: process.env.TEST_CDM_PASSWORD || '',
  },

  waruBuddy: {
    email: process.env.TEST_WARU_BUDDY_EMAIL || '',
    password: process.env.TEST_WARU_BUDDY_PASSWORD || '',
  },

  inHouseDoctor: {
    email: process.env.TEST_IN_HOUSE_DOCTOR_EMAIL || '',
    password: process.env.TEST_IN_HOUSE_DOCTOR_PASSWORD || '',
  },

  customReadOnly: {
    email: process.env.TEST_CUSTOM_READONLY_EMAIL || '',
    password: process.env.TEST_CUSTOM_READONLY_PASSWORD || '',
  },

  customLeads: {
    email: process.env.TEST_CUSTOM_LEADS_EMAIL || '',
    password: process.env.TEST_CUSTOM_LEADS_PASSWORD || '',
  },

  patient: {
    email: process.env.TEST_PATIENT_EMAIL || '',
    password: process.env.TEST_PATIENT_PASSWORD || '',
  },

  user: {
    email: process.env.TEST_USER_EMAIL || '',
    password: process.env.TEST_USER_PASSWORD || '',
  },
};

/**
 * ============================================================
 * ROUTES
 * ============================================================
 */

const ROUTES = {
  dashboard: '#/',
  hospitals: '#/hospitals',
  doctors: '#/doctors',
  patientLeads: '#/patient-leads',
  automation: '#/automation',
  bridge: '#/bridge',
  consent: '#/consent',
  travelManagement: '#/travel-mgmt',
  agreements: '#/agreements',
  quotations: '#/quotations',
  finance: '#/finance',
  disputes: '#/disputes',
  communications: '#/communications',
  whatsapp: '#/whatsapp',
  vault: '#/vault',
  logistics: '#/logistics',
  leads: '#/leads',
  pipeline: '#/pipeline',
  patients: '#/patients',
  orders: '#/orders',
  inventory: '#/inventory',
  insights: '#/insights',
  reports: '#/reports',
  settings: '#/settings',
  crmUsers: '#/crm-users',
};

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

type TestUser = {
  email: string;
  password: string;
};

function requireCredentials(
  user: TestUser,
  name: string,
) {
  if (!user.email || !user.password) {
    test.skip(
      true,
      `${name} credentials are not configured in environment variables.`,
    );
  }
}

/**
 * Login through the actual CRM login UI.
 */
async function login(
  page: Page,
  user: TestUser,
  userName = 'CRM user',
) {
  requireCredentials(user, userName);

  await page.goto(`${BASE_URL}/#/login`);

  /*
   * Wait for login page.
   */
  await expect(
    page.getByRole('button', {
      name: /Access CRM Dashboard/i,
    }),
  ).toBeVisible({
    timeout: 30000,
  });

  /*
   * Email field.
   *
   * We intentionally use type=email instead of a fragile CSS class.
   */
  const emailInput = page.locator(
    'input[type="email"]',
  );

  await expect(emailInput).toBeVisible();

  await emailInput.fill(user.email);

  /*
   * Current application uses #adminPassword.
   */
  const passwordInput = page.locator(
    '#adminPassword',
  );

  await expect(passwordInput).toBeVisible();

  await passwordInput.fill(user.password);

  await page.getByRole('button', {
    name: /Access CRM Dashboard/i,
  }).click();

  /*
   * Wait for CRM to finish authentication.
   */
  await page.waitForTimeout(1500);

  /*
   * Dashboard is the normal post-login destination.
   */
  await expect
    .poll(
      async () => page.url(),
      {
        timeout: 30000,
      },
    )
    .not.toContain('/login');

  return page;
}

/**
 * Logout using the actual application logout button.
 */
async function logout(page: Page) {
  const logoutButton = page.getByTitle(
    'Logout',
  );

  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();

    await expect
      .poll(
        async () => page.url(),
        {
          timeout: 15000,
        },
      )
      .toContain('#/login');
  }
}

/**
 * Navigate to a CRM route.
 */
async function navigateTo(
  page: Page,
  route: string,
) {
  await page.goto(`${BASE_URL}/${route}`);

  await page.waitForTimeout(1000);
}

/**
 * Assert the current user CAN access a route.
 */
async function expectRouteAllowed(
  page: Page,
  route: string,
) {
  await navigateTo(page, route);

  await expect(
    page.getByText('Access Restricted', {
      exact: true,
    }),
  ).not.toBeVisible({
    timeout: 5000,
  });

  expect(page.url()).toContain(route);
}

/**
 * Assert the current user CANNOT access a route.
 */
async function expectRouteDenied(
  page: Page,
  route: string,
) {
  await navigateTo(page, route);

  await expect(
    page.getByText('Access Restricted', {
      exact: true,
    }),
  ).toBeVisible({
    timeout: 15000,
  });
}

/**
 * Check whether a sidebar item exists.
 */
async function expectSidebarVisible(
  page: Page,
  name: string,
) {
  await expect(
    page.getByRole('link', {
      name: new RegExp(name, 'i'),
    }),
  ).toBeVisible();
}

/**
 * Check whether a sidebar item does NOT exist.
 */
async function expectSidebarHidden(
  page: Page,
  name: string,
) {
  await expect(
    page.getByRole('link', {
      name: new RegExp(name, 'i'),
    }),
  ).not.toBeVisible();
}

/**
 * ============================================================
 * BASIC AUTHENTICATION
 * ============================================================
 */

test.describe('RBAC - Authentication', () => {
  test('TC-RBAC-001 - Super Admin can login', async ({
    page,
  }) => {
    await login(
      page,
      USERS.superAdmin,
      'Super Admin',
    );

    await expect(page).not.toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-002 - Invalid password is rejected', async ({
    page,
  }) => {
    requireCredentials(
      USERS.superAdmin,
      'Super Admin',
    );

    await page.goto(`${BASE_URL}/#/login`);

    await page
      .locator('input[type="email"]')
      .fill(USERS.superAdmin.email);

    await page
      .locator('#adminPassword')
      .fill('DefinitelyWrongPassword123!');

    await page.getByRole('button', {
      name: /Access CRM Dashboard/i,
    }).click();

    await expect(
      page.locator('body'),
    ).toContainText(
      /invalid|credentials|password|failed/i,
      {
        timeout: 15000,
      },
    );
  });

  test('TC-RBAC-003 - Empty credentials are rejected', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/#/login`);

    await page.getByRole('button', {
      name: /Access CRM Dashboard/i,
    }).click();

    /*
     * Browser validation or application validation should
     * prevent successful navigation.
     */
    await expect(page).toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-004 - Super Admin session survives refresh', async ({
    page,
  }) => {
    await login(
      page,
      USERS.superAdmin,
      'Super Admin',
    );

    await page.reload();

    await page.waitForTimeout(1500);

    await expect(page).not.toHaveURL(
      /#\/login/,
    );

    await expect(
      page.getByTitle('Logout'),
    ).toBeVisible();
  });

  test('TC-RBAC-005 - Logout removes CRM session', async ({
    page,
  }) => {
    await login(
      page,
      USERS.superAdmin,
      'Super Admin',
    );

    await logout(page);

    await expect(page).toHaveURL(
      /#\/login/,
    );
  });
});

/**
 * ============================================================
 * SUPER ADMIN
 * ============================================================
 */

test.describe('RBAC - Super Admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(
      page,
      USERS.superAdmin,
      'Super Admin',
    );
  });

  test('TC-RBAC-010 - Super Admin can access Dashboard', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.dashboard,
    );
  });

  test('TC-RBAC-011 - Super Admin can access User & Role Management', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.crmUsers,
    );
  });

  test('TC-RBAC-012 - User & Role Management is visible to Super Admin', async ({
    page,
  }) => {
    await expectSidebarVisible(
      page,
      'User & Role Management',
    );
  });

  test('TC-RBAC-013 - Super Admin can access Leads', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.leads,
    );
  });

  test('TC-RBAC-014 - Super Admin can access Patient Leads', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.patientLeads,
    );
  });

  test('TC-RBAC-015 - Super Admin can access Clinical modules', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.hospitals,
    );

    await expectRouteAllowed(
      page,
      ROUTES.doctors,
    );

    await expectRouteAllowed(
      page,
      ROUTES.bridge,
    );
  });

  test('TC-RBAC-016 - Super Admin can access Finance modules', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.finance,
    );

    await expectRouteAllowed(
      page,
      ROUTES.quotations,
    );

    await expectRouteAllowed(
      page,
      ROUTES.agreements,
    );
  });

  test('TC-RBAC-017 - Super Admin can access Travel modules', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.travelManagement,
    );

    await expectRouteAllowed(
      page,
      ROUTES.logistics,
    );
  });

  test('TC-RBAC-018 - Super Admin can access Settings', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.settings,
    );
  });
});

/**
 * ============================================================
 * ADMIN
 * ============================================================
 */

test.describe('RBAC - Admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(
      page,
      USERS.admin,
      'Admin',
    );
  });

  test('TC-RBAC-020 - Admin can login', async ({
    page,
  }) => {
    await expect(page).not.toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-021 - Admin cannot access User & Role Management', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.crmUsers,
    );
  });

  test('TC-RBAC-022 - Admin does not see User & Role Management in sidebar', async ({
    page,
  }) => {
    await expectSidebarHidden(
      page,
      'User & Role Management',
    );
  });

  test('TC-RBAC-023 - Admin can access Leads', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.leads,
    );
  });

  test('TC-RBAC-024 - Admin can access Clinical modules', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.hospitals,
    );

    await expectRouteAllowed(
      page,
      ROUTES.doctors,
    );
  });

  test('TC-RBAC-025 - Admin can access Finance', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.finance,
    );

    await expectRouteAllowed(
      page,
      ROUTES.quotations,
    );
  });

  test('TC-RBAC-026 - Admin cannot bypass RBAC using direct URL', async ({
    page,
  }) => {
    await page.goto(
      `${BASE_URL}/${ROUTES.crmUsers}`,
    );

    await expect(
      page.getByText('Access Restricted', {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 15000,
    });
  });
});

/**
 * ============================================================
 * BDM
 * ============================================================
 */

test.describe('RBAC - BDM', () => {
  test.beforeEach(async ({ page }) => {
    await login(
      page,
      USERS.bdm,
      'BDM',
    );
  });

  test('TC-RBAC-030 - BDM can login', async ({
    page,
  }) => {
    await expect(page).not.toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-031 - BDM cannot manage users', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.crmUsers,
    );
  });

  test('TC-RBAC-032 - BDM can access Leads', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.leads,
    );

    await expectRouteAllowed(
      page,
      ROUTES.pipeline,
    );

    await expectRouteAllowed(
      page,
      ROUTES.patientLeads,
    );
  });

  test('TC-RBAC-033 - BDM can access Finance', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.finance,
    );

    await expectRouteAllowed(
      page,
      ROUTES.quotations,
    );
  });

  test('TC-RBAC-034 - BDM can access Travel', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.travelManagement,
    );

    await expectRouteAllowed(
      page,
      ROUTES.logistics,
    );
  });

  test('TC-RBAC-035 - BDM cannot access Clinical Bridge', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.bridge,
    );
  });

  test('TC-RBAC-036 - BDM cannot access Settings', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.settings,
    );
  });
});

/**
 * ============================================================
 * CDM
 * ============================================================
 */

test.describe('RBAC - CDM', () => {
  test.beforeEach(async ({ page }) => {
    await login(
      page,
      USERS.cdm,
      'CDM',
    );
  });

  test('TC-RBAC-040 - CDM can login', async ({
    page,
  }) => {
    await expect(page).not.toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-041 - CDM can access Clinical modules', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.hospitals,
    );

    await expectRouteAllowed(
      page,
      ROUTES.doctors,
    );

    await expectRouteAllowed(
      page,
      ROUTES.bridge,
    );
  });

  test('TC-RBAC-042 - CDM can access Cases / Patients', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.patients,
    );
  });

  test('TC-RBAC-043 - CDM can access Travel', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.travelManagement,
    );

    await expectRouteAllowed(
      page,
      ROUTES.logistics,
    );
  });

  test('TC-RBAC-044 - CDM cannot manage CRM users', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.crmUsers,
    );
  });

  test('TC-RBAC-045 - CDM cannot access Finance management', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.finance,
    );
  });
});

/**
 * ============================================================
 * WARU BUDDY
 * ============================================================
 */

test.describe('RBAC - Waru Buddy', () => {
  test.beforeEach(async ({ page }) => {
    await login(
      page,
      USERS.waruBuddy,
      'Waru Buddy',
    );
  });

  test('TC-RBAC-050 - Waru Buddy can login', async ({
    page,
  }) => {
    await expect(page).not.toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-051 - Waru Buddy can access Patients', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.patients,
    );
  });

  test('TC-RBAC-052 - Waru Buddy can access Communications', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.communications,
    );

    await expectRouteAllowed(
      page,
      ROUTES.whatsapp,
    );
  });

  test('TC-RBAC-053 - Waru Buddy can access Travel', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.travelManagement,
    );

    await expectRouteAllowed(
      page,
      ROUTES.logistics,
    );
  });

  test('TC-RBAC-054 - Waru Buddy cannot manage users', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.crmUsers,
    );
  });

  test('TC-RBAC-055 - Waru Buddy cannot access Finance', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.finance,
    );
  });
});

/**
 * ============================================================
 * IN-HOUSE DOCTOR
 * ============================================================
 */

test.describe('RBAC - In-house Doctor', () => {
  test.beforeEach(async ({ page }) => {
    await login(
      page,
      USERS.inHouseDoctor,
      'In-house Doctor',
    );
  });

  test('TC-RBAC-060 - In-house Doctor can login', async ({
    page,
  }) => {
    await expect(page).not.toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-061 - In-house Doctor can access Clinical', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.hospitals,
    );

    await expectRouteAllowed(
      page,
      ROUTES.doctors,
    );

    await expectRouteAllowed(
      page,
      ROUTES.bridge,
    );
  });

  test('TC-RBAC-062 - In-house Doctor can access Cases', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.patients,
    );
  });

  test('TC-RBAC-063 - In-house Doctor can access Documents', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.vault,
    );

    await expectRouteAllowed(
      page,
      ROUTES.consent,
    );
  });

  test('TC-RBAC-064 - In-house Doctor cannot manage users', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.crmUsers,
    );
  });

  test('TC-RBAC-065 - In-house Doctor cannot access Finance', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.finance,
    );
  });
});

/**
 * ============================================================
 * CUSTOM READ-ONLY ROLE
 * ============================================================
 *
 * Expected permissions for this test account:
 *
 * crm.read = true
 * leads.read = true
 *
 * All write permissions = false
 *
 * users.manage = false
 */

test.describe('RBAC - Custom Read Only Role', () => {
  test.beforeEach(async ({ page }) => {
    await login(
      page,
      USERS.customReadOnly,
      'Custom Read Only',
    );
  });

  test('TC-RBAC-070 - Custom read-only user can login', async ({
    page,
  }) => {
    await expect(page).not.toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-071 - Custom read-only role can access Dashboard', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.dashboard,
    );
  });

  test('TC-RBAC-072 - Custom read-only role can view Leads', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.leads,
    );

    await expectRouteAllowed(
      page,
      ROUTES.pipeline,
    );
  });

  test('TC-RBAC-073 - Custom read-only role cannot manage Users', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.crmUsers,
    );
  });

  test('TC-RBAC-074 - Custom read-only role cannot access Finance without permission', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.finance,
    );
  });

  test('TC-RBAC-075 - Custom read-only role cannot access Settings without permission', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.settings,
    );
  });
});

/**
 * ============================================================
 * CUSTOM LEADS ROLE
 * ============================================================
 *
 * Expected permissions:
 *
 * crm.read
 * leads.read
 * leads.write
 *
 * No clinical.write
 * No finance.write
 * No users.manage
 */

test.describe('RBAC - Custom Leads Role', () => {
  test.beforeEach(async ({ page }) => {
    await login(
      page,
      USERS.customLeads,
      'Custom Leads',
    );
  });

  test('TC-RBAC-080 - Custom Leads user can login', async ({
    page,
  }) => {
    await expect(page).not.toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-081 - Custom Leads user can access Leads', async ({
    page,
  }) => {
    await expectRouteAllowed(
      page,
      ROUTES.leads,
    );

    await expectRouteAllowed(
      page,
      ROUTES.pipeline,
    );

    await expectRouteAllowed(
      page,
      ROUTES.patientLeads,
    );
  });

  test('TC-RBAC-082 - Custom Leads user cannot access Clinical', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.bridge,
    );
  });

  test('TC-RBAC-083 - Custom Leads user cannot access Finance', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.finance,
    );
  });

  test('TC-RBAC-084 - Custom Leads user cannot access User Management', async ({
    page,
  }) => {
    await expectRouteDenied(
      page,
      ROUTES.crmUsers,
    );
  });
});

/**
 * ============================================================
 * DIRECT URL BYPASS TESTS
 * ============================================================
 *
 * These are important.
 *
 * Hiding a menu item is NOT enough.
 * The user must also be blocked if they manually type:
 *
 * http://.../#/settings
 * http://.../#/crm-users
 *
 * ============================================================
 */

test.describe('RBAC - Direct URL Protection', () => {
  test('TC-RBAC-090 - BDM cannot bypass CRM user restriction through URL', async ({
    page,
  }) => {
    await login(
      page,
      USERS.bdm,
      'BDM',
    );

    await page.goto(
      `${BASE_URL}/${ROUTES.crmUsers}`,
    );

    await expect(
      page.getByText('Access Restricted', {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('TC-RBAC-091 - Waru Buddy cannot bypass Finance restriction through URL', async ({
    page,
  }) => {
    await login(
      page,
      USERS.waruBuddy,
      'Waru Buddy',
    );

    await page.goto(
      `${BASE_URL}/${ROUTES.finance}`,
    );

    await expect(
      page.getByText('Access Restricted', {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('TC-RBAC-092 - In-house Doctor cannot bypass Finance restriction through URL', async ({
    page,
  }) => {
    await login(
      page,
      USERS.inHouseDoctor,
      'In-house Doctor',
    );

    await page.goto(
      `${BASE_URL}/${ROUTES.finance}`,
    );

    await expect(
      page.getByText('Access Restricted', {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('TC-RBAC-093 - Custom role cannot bypass User Management restriction', async ({
    page,
  }) => {
    await login(
      page,
      USERS.customReadOnly,
      'Custom Read Only',
    );

    await page.goto(
      `${BASE_URL}/${ROUTES.crmUsers}`,
    );

    await expect(
      page.getByText('Access Restricted', {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 15000,
    });
  });
});

/**
 * ============================================================
 * SIDEBAR PERMISSION TESTS
 * ============================================================
 */

test.describe('RBAC - Sidebar Visibility', () => {
  test('TC-RBAC-100 - Super Admin sees User Management', async ({
    page,
  }) => {
    await login(
      page,
      USERS.superAdmin,
      'Super Admin',
    );

    await expectSidebarVisible(
      page,
      'User & Role Management',
    );
  });

  test('TC-RBAC-101 - Admin does not see User Management', async ({
    page,
  }) => {
    await login(
      page,
      USERS.admin,
      'Admin',
    );

    await expectSidebarHidden(
      page,
      'User & Role Management',
    );
  });

  test('TC-RBAC-102 - BDM does not see User Management', async ({
    page,
  }) => {
    await login(
      page,
      USERS.bdm,
      'BDM',
    );

    await expectSidebarHidden(
      page,
      'User & Role Management',
    );
  });

  test('TC-RBAC-103 - CDM does not see User Management', async ({
    page,
  }) => {
    await login(
      page,
      USERS.cdm,
      'CDM',
    );

    await expectSidebarHidden(
      page,
      'User & Role Management',
    );
  });

  test('TC-RBAC-104 - Waru Buddy does not see User Management', async ({
    page,
  }) => {
    await login(
      page,
      USERS.waruBuddy,
      'Waru Buddy',
    );

    await expectSidebarHidden(
      page,
      'User & Role Management',
    );
  });

  test('TC-RBAC-105 - In-house Doctor does not see User Management', async ({
    page,
  }) => {
    await login(
      page,
      USERS.inHouseDoctor,
      'In-house Doctor',
    );

    await expectSidebarHidden(
      page,
      'User & Role Management',
    );
  });
});

/**
 * ============================================================
 * ROLE ISOLATION
 * ============================================================
 *
 * Verify that permissions don't leak between roles.
 * ============================================================
 */

test.describe('RBAC - Permission Isolation', () => {
  test('TC-RBAC-110 - BDM does not inherit Doctor permissions', async ({
    page,
  }) => {
    await login(
      page,
      USERS.bdm,
      'BDM',
    );

    await expectRouteDenied(
      page,
      ROUTES.bridge,
    );
  });

  test('TC-RBAC-111 - Doctor does not inherit BDM finance permissions', async ({
    page,
  }) => {
    await login(
      page,
      USERS.inHouseDoctor,
      'In-house Doctor',
    );

    await expectRouteDenied(
      page,
      ROUTES.finance,
    );
  });

  test('TC-RBAC-112 - Waru Buddy does not inherit Admin permissions', async ({
    page,
  }) => {
    await login(
      page,
      USERS.waruBuddy,
      'Waru Buddy',
    );

    await expectRouteDenied(
      page,
      ROUTES.settings,
    );

    await expectRouteDenied(
      page,
      ROUTES.crmUsers,
    );
  });

  test('TC-RBAC-113 - Custom role permissions are isolated', async ({
    page,
  }) => {
    await login(
      page,
      USERS.customReadOnly,
      'Custom Read Only',
    );

    /*
     * Should be allowed because crm.read exists.
     */
    await expectRouteAllowed(
      page,
      ROUTES.dashboard,
    );

    /*
     * Should be denied because users.manage does not exist.
     */
    await expectRouteDenied(
      page,
      ROUTES.crmUsers,
    );
  });
});

/**
 * ============================================================
 * SPECIALIST DOCTOR REMOVAL
 * ============================================================
 *
 * Specialist Doctor is no longer required.
 *
 * This test checks the visible role-management page.
 * ============================================================
 */

test.describe('RBAC - Specialist Doctor Removal', () => {
  test('TC-RBAC-120 - Specialist Doctor should not be offered as a CRM role', async ({
    page,
  }) => {
    await login(
      page,
      USERS.superAdmin,
      'Super Admin',
    );

    await navigateTo(
      page,
      ROUTES.crmUsers,
    );

    /*
     * Look for visible text.
     *
     * If the old role still exists in the DB, this test will
     * fail and tell us that cleanup is still required.
     */
    await expect(
      page.getByText(
        'Specialist Doctor',
        {
          exact: true,
        },
      ),
    ).not.toBeVisible({
      timeout: 5000,
    });
  });
});

/**
 * ============================================================
 * CRM USER MANAGEMENT
 * ============================================================
 */

test.describe('RBAC - User Management', () => {
  test('TC-RBAC-130 - Super Admin can open User Management', async ({
    page,
  }) => {
    await login(
      page,
      USERS.superAdmin,
      'Super Admin',
    );

    await navigateTo(
      page,
      ROUTES.crmUsers,
    );

    await expect(
      page.getByText(
        /User & Role Management/i,
      ),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('TC-RBAC-131 - Super Admin sees Create Role functionality', async ({
    page,
  }) => {
    await login(
      page,
      USERS.superAdmin,
      'Super Admin',
    );

    await navigateTo(
      page,
      ROUTES.crmUsers,
    );

    await expect(
      page.getByRole('button', {
        name: /Create Role/i,
      }),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test('TC-RBAC-132 - Super Admin sees Create User functionality', async ({
    page,
  }) => {
    await login(
      page,
      USERS.superAdmin,
      'Super Admin',
    );

    await navigateTo(
      page,
      ROUTES.crmUsers,
    );

    await expect(
      page.getByRole('button', {
        name: /Create User|Add User|New User/i,
      }),
    ).toBeVisible({
      timeout: 15000,
    });
  });
});

/**
 * ============================================================
 * PATIENT / WEBSITE USER SEPARATION
 * ============================================================
 *
 * Patient and normal website users should NOT receive CRM
 * access.
 * ============================================================
 */

test.describe('RBAC - Patient / Website User Separation', () => {
  test('TC-RBAC-140 - Patient account cannot enter CRM', async ({
    page,
  }) => {
    requireCredentials(
      USERS.patient,
      'Patient',
    );

    await page.goto(`${BASE_URL}/#/login`);

    await page
      .locator('input[type="email"]')
      .fill(USERS.patient.email);

    await page
      .locator('#adminPassword')
      .fill(USERS.patient.password);

    await page.getByRole('button', {
      name: /Access CRM Dashboard/i,
    }).click();

    await page.waitForTimeout(2000);

    /*
     * The current AdminLogin explicitly rejects an account
     * without an active CRM role.
     */
    await expect(page).toHaveURL(
      /#\/login/,
    );
  });

  test('TC-RBAC-141 - Normal website user cannot enter CRM', async ({
    page,
  }) => {
    requireCredentials(
      USERS.user,
      'Website User',
    );

    await page.goto(`${BASE_URL}/#/login`);

    await page
      .locator('input[type="email"]')
      .fill(USERS.user.email);

    await page
      .locator('#adminPassword')
      .fill(USERS.user.password);

    await page.getByRole('button', {
      name: /Access CRM Dashboard/i,
    }).click();

    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(
      /#\/login/,
    );
  });
});

/**
 * ============================================================
 * FULL ROLE MATRIX
 * ============================================================
 *
 * This gives one compact regression test for the overall RBAC
 * matrix.
 * ============================================================
 */

test.describe('RBAC - Role Matrix', () => {
  const matrix = [
    {
      name: 'Super Admin',
      user: USERS.superAdmin,
      allowed: [
        ROUTES.dashboard,
        ROUTES.leads,
        ROUTES.patientLeads,
        ROUTES.hospitals,
        ROUTES.doctors,
        ROUTES.bridge,
        ROUTES.finance,
        ROUTES.quotations,
        ROUTES.travelManagement,
        ROUTES.logistics,
        ROUTES.settings,
        ROUTES.crmUsers,
      ],
      denied: [],
    },

    {
      name: 'Admin',
      user: USERS.admin,
      allowed: [
        ROUTES.dashboard,
        ROUTES.leads,
        ROUTES.patientLeads,
        ROUTES.hospitals,
        ROUTES.doctors,
        ROUTES.finance,
        ROUTES.quotations,
      ],
      denied: [
        ROUTES.crmUsers,
      ],
    },

    {
      name: 'BDM',
      user: USERS.bdm,
      allowed: [
        ROUTES.dashboard,
        ROUTES.leads,
        ROUTES.pipeline,
        ROUTES.patientLeads,
        ROUTES.finance,
        ROUTES.quotations,
        ROUTES.travelManagement,
        ROUTES.logistics,
      ],
      denied: [
        ROUTES.crmUsers,
        ROUTES.bridge,
        ROUTES.settings,
      ],
    },

    {
      name: 'CDM',
      user: USERS.cdm,
      allowed: [
        ROUTES.dashboard,
        ROUTES.patientLeads,
        ROUTES.hospitals,
        ROUTES.doctors,
        ROUTES.patients,
        ROUTES.bridge,
        ROUTES.travelManagement,
        ROUTES.logistics,
      ],
      denied: [
        ROUTES.crmUsers,
        ROUTES.finance,
      ],
    },

    {
      name: 'Waru Buddy',
      user: USERS.waruBuddy,
      allowed: [
        ROUTES.dashboard,
        ROUTES.patients,
        ROUTES.communications,
        ROUTES.whatsapp,
        ROUTES.travelManagement,
        ROUTES.logistics,
      ],
      denied: [
        ROUTES.crmUsers,
        ROUTES.finance,
        ROUTES.settings,
      ],
    },

    {
      name: 'In-house Doctor',
      user: USERS.inHouseDoctor,
      allowed: [
        ROUTES.dashboard,
        ROUTES.hospitals,
        ROUTES.doctors,
        ROUTES.bridge,
        ROUTES.patients,
        ROUTES.vault,
        ROUTES.consent,
      ],
      denied: [
        ROUTES.crmUsers,
        ROUTES.finance,
        ROUTES.settings,
      ],
    },
  ];

  for (const role of matrix) {
    test(
      `TC-RBAC-MATRIX-${role.name.replace(/\s+/g, '-')}`,
      async ({ page }) => {
        await login(
          page,
          role.user,
          role.name,
        );

        for (const route of role.allowed) {
          await expectRouteAllowed(
            page,
            route,
          );
        }

        for (const route of role.denied) {
          await expectRouteDenied(
            page,
            route,
          );
        }
      },
    );
  }
});