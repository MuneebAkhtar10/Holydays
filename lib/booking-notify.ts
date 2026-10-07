import { notifyUser } from "@/lib/notify";
import { bookingNumber, parseBookingExtras, shareText } from "@/lib/booking-view";
import { formatDay, formatPKR, formatTime } from "@/lib/format";
import { mailHtml } from "@/lib/mail";
import { publicOrigin } from "@/lib/auth-tokens";
import { prisma } from "@/lib/prisma";
import {
  cancellationDecisionEmail,
  cancellationRequestedEmail,
  chatMessageEmail,
  confirmationEmail,
  loadBookingForEmail,
  ownerBookingEmail,
  type BuiltEmail,
  type ProviderItem,
} from "@/lib/booking-emails";
import { toBookingDTO } from "@/lib/booking-dto";
import { bookingIsPaid, type StoredPackage } from "@/lib/booking-invoice";
import { packagePrimaryAmount } from "@/lib/package-plan";


export type SentEmail = { type: string; at: string; to: string };

/** Keeps a small per-booking log of emails that really went out (shown on the booking page). Never throws. */
export async function recordEmailSent(bookingId: string, type: string, to: string) {
  try {
    const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: { extras: true } });
    if (!row) return;
    const extra = parseBookingExtras(row.extras);
    const log = Array.isArray(extra.emails) ? (extra.emails as SentEmail[]) : [];
    extra.emails = [...log, { type, at: new Date().toISOString(), to }].slice(-30);
    await prisma.booking.update({ where: { id: bookingId }, data: { extras: JSON.stringify(extra) } });
  } catch (err) {
    console.error("[booking-notify] could not record email", err);
  }
}

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

  await notifyProvidersOfBooking(input.id, { pending: input.pending });

  const channels: NotifyChannels = {
    email: email.delivered || Boolean(input.email),
    sms: Boolean(input.phone),
    whatsapp: Boolean(input.phone),
    push: true,
  };

  return {
    channels,
    sentEmail: !input.pending && email.delivered ? ({ type: "confirmation", at: new Date().toISOString(), to: input.email } as SentEmail) : null,
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
  const origin = publicOrigin();
  const mail = chatMessageEmail({
    to: "guest",
    recipientName: input.guestName,
    senderName: input.hostName,
    listing: input.listing,
    dates: input.startDate === input.endDate ? formatDay(input.startDate) : `${formatDay(input.startDate)} — ${formatDay(input.endDate)}`,
    number: bookingNumber(input.bookingId),
    message: input.message,
    url: `${origin}/bookings/${input.bookingId}`,
    origin,
  });
  return notifyUser({ to: input.guestEmail, subject: mail.subject, text: mail.text, html: mail.html });
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
      const res = await notifyUser({ to: dto.guestEmail, subject: mail.subject, text: mail.text, html: mail.html });
      if (res.delivered) await recordEmailSent(bookingId, "cancel_requested", dto.guestEmail);
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
    const res = await notifyUser({ to: loaded.dto.guestEmail, subject: mail.subject, text: mail.text, html: mail.html });
    if (res.delivered) await recordEmailSent(bookingId, approved ? "cancelled" : "cancel_denied", loaded.dto.guestEmail);
  } catch (err) {
    console.error("[booking-notify] cancellation decision email failed", err);
  }
}

const longDay = (iso: string) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
const payName = (m: string) => (m === "property" ? "Pay at the property" : m === "card" || m === "stripe" ? "Card" : m);

/**
 * Tells every partner whose listing is part of a booking — the main hotel, extra hotels, Ziyarat and taxi
 * owners inside a package, or the restaurant / taxi / Ziyarat booked on its own. One email per partner.
 * Never throws: email trouble must not undo a booking.
 */
