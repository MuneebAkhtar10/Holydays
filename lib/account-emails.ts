import { button, emailShell, paragraphs } from "@/lib/email-templates";

/** Verification link email for a new account, or for a changed address. */
export function verifyEmailMail(input: { name: string; link: string; origin: string; changed?: boolean }) {
  const first = (input.name || "there").split(" ")[0];
  const intro = input.changed
    ? `Hello ${first},\n\nYou changed the email on your HolyDays account. Please confirm this new address so we know it is yours.`
    : `Hello ${first},\n\nPlease confirm your email address so we can send your booking confirmations, invoices and reminders to the right place.`;
  const body = `${paragraphs(intro)}
    <p style="margin:22px 0 0">${button(input.link, "Verify my email")}</p>
    ${paragraphs("This link works for 24 hours. If you did not ask for it, you can ignore this email and nothing will change.")}
    <p style="margin:0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a97a8;word-break:break-all">Button not working? Paste this link into your browser:<br>${input.link}</p>`;
  return {
    subject: input.changed ? "Confirm your new HolyDays email" : "Verify your HolyDays email",
    text: `Hello ${first},\n\nVerify your email: ${input.link}\n\nThis link works for 24 hours. If you did not ask for it, ignore this email.`,
    html: emailShell({
      origin: input.origin,
      eyebrow: "Account security",
      title: input.changed ? "Confirm your new email" : "Verify your email",
      preheader: "One click to confirm your email address",
      bodyHtml: body,
    }),
  };
}
