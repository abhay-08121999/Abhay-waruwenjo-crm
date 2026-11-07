-- SQL script to seed Template 1 in Supabase SQL editor
INSERT INTO public.templates (name, type, html_content)
VALUES (
  'Template 1 - WaruWenJo Proposal',
  'clinical',
  '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
.email-container {
    max-width: 800px;
    margin: 30px auto;
    background: #fff;
    font-family: ''DM Sans'', sans-serif;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.email-header {
    background: linear-gradient(135deg, #0D6E6E 0%, #084F4F 100%);
    padding: 60px 55px 80px;
    position: relative;
    overflow: hidden;
}
.email-header::before {
    content: "";
    position: absolute;
    top: -80px;
    right: -80px;
    width: 240px;
    height: 240px;
    border: 2px solid rgba(201, 168, 76, 0.25);
    border-radius: 50%;
}
.email-header::after {
    content: "";
    position: absolute;
    bottom: -90px;
    left: -70px;
    width: 170px;
    height: 170px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 50%;
}
.logo-wrap {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 40px;
}
.logo-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: #C9A84C;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    font-family: ''Playfair Display'', serif;
}
.logo-title {
    color: #fff;
    font-size: 26px;
    font-weight: 700;
    font-family: ''Playfair Display'', serif;
}
.logo-sub {
    color: rgba(255, 255, 255, 0.65);
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
}
.stage {
    color: #E4C56A;
    text-transform: uppercase;
    font-size: 14px;
    letter-spacing: 3px;
    font-weight: 700;
    margin-bottom: 18px;
}
.main-title {
    color: #fff;
    font-family: ''Playfair Display'', serif;
    font-size: 58px;
    line-height: 1.1;
    font-weight: 600;
    margin-bottom: 18px;
}
.subtitle {
    color: rgba(255, 255, 255, 0.75);
    font-size: 18px;
    line-height: 1.6;
}
.content {
    padding: 60px;
    min-height: 250px;
}
.signature {
    color: #4A5568;
    font-size: 18px;
    line-height: 1.8;
}
.signature strong {
    color: #2C3E50;
}
.email-footer {
    background: #2E4258;
    text-align: center;
    padding: 40px 60px;
}
.footer-brand {
    color: #fff;
    font-size: 22px;
    font-family: ''Playfair Display'', serif;
    margin-bottom: 20px;
}
.footer-divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    margin-bottom: 20px;
}
.footer-text {
    color: rgba(255, 255, 255, 0.55);
    font-size: 14px;
    line-height: 1.8;
}
.footer-text a {
    color: rgba(255, 255, 255, 0.65);
}
</style>
<div class="email-container">
    <!-- HEADER -->
    <div class="email-header">
        <div class="logo-wrap">
            <div class="logo-icon">W</div>
            <div>
                <div class="logo-title">WaruWenJo</div>
                <div class="logo-sub">Medical Tourism Partners</div>
            </div>
        </div>
        <div class="stage">
            Stage 6–7 · Negotiation & Video Call
        </div>
        <h1 class="main-title">
            Your Proposal &<br>
            Consultation Details
        </h1>
        <div class="subtitle">
            Your personalised quotation and surgeon consultation are ready.
        </div>
    </div>

    <!-- CONTENT -->
    <div class="content">
        <p><strong>Date:</strong> {{date}}</p>
        <br>
        <p>To,</p>
        <p>
            {{patient_name}}<br>
            {{patient_email}}
        </p>
        <br>
        <p>
            <strong>Subject:</strong> Medical Quotation for Proposed Treatment
        </p>
        <br>
        <p>Dear {{patient_name}},</p>
        <br>
        <p>
            We are pleased to provide you with the comprehensive medical quotation
            for your proposed treatment plan at WaruWenJo. Our priority is to ensure
            you receive world-class healthcare with complete financial transparency.
        </p>
        <br><br>
        <h3 style="color:#0D6E6E; margin-bottom: 15px;">
            Quotation Details
        </h3>
        <table style="
            width:100%;
            border-collapse:collapse;
            font-size:14px;
        ">
            <thead>
                <tr style="background:#0D6E6E;color:white;">
                    <th style="padding:12px;border:1px solid #ddd;text-align:left;">Description</th>
                    <th style="padding:12px;border:1px solid #ddd;text-align:center;">Qty</th>
                    <th style="padding:12px;border:1px solid #ddd;text-align:right;">Unit Price</th>
                    <th style="padding:12px;border:1px solid #ddd;text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
                {{items}}
            </tbody>
            <tfoot>
                <tr style="font-weight:bold;background:#f5f5f5;">
                    <td colspan="3"
                        style="padding:12px;border:1px solid #ddd;text-align:right;">
                        Grand Total
                    </td>
                    <td style="
                        padding:12px;
                        border:1px solid #ddd;
                        color:#0D6E6E;
                        text-align:right;
                    ">
                        {{currency}} {{total_amount}}
                    </td>
                </tr>
            </tfoot>
        </table>
    </div>

    <!-- CONTENT -->
    <div class="content" style="padding-top: 0;">
        <div class="signature">
            Warm regards,<br>
            <strong>The WaruWenJo Care Team</strong>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="email-footer">
        <div class="footer-brand">
            WaruWenJo Medical Tourism
        </div>
        <hr class="footer-divider">
        <div class="footer-text">
            This email was sent to {{patient_email}} · Stage 6–7 Communication
            <br>
            © 2025 WaruWenJo Sdn Bhd · All rights reserved ·
            <a href="#" style="color:rgba(255,255,255,.65);">Privacy Policy</a>
        </div>
    </div>
</div>'
);
