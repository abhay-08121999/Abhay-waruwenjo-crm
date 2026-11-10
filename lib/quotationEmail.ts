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