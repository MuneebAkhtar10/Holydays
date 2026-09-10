import { sendEmail, emailConfigured as mailReady } from "@/lib/mail";

type Note = { to: string; subject: string; text: string; html?: string; code?: string };

export function emailConfigured() {
  return mailReady();
}

export function smsConfigured() {
  return Boolean(process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_ACCOUNT_SID);
}

/** Sends email when Resend or SMTP is set. Phone/WhatsApp stay logged unless Twilio is configured. */
export async function notifyUser(note: Note) {
  const email = note.to.includes("@") && !note.to.startsWith("whatsapp:");
  if (email) {
    const sent = await sendEmail({
      to: note.to,
      subject: note.subject,
      text: note.text,
      html: note.html,
    });
    if (!sent.delivered) {
      console.info(`[holydays-notify] ${note.subject} -> ${note.to}\n${note.text}`);
    }
    return { delivered: sent.delivered, preview: sent.preview ?? note.code ?? null };
  }

  console.info(`[holydays-notify] ${note.subject} -> ${note.to}\n${note.text}`);
  return {
    delivered: note.code ? smsConfigured() : false,
    preview: note.code || null,
  };
}
