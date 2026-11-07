import { expect, type Page } from '@playwright/test';

export async function adminLogin(page: Page) {
  // Open the CRM login page.
  await page.goto('/', {
    waitUntil: 'domcontentloaded',
  });

  // Wait for the login screen to appear.
  const emailInput = page
    .locator(
      'input[type="email"], input[placeholder*="email" i], input[name="email"]'
    )
    .first();

  await expect(emailInput).toBeVisible({
    timeout: 30000,
  });

  // Find the password field.
  const passwordInput = page
    .locator(
      'input[type="password"], input[placeholder*="password" i], input[name="password"]'
    )
    .first();

  await expect(passwordInput).toBeVisible({
    timeout: 10000,
  });

  // Fill admin credentials from .env.
  const adminEmail = process.env.CRM_ADMIN_EMAIL;
  const adminPassword = process.env.CRM_ADMIN_PASSWORD;

  if (!adminEmail) {
    throw new Error(
      'CRM_ADMIN_EMAIL is not set in the .env file.'
    );
  }

  if (!adminPassword) {
    throw new Error(
      'CRM_ADMIN_PASSWORD is not set in the .env file.'
    );
  }

  await emailInput.fill(adminEmail);
  await passwordInput.fill(adminPassword);

  // The application's initial login button is:
  // "Access CRM Dashboard"
  //
  // Keep the other names as fallbacks in case the login UI
  // changes between environments.
  const loginButton = page
    .getByRole('button', {
      name: /access crm dashboard|access admin dashboard|sign in|login|log in/i,
    })
    .first();

  await expect(loginButton).toBeVisible({
    timeout: 10000,
  });

  await expect(loginButton).toBeEnabled({
    timeout: 10000,
  });

  await loginButton.click();

  // Wait for the login screen to disappear and the CRM to load.
  await expect(emailInput).not.toBeVisible({
    timeout: 30000,
  });

  // Give Supabase authentication and CRM role/session
  // initialization a little time to finish.
  await page.waitForTimeout(1500);
}