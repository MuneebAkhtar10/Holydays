import { notifyUser } from "@/lib/notify";
import { bookingNumber, shareText } from "@/lib/booking-view";
import { formatDay, formatPKR } from "@/lib/format";
import { mailHtml } from "@/lib/mail";
import { publicOrigin } from "@/lib/auth-tokens";
import {
  cancellationDecisionEmail,
  cancellationRequestedEmail,
  confirmationEmail,
  loadBookingForEmail,
  type BuiltEmail,
} from "@/lib/booking-emails";

export type NotifyChannels = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
};

export async function notifyBookingCreated(input: {
  email: string;
  phone: string;
  name: string;
  listing: string;
  id: string;
  startDate: string;
  endDate: string;
  total: number;
  origin: string;
  ownerEmail?: string;
  pending?: boolean;
}) {
  const number = bookingNumber(input.id);
  const url = `${input.origin}/bookings/${input.id}`;
  const text = shareText({
    number,
    name: input.listing,
    startDate: input.startDate,
    endDate: input.endDate,
    total: input.total,
    url,
  });
  const dates = `${formatDay(input.startDate)} — ${formatDay(input.endDate)}`;
  const body = input.pending
    ? `Request ${number} sent to ${input.listing} for ${dates}. It is not confirmed yet — the driver needs to accept it first.`
    : `Booking ${number} is confirmed for ${input.listing}. ${dates}. Total ${formatPKR(input.total)}.`;

  let rich: BuiltEmail | null = null;
  if (!input.pending) {
    try {
      const loaded = await loadBookingForEmail(input.id);
      if (loaded) rich = confirmationEmail(loaded.dto, input.origin);
    } catch (err) {
      console.error("[booking-notify] could not build confirmation email", err);
    }
  }

  const email = input.email.includes("@")
    ? await notifyUser({
        to: input.email,
        subject: rich?.subject ?? (input.pending ? `HolyDays request sent ${number}` : `HolyDays confirmation ${number}`),
        text: rich?.text ?? `${body}\n\nOpen your booking: ${url}`,
        html:
          rich?.html ??
          mailHtml(
            input.pending ? "Your trip request is sent" : "Your booking is confirmed",
            `Hello ${input.name},\n\n${body}\n\nWe sent this to the email on your HolyDays account.`,
            url,
            "View booking",
          ),
      })
    : { delivered: false, preview: null };

  const sms = input.phone
    ? await notifyUser({ to: input.phone, subject: `HolyDays ${number}`, text: body, code: number })
    : { delivered: false, preview: null };
  const whatsapp = input.phone
    ? await notifyUser({
        to: `whatsapp:${input.phone}`,
        subject: `WhatsApp ${number}`,
        text: body,
      })
    : { delivered: false, preview: null };

  if (input.ownerEmail?.includes("@")) {
    await notifyUser({
      to: input.ownerEmail,
      subject: input.pending ? `New HolyDays trip request ${number}` : `New HolyDays booking ${number}`,
      text: input.pending
        ? `${input.name} sent a custom trip request for ${input.listing}. ${dates}. Accept or decline it in your partner desk. ${url}`
        : `${input.name} booked ${input.listing}. ${body} ${url}`,
      html: mailHtml(
        input.pending ? "New custom trip request" : "New guest booking",
        input.pending
          ? `${input.name} wants a custom trip with ${input.listing} on ${dates}. Review the details and accept or decline in your partner desk.`
          : `${input.name} booked ${input.listing}.\n${dates}.\nTotal ${formatPKR(input.total)}.`,
        `${input.origin}/owner?tab=bookings`,
        "Open partner desk",
      ),
    });
  }

  const channels: NotifyChannels = {
    email: email.delivered || Boolean(input.email),
    sms: Boolean(input.phone),
    whatsapp: Boolean(input.phone),
    push: true,
  };

  return {
    channels,
    number,
    url,
    waLink: input.phone
      ? `https://wa.me/${input.phone.replace(/\D/g, "").replace(/^0/, "92")}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`,
    preview: email.preview || sms.preview,
  };
}

