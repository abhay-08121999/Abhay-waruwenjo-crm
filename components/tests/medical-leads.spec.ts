import { test, expect, type Page } from '@playwright/test';
import { adminLogin } from './helpers/auth';

/**
 * End-to-end coverage for HealthHub CRM > Business Partnerships / Medical Leads.
 * Run against a STAGING environment. The create-partner tests write test leads
 * to the configured CRM database; archive/delete is a browser-local soft delete.
 */

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function openMedicalLeads(page: Page) {
  await adminLogin(page);

  // If login already lands on Business Partnerships, do not navigate again.
  if (await page.getByRole('heading', { name: /Business Partnerships/i }).count()) {
    return;
  }

  const navItem = page.locator('a, button').filter({ hasText: /^(Medical Leads|Business Partnerships|Leads)$/i }).first();
  await navItem.waitFor({ state: 'visible', timeout: 15000 });
  await navItem.click();
  await expect(page.getByRole('heading', { name: /Business Partnerships/i })).toBeVisible({ timeout: 15000 });
}

async function createPartnerInquiry(page: Page, suffix = unique()) {
  const fullName = `Test Medical Contact ${suffix}`;
  const company = `Test Medical Partner ${suffix}`;
  const email = `medical-${suffix.replace(/[^a-z0-9]/gi, '')}@example.test`;

  await page.getByRole('button', { name: /New Partner/i }).click();
  const dialog = page.getByRole('dialog', { name: /Create New Partner/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/Primary contact name/i).fill(fullName);
  await dialog.getByLabel(/Organisation \/ legal name/i).fill(company);
  await dialog.getByLabel(/Work email/i).fill(email);
  await dialog.getByLabel(/Lead source/i).selectOption({ label: 'Web Research' });
  await dialog.getByLabel(/BDM \/ owner/i).fill('Playwright Test Owner');
  await dialog.getByLabel(/Data-use permission confirmed/i).check();
  await dialog.getByRole('button', { name: /Create Partner Inquiry/i }).click();

  await expect(dialog).toBeHidden({ timeout: 15000 });
  await expect(page.getByRole('button', { name: new RegExp(`Open workflow for ${company}`, 'i') })).toBeVisible({ timeout: 15000 });
  return { fullName, company, email };
}

test.describe('Medical Leads / Business Partnerships', () => {
  test.setTimeout(90000);

  test('New Partner opens the form and validates required source, owner, contact and permission', async ({ page }) => {
    await openMedicalLeads(page);
    await page.getByRole('button', { name: /New Partner/i }).click();

    const dialog = page.getByRole('dialog', { name: /Create New Partner/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/Primary contact name/i)).toBeVisible();
    await expect(dialog.getByLabel(/Lead source/i)).toBeVisible();
    await expect(dialog.getByLabel(/BDM \/ owner/i)).toBeVisible();
    await expect(dialog.getByLabel(/Data-use permission confirmed/i)).toBeVisible();

    // HTML required fields prevent an incomplete form from being submitted.
    await expect(dialog.getByLabel(/Primary contact name/i)).toHaveAttribute('required', '');
    await expect(dialog.getByLabel(/Lead source/i)).toHaveAttribute('required', '');
    await expect(dialog.getByLabel(/BDM \/ owner/i)).toHaveAttribute('required', '');
    await dialog.getByRole('button', { name: /Close form/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('bulk import preview flags invalid rows and duplicates without sending email', async ({ page }) => {
    await openMedicalLeads(page);
    await page.getByRole('button', { name: /Bulk Import/i }).click();
    await expect(page.getByText(/Import preview & validation/i)).toBeVisible();

    // Use the bulk-import paste area by its distinctive placeholder.
    const pasteArea = page.getByPlaceholder(/full_name,email,company_name,partner_type,phone/i);
    await pasteArea.fill([
      'full_name,email,company_name,partner_type,phone',
      'Dr Duplicate,dup-medical@example.test,Duplicate Hospital,Doctor,9876543210',
      'Dr Duplicate,dup-medical@example.test,Duplicate Hospital,Doctor,9876543210',
      ',invalid-email,Missing Name Hospital,Doctor,12',
    ].join('\n'));
    await page.getByRole('button', { name: /Add pasted rows/i }).click();

    await expect(page.getByText(/3 total/)).toBeVisible();
    await expect(page.getByText(/invalid/i).first()).toBeVisible();
    await expect(page.getByText(/duplicate/i).first()).toBeVisible();
    await expect(page.getByText(/No emails will be sent by bulk import/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Import partners/i })).toBeDisabled();
    await page.getByRole('button', { name: /^Cancel$/i }).click();
  });

  test('checking a Stage 1 checklist item does not automatically move the lead; Next Stage does', async ({ page }) => {
    await openMedicalLeads(page);
    const partner = await createPartnerInquiry(page);
    await page.getByRole('button', { name: new RegExp(`Open workflow for ${partner.company}`, 'i') }).click();

    await expect(page.getByText('Stage 1 of 5')).toBeVisible();
    await page.getByRole('button', { name: /Review the partnership inquiry/i }).click();
    await expect(page.getByText('Stage 1 of 5')).toBeVisible();

    const stage1Tasks = [
      'Review the partnership inquiry',
      'Verify contact and organization details',
      'Check for duplicate partner records',
      'Confirm the inquiry is genuine',
      'Record the inquiry source and owner',
    ];
    for (const task of stage1Tasks.slice(1)) {
      await page.getByRole('button', { name: new RegExp(task, 'i') }).click();
    }

    const nextStage = page.getByRole('button', { name: /Next Stage/i });
    await expect(nextStage).toBeEnabled();
    await nextStage.click();
    await expect(page.getByText('Stage 2 of 5')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Review and Qualify Lead/i })).toBeVisible();
  });

  test('Stage 2 requires qualification checks before Next Stage can reach Stage 3', async ({ page }) => {
    await openMedicalLeads(page);
    const partner = await createPartnerInquiry(page);
    await page.getByRole('button', { name: new RegExp(`Open workflow for ${partner.company}`, 'i') }).click();

    for (const task of [
      'Review the partnership inquiry',
      'Verify contact and organization details',
      'Check for duplicate partner records',
      'Confirm the inquiry is genuine',
      'Record the inquiry source and owner',
    ]) await page.getByRole('button', { name: new RegExp(task, 'i') }).click();
    await page.getByRole('button', { name: /Next Stage/i }).click();

    for (const task of [
      'Confirm partner type and service fit',
      'Understand partnership requirements',
      'Verify required organization details',
      'Record qualification notes',
      'Confirm the next steps with the partner',
    ]) await page.getByRole('button', { name: new RegExp(task, 'i') }).click();

    await page.getByPlaceholder(/Enter owner name/i).fill('Playwright Test Owner');
    await page.getByLabel(/Priority \*/i).selectOption('Medium');
    await page.getByLabel(/Partner Category \*/i).selectOption('Hospital');
    await page.getByLabel(/Partner is relevant and service fit is confirmed/i).check();
    await page.getByLabel(/Contact details are plausible and reviewed/i).check();
    await page.getByRole('button', { name: /Confirm Qualification/i }).click();
    await expect(page.getByText(/Qualified · Pipeline stage: Qualified/i)).toBeVisible();

    await page.getByRole('button', { name: /Next Stage/i }).click();
    await expect(page.getByText('Stage 3 of 5')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create MoU/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Consent/i })).toBeVisible();
  });

  test('Stage 3 Create MoU and Create Consent buttons open the existing modules', async ({ page }) => {
    await openMedicalLeads(page);
    const partner = await createPartnerInquiry(page);
    await page.getByRole('button', { name: new RegExp(`Open workflow for ${partner.company}`, 'i') }).click();

    // Advance through Stage 1 and Stage 2 with explicit checklist actions.
    for (const task of [
      'Review the partnership inquiry',
      'Verify contact and organization details',
      'Check for duplicate partner records',
      'Confirm the inquiry is genuine',
      'Record the inquiry source and owner',
    ]) await page.getByRole('button', { name: new RegExp(task, 'i') }).click();
    await page.getByRole('button', { name: /Next Stage/i }).click();
    for (const task of [
      'Confirm partner type and service fit',
      'Understand partnership requirements',
      'Verify required organization details',
      'Record qualification notes',
      'Confirm the next steps with the partner',
    ]) await page.getByRole('button', { name: new RegExp(task, 'i') }).click();
    await page.getByPlaceholder(/Enter owner name/i).fill('Playwright Test Owner');
    await page.getByLabel(/Priority \*/i).selectOption('Medium');
    await page.getByLabel(/Partner Category \*/i).selectOption('Hospital');
    await page.getByLabel(/Partner is relevant and service fit is confirmed/i).check();
    await page.getByLabel(/Contact details are plausible and reviewed/i).check();
    await page.getByRole('button', { name: /Confirm Qualification/i }).click();
    await page.getByRole('button', { name: /Next Stage/i }).click();

    await expect(page.getByRole('button', { name: /Create MoU/i })).toBeVisible();
    await page.getByRole('button', { name: /Create MoU/i }).click();
    await expect(page).toHaveURL(/#\/agreements$/);

    // Return to the CRM and re-open the same lead to test Consent.
    await page.goBack();
    await expect(page.getByRole('button', { name: new RegExp(`Open workflow for ${partner.company}`, 'i') })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: new RegExp(`Open workflow for ${partner.company}`, 'i') }).click();
    await expect(page.getByRole('button', { name: /Create Consent/i })).toBeVisible();
    await page.getByRole('button', { name: /Create Consent/i }).click();
    await expect(page).toHaveURL(/#\/consent$/);
  });

  test('Delete Lead asks for confirmation and moves the workflow to Stage 5', async ({ page }) => {
    await openMedicalLeads(page);
    const partner = await createPartnerInquiry(page);
    await page.getByRole('button', { name: new RegExp(`Open workflow for ${partner.company}`, 'i') }).click();

    page.once('dialog', async dialog => {
      expect(dialog.message()).toMatch(/Mark this partner as deleted/i);
      await dialog.accept();
    });
    await page.getByRole('button', { name: /Delete Lead/i }).click();

    await expect(page.getByText('Stage 5 of 5')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Dropped \/ Archived Medical Lead/i })).toBeVisible();
    await expect(page.getByText(/Marked deleted \(soft delete\)/i)).toBeVisible();
  });
});
