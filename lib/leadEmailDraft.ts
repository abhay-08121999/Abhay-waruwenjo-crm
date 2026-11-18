// Email templates used by Patient Leads. Each template has {{placeholders}} that are
// filled with the lead's details right before the email is sent from Patient Leads.

export type LeadEmailKind =
  | 'document_request'
  | 'vil_form'
  | 'personal_doctor_email'
  | 'clinical_doctor_email';

export interface LeadEmailTemplate {
  subject: string;
  title: string;
  subtitle: string;
  content: string;
}

export const LEAD_EMAIL_TEMPLATES: Record<LeadEmailKind, LeadEmailTemplate> = {
  document_request: {
    subject: 'Medical documents required for your enquiry',
    title: 'Medical Documents Required',
    subtitle: 'Please upload the documents for your medical review',
    content:
      '<p>Dear {{patient_name}},</p>' +
      '<p>Please upload the documents needed for your {{treatment_name}} review, including your passport and national ID.</p>' +
      '<ul>' +
      '<li>Passport – personal particulars page</li>' +
      '<li>National ID card (patient and companion)</li>' +
      '<li>Medical reports</li>' +
      '<li>Test results</li>' +
      '<li>X-rays</li>' +
      '<li>MRI / CT scans</li>' +
      '<li>Prescriptions</li>' +
      '<li>Previous treatment records</li>' +
      '<li>Other relevant medical documents</li>' +
      '</ul>' +
      '<p><a href="{{upload_link}}" style="display:inline-block;padding:12px 18px;background:#0d7a6e;color:#ffffff;border-radius:8px;text-decoration:none;">Upload medical documents</a></p>' +
      '<p>This secure link is associated with your enquiry. You may upload multiple files.</p>',
  },

  vil_form: {
    subject: 'Complete your VIL medical visa form',
    title: 'VIL Medical Visa Form',
    subtitle: 'Secure link to continue your medical visa application',
    content:
      '<p>Dear {{patient_name}},</p>' +
      '<p>To continue with your medical visa (VIL) application, please complete the form and upload your documents using the secure link below. It takes about 10 minutes.</p>' +
      '<p style="text-align:center;margin:26px 0;"><a href="{{vil_form_link}}" style="display:inline-block;background:#4338ca;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:14px 28px;border-radius:12px;">Complete the VIL Form</a></p>' +
      '<p><strong>Documents you will need</strong></p>' +
      '<ul>' +
      '<li>Recent colour photograph (2 in × 2 in, JPEG, 10 KB – 1 MB)</li>' +
      '<li>Medical invitation letter from the Indian hospital</li>' +
      '<li>Proof of residence</li>' +
      '<li>Proof of occupation</li>' +
      '<li>Polio and Yellow Fever vaccination certificate</li>' +
      '</ul>' +
      '<p><strong>Photo tip:</strong> Use a plain white or light background, face the camera directly, and do not crop your passport photo. Upload a separate photograph.</p>' +
      '<p>If the button does not work, copy and paste this link into your browser:<br/>{{vil_form_link}}</p>',
  },

  personal_doctor_email: {
    subject: 'Your personal medical assessment is in progress',
    title: 'Your Personal Medical Assessment',
    subtitle: 'A dedicated doctor is looking after your case',
    content:
      '<p>Dear {{patient_name}},</p>' +
      '<p>Thank you for trusting WaruWenJo with your care. <strong>{{doctor_name}}</strong> is personally reviewing the reports and information you shared, and will guide you through the next steps of your treatment journey.</p>' +
      '<p>Our team will contact you shortly with the assessment and recommendations. If you have new reports or any questions in the meantime, simply reply to this email and we will be happy to help.</p>',
  },

  clinical_doctor_email: {
    subject: 'Your clinical review and next steps',
    title: 'Your Clinical Review',
    subtitle: 'Next steps from our In-House Doctor',
    content:
      '<p>Dear {{patient_name}},</p>' +
      '<p>{{doctor_name}} has reviewed your medical information. We will share the recommended hospital, specialist, procedure, and next steps with you.</p>' +
      '<p>Please reply if you have any questions or additional information.</p>',
  },
};

/** Fills the {{placeholders}} of a template. Pass values that are already HTML-escaped. */
export const fillLeadEmailTemplate = (
  kind: LeadEmailKind,
  variables: Record<string, string>
): LeadEmailTemplate => {
  const fill = (text: string) =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => variables[key] ?? '');
  const template = LEAD_EMAIL_TEMPLATES[kind];
  return {
    subject: fill(template.subject),
    title: fill(template.title),
    subtitle: fill(template.subtitle),
    content: fill(template.content),
  };
};

export const LEAD_EMAIL_LOG_LABELS: Record<LeadEmailKind, string> = {
  document_request: 'Medical Document Request Email Sent',
  vil_form: 'VIL Form Email Sent',
  personal_doctor_email: 'Personal Doctor Email Sent',
  clinical_doctor_email: 'Clinical Doctor Email Sent',
};

/** Public site from the project README. Used for patient links when running on localhost. */
const DEFAULT_PUBLIC_SITE = 'https://admin.waruwenjo.com';

/**
 * Builds a link the patient opens from their own device.
 * - VITE_SITE_URL in .env overrides the public site (recommended: the deployed CRM address).
 * - When the CRM is running on localhost, the public site above is used instead, because a
 *   localhost link does not open on a patient's device.
 */
export const buildPatientLink = (hashRoute: string): { url: string; isLocal: boolean } => {
  // Same base as the quotation-choice email link (LeadQuotationPanel): the site this CRM is running on,
  // so the button opens the upload form from the build that sent the email instead of a different deployment.
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  const current = `${window.location.origin}${window.location.pathname}`;
  const base = (configured || current).replace(/\/+$/, '');
  return { url: `${base}/${hashRoute}`, isLocal: false };
};