export async function notifyBookingUpdate(to: string, subject: string, text: string, href?: string) {
  if (!to?.includes("@")) return { delivered: false, preview: null };
  return notifyUser({
    to,
    subject,
    text: href ? `${text}\n\n${href}` : text,
    html: mailHtml(subject.replace(/^HolyDays · /, ""), text, href, href ? "Open HolyDays" : undefined),
  });
}

export async function notifyGuestHostMessage(input: {
  guestEmail: string;
  guestName: string;
  listing: string;
  hostName: string;
  message: string;
  bookingId: string;
  startDate: string;
  endDate: string;
}) {
  if (!input.guestEmail?.includes("@")) return { delivered: false, preview: null };
  const url = `${publicOrigin()}/bookings/${input.bookingId}`;
  const dates = `${formatDay(input.startDate)} — ${formatDay(input.endDate)}`;
  const text = `${input.hostName} sent you a message about ${input.listing} (${dates}):\n\n${input.message}\n\nReply here: ${url}`;
  return notifyUser({
    to: input.guestEmail,
    subject: `New message from ${input.listing}`,
    text,
    html: mailHtml(
      "New message from your host",
      `Hello ${input.guestName},\n\n${input.hostName} wrote about your stay at ${input.listing} (${dates}):\n\n“${input.message}”`,
      url,
      "Reply to host",
    ),
  });
}

/** Sent to the traveller (and the host) when a traveller asks to cancel. Never throws — email trouble must not block a cancellation. */
export async function notifyCancellationRequested(bookingId: string, reason: string) {
  try {
    const loaded = await loadBookingForEmail(bookingId);
    if (!loaded) return;
    const { dto, ownerEmail } = loaded;
    // Extra hotels in a package are cancelled together with the main booking, whose email covers all of them.
    if (dto.extra.packageId && dto.extra.packageId !== dto.id) return;
    const origin = publicOrigin();

    if (dto.guestEmail?.includes("@")) {
      const mail = cancellationRequestedEmail(dto, origin, reason);
      await notifyUser({ to: dto.guestEmail, subject: mail.subject, text: mail.text, html: mail.html });
    }
    if (ownerEmail.includes("@")) {
      await notifyUser({
        to: ownerEmail,
        subject: `Cancellation request · ${dto.listing.name} · ${dto.number}`,
        text: `${dto.guestName || "A guest"} asked to cancel booking ${dto.number} (${dto.listing.name}, ${formatDay(dto.startDate)} — ${formatDay(dto.endDate)}).\nReason: ${reason}\n\nReview it in your partner desk: ${origin}/owner?tab=bookings`,
        html: mailHtml(
          "Cancellation request",
          `${dto.guestName || "A guest"} asked to cancel booking ${dto.number} for ${dto.listing.name} (${formatDay(dto.startDate)} — ${formatDay(dto.endDate)}).\n\nReason: ${reason}\n\nPlease approve or decline it in your partner desk.`,
          `${origin}/owner?tab=bookings`,
          "Review request",
        ),
      });
    }
  } catch (err) {
    console.error("[booking-notify] cancellation request email failed", err);
  }
}

/** Sent to the traveller when a cancellation request is approved or denied. */
export async function notifyCancellationDecision(bookingId: string, approved: boolean) {
  try {
    const loaded = await loadBookingForEmail(bookingId);
    if (!loaded?.dto.guestEmail?.includes("@")) return;
    const mail = cancellationDecisionEmail(loaded.dto, publicOrigin(), approved);
    await notifyUser({ to: loaded.dto.guestEmail, subject: mail.subject, text: mail.text, html: mail.html });
  } catch (err) {
    console.error("[booking-notify] cancellation decision email failed", err);
  }
}
