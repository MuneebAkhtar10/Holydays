import { prisma } from "@/lib/prisma";
import { toBookingDTO, type BookingDTO } from "@/lib/booking-dto";
import { bookingInvoiceBreakdown, bookingIsPaid, bookingPackageGrandTotal, bookingPackageHotelNames } from "@/lib/booking-invoice";
import { formatPKR, formatTime, nightsBetween } from "@/lib/format";
import { bookingCurrency, formatMoney } from "@/lib/currency";
import { guideAmount } from "@/lib/trip-total";

/** Amounts in the currency the guest chose at checkout. */
const fmt = (b: BookingDTO, n: number) => formatMoney(n, bookingCurrency(b.extra));
import {
  badge,
  button,
  checklist,
  detailCard,
  emailShell,
  esc,
  lineTable,
  paragraphs,
  sectionTitle,
  totalBar,
  type MailLine,
} from "@/lib/email-templates";

export type BuiltEmail = { subject: string; text: string; html: string };

export async function loadBookingForEmail(id: string) {
  const row = await prisma.booking.findUnique({
    where: { id },
    include: { listing: { include: { owner: true } }, user: true },
  });
  if (!row) return null;
  return { dto: toBookingDTO(row), ownerEmail: row.listing.owner?.email ?? "" };
}

function longDay(iso: string) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Visit = { days: number; guests: number; rate: number; unit: string; guideFee?: number; guideUnit?: string; free: boolean };
/** A multi-day Ziyarat plan: number of days, and whether it costs nothing. */
const visitOf = (b: BookingDTO) => (b.extra.visit && typeof b.extra.visit === "object" ? (b.extra.visit as Visit) : null);

function paymentLabel(b: BookingDTO) {
  if (visitOf(b)?.free) return "Free visit";
  if (b.payment === "property") return b.listing.kind === "STAY" ? "Pay at the property" : "Pay on the day";
  if (b.payment === "card" || b.payment === "stripe") return "Card";
  if (b.payment === "jazz") return "JazzCash";
  if (b.payment === "easy") return "EasyPaisa";
  return b.payment;
}

function isStay(b: BookingDTO) {
  return b.listing.kind === "STAY";
}

