import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";
import { mailHtml } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin-only mail diagnostics for the live site.
 *   /api/admin/email-check              → shows how mail is configured
 *   /api/admin/email-check?to=you@x.com → also sends a test email and shows the provider's exact error, if any
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const from = process.env.MAIL_FROM || process.env.SMTP_FROM || "";
  const fromDomain = from.match(/@([^>\s"]+)/)?.[1] ?? "";
  const provider = process.env.RESEND_API_KEY ? "resend" : process.env.SMTP_HOST ? "smtp" : "none";

  const report: Record<string, unknown> = {
    provider,
    mailFrom: from || "(not set — falls back to noreply@holydays.app, which will be rejected)",
    fromDomain,
    resendKeySet: Boolean(process.env.RESEND_API_KEY),
    nextauthUrl: process.env.NEXTAUTH_URL || "(not set)",
    cronSecretSet: Boolean(process.env.CRON_SECRET),
  };

  if (provider === "resend" && fromDomain) {
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (res.ok) {
        const list = ((await res.json()) as { data?: { name: string; status: string }[] }).data ?? [];
        const match = list.find((d) => fromDomain === d.name || fromDomain.endsWith(`.${d.name}`));
        report.domainCheck = match
          ? `${match.name}: ${match.status}`
          : `NOT FOUND — ${fromDomain} is not a domain in this Resend account. Verified domains: ${list.map((d) => d.name).join(", ") || "none"}`;
      } else {
        report.domainCheck = `Could not list domains (HTTP ${res.status}) — the key may be send-only.`;
      }
    } catch (err) {
      report.domainCheck = `Could not reach Resend: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const to = new URL(req.url).searchParams.get("to")?.trim();
  if (to) {
    const sent = await sendEmail({
      to,
      subject: "HolyDays live email check",
      text: "If you can read this, live email sending works.",
      html: mailHtml("Live email check", "If you can read this, email sending from the live HolyDays site works."),
    });
    report.testTo = to;
    report.testDelivered = sent.delivered;
    if (sent.error) report.testError = sent.error;
  }

  return NextResponse.json(report);
}
