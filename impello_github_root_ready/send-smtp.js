// api/send-smtp.js
import nodemailer from "nodemailer";

export default async function handler(req, res){
  if(req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, TO_ADDRESS, FROM_ADDRESS } = process.env;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      secure: String(SMTP_SECURE||"true")==="true",
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    const data = req.body || {};
    const toSales = TO_ADDRESS || "sales@impelloglobal.com";
    const fromAddr = FROM_ADDRESS || SMTP_USER;
    const applicantEmail = (data.email || data.Email || data.contact_email || "").toString().trim();

    const rows = Object.entries(data)
      .filter(([k]) => !k.startsWith("_"))
      .map(([k,v]) => {
        const value = Array.isArray(v) ? v.join(", ") : v ?? "";
        return `<tr>
          <td style="padding:6px 10px;border:1px solid #e6ecf4;"><strong>${k}</strong></td>
          <td style="padding:6px 10px;border:1px solid #e6ecf4;">${String(value).replace(/</g,"&lt;")}</td>
        </tr>`;
      }).join("");

    const adminHtml = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b2634">
        <h2>Impello Global – Trade Credit Insurance Application</h2>
        <p><strong>Submitted:</strong> ${new Date().toISOString()}</p>
        <table style="border-collapse:collapse;border:1px solid #e6ecf4;width:100%">${rows}</table>
        <p style="color:#6b7a90">Meta: ${JSON.stringify(data._meta || {})}</p>
      </div>`;

    const attachments = (data._files || []).map(f => ({
      filename: f.filename,
      content: Buffer.from(f.content, "base64"),
      contentType: f.type || "application/octet-stream"
    }));

    // 1) Email to Sales
    await transporter.sendMail({
      to: toSales,
      from: `Impello Global <${fromAddr}>`,
      subject: `New Application – ${data.company_name || "Unknown Company"} – ${new Date().toLocaleString()}`,
      html: adminHtml,
      attachments
    });

    // 2) Confirmation email to applicant
    if (applicantEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(applicantEmail)) {
      const firstName = (data.primary_contact || data.company_name || "").toString().split(" ")[0] || "there";
      const confirmHtml = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b2634;max-width:640px">
          <img src="https://impelloglobal.com/wp-content/uploads/2023/11/impello-logo-blue.png" alt="Impello Global" style="height:36px;margin:8px 0" />
          <h2 style="color:#0B4D8F;margin:16px 0 8px">We received your application</h2>
          <p>Hello ${firstName},</p>
          <p>Thank you for submitting your application to Impello Global. Our team has received your information and will begin reviewing it right away.</p>
          <p><strong>What happens next:</strong></p>
          <ul>
            <li>We’ll review your application in detail.</li>
            <li>If we need anything else, we’ll reach out by phone or email.</li>
            <li>You can expect to hear from us within 2–3 business days.</li>
          </ul>
          <p>If you have any immediate questions, reply to this email or contact us at <a href="mailto:sales@impelloglobal.com">sales@impelloglobal.com</a>.</p>
          <p style="margin-top:20px">Best regards,<br/>The Impello Global Team<br/>
            <a href="mailto:applications@impelloglobal.com">applications@impelloglobal.com</a> ·
            <a href="https://impelloglobal.com">impelloglobal.com</a>
          </p>
        </div>`;

      await transporter.sendMail({
        to: applicantEmail,
        from: `Impello Global <${fromAddr}>`,
        replyTo: toSales,
        subject: "Your application has been received – Impello Global",
        html: confirmHtml
      });
    }

    return res.status(200).json({ ok:true });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error:"Failed to send" });
  }
}