function mapsUrl(b: BookingDTO) {
  const q = [b.listing.name, b.listing.address || `${b.listing.city}, ${b.listing.region}`].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function stayFacts(b: BookingDTO): [string, string][] {
  const nights = nightsBetween(b.startDate, b.endDate);
  const isPackage = Boolean(b.extra.package);
  const hotels = isPackage ? bookingPackageHotelNames(b) : [];
  return [
    ["Booking number", b.number],
    [isPackage ? "Package" : isStay(b) ? "Property" : "Service", isPackage ? hotels.join(" · ") : b.listing.name],
    ["Location", b.listing.address || `${b.listing.city}, ${b.listing.region}`],
    [isStay(b) ? "Check-in" : "Starts", `${longDay(b.startDate)}${isStay(b) && b.listing.checkIn ? ` · from ${b.listing.checkIn}` : ""}`],
    ["Reservation time", b.extra.reservation && b.extra.time ? formatTime(String(b.extra.time)) : ""],
    ["Your requests", b.extra.reservation ? String(b.extra.requests ?? "") : ""],
    [isStay(b) ? "Check-out" : "Ends", b.extra.reservation ? "" : `${longDay(b.endDate)}${isStay(b) && b.listing.checkOut ? ` · by ${b.listing.checkOut}` : ""}`],
    [
      isStay(b) ? "Length of stay" : "Duration",
      isStay(b) ? `${nights} night${nights === 1 ? "" : "s"}` : visitOf(b) ? `${visitOf(b)!.days} day${visitOf(b)!.days === 1 ? "" : "s"}` : "",
    ],
    ["Guests", `${b.guests} guest${b.guests === 1 ? "" : "s"}`],
    ["Booked by", b.guestName || ""],
  ];
}

function invoiceLines(b: BookingDTO): { lines: MailLine[]; grand: number } {
  const grand = bookingPackageGrandTotal(b);
  const breakdown = bookingInvoiceBreakdown(b);
  const lines: MailLine[] = [];
  if (breakdown) {
    for (const h of breakdown.hotels) {
      lines.push({
        label: h.name,
        note: `${h.city} · ${shortDay(h.checkin)} – ${shortDay(h.checkout)}`,
        amount: fmt(b, h.roomAmount),
      });
      for (const m of h.mealLines) lines.push({ label: m.label, amount: fmt(b, m.amount), indent: true });
    }
    for (const x of breakdown.extras) lines.push({ label: x.label, amount: fmt(b, x.amount) });
  } else {
    const quote = b.extra.quote as { total?: number; taxes?: number } | undefined;
    const base = quote?.total ?? b.total;
    const taxes = quote?.taxes ?? 0;
    const v = visitOf(b);
    const g = `${v?.guests ?? b.guests} guest${(v?.guests ?? b.guests) === 1 ? "" : "s"}`;
    const d = v ? `${v.days} day${v.days === 1 ? "" : "s"}` : "";
    if (v && !v.free) {
      const guide = guideAmount(v.guideFee, v.guideUnit, v.guests, v.days);
      const visitPart = Math.max(0, base - guide);
      if (visitPart > 0) lines.push({ label: `${b.listing.name} · visit`, note: `${fmt(b, v.rate)}${v.unit === "person" ? ` × ${g}` : ""} × ${d}`, amount: fmt(b, visitPart) });
      if (guide > 0) lines.push({ label: `${b.listing.name} · guide fee`, note: `${fmt(b, v.guideFee ?? 0)}${v.guideUnit === "group" ? " flat for the group" : ` × ${g}`} × ${d}`, amount: fmt(b, guide) });
    } else {
      lines.push({
        label: isStay(b) ? "Accommodation" : b.listing.name,
        note: v ? "Free visit" : undefined,
        amount: fmt(b, base),
      });
    }
    if (taxes > 0) lines.push({ label: "Taxes & fees", amount: fmt(b, taxes) });
  }
  return { lines, grand };
}

function plainSummary(b: BookingDTO, grand: number) {
  return [
    `Booking ${b.number}`,
    b.listing.name,
    `${longDay(b.startDate)} – ${longDay(b.endDate)} · ${b.guests} guests`,
    `Total ${fmt(b, grand)} (${paymentLabel(b)})`,
  ].join("\n");
}

export function confirmationEmail(b: BookingDTO, origin: string): BuiltEmail {
  const url = `${origin}/bookings/${b.id}`;
  const paid = bookingIsPaid(b);
  const free = Boolean(visitOf(b)?.free);
  const { lines, grand } = invoiceLines(b);
  const first = (b.guestName || "there").split(" ")[0];
  const paidAt = String(b.extra.paidAt ?? "");
  const receiptNo = `RC-${b.number.replace(/^HD-/, "")}`;
  const invoiceNo = `INV-${b.number.replace(/^HD-/, "")}`;
  const issued = b.createdAt.slice(0, 10);

  const contact: [string, string][] = [
    ["Property phone", b.listing.phone],
    ["Property email", b.listing.email],
    ["Host", b.listing.hostContactRevealed ? b.listing.hostName : ""],
    ["Host phone", b.listing.hostPhone],
  ];
  const hasContact = contact.some(([, v]) => v);

  const next = [
    "Carry a valid passport or national ID for every guest.",
    free
      ? "This is a free visit — there is nothing to pay."
      : paid
        ? "Your payment is complete — nothing more to pay before you arrive."
        : `Bring ${fmt(b, grand)} to pay ${isStay(b) ? "at the property on arrival" : "on the day"}.`,
    "Open your booking any time to message the host, view your voucher, or make changes.",
  ];

  const body = `
    ${paragraphs(`Hello ${first},\n\nThank you for booking with HolyDays. Your reservation is confirmed — here is everything you need, including your invoice and receipt.`)}
    <p style="margin:0 0 6px">${badge("Confirmed", "green")} ${free ? badge("Free visit", "navy") : paid ? badge("Paid", "navy") : badge(isStay(b) ? "Pay at property" : "Pay on the day", "gold")}</p>

    ${sectionTitle("Your booking")}
    ${detailCard(stayFacts(b))}

    ${sectionTitle(`Invoice · ${invoiceNo}`)}
    <p style="margin:0 0 6px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a97a8">Issued ${esc(longDay(issued))}</p>
    ${lineTable(lines)}
    ${free ? totalBar("Total", "Free", "No payment needed") : totalBar(paid ? "Total paid" : "Total due", fmt(b, grand), paid ? "Paid in full" : isStay(b) ? "Payable at the property" : "Payable on the day")}

    ${sectionTitle(`Receipt · ${receiptNo}`)}
    ${detailCard([
      ["Payment method", paymentLabel(b)],
      ["Status", free ? "No payment needed" : paid ? "Paid" : isStay(b) ? "Due at check-in" : "Due on the day"],
      [paid ? "Amount paid" : "Amount due", free ? "Free" : fmt(b, grand)],
      ["Paid on", paid && paidAt ? longDay(paidAt.slice(0, 10)) : ""],
      ["Reference", b.number],
    ])}
    ${paid || free ? "" : `<p style="margin:10px 0 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a97a8">This receipt will show as paid once the host confirms payment${isStay(b) ? " at check-in" : " on the day"}.</p>`}

    ${hasContact ? `${sectionTitle("Contact")}${detailCard(contact)}` : ""}

    ${sectionTitle("Before you travel")}
    ${checklist(next)}

    <p style="margin:28px 0 0">${button(url, "View booking")}
      &nbsp;${button(`${url}/invoice`, "Invoice", "outline")}
      &nbsp;${button(`${url}/receipt`, "Receipt", "outline")}</p>
    <p style="margin:14px 0 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a97a8">Open the invoice or receipt page and choose “Print / save PDF” to keep a copy.</p>
  `;

  const subject = `Booking confirmed · ${b.listing.name} · ${b.number}`;
  const text = `Hello ${first},\n\nYour booking is confirmed.\n\n${plainSummary(b, grand)}\n\nInvoice ${invoiceNo} · Receipt ${receiptNo}\nView booking, invoice and receipt: ${url}\n`;
  return {
    subject,
    text,
    html: emailShell({
      origin,
      eyebrow: `Booking ${b.number}`,
      title: "Your booking is confirmed",
      preheader: `${b.listing.name} · ${longDay(b.startDate)} – ${longDay(b.endDate)} · ${fmt(b, grand)}`,
      bodyHtml: body,
    }),
  };
}

export type ReminderKind = "d7" | "d1" | "d0";

export function reminderEmail(b: BookingDTO, origin: string, kind: ReminderKind): BuiltEmail {
  const url = `${origin}/bookings/${b.id}`;
  const first = (b.guestName || "there").split(" ")[0];
  const grand = bookingPackageGrandTotal(b);
  const paid = bookingIsPaid(b);
  const stay = isStay(b);
  const when = kind === "d7" ? "in 7 days" : kind === "d1" ? "tomorrow" : "today";
  const thing = stay ? "stay" : "trip";
  const title =
    kind === "d7" ? `Your ${thing} is one week away` : kind === "d1" ? `Your ${thing} starts tomorrow` : `Your ${thing} starts today`;

  const intro =
    kind === "d7"
      ? `Hello ${first},\n\nYour ${thing} at ${b.listing.name} begins ${when}, on ${longDay(b.startDate)}. A few things to get ready now so arrival is smooth.`
      : kind === "d1"
        ? `Hello ${first},\n\nYour ${thing} at ${b.listing.name} begins ${when} (${longDay(b.startDate)}). Here are your arrival details.`
        : `Hello ${first},\n\nYour ${thing} at ${b.listing.name} begins ${when}. We wish you a blessed and comfortable journey.`;

  const list =
    kind === "d7"
      ? [
          "Check that your passport or national ID is valid for travel.",
          "Confirm your flight, transfer or driver pick-up times.",
          visitOf(b)?.free ? "This is a free visit — nothing to pay." : paid ? "Payment is complete — nothing to pay on arrival." : `Plan to pay ${fmt(b, grand)} ${stay ? "at the property" : "on the day"}.`,
          "Message the host from your booking if you have special requests.",
        ]
      : [
          "Keep your booking number and ID handy for check-in.",
          stay && b.listing.checkIn ? `Check-in opens at ${b.listing.checkIn}.` : "Be ready at the agreed meeting point.",
          visitOf(b)?.free ? "This is a free visit — nothing to pay." : paid ? "Payment is complete — nothing to pay on arrival." : `Bring ${fmt(b, grand)} to pay ${stay ? "at the property" : "on the day"}.`,
          "Use your voucher at reception — it has your booking number.",
        ];

  const body = `
    ${paragraphs(intro)}
    <p style="margin:0 0 6px">${badge(kind === "d0" ? "Today" : kind === "d1" ? "Tomorrow" : "7 days to go", "gold")}</p>

    ${sectionTitle("Arrival details")}
    ${detailCard([
      ["Booking number", b.number],
      [stay ? "Property" : "Service", b.listing.name],
      ["Address", b.listing.address || `${b.listing.city}, ${b.listing.region}`],
      [stay ? "Check-in" : "Starts", `${longDay(b.startDate)}${stay && b.listing.checkIn ? ` · from ${b.listing.checkIn}` : ""}`],
      ["Reservation time", b.extra.reservation && b.extra.time ? formatTime(String(b.extra.time)) : ""],
      [stay ? "Check-out" : "Ends", b.extra.reservation ? "" : `${longDay(b.endDate)}${stay && b.listing.checkOut ? ` · by ${b.listing.checkOut}` : ""}`],
      ["Property phone", b.listing.phone],
      ["Host", b.listing.hostContactRevealed ? b.listing.hostName : ""],
      ["Host phone", b.listing.hostPhone],
    ])}

    ${sectionTitle("Checklist")}
    ${checklist(list)}

    <p style="margin:28px 0 0">${button(url, "View booking")}
      &nbsp;${button(`${url}/voucher`, "Voucher", "outline")}
      &nbsp;${button(mapsUrl(b), "Directions", "outline")}</p>
  `;

  return {
    subject: `${kind === "d7" ? "One week to go" : kind === "d1" ? "Tomorrow" : "Today"} · ${b.listing.name} · ${b.number}`,
    text: `Hello ${first},\n\n${intro}\n\n${plainSummary(b, grand)}\n\nView booking: ${url}\nVoucher: ${url}/voucher\n`,
    html: emailShell({
      origin,
      eyebrow: `Booking ${b.number}`,
      title,
      preheader: `${b.listing.name} · ${longDay(b.startDate)}`,
      bodyHtml: body,
    }),
  };
}

export function thankYouEmail(b: BookingDTO, origin: string): BuiltEmail {
  const url = `${origin}/bookings/${b.id}`;
  const first = (b.guestName || "there").split(" ")[0];
  const body = `
    ${paragraphs(`Hello ${first},\n\nThank you for choosing HolyDays for your ${isStay(b) ? "stay" : "trip"} with ${b.listing.name}. We hope it was comfortable and meaningful.\n\nA short review helps other pilgrims choose well, and helps your host improve. It takes under a minute.`)}
    ${sectionTitle("Your booking")}
    ${detailCard([
      ["Booking number", b.number],
      [isStay(b) ? "Property" : "Service", b.listing.name],
      ["Dates", `${longDay(b.startDate)} – ${longDay(b.endDate)}`],
    ])}
    <p style="margin:28px 0 0">${button(url, "Leave a review")}
      &nbsp;${button(`${url}/receipt`, "Receipt", "outline")}</p>
  `;
  return {
    subject: `How was ${b.listing.name}? · ${b.number}`,
    text: `Hello ${first},\n\nThank you for your ${isStay(b) ? "stay" : "trip"} with ${b.listing.name}. Share a quick review: ${url}\n`,
    html: emailShell({
      origin,
      eyebrow: `Booking ${b.number}`,
      title: "Thank you — how did it go?",
      preheader: `Leave a quick review of ${b.listing.name}`,
      bodyHtml: body,
    }),
  };
}

function cancelFacts(b: BookingDTO): [string, string][] {
  const isPackage = Boolean(b.extra.package);
  return [
    ["Booking number", b.number],
    [isPackage ? "Package" : isStay(b) ? "Property" : "Service", isPackage ? bookingPackageHotelNames(b).join(" · ") : b.listing.name],
    ["Dates", `${longDay(b.startDate)} – ${longDay(b.endDate)}`],
    ["Guests", `${b.guests} guest${b.guests === 1 ? "" : "s"}`],
    ["Amount", fmt(b, bookingPackageGrandTotal(b))],
    ["Payment", `${paymentLabel(b)}${wasPaid(b) ? " · paid" : ""}`],
    ...(refundOf(b) && refundOf(b)!.status !== "failed" ? ([["Refund", refundOf(b)!.amountPkr > 0 ? `${fmt(b, refundOf(b)!.amountPkr)} (${refundOf(b)!.percent}%)` : "None"]] as [string, string][]) : []),
  ];
}

/** bookingIsPaid() is false for cancelled bookings, so read the recorded card payment directly. */
function wasPaid(b: BookingDTO) {
  return b.extra.paymentStatus === "paid" || Boolean(b.extra.paidAt);
}

type RefundInfo = { percent: number; amountPkr: number; status: string };
const refundOf = (b: BookingDTO) => (b.extra.refund && typeof b.extra.refund === "object" ? (b.extra.refund as RefundInfo) : null);

function refundNote(b: BookingDTO) {
  if (!wasPaid(b)) return "You had not paid for this booking yet, so there is nothing to refund.";
  const r = refundOf(b);
  if (r && r.status !== "failed") {
    if (r.amountPkr > 0) {
      const part = r.percent < 100 ? ` This is ${r.percent}% of what you paid; the rest is kept under the cancellation terms of your rate.` : "";
      return `A refund of ${fmt(b, r.amountPkr)} has been sent to your original payment method.${part} Banks usually show it within 5 to 10 business days.`;
    }
    return "Under the cancellation terms of your rate, this booking is not eligible for a refund. If you think this is a mistake, reply to this email.";
  }
  const o = b.refundOutlook;
  return `You paid for this booking in advance. ${o.note}. Once the cancellation is confirmed, any refund is sent to your original payment method and we will email you the amount.`;
}

export function cancellationRequestedEmail(b: BookingDTO, origin: string, reason: string): BuiltEmail {
  const url = `${origin}/bookings/${b.id}`;
  const first = (b.guestName || "there").split(" ")[0];
  const body = `
    ${paragraphs(`Hello ${first},\n\nWe have received your request to cancel this booking. Our team is reviewing it, and we will email you as soon as a decision is made. Your booking stays active until then.`)}
    <p style="margin:0 0 6px">${badge("Request received", "gold")} ${badge("Under review", "navy")}</p>

    ${sectionTitle("Booking")}
    ${detailCard(cancelFacts(b))}

    ${reason ? `${sectionTitle("Your reason")}${paragraphs(`“${reason}”`)}` : ""}

    ${sectionTitle("What happens next")}
    ${checklist([
      "Our team and the host review your request, usually within one business day.",
      "You will receive another email with the decision.",
      refundNote(b),
    ])}

    <p style="margin:28px 0 0">${button(url, "View booking")}</p>
    <p style="margin:14px 0 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a97a8">Changed your mind? Reply to this email and tell us before the request is reviewed.</p>
  `;
  return {
    subject: `Cancellation request received · ${b.listing.name} · ${b.number}`,
    text: `Hello ${first},\n\nWe received your request to cancel booking ${b.number} (${b.listing.name}, ${longDay(b.startDate)} – ${longDay(b.endDate)}). It is under review and your booking stays active until a decision is made. We will email you the outcome.\n\nView booking: ${url}\n`,
    html: emailShell({
      origin,
      eyebrow: `Booking ${b.number}`,
      title: "We received your cancellation request",
      preheader: `${b.listing.name} · ${longDay(b.startDate)} – ${longDay(b.endDate)} · under review`,
      bodyHtml: body,
    }),
  };
}

export function cancellationDecisionEmail(b: BookingDTO, origin: string, approved: boolean): BuiltEmail {
  const url = `${origin}/bookings/${b.id}`;
  const first = (b.guestName || "there").split(" ")[0];
  const decidedAt = String(b.extra.cancelDecidedAt ?? "");
  const decided = decidedAt ? longDay(decidedAt.slice(0, 10)) : "";

  if (approved) {
    const body = `
      ${paragraphs(`Hello ${first},\n\nYour cancellation has been confirmed. This booking is now cancelled and your dates have been released.`)}
      <p style="margin:0 0 6px">${badge("Cancelled", "red")}</p>

      ${sectionTitle("Cancelled booking")}
      ${detailCard([...cancelFacts(b), ["Cancelled on", decided]])}

      ${sectionTitle("Refund")}
      ${paragraphs(refundNote(b))}

      <p style="margin:28px 0 0">${button(url, "View booking")}
        &nbsp;${button(`${origin}/search`, "Find another stay", "outline")}</p>
      <p style="margin:14px 0 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a97a8">We are sorry to see this trip change, and hope to host you another time.</p>
    `;
    return {
      subject: `Cancellation confirmed · ${b.listing.name} · ${b.number}`,
      text: `Hello ${first},\n\nYour cancellation of booking ${b.number} (${b.listing.name}, ${longDay(b.startDate)} – ${longDay(b.endDate)}) is confirmed.\n\n${refundNote(b)}\n\nView booking: ${url}\n`,
      html: emailShell({
        origin,
        eyebrow: `Booking ${b.number}`,
        title: "Your cancellation is confirmed",
        preheader: `${b.listing.name} · ${longDay(b.startDate)} – ${longDay(b.endDate)} · cancelled`,
        bodyHtml: body,
      }),
    };
  }

  const body = `
    ${paragraphs(`Hello ${first},\n\nYour request to cancel this booking was not approved, so your booking stays confirmed and nothing has changed. If you still need to change your plans, please contact the host or reply to this email.`)}
    <p style="margin:0 0 6px">${badge("Booking stays confirmed", "green")}</p>

    ${sectionTitle("Your booking")}
    ${detailCard(cancelFacts(b))}

    <p style="margin:28px 0 0">${button(url, "View booking")}
      &nbsp;${button(`${url}/voucher`, "Voucher", "outline")}</p>
  `;
  return {
    subject: `Cancellation request not approved · ${b.listing.name} · ${b.number}`,
    text: `Hello ${first},\n\nYour request to cancel booking ${b.number} (${b.listing.name}) was not approved. The booking stays confirmed.\n\nView booking: ${url}\n`,
    html: emailShell({
      origin,
      eyebrow: `Booking ${b.number}`,
      title: "Your booking stays confirmed",
      preheader: `Cancellation request for ${b.listing.name} was not approved`,
      bodyHtml: body,
    }),
  };
}

export type ProviderItem = { label: string; type: string; when: string; detail?: string; amount?: number };

/** Sent to a hotel / Ziyarat / taxi / food partner when a guest's booking against their listing is made. */
export function ownerBookingEmail(input: {
  ownerName: string;
  origin: string;
  number: string;
  items: ProviderItem[];
  guest: { name: string; email: string; phone: string };
  guests: number;
  paid: boolean;
  paymentLabel: string;
  requests?: string;
  pending?: boolean;
}): BuiltEmail {
  const first = (input.ownerName || "there").split(" ")[0];
  const url = `${input.origin}/owner?tab=bookings`;
  const many = input.items.length > 1;
  const title = input.pending ? "New trip request" : many ? "You have new bookings" : "You have a new booking";
  const intro = input.pending
    ? `Hello ${first},\n\n${input.guest.name} sent you a custom trip request on HolyDays. Review the details and accept or decline it in your partner desk. The guest is waiting for your answer.`
    : `Hello ${first},\n\n${input.guest.name} has booked ${many ? "with you" : input.items[0]?.label ? `${input.items[0].label}` : "with you"} on HolyDays. Here is what you need to prepare.`;

  const itemCards = input.items
    .map(
      (it) => `${sectionTitle(it.type)}${detailCard([
        ["Listing", it.label],
        ["When", it.when],
        ["Details", it.detail ?? ""],
        ["Your amount", it.amount && it.amount > 0 ? formatPKR(it.amount) : ""],
      ])}`,
    )
    .join("");

  const body = `
    ${paragraphs(intro)}
    <p style="margin:0 0 6px">${badge(input.pending ? "Awaiting your answer" : "New booking", input.pending ? "gold" : "green")} ${input.pending ? "" : input.paid ? badge("Paid online", "navy") : badge("Pay on arrival", "gold")}</p>
    ${itemCards}

    ${sectionTitle("Guest")}
    ${detailCard([
      ["Name", input.guest.name],
      ["Phone", input.guest.phone],
      ["Email", input.guest.email],
      ["Party size", `${input.guests} guest${input.guests === 1 ? "" : "s"}`],
      ["Payment", input.paid ? `Paid (${input.paymentLabel})` : input.paymentLabel],
      ["Booking number", input.number],
    ])}
    ${input.requests ? `${sectionTitle("Guest requests")}${paragraphs(`“${input.requests}”`)}` : ""}

    <p style="margin:28px 0 0">${button(url, input.pending ? "Review request" : "Open partner desk")}</p>
    <p style="margin:14px 0 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a97a8">You can chat with the guest from the Messages tab of your partner desk.</p>
  `;

  return {
    subject: `${input.pending ? "New trip request" : "New booking"} · ${input.items[0]?.label ?? "HolyDays"} · ${input.number}`,
    text: `Hello ${first},\n\n${input.guest.name} ${input.pending ? "sent a trip request" : "made a booking"} (${input.number}).\n${input.items.map((i) => `- ${i.label}: ${i.when}`).join("\n")}\nGuest phone: ${input.guest.phone || "not given"}\n\nOpen your partner desk: ${url}\n`,
    html: emailShell({
      origin: input.origin,
      eyebrow: `Booking ${input.number}`,
      title,
      preheader: `${input.guest.name} · ${input.items[0]?.label ?? ""} · ${input.items[0]?.when ?? ""}`,
      bodyHtml: body,
    }),
  };
}

/** A chat message between guest and host, in either direction. */
export function chatMessageEmail(input: {
  to: "host" | "guest";
  recipientName: string;
  senderName: string;
  listing: string;
  dates: string;
  number: string;
  message: string;
  url: string;
  origin: string;
}): BuiltEmail {
  const first = (input.recipientName || "there").split(" ")[0];
  const toHost = input.to === "host";
  const body = `
    ${paragraphs(`Hello ${first},\n\n${input.senderName} sent you a message${toHost ? " about a booking" : ""}:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tbody><tr>
      <td style="background:#f6f0e4;border-left:3px solid #c5a46a;border-radius:6px;padding:14px 16px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#102948;white-space:pre-wrap">${esc(input.message)}</td>
    </tr></tbody></table>
    ${sectionTitle("Booking")}
    ${detailCard([
      ["Listing", input.listing],
      ["Dates", input.dates],
      ["Booking number", input.number],
    ])}
    <p style="margin:28px 0 0">${button(input.url, "Reply")}</p>
  `;
  return {
    subject: toHost ? `New message from ${input.senderName} · ${input.number}` : `New message from ${input.listing} · ${input.number}`,
    text: `Hello ${first},\n\n${input.senderName} wrote:\n\n${input.message}\n\n${input.listing} (${input.dates}) - booking ${input.number}\nReply: ${input.url}\n`,
    html: emailShell({
      origin: input.origin,
      eyebrow: "New message",
      title: toHost ? "A guest sent you a message" : "Your host sent you a message",
      preheader: input.message.slice(0, 110),
      bodyHtml: body,
    }),
  };
}
