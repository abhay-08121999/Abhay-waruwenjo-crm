// =============================================================
// WaruWenJo Master Email Template System
// =============================================================
// MASTER PLACEHOLDERS:
//   {{EMAIL_TITLE}}    – injected as the hero headline
//   {{EMAIL_SUBTITLE}} – injected as the hero sub-line
//   {{EMAIL_CONTENT}}  – injected as the main body content
//
// MERGE VARIABLES (replaced at send-time):
//   {{patient_name}}, {{doctor_name}}, {{hospital_name}},
//   {{appointment_date}}, {{case_id}}, {{invoice_number}},
//   {{treatment_name}}, {{recipient_name}}, {{contact_email}}
// =============================================================

import masterTemplateHtml from '../template5.html?raw';

// --------------- Merge Variable Definitions -----------------

export interface MergeVariable {
  key: string;
  label: string;
  example: string;
}

export const MERGE_VARIABLES: MergeVariable[] = [
  { key: 'patient_name',      label: 'Patient Name',      example: 'Ahmed Al-Rashid'   },
  { key: 'doctor_name',       label: 'Doctor Name',       example: 'Dr. Priya Sharma'  },
  { key: 'hospital_name',     label: 'Hospital Name',     example: 'Apollo Hospitals'  },
  { key: 'appointment_date',  label: 'Appointment Date',  example: '15 June 2026'      },
  { key: 'case_id',           label: 'Case ID',           example: 'WW-2026-0042'      },
  { key: 'invoice_number',    label: 'Invoice Number',    example: 'INV-2026-001'      },
  { key: 'treatment_name',    label: 'Treatment Name',    example: 'Cardiac Bypass'    },
  { key: 'recipient_name',    label: 'Recipient Name',    example: 'John Doe'          },
  { key: 'contact_email',     label: 'Contact Email',     example: 'john@example.com'  },
];

/**
 * Replace all {{key}} placeholders in a template string.
 * Unresolved placeholders are left as-is.
 */
export const applyMergeVariables = (
  template: string,
  vars: Record<string, string>
): string => {
  let result = template;
  Object.entries(vars).forEach(([key, value]) => {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(pattern, value ?? `{{${key}}}`);
  });
  return result;
};

// --------------- Full Template (with hero + content) ---------

export interface EmailTemplateFullParams {
  emailTitle?: string;
  emailSubtitle?: string;
  emailContent?: string;
  masterTemplate?: string;
}

/**
 * Build a complete branded WaruWenJo HTML email.
 *
 * Layout:
 *   Loads masterTemplate (falls back to local template5.html)
 *   Injects {{EMAIL_TITLE}}, {{EMAIL_SUBTITLE}}, {{EMAIL_CONTENT}}
 */
export const buildWaruWenJoEmailFull = ({
  emailTitle    = 'WaruWenJo Healthcare',
  emailSubtitle = 'Your trusted medical tourism partner.',
  emailContent  = '',
  masterTemplate,
}: EmailTemplateFullParams): string => {
  const template = masterTemplate || masterTemplateHtml;
  const result = template
    .replace(/\{\{\s*EMAIL_TITLE\s*\}\}/g, emailTitle)
    .replace(/\{\{\s*EMAIL_SUBTITLE\s*\}\}/g, emailSubtitle)
    .replace(/\{\{\s*EMAIL_CONTENT\s*\}\}/g, emailContent);

  // Clean up any leftover placeholders if values were empty/undefined
  return cleanupMasterPlaceholders(result);
};

// Ensure leftover placeholders are removed when empty or undefined
const cleanupMasterPlaceholders = (html: string) =>
  html
    .replace(/\{\{\s*EMAIL_TITLE\s*\}\}/g, '')
    .replace(/\{\{\s*EMAIL_SUBTITLE\s*\}\}/g, '')
    .replace(/\{\{\s*EMAIL_CONTENT\s*\}\}/g, '');

// (No additional wrapper needed; `buildWaruWenJoEmailFull` already cleans up.)

// --------------- Backwards-Compatible Function ---------------

/**
 * @deprecated Use buildWaruWenJoEmailFull for proper title/subtitle support.
 * Kept for backwards compatibility with any existing callers.
 */
export const buildWaruWenJoEmail = (bodyContent: string): string =>
  buildWaruWenJoEmailFull({
    emailTitle:    'WaruWenJo Healthcare Update',
    emailSubtitle: 'A message from the WaruWenJo Clinical Team',
    emailContent:  bodyContent,
  });
