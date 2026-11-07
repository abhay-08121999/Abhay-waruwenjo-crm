// ================================================================
// Supabase Edge Function: send-welcome-email
// ================================================================
// Sends a welcome email to the patient with their enquiry
// details as a PDF attachment, using SMTP via Nodemailer-style
// SMTP (denomailer for Deno).
//
// Triggered from PatientLeads.tsx Stage 2 "Send Welcome Email" button.
// ================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// SMTP config — loaded from Supabase Edge Function Secrets
const SMTP_HOST     = Deno.env.get("SMTP_HOST")     ?? "mail.waruwenjo.com";
const SMTP_PORT     = parseInt(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER     = Deno.env.get("SMTP_USER")     ?? "support@waruwenjo.com";
const SMTP_PASS     = Deno.env.get("SMTP_PASS")     ?? "Support@WaruWenJo.";
const FROM_NAME     = "WaruWenJo Medical Tourism";
const FROM_EMAIL    = "support@waruwenjo.com";

const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Treatment slug → label ───────────────────────────────────────────────────
const TREATMENT_LABELS: Record<string, string> = {
  cardiac_surgery      : "Cardiac Surgery",
  orthopedic_surgery   : "Orthopedic Surgery",
  cancer_treatment     : "Cancer Treatment",
  fertility_treatment  : "Fertility Treatment",
  neurology            : "Neurology",
  cosmetic_surgery     : "Cosmetic Surgery",
  kidney_transplant    : "Kidney Transplant",
  liver_transplant     : "Liver Transplant",
  spine_surgery        : "Spine Surgery",
  dental_treatment     : "Dental Treatment",
  eye_surgery          : "Eye Surgery",
  bariatric_surgery    : "Bariatric Surgery",
  general_consultation : "General Consultation",
};

function treatmentLabel(slug?: string): string {
  if (!slug) return "General Consultation";
  return TREATMENT_LABELS[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Build the HTML email body ────────────────────────────────────────────────
function buildEmailHtml(lead: any): string {
  const treatment   = treatmentLabel(lead.treatment_interest);
  const refId       = (lead.id ?? "").slice(0, 8).toUpperCase() || "PENDING";
  const dateLabel   = lead.preferred_date
    ? new Date(lead.preferred_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : "Flexible";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to WaruWenJo</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#f0f4f8; color:#1a2332; }
    .wrapper { max-width:600px; margin:40px auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 4px 40px rgba(0,0,0,0.10); }
    .header { background:linear-gradient(135deg, #0d7a6e 0%, #14b8a6 100%); padding:48px 40px; text-align:center; }
    .header img { width:56px; height:56px; margin-bottom:16px; }
    .header h1 { color:#fff; font-size:26px; font-weight:800; letter-spacing:-0.5px; }
    .header p  { color:rgba(255,255,255,0.85); margin-top:8px; font-size:14px; }
    .badge { display:inline-block; background:rgba(255,255,255,0.2); color:#fff; font-size:11px; font-weight:700; padding:6px 16px; border-radius:99px; margin-top:16px; letter-spacing:1px; text-transform:uppercase; }
    .body { padding:40px; }
    .greeting { font-size:20px; font-weight:700; color:#0d7a6e; margin-bottom:12px; }
    .intro { font-size:14px; line-height:1.7; color:#475569; margin-bottom:32px; }
    .card { background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:16px; padding:28px; margin-bottom:28px; }
    .card-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; color:#94a3b8; margin-bottom:16px; }
    .row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #e2e8f0; }
    .row:last-child { border-bottom:none; }
    .label { font-size:12px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; }
    .value { font-size:13px; font-weight:700; color:#1e293b; text-align:right; max-width:60%; }
    .ref-box { background:linear-gradient(135deg,#0d7a6e,#14b8a6); border-radius:12px; padding:18px 24px; text-align:center; margin-bottom:28px; }
    .ref-label { font-size:10px; color:rgba(255,255,255,0.8); text-transform:uppercase; letter-spacing:1.5px; font-weight:700; }
    .ref-value { font-size:28px; font-weight:900; color:#fff; letter-spacing:4px; margin-top:4px; font-family:monospace; }
    .next-steps { margin-bottom:28px; }
    .step { display:flex; gap:14px; margin-bottom:16px; align-items:flex-start; }
    .step-num { width:28px; height:28px; min-width:28px; background:#0d7a6e; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; }
    .step-text { font-size:13px; color:#475569; line-height:1.5; }
    .step-text strong { color:#1e293b; }
    .cta { text-align:center; margin-bottom:32px; }
    .cta a { display:inline-block; background:linear-gradient(135deg,#0d7a6e,#14b8a6); color:#fff; text-decoration:none; font-size:13px; font-weight:800; padding:14px 36px; border-radius:99px; letter-spacing:0.5px; }
    .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:28px 40px; text-align:center; }
    .footer p { font-size:12px; color:#94a3b8; line-height:1.7; }
    .footer a { color:#0d7a6e; text-decoration:none; font-weight:600; }
    .social { margin-top:12px; }
  </style>
</head>
<body>
<div class="wrapper">
  <!-- Header -->
  <div class="header">
    <h1>🏥 WaruWenJo</h1>
    <p>Premier Medical Tourism &amp; Value Travel in India</p>
    <span class="badge">✅ Enquiry Confirmed</span>
  </div>

  <!-- Body -->
  <div class="body">
    <p class="greeting">Hello, ${lead.full_name}! 👋</p>
    <p class="intro">
      Thank you for registering with <strong>WaruWenJo Medical Tourism</strong>. 
      We have successfully received your medical enquiry and our dedicated Case Manager 
      will reach out to you within <strong>24 hours</strong> to guide you through the next steps.
      <br/><br/>
      Please find your <strong>enquiry summary</strong> below and attached as a PDF for your records.
    </p>

    <!-- Reference ID -->
    <div class="ref-box">
      <div class="ref-label">Your Enquiry Reference ID</div>
      <div class="ref-value">${refId}</div>
    </div>

    <!-- Enquiry Details -->
    <div class="card">
      <div class="card-title">📋 Your Enquiry Details</div>
      <div class="row"><span class="label">Full Name</span><span class="value">${lead.full_name}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${lead.email}</span></div>
      <div class="row"><span class="label">Phone</span><span class="value">${lead.phone ?? "Not provided"}</span></div>
      <div class="row"><span class="label">Country</span><span class="value">${lead.country ?? "Not specified"}</span></div>
      <div class="row"><span class="label">Treatment</span><span class="value">${treatment}</span></div>
      <div class="row"><span class="label">Preferred Date</span><span class="value">${dateLabel}</span></div>
      <div class="row"><span class="label">Priority</span><span class="value">${lead.urgency ?? "Standard"}</span></div>
      ${lead.message ? `<div class="row"><span class="label">Notes</span><span class="value">${lead.message}</span></div>` : ""}
    </div>

    <!-- Next Steps -->
    <div class="next-steps">
      <div class="card-title" style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:16px;">🚀 What Happens Next</div>
      <div class="step"><div class="step-num">1</div><div class="step-text"><strong>Case Review (Within 24 hrs)</strong> — Our in-house medical team reviews your requirements.</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text"><strong>Doctor Matching</strong> — We connect you with the best specialist for your condition.</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text"><strong>Free Video Consultation</strong> — Speak directly with your matched doctor.</div></div>
      <div class="step"><div class="step-num">4</div><div class="step-text"><strong>Treatment Plan &amp; Travel</strong> — We handle everything from flights to hospital admission.</div></div>
    </div>

    <!-- CTA -->
    <div class="cta">
      <a href="https://waruwenjo.com">Visit Our Website →</a>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>
      <strong>WaruWenJo Medical Tourism</strong><br/>
      📧 <a href="mailto:support@waruwenjo.com">support@waruwenjo.com</a> &nbsp;|&nbsp;
      🌐 <a href="https://waruwenjo.com">waruwenjo.com</a>
    </p>
    <p style="margin-top:8px;font-size:11px;">
      This email was sent because you submitted a medical enquiry on waruwenjo.com.<br/>
      Please keep this email for your reference. Ref ID: <strong>${refId}</strong>
    </p>
  </div>
</div>
</body>
</html>`;
}

// ─── Send email via SMTP using fetch to Supabase's built-in email or raw SMTP ─
// We use the SmtpClient from denomailer
async function sendEmail(to: string, toName: string, subject: string, htmlBody: string, pdfBase64?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Use denomailer — a Deno SMTP client
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: SMTP_PORT === 465,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    const attachments = pdfBase64
      ? [{
          filename: "WaruWenJo_Enquiry_Summary.pdf",
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
        }]
      : [];

    await client.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: `${toName} <${to}>`,
      subject,
      html: htmlBody,
      attachments,
    });

    await client.close();
    return { success: true };
  } catch (err) {
    console.error("SMTP send error:", err);
    return { success: false, error: String(err) };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const lead    = body.lead;
    const pdfB64  = body.pdf_base64; // optional PDF from client

    const toEmail = body.to_email || lead?.email;
    const toName  = body.to_name || lead?.full_name || "Valued Partner";

    if (!toEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject  = body.custom_subject || `✅ Enquiry Received — Welcome to WaruWenJo! (Ref: ${(lead?.id ?? "").slice(0, 8).toUpperCase()})`;
    const htmlBody = body.custom_html || buildEmailHtml(lead);

    const result = await sendEmail(toEmail, toName, subject, htmlBody, pdfB64);

    return new Response(
      JSON.stringify({ success: result.success, to: toEmail, error: result.error || null }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
