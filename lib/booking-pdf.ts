import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { BookingDTO } from "@/lib/booking-dto";
import { bookingInvoiceBreakdown, bookingIsPaid, bookingPackageGrandTotal, bookingPackageHotelNames } from "@/lib/booking-invoice";
import { formatMoney, type DisplayCurrency } from "@/lib/currency";
import { formatTime, nightsBetween } from "@/lib/format";

export type PdfKind = "invoice" | "receipt" | "voucher";

const NAVY = rgb(0.063, 0.161, 0.282);
const GOLD = rgb(0.773, 0.643, 0.416);
const GOLD_DARK = rgb(0.541, 0.424, 0.196);
const INK = rgb(0.063, 0.161, 0.282);
const SOFT = rgb(0.29, 0.353, 0.439);
const MUTED = rgb(0.478, 0.529, 0.6);
const LINE = rgb(0.91, 0.875, 0.8);
const CREAM = rgb(0.965, 0.941, 0.894);
const GREEN = rgb(0.118, 0.42, 0.227);
const WHITE = rgb(1, 1, 1);

const W = 595.28;
const H = 841.89;
const M = 48;

/** Standard PDF fonts only cover Latin text; anything else becomes "?" instead of crashing the file. */
const safe = (s: string) => String(s ?? "").replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?");

const longDay = (iso: string) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : "";

class Sheet {
  doc!: PDFDocument;
  page!: PDFPage;
  sans!: PDFFont;
  sansBold!: PDFFont;
  serif!: PDFFont;
  y = 0;

  static async create() {
    const s = new Sheet();
    s.doc = await PDFDocument.create();
    s.sans = await s.doc.embedFont(StandardFonts.Helvetica);
    s.sansBold = await s.doc.embedFont(StandardFonts.HelveticaBold);
    s.serif = await s.doc.embedFont(StandardFonts.TimesRoman);
    s.addPage();
    return s;
  }

  addPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
  }

  ensure(height: number) {
    if (this.y - height < M + 24) {
      this.addPage();
      this.header(true);
    }
  }

  header(compact = false) {
    const h = compact ? 46 : 74;
    this.page.drawRectangle({ x: 0, y: H - h, width: W, height: h, color: NAVY });
    this.page.drawText("HOLYDAYS", { x: M, y: H - h / 2 - 8, size: 22, font: this.serif, color: GOLD });
    this.page.drawText("Hotels, Ziyarat and taxis for Saudi Arabia, Iraq and Iran", {
      x: W - M - this.sans.widthOfTextAtSize("Hotels, Ziyarat and taxis for Saudi Arabia, Iraq and Iran", 7.5),
      y: H - h / 2 - 3,
      size: 7.5,
      font: this.sans,
      color: rgb(0.72, 0.77, 0.84),
    });
    this.y = H - h - 28;
  }

  text(t: string, o: { x?: number; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const size = o.size ?? 10;
    this.page.drawText(safe(t), { x: o.x ?? M, y: this.y - size, size, font: o.font ?? this.sans, color: o.color ?? INK });
    this.y -= size + (o.gap ?? 6);
  }

  right(t: string, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; y?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.font ?? this.sans;
    const s = safe(t);
    this.page.drawText(s, { x: W - M - font.widthOfTextAtSize(s, size), y: (o.y ?? this.y) - size, size, font, color: o.color ?? INK });
  }

  wrap(t: string, width: number, size: number, font: PDFFont) {
    const out: string[] = [];
    let line = "";
    for (const word of safe(t).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  }

  rule(color = LINE) {
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.7, color });
    this.y -= 10;
  }

  eyebrow(t: string) {
    this.y -= 6;
    this.text(t.toUpperCase(), { size: 8, font: this.sansBold, color: GOLD_DARK, gap: 8 });
  }

  /** Label / value pairs inside a cream card. */
  card(rows: [string, string][]) {
    const shown = rows.filter(([, v]) => v);
    const h = shown.length * 20 + 16;
    this.ensure(h);
    this.page.drawRectangle({ x: M, y: this.y - h, width: W - M * 2, height: h, color: CREAM });
    let y = this.y - 14;
    for (const [label, value] of shown) {
      this.page.drawText(safe(label), { x: M + 14, y: y - 8, size: 9, font: this.sans, color: MUTED });
      const maxW = W - M * 2 - 150;
      const lines = this.wrap(value, maxW, 9.5, this.sansBold);
      this.page.drawText(lines[0] ?? "", { x: M + 140, y: y - 8, size: 9.5, font: this.sansBold, color: INK });
      y -= 20;
    }
    this.y -= h + 6;
  }

  item(label: string, amount: string, o: { note?: string; indent?: boolean; bold?: boolean } = {}) {
    const size = o.indent ? 9 : 10;
    const font = o.bold || !o.indent ? this.sansBold : this.sans;
    const maxW = W - M * 2 - 110 - (o.indent ? 14 : 0);
    const lines = this.wrap(label, maxW, size, font);
    const height = lines.length * (size + 3) + (o.note ? 11 : 0) + 8;
    this.ensure(height);
    const x = M + (o.indent ? 14 : 0);
    let y = this.y;
    lines.forEach((ln, i) => {
      this.page.drawText(ln, { x, y: y - size, size, font, color: o.indent ? SOFT : INK });
      if (i === 0 && amount) {
        const s = safe(amount);
        this.page.drawText(s, { x: W - M - font.widthOfTextAtSize(s, size), y: y - size, size, font, color: o.indent ? SOFT : INK });
      }
      y -= size + 3;
    });
    if (o.note) {
      this.page.drawText(safe(o.note), { x, y: y - 8, size: 8, font: this.sans, color: MUTED });
      y -= 11;
    }
    this.y = y - 5;
    if (!o.indent) this.page.drawLine({ start: { x: M, y: this.y + 2 }, end: { x: W - M, y: this.y + 2 }, thickness: 0.5, color: LINE });
  }

  totalBar(label: string, amount: string, note?: string) {
    this.ensure(56);
    const h = 46;
    this.page.drawRectangle({ x: M, y: this.y - h, width: W - M * 2, height: h, color: NAVY });
    this.page.drawText(safe(label.toUpperCase()), { x: M + 16, y: this.y - 19, size: 8.5, font: this.sansBold, color: GOLD });
    if (note) this.page.drawText(safe(note), { x: M + 16, y: this.y - 33, size: 8.5, font: this.sans, color: rgb(0.72, 0.77, 0.84) });
    const s = safe(amount);
    this.page.drawText(s, { x: W - M - 16 - this.serif.widthOfTextAtSize(s, 22), y: this.y - 31, size: 22, font: this.serif, color: WHITE });
    this.y -= h + 12;
  }

  pill(t: string, color: ReturnType<typeof rgb>, x: number, y: number) {
    const s = safe(t.toUpperCase());
    const w = this.sansBold.widthOfTextAtSize(s, 8) + 18;
    this.page.drawRectangle({ x, y: y - 4, width: w, height: 17, color, opacity: 0.14 });
    this.page.drawText(s, { x: x + 9, y: y + 1, size: 8, font: this.sansBold, color });
    return w;
  }

  footer() {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: 38 }, end: { x: W - M, y: 38 }, thickness: 0.5, color: LINE });
      p.drawText("HolyDays  -  holydays-bay.vercel.app", { x: M, y: 24, size: 8, font: this.sans, color: MUTED });
      const t = `Page ${i + 1} of ${pages.length}`;
      p.drawText(t, { x: W - M - this.sans.widthOfTextAtSize(t, 8), y: 24, size: 8, font: this.sans, color: MUTED });
    });
  }
}