export async function notifyProvidersOfBooking(bookingId: string, opts: { pending?: boolean } = {}) {
  try {
    const row = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { include: { owner: true } }, user: true },
    });
    if (!row) return;
    const dto = toBookingDTO(row);
    const extra = parseBookingExtras(row.extras);
    const pack = extra.package as (StoredPackage & { stays?: { listingId: string; name: string; city: string; checkin: string; checkout: string; amount: number }[] }) | undefined;
    const origin = publicOrigin();

    type Group = { email: string; name: string; items: ProviderItem[] };
    const groups = new Map<string, Group>();
    const add = (owner: { id: string; email: string; name: string } | null | undefined, item: ProviderItem) => {
      if (!owner?.email?.includes("@")) return;
      const g = groups.get(owner.id) ?? { email: owner.email, name: owner.name, items: [] };
      g.items.push(item);
      groups.set(owner.id, g);
    };

    // The listing that was booked directly
    const kind = row.listing.kind;
    let primaryWhen = `${longDay(row.startDate)} to ${longDay(row.endDate)}`;
    let primaryDetail = "";
    if (extra.reservation && extra.time) {
      primaryWhen = `${longDay(row.startDate)} at ${formatTime(String(extra.time))}`;
      primaryDetail = `Table for ${row.guests}`;
    } else if (kind === "TAXI") {
      primaryWhen = longDay(row.startDate);
      primaryDetail = extra.taxiMode === "private" ? "Private vehicle" : extra.taxiMode === "custom" ? "Custom trip, rate agreed with you" : `${row.guests} seat${row.guests === 1 ? "" : "s"} (shared)`;
    } else if (kind === "ATTRACTION") {
      primaryWhen = longDay(row.startDate);
    }
    add(row.listing.owner, {
      label: row.listing.name,
      type: kindLabelFor(kind),
      when: primaryWhen,
      detail: primaryDetail || (kind === "STAY" ? `${row.guests} guest${row.guests === 1 ? "" : "s"}` : undefined),
      amount: pack ? packagePrimaryAmount(row.total, { total: pack.total ?? 0, stays: (pack.stays ?? []) as never }) : row.total,
    });

    if (pack) {
      const slugs = [...(pack.ziyaratIds ?? []), ...(pack.taxis ?? []).map((t) => t.id)];
      const stayIds = (pack.stays ?? []).map((st) => st.listingId);
      const found = await prisma.listing.findMany({
        where: { OR: [{ slug: { in: slugs } }, { id: { in: stayIds } }, { slug: { in: stayIds } }] },
        include: { owner: true },
      });
      const bySlug = new Map(found.map((l) => [l.slug, l]));
      const byAny = new Map<string, (typeof found)[number]>([...found.map((l) => [l.id, l] as const), ...found.map((l) => [l.slug, l] as const)]);

      for (const st of pack.stays ?? []) {
        const l = byAny.get(st.listingId);
        add(l?.owner, {
          label: st.name,
          type: "Hotel stay",
          when: `${longDay(st.checkin)} to ${longDay(st.checkout)}`,
          detail: `${st.city} · ${row.guests} guest${row.guests === 1 ? "" : "s"}`,
          amount: st.amount,
        });
      }
      for (const zid of pack.ziyaratIds ?? []) {
        const l = bySlug.get(zid);
        const z = (pack.ziyarat ?? []).find((x) => x.id === zid);
        add(l?.owner, {
          label: l?.name ?? z?.name ?? zid,
          type: "Ziyarat visit",
          when: z?.hours ? `${z.hours} · during the stay in ${l?.city ?? z.city}` : `During the stay in ${l?.city ?? ""}`,
          detail: `${row.guests} guest${row.guests === 1 ? "" : "s"}`,
          amount: z ? z.price * Math.max(1, row.guests) : undefined,
        });
      }
      for (const pick of pack.taxis ?? []) {
        const l = bySlug.get(pick.id);
        const t = (pack.taxiList ?? []).find((x) => x.id === pick.id);
        add(l?.owner, {
          label: l?.name ?? (t ? `${t.origin} to ${t.destination}` : pick.id),
          type: pick.leg === "out" ? "Airport drop-off" : pick.leg === "in" ? "Airport pick-up" : "Taxi trip",
          when: longDay(pick.date),
          detail: pick.mode === "private" ? "Private vehicle" : `${pick.seats} seat${pick.seats === 1 ? "" : "s"} (shared)`,
          amount: t ? (pick.mode === "private" ? t.privateRate : t.ratePerPerson * Math.max(1, pick.seats)) : undefined,
        });
      }
    }

    const guest = { name: row.user?.name || "A guest", email: row.user?.email || "", phone: row.phone };
    const requests = String(extra.specialRequests ?? extra.requests ?? "").trim();
    for (const g of groups.values()) {
      const mail = ownerBookingEmail({
        ownerName: g.name,
        origin,
        number: dto.number,
        items: g.items,
        guest,
        guests: row.guests,
        paid: bookingIsPaid(dto),
        paymentLabel: payName(row.payment),
        requests,
        pending: opts.pending,
      });
      await notifyUser({ to: g.email, subject: mail.subject, text: mail.text, html: mail.html });
    }
  } catch (err) {
    console.error("[booking-notify] partner booking emails failed", err);
  }
}

function kindLabelFor(kind: string) {
  return kind === "STAY" ? "Hotel stay" : kind === "TAXI" ? "Taxi trip" : kind === "ATTRACTION" ? "Ziyarat visit" : kind === "RESTAURANT" ? "Table reservation" : "Booking";
}

const CHAT_EMAIL_GAP_MS = 5 * 60 * 1000;

/** Emails the host when a guest writes in the booking chat — at most one email per booking every 5 minutes, so a burst of messages is one alert. */
export async function notifyOwnerGuestMessage(bookingId: string, message: string) {
  try {
    const row = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { include: { owner: true } }, user: true },
    });
    const to = row?.listing.owner?.email ?? "";
    if (!row || !to.includes("@")) return;
    const extra = parseBookingExtras(row.extras);
    const last = new Date(String(extra.ownerChatEmailAt ?? 0)).getTime();
    if (Number.isFinite(last) && Date.now() - last < CHAT_EMAIL_GAP_MS) return;

    const origin = publicOrigin();
    const mail = chatMessageEmail({
      to: "host",
      recipientName: row.listing.owner.name,
      senderName: row.user?.name || "A guest",
      listing: row.listing.name,
      dates: row.startDate === row.endDate ? formatDay(row.startDate) : `${formatDay(row.startDate)} — ${formatDay(row.endDate)}`,
      number: bookingNumber(row.id),
      message,
      url: `${origin}/owner?tab=messages`,
      origin,
    });
    const res = await notifyUser({ to, subject: mail.subject, text: mail.text, html: mail.html });
    if (res.delivered) {
      extra.ownerChatEmailAt = new Date().toISOString();
      await prisma.booking.update({ where: { id: bookingId }, data: { extras: JSON.stringify(extra) } });
    }
  } catch (err) {
    console.error("[booking-notify] host chat email failed", err);
  }
}
