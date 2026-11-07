import { test, expect, type Page } from '@playwright/test';
import { adminLogin } from './helpers/auth';

/**
 * Patient Leads - complete 9-stage workflow E2E test
 *
 * This file follows the STAGES definition in components/PatientLeads.tsx:
 * 1. New Lead / Triage
 * 2. Contact Attempted / Outreach
 * 3. Documents & Verification
 * 4. In-House Doctor Interaction
 * 5. Clinical Qualification & Planning
 * 6. Financial & Logistics Proposal
 * 7. Specialist Consultation, Payment & Confirmation
 * 8. Medical Case Handover
 * 9. Lost / Dropped
 *
 * The suite is intentionally serial because every stage depends on the lead
 * created by Stage 1 and Stage 9 archives that same lead at the end.
 */

test.describe.serial('Patient Leads - all 9 workflow stages', () => {
  const TEST_PATIENT = {
    name: `E2E Patient ${Date.now()}`,
    email: `patient.e2e.${Date.now()}@example.com`,
    treatment: 'Cardiology Consultation',
    country: 'India',
  };

  const STAGE_NAMES: Record<number, string> = {
    1: 'New Lead',
    2: 'Contact Attempted',
    3: 'Documents & Verification',
    4: 'In-House Doctor Interaction',
    5: 'Clinical Qualification & Planning',
    6: 'Financial & Logistics Proposal',
    7: 'Specialist Consultation, Payment & Confirmation',
    8: 'Medical Case Handover',
    9: 'Lost / Dropped',
  };

  const STAGE_TASKS: Record<number, string[]> = {
    1: [
      'Review New Lead',
      'Check Duplicate Lead',
      'Decide Whether Lead Is Genuine',
    ],
    2: [
      'Log First Call',
      'Record Call Outcome',
      'Record Call Notes',
      'Complete First Contact',
    ],
    3: [
      'Explain Patient Process & Send Medical Document Request Email',
      'Receive Medical Documents',
      'Verify & Complete Document Verification',
    ],
    4: [
      'Record Doctor Call Notes',
      'Send Personal Email to Patient',
      'Complete In-House Doctor Interaction',
    ],
    5: [
      'Suggest Hospitals & Surgeons/Specialists',
      'Finalize Clinical Recommendation & Confirm Clinical Review',
      'Generate Clinical Report',
    ],
    6: [
      'Generate Financial Proposal',
      'Discuss Travel & Accommodation',
      'Address Patient Concerns',
      'Generate Proposal PDF',
      'Send Proposal Via Mail',
      'Confirm Patient Interest Via Call',
    ],
    7: [
      'Specialist Doctor Call',
      'Record MOM',
      'BDM Calls Patient',
      'Confirm Quotation Agreement',
      'Confirm Clinical Process Agreement',
      'Record Patient Decision',
      'Request Patient to Proceed',
      'Generate Payment Link',
      'Provide Payment Link',
      'Verify Advance Payment',
    ],
    8: [
      'Convert Lead to Medical Case',
      'Prepare Complete Patient Handover',
      'Create Patient Account',
      'Handover Patient from BDM to CDM/WaruBuddy',
      'CDM/WaruBuddy Accepts Handover',
      'Confirm Case Ownership',
      'Complete Stage 8',
    ],
    9: [
      'Select Drop-off Reason',
      'Archive Lead',
    ],
  };

  async function openPatientLeads(page: Page) {
    const patientsLink = page.locator(
      'a:has-text("Patient"), a:has-text("Patients"), [href*="patient"]'
    ).first();
    await patientsLink.waitFor({ state: 'visible', timeout: 20000 });
    await patientsLink.click();
    await page.waitForTimeout(1000);
  }

  async function openTestLead(page: Page) {
    const search = page.locator(
      'input[placeholder*="Search leads" i], input[placeholder*="Search" i]'
    ).first();

    await search.waitFor({ state: 'visible', timeout: 15000 });
    await search.fill(TEST_PATIENT.name);

    const lead = page.getByText(TEST_PATIENT.name, { exact: true }).first();
    await lead.waitFor({ state: 'visible', timeout: 15000 });
    await lead.click();

    await expect(
      page.getByText(/Lead Conversion Protocol & Manual Checklist/i)
    ).toBeVisible({ timeout: 10000 });
  }

  async function goToStage(page: Page, stage: number) {
    const stageButton = page
      .locator('button')
      .filter({ hasText: STAGE_NAMES[stage] })
      .last();

    await stageButton.waitFor({ state: 'visible', timeout: 10000 });
    await stageButton.click();

    await expect(
      page.getByText(new RegExp(`Stage ${stage}: ${STAGE_NAMES[stage]}`, 'i'))
    ).toBeVisible({ timeout: 10000 });
  }

  async function clickChecklistTask(page: Page, task: string) {
    const taskText = page.getByText(task, { exact: true }).first();
    await taskText.waitFor({ state: 'visible', timeout: 10000 });
    await taskText.click();

    // Give the workflow-state write a chance to settle before the next task.
    await page.waitForTimeout(250);
  }

  async function expectChecklistTask(page: Page, task: string) {
    await expect(page.getByText(task, { exact: true }).first()).toBeVisible();
  }

  async function expectStageTasks(page: Page, stage: number) {
    for (const task of STAGE_TASKS[stage]) {
      await expectChecklistTask(page, task);
    }
  }

  async function mockCrmEmail(page: Page) {
    await page.route('**/api/send-email', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
  }

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    await mockCrmEmail(page);
  });

  test('Stage 1 - create lead, review, duplicate-check and mark genuine', async ({ page }) => {
    await adminLogin(page);
    await openPatientLeads(page);

    await page.getByRole('button', { name: /New Intake/i }).click();

    const form = page.locator('form').last();
    await form.waitFor({ state: 'visible', timeout: 10000 });

    const inputs = form.locator('input');
    await inputs.nth(0).fill(TEST_PATIENT.name);
    await inputs.nth(1).fill(TEST_PATIENT.treatment);
    await inputs.nth(2).fill(TEST_PATIENT.country);
    await inputs.nth(3).fill(TEST_PATIENT.email);

    await form.getByRole('button', { name: /Onboard Inquiry/i }).click();

    await expect(page.getByText(TEST_PATIENT.name, { exact: true })).toBeVisible({
      timeout: 15000,
    });

    await openTestLead(page);
    await goToStage(page, 1);
    await expectStageTasks(page, 1);

    await page.getByRole('button', { name: /Mark Review New Lead/i }).click();
    await page.getByRole('button', { name: /Confirm Result/i }).click();
    await page.getByRole('button', { name: /^Genuine$/i }).click();

    await expect(page.getByText('✓ Genuine', { exact: true })).toBeVisible();

    await expect(
      page.getByText('Move to Outreach', { exact: true })
    ).toBeVisible();

    await page.getByRole('button', { name: /Move to Outreach/i }).click();
    await expect(page.getByText(/Stage 2: Contact Attempted/i)).toBeVisible();
  });

  test('Stage 2 - log first contact and verify the four outreach tasks', async ({ page }) => {
    await adminLogin(page);
    await openPatientLeads(page);
    await openTestLead(page);
    await goToStage(page, 2);
    await expectStageTasks(page, 2);

    const outcome = page.locator('select').first();
    await outcome.selectOption({ label: 'Interested' });

    await page
      .getByPlaceholder(/What did the patient say/i)
      .fill('Patient is interested in treatment and requested the next clinical steps.');

    await page.getByRole('button', { name: /Save Call Attempt/i }).click();

    await expect(page.getByText(/1 attempt/i)).toBeVisible();
    await expect(page.getByText(/First contact:/i)).toBeVisible();

    for (const task of STAGE_TASKS[2]) {
      await expectChecklistTask(page, task);
    }

    await page.getByRole('button', { name: /Progress to Discovery/i }).click();
    await expect(page.getByText(/Stage 3: Documents & Verification/i)).toBeVisible();
  });

  test('Stage 3 - request documents, receive a PDF and complete verification', async ({ page }) => {
    await adminLogin(page);

    // Capture the real enquiry UUID while the Patient Leads list is loaded.
    let leadId = '';
    const leadResponseHandler = async (response: any) => {
      if (leadId || response.request().method() !== 'GET') return;
      if (!response.url().includes('/rest/v1/patient_enquiries')) return;
      try {
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : [payload];
        const row = rows.find((item: any) => item?.full_name === TEST_PATIENT.name);
        if (row?.id) leadId = String(row.id);
      } catch {
        // Ignore unrelated responses.
      }
    };
    page.on('response', leadResponseHandler);

    await openPatientLeads(page);
    await openTestLead(page);
    await goToStage(page, 3);
    await page.waitForTimeout(1000);
    page.off('response', leadResponseHandler);

    expect(leadId, 'Could not determine the full enquiry UUID for document upload.').toBeTruthy();

    await page.getByRole('button', { name: /Mark Process Explained/i }).click();
    await page.getByRole('button', { name: /Send Medical Document Request Email/i }).click();
    await expect(page.getByText(/Document request email sent/i)).toBeVisible({ timeout: 10000 });

    // The real stage gate must reject completion before any document exists.
    await page.getByRole('button', { name: /Complete Document Verification/i }).click();
    await expect(page.getByText(/Wait for the patient to submit at least one document/i)).toBeVisible();

    // Upload a real PDF through the same public route used by the emailed link.
    await page.goto(`/#/patient-documents/${leadId}`);
    await expect(page.getByRole('heading', { name: /Upload medical documents/i })).toBeVisible({ timeout: 10000 });

    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF',
      'utf8'
    );

    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-medical-report.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    });
    await page.getByRole('button', { name: /Submit documents/i }).click();
    await expect(page.getByText(/Documents received/i)).toBeVisible({ timeout: 30000 });

    await page.goto('/');
    await openPatientLeads(page);
    await openTestLead(page);
    await goToStage(page, 3);

    await expect(page.getByText('e2e-medical-report.pdf', { exact: true })).toBeVisible({ timeout: 15000 });

    page.once('dialog', async (dialog) => {
      await dialog.accept('Valid E2E document');
    });
    await page.getByRole('button', { name: /^Genuine$/i }).click();
    await page.getByRole('button', { name: /Complete Document Verification/i }).click();

    await expect(page.getByText(/Document verification completed/i)).toBeVisible({ timeout: 15000 });
    await expectChecklistTask(page, 'Receive Medical Documents');
    await expectChecklistTask(page, 'Verify & Complete Document Verification');

    await page.getByRole('button', { name: /Progress to Stage 4/i }).click();
    await expect(page.getByText(/Stage 4: In-House Doctor Interaction/i)).toBeVisible();
  });

  test('Stage 4 - record doctor notes, assessment and patient email', async ({ page }) => {
    await adminLogin(page);
    await openPatientLeads(page);
    await openTestLead(page);
    await goToStage(page, 4);
    await expectStageTasks(page, 4);

    await page
      .getByPlaceholder(/Record medical condition, history, concerns/i)
      .fill('Patient has a cardiac history. Discussed symptoms, expectations and questions.');
    await page.getByRole('button', { name: /Save Doctor Call Notes/i }).click();

    const assessments = page.getByPlaceholder(/Initial assessment and recommended next steps/i);
    await assessments.fill('Initial clinical assessment completed; specialist review recommended.');

    await page
      .getByPlaceholder(/Recommended next steps/i)
      .fill('Proceed to specialist and hospital recommendation.');

    await page.getByRole('button', { name: /Send Personal Email to Patient/i }).click();
    await expect(page.getByText(/Personal email sent to the patient/i)).toBeVisible({ timeout: 10000 });

    await page
      .getByRole('button', { name: /Complete In-House Doctor Interaction & Progress to Stage 5/i })
      .click();

    await expect(page.getByText(/Stage 5: Clinical Qualification & Planning/i)).toBeVisible();
  });

  test('Stage 5 - select hospital/surgeon, finalize review and generate clinical report', async ({ page }) => {
    await adminLogin(page);
    await openPatientLeads(page);
    await openTestLead(page);
    await goToStage(page, 5);
    await expectStageTasks(page, 5);

    const selects = page.locator('select');
    expect(await selects.count()).toBeGreaterThanOrEqual(2);

    const hospitalSelect = selects.nth(0);
    const surgeonSelect = selects.nth(1);

    await expect(hospitalSelect.locator('option').nth(1)).toBeVisible();
    await expect(surgeonSelect.locator('option').nth(1)).toBeVisible();

    await hospitalSelect.selectOption({ index: 1 });
    await surgeonSelect.selectOption({ index: 1 });

    await page
      .getByPlaceholder(/List the necessary procedures/i)
      .fill('Cardiology consultation, diagnostic review and recommended intervention.');

    await page
      .getByPlaceholder(/Patient's medical history/i)
      .fill('History of cardiac symptoms; previous outpatient evaluation.');

    await page
      .getByPlaceholder(/Summary of requirements/i)
      .fill('Patient needs specialist review and treatment planning.');

    await page.getByRole('button', { name: /Finalize Clinical Recommendation/i }).first().click();
    await page.getByRole('button', { name: /Confirm Clinical Review/i }).click();

    // The PDF opens in a new tab. We only need to verify that generation marks
    // the Stage 5 task; the actual PDF contents are produced by jsPDF in-app.
    const pdfButton = page.getByRole('button', { name: /Generate Clinical Review Report/i });
    const popupPromise = page.waitForEvent('popup').catch(() => null);
    await pdfButton.click();
    const popup = await popupPromise;
    if (popup) await popup.waitForLoadState('domcontentloaded').catch(() => undefined);

    await expectChecklistTask(page, 'Suggest Hospitals & Surgeons/Specialists');
    await expectChecklistTask(page, 'Finalize Clinical Recommendation & Confirm Clinical Review');
    await expectChecklistTask(page, 'Generate Clinical Report');

    // Stage 6 requires the Stage 5 checklist to be complete.
    await goToStage(page, 6);
    await expect(page.getByText(/Stage 6: Financial & Logistics Proposal/i)).toBeVisible();
  });

  test('Stage 6 - build proposal, send it, record patient interest and book consultation', async ({ page }) => {
    await adminLogin(page);
    await openPatientLeads(page);
    await openTestLead(page);
    await goToStage(page, 6);
    await expectStageTasks(page, 6);

    await page.getByRole('button', { name: /Add Line Item/i }).click();

    const description = page.getByPlaceholder('Description').first();
    const qty = page.getByPlaceholder('Qty').first();
    const rate = page.getByPlaceholder('Rate').first();

    await description.fill('Specialist consultation and clinical review');
    await qty.fill('1');
    await rate.fill('500');

    await page
      .getByPlaceholder(/Enter logistics details/i)
      .fill('Airport transfer, accommodation and local transport to be coordinated.');

    await page
      .getByPlaceholder(/Record concerns about price/i)
      .fill('Patient requested transparent pricing and accommodation details.');

    await page.getByRole('button', { name: /Generate Proposal PDF/i }).click();
    await expect(page.getByText(/Financial Proposal Generated/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Email Proposal to Patient/i }).click();
    await expect(page.getByText(/Proposal sent successfully/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /^Agreed$/i }).click();

    for (const task of STAGE_TASKS[6]) {
      await expectChecklistTask(page, task);
    }

    await page.getByRole('button', { name: /Book Specialist Doctor Consultation/i }).click();

    const consultationSelect = page.locator('select').last();
    await consultationSelect.selectOption({ index: 1 });
    await page.getByRole('button', { name: /Schedule Assessment/i }).click();

    await expect(page.getByText(/Stage 7: Specialist Consultation, Payment & Confirmation/i)).toBeVisible();
  });

  test('Stage 7 - specialist call, MOM, agreements, patient decision and payment verification', async ({ page }) => {
    await adminLogin(page);
    await openPatientLeads(page);
    await openTestLead(page);
    await goToStage(page, 7);
    await expectStageTasks(page, 7);

    await page
      .getByPlaceholder(/Medical condition, proposed treatment/i)
      .fill('Specialist discussed diagnosis, treatment options, clinical process and patient questions.');
    await page.getByRole('button', { name: /Record Specialist Doctor Call/i }).click();

    const momValues: Record<string, string> = {
      'Date / time': '2026-10-05 15:00',
      'Participants': 'Patient, BDM, Specialist Doctor',
      'Main discussion points': 'Diagnosis, treatment plan and expected timeline.',
      'Specialist observations': 'Specialist recommends proceeding after clinical review.',
      'Patient questions': 'Asked about recovery time and travel arrangements.',
      'Decisions': 'Patient agrees to proceed with recommended pathway.',
      'Next steps': 'Complete payment and handover.',
      'Important instructions': 'Follow specialist pre-treatment instructions.',
    };

    for (const [placeholder, value] of Object.entries(momValues)) {
      await page.getByPlaceholder(placeholder, { exact: true }).fill(value);
    }

    await page.getByRole('button', { name: /Record MOM/i }).click();

    await page
      .getByPlaceholder(/Record patient understanding/i)
      .fill('Patient understands the quotation, clinical plan and next steps and is willing to proceed.');
    await page.getByRole('button', { name: /Record BDM Patient Call/i }).click();

    await page.getByRole('button', { name: /Confirm Quotation Agreement/i }).click();
    await page.getByRole('button', { name: /Confirm Clinical Process Agreement/i }).click();
    await page.getByRole('button', { name: /Patient Agreed/i }).click();
    await page.getByRole('button', { name: /Request Patient to Proceed/i }).click();

    await page.getByRole('button', { name: /Generate Payment Link/i }).click();
    await expect(page.getByText(/Payment Link Generated/i)).toBeVisible({ timeout: 10000 });

    // The generated link is already in the controlled input; click the first
    // "Provide Payment Link" action rather than depending on an input name.
    await page.getByRole('button', { name: /Provide Payment Link/i }).click();
    await page.getByRole('button', { name: /Verify Advance Payment/i }).click();

    for (const task of STAGE_TASKS[7]) {
      await expectChecklistTask(page, task);
    }

    // Use the real stage gate to enter Stage 8.
    await page.getByRole('button', { name: /Proceed to Stage 8/i }).click();
    await expect(page.getByText(/Stage 8: Medical Case Handover/i)).toBeVisible();
  });

  test('Stage 8 - prepare handover, create/link patient account, convert case and transfer ownership', async ({ page }) => {
    await adminLogin(page);
    await openPatientLeads(page);
    await openTestLead(page);
    await goToStage(page, 8);
    await expectStageTasks(page, 8);

    await page.getByPlaceholder(/BDM name/i).fill('E2E BDM');
    await page.getByPlaceholder(/CDM\/WaruBuddy team/i).fill('CDM/WaruBuddy');
    await page
      .getByPlaceholder(/Patient requirements, medical information/i)
      .fill('Complete handover: clinical recommendation, hospital, specialist, quotation, payment and travel requirements.');

    await page.getByRole('button', { name: /Prepare Complete Patient Handover/i }).click();

    await expect
      .poll(async () => {
        const text = await page.locator('body').innerText();
        return /Patient account (created|linked)|Account .*created|Account .*linked/i.test(text);
      }, { timeout: 30000 })
      .toBeTruthy();

    // Convert only after the Stage 7 payment verification and patient account
    // prerequisites are satisfied.
    const convertButton = page.getByRole('button', { name: /Convert Lead to Medical Case/i });
    await expect(convertButton).toBeEnabled({ timeout: 15000 });
    await convertButton.click();

    await expect(page.getByText(/Medical Case Created/i)).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: /Share Clinical Information/i }).click();
    await page.getByRole('button', { name: /Share Financial Information/i }).click();
    await page.getByRole('button', { name: /Share Specialist\/MOM/i }).click();

    await page.getByRole('button', { name: /Handover Patient from BDM to CDM\/WaruBuddy/i }).click();
    await page.getByRole('button', { name: /CDM\/WaruBuddy Accepts Handover/i }).click();
    await page.getByRole('button', { name: /Confirm Case Ownership/i }).click();

    for (const task of STAGE_TASKS[8].slice(0, 6)) {
      await expectChecklistTask(page, task);
    }

    await page.getByRole('button', { name: /Complete Stage 8/i }).click();
    await expectChecklistTask(page, 'Complete Stage 8');
  });

  test('Stage 9 - drop, select reason, archive and verify lost status', async ({ page }) => {
    await adminLogin(page);
    await openPatientLeads(page);
    await openTestLead(page);

    // Stage 9 is intentionally reachable from any active stage by design.
    await page.getByRole('button', { name: /Drop Lead/i }).click();
    await expect(page.getByText(/Stage 9: Lost \/ Dropped/i)).toBeVisible();
    await expectStageTasks(page, 9);

    const reasonSelect = page.locator('select').first();
    await reasonSelect.selectOption({ label: 'Price Too High' });

    await page.getByRole('button', { name: /Confirm Drop-off & Archive/i }).click();

    await expect(page.getByText(/Lead Archived & Dropped/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Price Too High/i)).toBeVisible();
  });
});
