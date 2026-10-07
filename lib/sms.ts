const placeholder = (v: string) => !v || /^(your|replace|xxx|changeme)/i.test(v);

export function smsConfigured() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const from = process.env.TWILIO_FROM?.trim() || process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || "";
  return !placeholder(sid) && !placeholder(token) && !placeholder(from);
}

/** "03001234567" -> "+923001234567"; numbers already in +country form are kept. */
export function toE164(phone: string) {
  const p = phone.replace(/[^\d+]/g, "");
  if (/^03\d{9}$/.test(p)) return `+92${p.slice(1)}`;
  if (/^92\d{10}$/.test(p)) return `+${p}`;
  return p.startsWith("+") ? p : `+${p}`;
}

/** Sends a text through Twilio's REST API (no SDK). Returns the provider's error text when it fails. */
export async function sendSms(to: string, body: string): Promise<{ delivered: boolean; error?: string }> {
  if (!smsConfigured()) return { delivered: false, error: "SMS is not set up (add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM)." };
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const form = new URLSearchParams({ To: toE164(to), Body: body });
  if (process.env.TWILIO_FROM?.trim()) form.set("From", process.env.TWILIO_FROM.trim());
  else form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID!.trim());
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { message?: string } | null;
      return { delivered: false, error: detail?.message || `Twilio ${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    return { delivered: false, error: err instanceof Error ? err.message : String(err) };
  }
}
