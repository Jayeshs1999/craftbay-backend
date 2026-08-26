import { Resend } from "resend";

// Initialise lazily so missing env var doesn't crash the server on boot —
// it just silently skips every send.
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn("[mailer] RESEND_API_KEY not set – emails will be silently skipped.");
}

const FROM = `${process.env.SMTP_FROM_NAME || "Banavoo"} <${process.env.SMTP_FROM_EMAIL || "noreply@banavoo.in"}>`;

/**
 * Send a single transactional email via Resend.
 * @param {{ to: string, subject: string, html: string }} opts
 *
 * Never throws — logs the error instead so that a mail failure
 * never breaks an API response.
 */
export async function sendMail({ to, subject, html }) {
  if (!resend) return;
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      [to],
      subject,
      html,
    });
    if (error) {
      console.error(`[mailer] Resend error for "${subject}" → ${to}:`, error);
    } else {
      console.log(`[mailer] Sent "${subject}" → ${to} (id: ${data.id})`);
    }
  } catch (err) {
    console.error(`[mailer] Unexpected error sending "${subject}" → ${to}:`, err.message);
  }
}
