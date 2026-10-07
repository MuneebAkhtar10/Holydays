import { prisma } from "@/lib/prisma";
import { toBookingDTO, type BookingDTO } from "@/lib/booking-dto";
import { bookingInvoiceBreakdown, bookingIsPaid, bookingPackageGrandTotal, bookingPackageHotelNames } from "@/lib/booking-invoice";
import { formatPKR, formatTime, nightsBetween } from "@/lib/format";
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

function paymentLabel(b: BookingDTO) {
  if (b.payment === "property") return "Pay at the property";
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
    [isStay(b) ? "Length of stay" : "Duration", isStay(b) ? `${nights} night${nights === 1 ? "" : "s"}` : ""],
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
        amount: formatPKR(h.roomAmount),
      });
      for (const m of h.mealLines) lines.push({ label: m.label, amount: formatPKR(m.amount), indent: true });
    }
    for (const x of breakdown.extras) lines.push({ label: x.label, amount: formatPKR(x.amount) });
  } else {
    const quote = b.extra.quote as { total?: number; taxes?: number } | undefined;
    const base = quote?.total ?? b.total;
    const taxes = quote?.taxes ?? 0;
    lines.push({ label: isStay(b) ? "Accommodation" : b.listing.name, amount: formatPKR(base) });
    if (taxes > 0) lines.push({ label: "Taxes & fees", amount: formatPKR(taxes) });
  }
  return { lines, grand };
}

function plainSummary(b: BookingDTO, grand: number) {
  return [
    `Booking ${b.number}`,
    b.listing.name,
    `${longDay(b.startDate)} – ${longDay(b.endDate)} · ${b.guests} guests`,
    `Total ${formatPKR(grand)} (${paymentLabel(b)})`,
  ].join("\n");
}

export function confirmationEmail(b: BookingDTO, origin: string): BuiltEmail {
  const url = `${origin}/bookings/${b.id}`;
  const paid = bookingIsPaid(b);
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
    paid ? "Your payment is complete — nothing more to pay before you arrive." : `Bring ${formatPKR(grand)} to pay at the property on arrival.`,
    "Open your booking any time to message the host, view your voucher, or make changes.",
  ];

  const body = `
    ${paragraphs(`Hello ${first},\n\nThank you for booking with HolyDays. Your reservation is confirmed — here is everything you need, including your invoice and receipt.`)}
    <p style="margin:0 0 6px">${badge("Confirmed", "green")} ${paid ? badge("Paid", "navy") : badge("Pay at property", "gold")}</p>

    ${sectionTitle("Your booking")}
    ${detailCard(stayFacts(b))}

    ${sectionTitle(`Invoice · ${invoiceNo}`)}
    <p style="margin:0 0 6px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a97a8">Issued ${esc(longDay(issued))}</p>
    ${lineTable(lines)}
    ${totalBar(paid ? "Total paid" : "Total due", formatPKR(grand), paid ? "Paid in full" : "Payable at the property")}

    ${sectionTitle(`Receipt · ${receiptNo}`)}
    ${detailCard([
      ["Payment method", paymentLabel(b)],
      ["Status", paid ? "Paid" : "Due at check-in"],
      [paid ? "Amount paid" : "Amount due", formatPKR(grand)],
      ["Paid on", paid && paidAt ? longDay(paidAt.slice(0, 10)) : ""],
      ["Reference", b.number],
    ])}
    ${paid ? "" : `<p style="margin:10px 0 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a97a8">This receipt will show as paid once the property confirms payment at check-in.</p>`}

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
      preheader: `${b.listing.name} · ${longDay(b.startDate)} – ${longDay(b.endDate)} · ${formatPKR(grand)}`,
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
          paid ? "Payment is complete — nothing to pay on arrival." : `Plan to pay ${formatPKR(grand)} at the property.`,
          "Message the host from your booking if you have special requests.",
        ]
      : [
          "Keep your booking number and ID handy for check-in.",
          stay && b.listing.checkIn ? `Check-in opens at ${b.listing.checkIn}.` : "Be ready at the agreed meeting point.",
          paid ? "Payment is complete — nothing to pay on arrival." : `Bring ${formatPKR(grand)} to pay at the property.`,
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
    ["Amount", formatPKR(bookingPackageGrandTotal(b))],
    ["Payment", `${paymentLabel(b)}${wasPaid(b) ? " · paid" : ""}`],
  ];
}

/** bookingIsPaid() is false for cancelled bookings, so read the recorded card payment directly. */
function wasPaid(b: BookingDTO) {
  return b.extra.paymentStatus === "paid" || Boolean(b.extra.paidAt);
}

function refundNote(b: BookingDTO) {
  return wasPaid(b)
    ? "You paid for this booking in advance. If a refund applies under the cancellation policy of your booking, it is returned to your original payment method, and we will email you once it is processed."
    : "You had not paid for this booking yet, so there is nothing to refund.";
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