export async function buildBookingPdf(b: BookingDTO, kind: PdfKind, currency: DisplayCurrency = "PKR") {
  const money = (n: number) => formatMoney(n, currency).replace(/[^\x20-\x7E -ÿ]/g, "");
  const s = await Sheet.create();
  s.header();

  const paid = bookingIsPaid(b);
  const grand = bookingPackageGrandTotal(b);
  const code = b.number.replace(/^HD-/, "");
  const isPackage = Boolean(b.extra.package);
  const breakdown = isPackage ? bookingInvoiceBreakdown(b) : null;
  const reservation = Boolean(b.extra.reservation && b.extra.time);
  const stay = b.listing.kind === "STAY";
  const issued = longDay(b.createdAt.slice(0, 10));
  const nights = nightsBetween(b.startDate, b.endDate);

  const title = kind === "invoice" ? "Invoice" : kind === "receipt" ? "Receipt" : "Booking confirmation";
  const docNo = kind === "invoice" ? `INV-${code}` : kind === "receipt" ? `RC-${code}` : b.number;

  // Title row
  s.page.drawText(title, { x: M, y: s.y - 24, size: 30, font: s.serif, color: INK });
  s.right(docNo, { y: s.y - 6, size: 11, font: s.sansBold, color: INK });
  s.right(`Issued ${issued}`, { y: s.y - 22, size: 8.5, color: MUTED });
  s.y -= 46;
  const status = b.status === "cancelled" ? ["Cancelled", rgb(0.63, 0.15, 0.15)] : paid ? ["Paid", GREEN] : ["Due at property", GOLD_DARK];
  const pw = s.pill(String(status[0]), status[1] as ReturnType<typeof rgb>, M, s.y - 9);
  s.text(`Booking ${b.number}`, { x: M + pw + 12, size: 9, color: MUTED, gap: 14 });
  s.y -= 4;

  // Parties
  s.eyebrow(kind === "voucher" ? "Reservation" : "Billed to");
  s.card(
    kind === "voucher"
      ? [
          ["Guest", b.guestName ?? ""],
          ["Phone", b.phone],
          [isPackage ? "Package" : stay ? "Property" : "Service", isPackage ? bookingPackageHotelNames(b).join(", ") : b.listing.name],
          ["Location", b.listing.address || `${b.listing.city}, ${b.listing.region}`],
          [reservation ? "Date" : stay ? "Check-in" : "Starts", `${longDay(b.startDate)}${reservation ? ` at ${formatTime(String(b.extra.time))}` : stay && b.listing.checkIn ? `, from ${b.listing.checkIn}` : ""}`],
          [stay ? "Check-out" : "Ends", reservation ? "" : `${longDay(b.endDate)}${stay && b.listing.checkOut ? `, by ${b.listing.checkOut}` : ""}`],
          ["Guests", `${b.guests}`],
          ["Property phone", b.listing.phone],
        ]
      : [
          ["Guest", b.guestName ?? ""],
          ["Email", b.guestEmail ?? ""],
          ["Phone", b.phone],
          [isPackage ? "Package" : stay ? "Property" : "Service", isPackage ? bookingPackageHotelNames(b).join(", ") : b.listing.name],
          [reservation ? "Date" : "Dates", reservation ? `${longDay(b.startDate)} at ${formatTime(String(b.extra.time))}` : `${longDay(b.startDate)} to ${longDay(b.endDate)}${stay ? `  (${nights} night${nights === 1 ? "" : "s"})` : ""}`],
          ["Guests", `${b.guests}`],
        ],
  );

  if (kind === "voucher") {
    s.ensure(110);
    s.y -= 6;
    const h = 92;
    s.page.drawRectangle({ x: M, y: s.y - h, width: W - M * 2, height: h, borderColor: GOLD, borderWidth: 1, borderDashArray: [4, 3] });
    const t = safe(b.number);
    s.page.drawText(t, { x: W / 2 - s.serif.widthOfTextAtSize(t, 40) / 2, y: s.y - 50, size: 40, font: s.serif, color: NAVY });
    const hint = reservation ? `Show this at the restaurant  -  table for ${b.guests}` : "Show this at reception on arrival";
    s.page.drawText(hint, { x: W / 2 - s.sans.widthOfTextAtSize(hint, 9.5) / 2, y: s.y - 72, size: 9.5, font: s.sans, color: SOFT });
    s.y -= h + 16;
    s.eyebrow("Good to know");
    for (const line of [
      "Carry a valid passport or national ID for every guest.",
      paid ? "Your payment is complete. Nothing more to pay on arrival." : `Amount due at the property: ${money(grand)}.`,
      `Booking details and messages: holydays-bay.vercel.app/bookings/${b.id}`,
    ]) {
      s.ensure(18);
      s.text(`-  ${line}`, { size: 9.5, color: SOFT, gap: 5 });
    }
  } else {
    // Line items
    s.eyebrow(kind === "invoice" ? "Charges" : "Payment breakdown");
    if (breakdown) {
      for (const h of breakdown.hotels) {
        s.item(h.name, money(h.roomAmount), { note: `${h.city}  -  ${longDay(h.checkin)} to ${longDay(h.checkout)}` });
        for (const m of h.mealLines) s.item(m.label, money(m.amount), { indent: true });
      }
      for (const x of breakdown.extras) s.item(x.label, x.amount ? money(x.amount) : "");
    } else {
      const quote = b.extra.quote as { total?: number; taxes?: number } | undefined;
      s.item(stay ? "Accommodation" : b.listing.name, money(quote?.total ?? b.total));
      if ((quote?.taxes ?? 0) > 0) s.item("Taxes & fees", money(quote!.taxes!));
    }
    s.y -= 6;
    s.totalBar(
      kind === "receipt" || paid ? "Amount paid" : "Amount due",
      money(grand),
      paid ? "Paid in full" : b.payment === "property" ? "Payable at the property" : "Awaiting payment",
    );

    if (kind === "receipt") {
      s.eyebrow("Payment details");
      const paidAt = String(b.extra.paidAt ?? "");
      s.card([
        ["Method", b.payment === "property" ? "Pay at the property" : b.payment === "card" || b.payment === "stripe" ? "Card" : b.payment],
        ["Status", paid ? "Paid" : "Not yet paid"],
        ["Paid on", paid && paidAt ? longDay(paidAt.slice(0, 10)) : ""],
        ["Reference", b.number],
      ]);
      s.text(
        b.payment === "property" ? "Collect at check-in. This is not a card capture." : "Thank you. This receipt confirms your payment.",
        { size: 9, color: MUTED },
      );
    }
  }

  s.footer();
  return s.doc.save();
}
