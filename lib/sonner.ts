// Shared helpers for emailing quotation PDFs to patients through the /api/send-email route.

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const buildQuotationEmailHtml = (patientName: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Quotation from WaruWenJo</title>
</head>
<body style="margin:0; padding:0; background:#f0f4f8; font-family:'Segoe UI', Arial, sans-serif; color:#1a2332;">
  <div style="max-width:600px; margin:40px auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 4px 40px rgba(0,0,0,0.10);">
    <div style="background:linear-gradient(135deg,#0d7a6e 0%,#14b8a6 100%); padding:40px; text-align:center;">
      <h1 style="margin:0; color:#fff; font-size:24px;">WaruWenJo</h1>
      <p style="margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px;">Premier Medical Tourism &amp; Value Travel in India</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="font-size:20px; font-weight:700; color:#0d7a6e; margin:0 0 12px;">Hello, ${escapeHtml(patientName)}</p>
      <p style="font-size:14px; line-height:1.7; color:#475569; margin:0 0 24px;">
        Thank you for your interest in WaruWenJo. Please find your <strong>quotation</strong> attached as a PDF.
        Our Case Manager is available to answer any questions and to guide you through the next steps.
      </p>
      <p style="font-size:14px; line-height:1.7; color:#475569; margin:0;">
        If you have any questions about this quotation, simply reply to this email or write to
        <strong>support@waruwenjo.com</strong>.
      </p>
    </div>
    <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:24px 40px; text-align:center;">
      <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.7;">
        <strong>WaruWenJo Medical Tourism</strong><br/>
        support@waruwenjo.com &nbsp;|&nbsp; waruwenjo.com
      </p>
    </div>
  </div>
</body>
</html>`;

export const sendQuotationEmail = async (params: {
  toEmail: string;
  toName: string;
  pdfBase64: string;
}) => {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to_email: params.toEmail,
      to_name: params.toName,
      custom_subject: 'Your Medical Tourism Quotation from WaruWenJo',
      custom_html: buildQuotationEmailHtml(params.toName),
      pdf_base64: params.pdfBase64,
      pdf_filename: 'WaruWenJo_Quotation.pdf',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Email could not be sent');
  }
};

// ─── Quotation OPTIONS email: patient picks one quotation via a secure link ───
export type QuotationChoiceOption = {
  id: string;
  label: string;
  total: number;
  currency: string;
  pdfUrl: string;
};

export const buildQuotationChoiceEmailHtml = (params: {
  patientName: string;
  options: QuotationChoiceOption[];
  /** e.g. https://crm.example.com/#/quotation-choice/<token> */
  choiceBaseUrl: string;
}) => {
  const cards = params.options
    .map(
      (o) => `
        <div style="border:1.5px solid #e2e8f0;border-radius:14px;padding:18px 20px;margin:0 0 14px;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(o.label)}</p>
          <p style="margin:0 0 14px;font-size:14px;color:#475569;">
            Total: <strong>${escapeHtml(o.currency)} ${Number(o.total || 0).toLocaleString('en-US')}</strong>
          </p>
          <a href="${escapeHtml(o.pdfUrl)}" target="_blank" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border:1.5px solid #0d7a6e;color:#0d7a6e;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">View PDF</a>
          <a href="${escapeHtml(`${params.choiceBaseUrl}?choose=${encodeURIComponent(o.id)}`)}" style="display:inline-block;margin:0 0 8px 0;padding:10px 16px;background:#0d7a6e;color:#ffffff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700;">Choose this quotation</a>
        </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Choose your quotation - WaruWenJo</title>
</head>
<body style="margin:0; padding:0; background:#f0f4f8; font-family:'Segoe UI', Arial, sans-serif; color:#1a2332;">
  <div style="max-width:600px; margin:40px auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 4px 40px rgba(0,0,0,0.10);">
    <div style="background:linear-gradient(135deg,#0d7a6e 0%,#14b8a6 100%); padding:40px; text-align:center;">
      <h1 style="margin:0; color:#fff; font-size:24px;">WaruWenJo</h1>
      <p style="margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px;">Premier Medical Tourism &amp; Value Travel in India</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="font-size:20px; font-weight:700; color:#0d7a6e; margin:0 0 12px;">Hello, ${escapeHtml(params.patientName)}</p>
      <p style="font-size:14px; line-height:1.7; color:#475569; margin:0 0 24px;">
        We have prepared <strong>${params.options.length} quotation${params.options.length > 1 ? 's' : ''}</strong> for you.
        Please review each one and <strong>choose the quotation you would like to proceed with</strong>.
        Your choice is recorded instantly and our team will follow up with you.
      </p>
      ${cards}
      <p style="font-size:13px; line-height:1.7; color:#64748b; margin:24px 0 0;">
        If the buttons do not work, copy and paste this link into your browser:<br/>
        <span style="word-break:break-all;">${escapeHtml(params.choiceBaseUrl)}</span>
      </p>
      <p style="font-size:14px; line-height:1.7; color:#475569; margin:24px 0 0;">
        Questions about any quotation? Reply to this email or write to <strong>support@waruwenjo.com</strong>.
      </p>
    </div>
    <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:24px 40px; text-align:center;">
      <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.7;">
        <strong>WaruWenJo Medical Tourism</strong><br/>
        support@waruwenjo.com &nbsp;|&nbsp; waruwenjo.com
      </p>
    </div>
  </div>
</body>
</html>`;
};