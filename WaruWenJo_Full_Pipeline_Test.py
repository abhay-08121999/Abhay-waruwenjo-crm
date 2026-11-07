import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import nodemailer from 'nodemailer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Custom plugin to handle email sending locally
  const emailApiPlugin = () => ({
    name: 'email-api',
    configureServer(server) {
      server.middlewares.use('/api/send-email', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const { lead = {}, pdf_base64, to_email, to_name, custom_subject, custom_html } = data;

              const transporter = nodemailer.createTransport({
                host: 'mail.waruwenjo.com',
                port: 465,
                secure: true,
                auth: {
                  // VERY IMPORTANT: This is ONLY the background login to access the server.
                  // It does NOT change the sender's email address. The sender is defined below in mailOptions.
                  user: 'contact@waruwenjo.com',
                  pass: 'WaruWenJo@@26'
                }
              });

              // Construct email HTML
              const refId = (lead.id || "").slice(0, 8).toUpperCase() || "PENDING";
              const dateLabel = lead.preferred_date ? new Date(lead.preferred_date).toLocaleDateString() : "Flexible";

              const defaultHtmlBody = `<!DOCTYPE html>
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
    .cta { text-align:center; margin-bottom:32px; }
    .cta a { display:inline-block; background:linear-gradient(135deg,#0d7a6e,#14b8a6); color:#fff; text-decoration:none; font-size:13px; font-weight:800; padding:14px 36px; border-radius:99px; letter-spacing:0.5px; }
    .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:28px 40px; text-align:center; }
    .footer p { font-size:12px; color:#94a3b8; line-height:1.7; }
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
      <div class="row"><span class="label">Phone</span><span class="value">${lead.phone || "Not provided"}</span></div>
      <div class="row"><span class="label">Treatment</span><span class="value">${lead.treatment_interest || "General Consultation"}</span></div>
      <div class="row"><span class="label">Preferred Date</span><span class="value">${dateLabel}</span></div>
    </div>

    <!-- Next Steps -->
    <div class="next-steps">
      <div class="card-title" style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:16px;">🚀 What Happens Next</div>
      <div class="step"><div class="step-num">1</div><div class="step-text"><strong>Case Review (Within 24 hrs)</strong> — Our medical team reviews your requirements.</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text"><strong>Doctor Matching</strong> — We connect you with the best specialist.</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text"><strong>Free Video Consultation</strong> — Speak directly with your doctor.</div></div>
      <div class="step"><div class="step-num">4</div><div class="step-text"><strong>Treatment & Travel</strong> — We handle flights to hospital admission.</div></div>
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
      📧 support@waruwenjo.com &nbsp;|&nbsp; 🌐 waruwenjo.com
    </p>
  </div>
</div>
</body>
</html>`;

              const recipientEmail = to_email || lead.email;
              if (!recipientEmail) throw new Error('Recipient email is required');
              const mailOptions = {
                from: '"WaruWenJo Support" <support@waruwenjo.com>',
                to: recipientEmail,
                subject: custom_subject || `✅ Enquiry Received — Welcome to WaruWenJo! (Ref: ${refId})`,
                html: custom_html || defaultHtmlBody,
                attachments: pdf_base64 ? [{
                  filename: 'WaruWenJo_Enquiry_Summary.pdf',
                  content: pdf_base64,
                  encoding: 'base64'
                }] : []
              };

              await transporter.sendMail(mailOptions);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              console.error('Email API Error:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(error) }));
            }
          });
        } else {
          next();
        }
      });

      // API for sending the 8-step process email
      server.middlewares.use('/api/send-process-email', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const { lead } = data;

              const transporter = nodemailer.createTransport({
                host: 'mail.waruwenjo.com',
                port: 465,
                secure: true,
                auth: {
                  user: 'contact@waruwenjo.com',
                  pass: 'WaruWenJo@@26'
                }
              });

              const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>The WaruWenJo Process</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#f0f4f8; color:#1a2332; }
    .wrapper { max-width:650px; margin:40px auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 4px 40px rgba(0,0,0,0.10); }
    .header { background:linear-gradient(135deg, #0d7a6e 0%, #14b8a6 100%); padding:48px 40px; text-align:center; }
    .header h1 { color:#fff; font-size:28px; font-weight:800; letter-spacing:-0.5px; }
    .header p  { color:rgba(255,255,255,0.85); margin-top:8px; font-size:15px; }
    .body { padding:40px; }
    .greeting { font-size:20px; font-weight:700; color:#0d7a6e; margin-bottom:12px; }
    .intro { font-size:15px; line-height:1.7; color:#475569; margin-bottom:32px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
    .step-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:24px; position: relative; overflow: hidden; }
    .step-card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #0d7a6e; }
    .step-num { font-size: 12px; font-weight: 800; color: #0d7a6e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .step-title { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
    .step-desc { font-size: 13px; color: #64748b; line-height: 1.5; }
    .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:28px 40px; text-align:center; }
    .footer p { font-size:13px; color:#94a3b8; line-height:1.7; }
    .footer a { color:#0d7a6e; text-decoration:none; font-weight:600; }
  </style>
</head>
<body>
<div class="wrapper">
  <!-- Header -->
  <div class="header">
    <h1>The Step-by-Step Patient Journey</h1>
    <p>From first contact to full recovery - every step managed for you</p>
  </div>

  <!-- Body -->
  <div class="body">
    <p class="greeting">Hello, ${lead.full_name || 'there'}! 👋</p>
    <p class="intro">
      We are excited to help you on your medical journey. At <strong>WaruWenJo</strong>, we ensure a seamless, transparent, and comfortable experience. Here is a breakdown of our 8-step process:
    </p>

    <!-- Grid of Steps -->
    <div style="display:flex; flex-direction:column; gap:20px;">
      
      <div class="step-card">
        <div class="step-num">Step 01</div>
        <div class="step-title">Initial Consultation</div>
        <div class="step-desc">Patient inquiry & onboarding. We understand your needs and gather preliminary details.</div>
      </div>

      <div class="step-card">
        <div class="step-num">Step 02</div>
        <div class="step-title">Medical Assessment</div>
        <div class="step-desc">Comprehensive review of your medical records and reports by our clinical team.</div>
      </div>

      <div class="step-card">
        <div class="step-num">Step 03</div>
        <div class="step-title">Hospital Matching</div>
        <div class="step-desc">Ensuring the right hospital and top specialist are selected for your specific care.</div>
      </div>

      <div class="step-card">
        <div class="step-num">Step 04</div>
        <div class="step-title">Treatment Plan & Costing</div>
        <div class="step-desc">You receive a detailed treatment plan along with transparent, upfront pricing.</div>
      </div>

      <div class="step-card">
        <div class="step-num">Step 05</div>
        <div class="step-title">Medical Visa Assistance</div>
        <div class="step-desc">We manage all documentation and expedite your medical visa processing.</div>
      </div>

      <div class="step-card">
        <div class="step-num">Step 06</div>
        <div class="step-title">Travel, Stay & Logistics</div>
        <div class="step-desc">We handle booking flights, comfortable accommodation, and complimentary airport pickup.</div>
      </div>

      <div class="step-card">
        <div class="step-num">Step 07</div>
        <div class="step-title">Admission & Treatment</div>
        <div class="step-desc">Fully managed hospital admission, translation services, and expert clinical care.</div>
      </div>

      <div class="step-card">
        <div class="step-num">Step 08</div>
        <div class="step-title">12-Month Post-Care</div>
        <div class="step-desc">Long-term recovery support including Physiotherapy, Rehabilitation, Yoga, and follow-ups.</div>
      </div>

    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>
      <strong>WaruWenJo Medical Tourism</strong><br/>
      Your health is our priority.<br/>
      📧 <a href="mailto:support@waruwenjo.com">support@waruwenjo.com</a> &nbsp;|&nbsp; 🌐 <a href="https://waruwenjo.com">waruwenjo.com</a>
    </p>
  </div>
</div>
</body>
</html>`;

              const mailOptions = {
                from: '"WaruWenJo Support" <support@waruwenjo.com>',
                to: lead.email,
                subject: `🏥 The WaruWenJo Patient Journey — What to Expect`,
                html: htmlBody
              };

              await transporter.sendMail(mailOptions);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              console.error('Process Email API Error:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(error) }));
            }
          });
        } else {
          next();
        }
      });

      // API for sending documents to in-house doctors
      server.middlewares.use('/api/send-doctor-reports', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const { lead, doctorName, doctorEmail, pdf_base64 } = data;

              const transporter = nodemailer.createTransport({
                host: 'mail.waruwenjo.com',
                port: 465,
                secure: true,
                auth: {
                  user: 'contact@waruwenjo.com',
                  pass: 'WaruWenJo@@26'
                }
              });

              const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Medical Documents for Review</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#f8fafc; color:#1e293b; padding: 40px; }
    .container { max-width:600px; margin:0 auto; background:#fff; padding:40px; border-radius:24px; box-shadow:0 10px 30px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    .header { color:#0d7a6e; font-size:24px; font-weight:800; margin-bottom:20px; }
    .info-card { background:#f1f5f9; padding:20px; border-radius:16px; margin-bottom:20px; }
    .label { font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px; }
    .value { font-size:16px; font-weight:600; color:#1e293b; margin-bottom:12px; }
    .message { font-size:16px; line-height:1.6; color:#475569; padding:20px; border-left:4px solid #0d7a6e; background:#f0fdfa; border-radius:0 12px 12px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="header">WaruWenJo Clinical Review</h1>
    <p>Dear Dr. ${doctorName},</p>
    <p>Please review the medical documents for the following patient lead:</p>
    
    <div class="info-card">
      <div class="label">Patient Name</div>
      <div class="value">${lead.full_name}</div>
      <div class="label">Lead ID</div>
      <div class="value">${lead.id}</div>
      <div class="label">Treatment Interest</div>
      <div class="value">${lead.treatment_interest || 'N/A'}</div>
    </div>

    <div class="message">
      <strong>Message:</strong> these are the documents.
    </div>

    <p style="margin-top:30px; font-size:14px; color:#94a3b8;">
      This is an automated clinical notification from the WaruWenJo CRM.
    </p>
  </div>
</body>
</html>`;

              const mailOptions = {
                from: '"WaruWenJo CRM" <support@waruwenjo.com>',
                to: doctorEmail,
                subject: `📋 Clinical Review Requested: ${lead.full_name} (${lead.id.slice(0,8)})`,
                html: htmlBody,
                attachments: pdf_base64 ? [{
                  filename: `Medical_Reports_${lead.full_name.replace(/\s+/g, '_')}.pdf`,
                  content: pdf_base64,
                  encoding: 'base64'
                }] : []
              };

              await transporter.sendMail(mailOptions);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              console.error('Doctor Email API Error:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(error) }));
            }
          });
        } else {
          next();
        }
      });

      // API for Stage 5: Finalize Clinical Review
      server.middlewares.use('/api/finalize-clinical-review', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const { lead, doctorName, hospitalName, doctorEmail, pdf_base64 } = data;

              const transporter = nodemailer.createTransport({
                host: 'mail.waruwenjo.com',
                port: 465,
                secure: true,
                auth: { user: 'contact@waruwenjo.com', pass: 'WaruWenJo@@26' }
              });

              // 1. Email to Doctor (Dr Neha)
              const doctorHtml = `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                  <h2 style="color: #0d7a6e;">Video Consultation Request</h2>
                  <p>Dear Dr. ${doctorName},</p>
                  <p>A patient, <strong>${lead.full_name}</strong>, has requested a video consultation regarding: ${lead.treatment_interest}.</p>
                  <p>Attached is the medical report for your review.</p>
                  <hr/>
                  <p><strong>Please select your preferred slot:</strong></p>
                  <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <a href="#" style="padding: 10px; background: #0d7a6e; color: #fff; text-decoration: none; border-radius: 6px;">Slot A: 10:00 AM</a>
                    <a href="#" style="padding: 10px; background: #0d7a6e; color: #fff; text-decoration: none; border-radius: 6px;">Slot B: 02:00 PM</a>
                    <a href="#" style="padding: 10px; background: #0d7a6e; color: #fff; text-decoration: none; border-radius: 6px;">Slot C: 05:00 PM</a>
                  </div>
                </div>
              `;

              await transporter.sendMail({
                from: '"WaruWenJo Medical" <support@waruwenjo.com>',
                to: doctorEmail,
                subject: `Video Consultation Request: ${lead.full_name}`,
                html: doctorHtml,
                attachments: pdf_base64 ? [{
                  filename: `Medical_Report_${lead.full_name}.pdf`,
                  content: pdf_base64,
                  encoding: 'base64'
                }] : []
              });

              // 2. Email to Patient
              const patientHtml = `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                  <h2 style="color: #0d7a6e;">Consultation Slots Requested</h2>
                  <p>Hello ${lead.full_name},</p>
                  <p>Your medical reports have been shared with <strong>${doctorName}</strong> at ${data.hospitalName || 'the selected hospital'}.</p>
                  <p>Please select your preferred timing for the video consultation:</p>
                  <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <a href="#" style="padding: 10px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 5px;">Slot A: 10:00 AM</a>
                    <a href="#" style="padding: 10px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 5px;">Slot B: 02:00 PM</a>
                    <a href="#" style="padding: 10px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Slot C: 05:00 PM</a>
                  </div>
                </div>
              `;

              await transporter.sendMail({
                from: '"WaruWenJo Support" <support@waruwenjo.com>',
                to: lead.email,
                subject: `Action Required: Select Meeting Timings`,
                html: patientHtml
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              console.error('Finalize Review Error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: String(error) }));
            }
          });
        } else {
          next();
        }
      });

      // API for final Meeting Link confirmation
      server.middlewares.use('/api/send-final-confirmation', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const { lead, doctorName, timing, doctorEmail } = data;

              const transporter = nodemailer.createTransport({
                host: 'mail.waruwenjo.com',
                port: 465,
                secure: true,
                auth: { user: 'contact@waruwenjo.com', pass: 'WaruWenJo@@26' }
              });

              const finalHtml = `
                <div style="font-family: sans-serif; padding: 40px; background: #f0fdfa; border-radius: 24px; text-align: center;">
                  <h1 style="color: #0d7a6e;">Consultation Confirmed!</h1>
                  <p>Your meeting with <strong>${doctorName}</strong> has been scheduled.</p>
                  <div style="background: #fff; padding: 20px; border-radius: 16px; margin: 20px 0; border: 1px solid #ccfbf1;">
                    <p style="font-size: 18px; font-weight: bold; color: #1e293b;">Time: ${timing}</p>
                    <p>Link: <a href="${data.meetingLink || 'https://meet.google.com/abc-defg-hij'}" style="color: #0d7a6e; font-weight: bold;">Click here to join</a></p>
                  </div>
                  <p style="font-size: 12px; color: #64748b;">Sent from nehasp0804@gmail.com (WaruWenJo Official)</p>
                </div>
              `;

              await transporter.sendMail({
                from: '"WaruWenJo Official" <nehasp0804@gmail.com>',
                to: [lead.email, doctorEmail || 'trionsv123@gmail.com'],
                subject: `CONFIRMED: Video Consultation on ${timing}`,
                html: finalHtml
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: String(error) }));
            }
          });
        } else {
          next();
        }
      });
    }
  });

  return {
    server: {
      port: 3002,
      host: '0.0.0.0',
    },
    plugins: [react(), emailApiPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
