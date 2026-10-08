import { sendEmail, emailConfigured as mailReady } from "@/lib/mail";
import { sendSms, smsConfigured as smsReady } from "@/lib/sms";

type Note = { to: string; subject: string; text: string; html?: string; code?: string };

export function emailConfigured() {
  return mailReady();
}

export function smsConfigured() {
  return smsReady();
}

/** MAIL_COPIES="owner@a.com=me@b.com;other@a.com=me@b.com" — everything emailed to the left address is also sent to the right one. For testing. */
function copyRecipients(to: string) {
  const wanted = to.trim().toLowerCase();
  return String(process.env.MAIL_COPIES ?? "")
    .split(/[;\n]/)
    .map((pair) => pair.split("="))
    .filter(([from, copy]) => from?.trim().toLowerCase() === wanted && copy?.includes("@"))
    .map(([, copy]) => copy.trim());
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
    for (const copy of copyRecipients(note.to)) {
      if (copy.toLowerCase() === note.to.trim().toLowerCase()) continue;
      await sendEmail({
        to: copy,
        subject: `[Copy for ${note.to}] ${note.subject}`,
        text: note.text,
        html: note.html,
      }).catch((err) => console.error("[holydays-notify] copy failed", err));
    }
    return { delivered: sent.delivered, preview: sent.preview ?? note.code ?? null };
  }

  // Plain phone numbers are texted; WhatsApp is not connected yet, so it is only logged.
  if (!note.to.startsWith("whatsapp:") && smsReady()) {
    const sms = await sendSms(note.to, note.text);
    if (!sms.delivered) console.error("[holydays-sms]", sms.error);
    return { delivered: sms.delivered, preview: sms.delivered ? null : note.code ?? null, error: sms.error };
  }

  console.info(`[holydays-notify] ${note.subject} -> ${note.to}\n${note.text}`);
  return { delivered: false, preview: note.code || null, error: undefined as string | undefined };
}
