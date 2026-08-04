/**
 * REN Enterprise Monitor — Mailer Service
 *
 * Configures a reusable Nodemailer transport from environment
 * variables and exposes a helper to send alert emails.
 *
 * Gmail setup:
 *   1. Enable 2-Step Verification in your Google account.
 *   2. Go to https://myaccount.google.com/apppasswords
 *   3. Create an App Password for "Mail".
 *   4. Set SMTP_PASS to the 16-character app password (no spaces).
 */

import nodemailer from "nodemailer";

// ── SMTP Configuration ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  secure: false, // STARTTLS on port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP connection at startup (logs a clear error if credentials are wrong)
transporter.verify().then(() => {
  console.log("[Mailer] ✅ Conexión SMTP verificada — los correos de alerta están activos.");
}).catch((err: Error) => {
  console.warn("[Mailer] ⚠️  Conexión SMTP no disponible:", err.message);
  console.warn("[Mailer]    Para Gmail, usa una Contraseña de Aplicación en SMTP_PASS.");
  console.warn("[Mailer]    https://myaccount.google.com/apppasswords");
});

// ── Public API ──────────────────────────────────────────────────────

export interface AlertEmailPayload {
  alertType: string;
  severity: "Warning" | "Critical";
  message: string;
  timestamp: Date;
}

/**
 * Send an alert notification email.
 * Silently fails if SMTP is not configured (dev environments).
 */
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<void> {
  const recipient = process.env.ALERT_EMAIL_TO;

  if (!recipient) {
    console.log(`[Mailer] ⚠️  ALERT_EMAIL_TO no configurado — alerta "${payload.alertType}" no enviada.`);
    return;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[Mailer] ⚠️  SMTP_USER o SMTP_PASS no configurados — alerta "${payload.alertType}" no enviada.`);
    return;
  }

  const isResolved = payload.alertType.endsWith("_RESOLVED");
  const severityEmoji = isResolved ? "🟢" : (payload.severity === "Critical" ? "🔴" : "🟡");
  const displayType = isResolved ? payload.alertType.replace("_RESOLVED", "") : payload.alertType;
  const displayStatus = isResolved ? "Resuelta" : payload.severity;
  const timeString = payload.timestamp.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour12: false });
  const uniqueId = Math.random().toString(36).substring(2, 6).toUpperCase();
  const subject = `${severityEmoji} [REN Monitor] ${displayStatus}: ${displayType} [${timeString}-${uniqueId}]`;

  const accentColor = isResolved ? "#10b981" : (payload.severity === "Critical" ? "#ef4444" : "#f59e0b");
  const accentBg = isResolved ? "#064e3b" : (payload.severity === "Critical" ? "#7f1d1d" : "#78350f");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 32px; text-align: center; border-bottom: 4px solid ${accentColor};">
        <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">REN Enterprise Monitor</h1>
        <p style="color: #a5b4fc; font-size: 14px; margin: 8px 0 0 0; font-weight: 500;">
          ${isResolved ? "✅ Notificación de Resolución" : "⚠️ Alerta del Sistema"}
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 32px; background-color: #1e293b;">
        <div style="display: inline-block; background-color: ${accentBg}; border: 1px solid ${accentColor}; color: ${accentColor}; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 24px;">
          Estado: ${displayStatus}
        </div>

        <div style="background-color: #0f172a; border-left: 4px solid ${accentColor}; border-radius: 0 8px 8px 0; padding: 24px; margin-bottom: 32px; color: #f8fafc; font-size: 16px; line-height: 1.6;">
          <strong style="display: block; font-size: 18px; margin-bottom: 8px; color: ${accentColor};">${displayType.replace(/_/g, " ")}</strong>
          ${payload.message}
        </div>

        <!-- Details -->
        <div style="background-color: #0f172a; border-radius: 12px; padding: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #94a3b8; width: 40%;">Tipo de Alerta</td>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #f8fafc; font-weight: 600; text-align: right;">${displayType}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #94a3b8;">Nivel de Severidad</td>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: ${accentColor}; font-weight: 700; text-align: right;">${displayStatus.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #94a3b8;">Marca de Tiempo</td>
              <td style="padding: 12px 0; color: #cbd5e1; font-family: monospace; text-align: right;">
                ${payload.timestamp.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "medium" })}
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #0f172a; padding: 24px 32px; text-align: center; border-top: 1px solid #1e293b;">
        <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.5;">
          Este es un mensaje automático de <strong>REN Monitor</strong>.<br>
          Por favor, no respondas a este correo.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"REN Monitor 🛡️" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject,
      html,
    });
    console.log(`[Mailer] ✅ Correo "${subject}" enviado a ${recipient}`);
  } catch (err) {
    console.error(
      "[Mailer] ❌ Error enviando correo:",
      err instanceof Error ? err.message : err
    );
  }
}
