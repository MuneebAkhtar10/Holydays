"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { BookingDTO } from "@/lib/booking-dto";
import { addDaysIso, formatDay, formatTime, nightsBetween, todayIso } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { shareText } from "@/lib/booking-view";
import { readJson } from "@/lib/readJson";
import { bookingIsPaid, bookingPackageGrandTotal, bookingPackageHotelNames } from "@/lib/booking-invoice";

const payLabel: Record<string, string> = {
  jazz: "JazzCash",
  easy: "EasyPaisa",
  property: "Pay at property",
  card: "Card (Stripe)",
  stripe: "Card (Stripe)",
};

const CARD = "rounded-2xl border border-brass/25 bg-ink-2/70 p-4";
const EYEBROW = "text-[11px] uppercase tracking-[0.16em] text-brass";

export function bookingStatusInfo(b: BookingDTO): { label: string; tone: "green" | "gold" | "rose" | "muted" } {
  if (b.status === "declined") return { label: "Declined", tone: "muted" };
  if (b.status === "cancelled") return { label: "Cancelled", tone: "muted" };
  if (b.status === "cancel_requested") return { label: "Cancellation requested", tone: "rose" };
  if (b.status === "pending_driver") return { label: "Awaiting driver", tone: "gold" };
  if (b.status === "pending_payment") return { label: "Awaiting payment", tone: "gold" };
  if (b.bucket === "completed") return { label: "Completed", tone: "gold" };
  if (b.bucket === "current") return { label: "Current stay", tone: "green" };
  return { label: "Upcoming", tone: "green" };
}

const TONE = {
  green: ["text-emerald-400", "bg-emerald-400"],
  gold: ["text-brass", "bg-brass"],
  rose: ["text-rose", "bg-rose"],
  muted: ["text-mist", "bg-mist"],
} as const;

export function BookingActions({ booking, origin }: { booking: BookingDTO; origin: string }) {
  const url = `${origin}/bookings/${booking.id}`;
  const text = shareText({
    number: booking.number,
    name: booking.listing.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
    total: booking.total,
    url,
  });
  const wa = String(booking.extra.waLink || `https://wa.me/?text=${encodeURIComponent(text)}`);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: `HolyDays ${booking.number}`, text, url });
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const docs = [
    ["Invoice", `/bookings/${booking.id}/invoice`, "Itemised charges"],
    ["Receipt", `/bookings/${booking.id}/receipt`, "Proof of payment"],
    ["Confirmation", `/bookings/${booking.id}/voucher`, "Show this on arrival"],
  ] as const;

  return (
    <div className={CARD}>
      <p className={EYEBROW}>Documents & sharing</p>
      <a className="btn-primary mt-3 w-full" href={`/api/bookings/${booking.id}/ics`}>
        Add to calendar
      </a>
      <ul className="mt-2 divide-y divide-brass/10">
        {docs.map(([label, href, hint]) => (
          <li key={label}>
            <Link href={href} className="group flex items-center justify-between gap-3 py-2.5 text-sm text-sand">
              <span>
                {label}
                <span className="block text-xs text-mist">{hint}</span>
              </span>
              <span aria-hidden className="text-mist transition-transform group-hover:translate-x-0.5 group-hover:text-brass">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a className="btn-ghost px-3! py-2! text-sm!" href={wa} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
        <button type="button" className="btn-ghost px-3! py-2! text-sm!" onClick={() => void share()}>
          {copied ? "Copied" : "Share"}
        </button>
      </div>
    </div>
  );
}

type SentEmail = { type: string; at: string; to: string };

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Email updates for one booking: what has been sent, what is scheduled, and a way to get another copy. */
export function BookingNotifyStrip({ booking }: { booking: BookingDTO }) {
  const [state, setState] = useState<{ busy: boolean; note: string; ok: boolean }>({ busy: false, note: "", ok: false });
  const [extraSent, setExtraSent] = useState<SentEmail[]>([]);

  const email = booking.guestEmail || "";
  const log = ((Array.isArray(booking.extra.emails) ? booking.extra.emails : []) as SentEmail[]).concat(extraSent);
  const sentAt = (...types: string[]) => [...log].reverse().find((e) => types.includes(e.type))?.at;
  const reminders = (booking.extra.reminders ?? {}) as Record<string, string>;
  const today = todayIso();
  const isConfirmed = booking.status === "confirmed";

  type Row = { label: string; detail: string; state: "sent" | "scheduled" | "waiting" };
  const rows: Row[] = [];

  const confirmedAt = sentAt("confirmation", "confirmation_resent");
  if (booking.status === "pending_payment") {
    rows.push({ label: "Booking confirmation, invoice & receipt", detail: "Sent as soon as your card payment goes through", state: "waiting" });
  } else if (booking.status === "pending_driver") {
    rows.push({ label: "Trip request", detail: "You will be emailed when the driver answers", state: "waiting" });
  } else if (isConfirmed || booking.status === "cancel_requested" || booking.status === "cancelled") {
    rows.push({
      label: "Booking confirmation, invoice & receipt",
      detail: confirmedAt ? `Sent ${when(confirmedAt)}` : "Sent when the booking was confirmed",
      state: "sent",
    });
  }

  if (isConfirmed) {
    const d7 = addDaysIso(booking.startDate, -7);
    const d1 = addDaysIso(booking.startDate, -1);
    const afterStay = addDaysIso(booking.endDate, 1);
    const sentD7 = reminders.d7;
    const sentD1 = reminders.d1 || reminders.d0;
    const sentReview = reminders.review;
    if (sentD7) rows.push({ label: "One-week reminder", detail: `Sent ${when(sentD7)}`, state: "sent" });
    else if (d7 > today) rows.push({ label: "One-week reminder", detail: `Scheduled for ${when(d7)}`, state: "scheduled" });
    if (sentD1) rows.push({ label: "Arrival details", detail: `Sent ${when(sentD1)}`, state: "sent" });
    else if (d1 >= today) rows.push({ label: "Arrival details", detail: `Scheduled for ${when(d1)}`, state: "scheduled" });
    if (sentReview) rows.push({ label: "Thank-you & review request", detail: `Sent ${when(sentReview)}`, state: "sent" });
    else if (afterStay >= today) rows.push({ label: "Thank-you & review request", detail: `Scheduled for ${when(afterStay)}`, state: "scheduled" });
  }

  if (booking.status === "cancel_requested") {
    rows.push({ label: "Cancellation request received", detail: "We will email you the decision", state: "sent" });
  }
  if (booking.status === "cancelled") {
    const at = sentAt("cancelled");
    rows.push({ label: "Cancellation confirmed", detail: at ? `Sent ${when(at)}` : "Sent when the cancellation was confirmed", state: "sent" });
  }

  const resend = async () => {
    setState({ busy: true, note: "", ok: false });
    try {
      const res = await fetch(`/api/bookings/${booking.id}/resend`, { method: "POST" });
      const data = await readJson<{ error?: string; to?: string }>(res);
      if (!res.ok) {
        setState({ busy: false, note: data?.error || "Could not send the email.", ok: false });
        return;
      }
      setExtraSent((l) => [...l, { type: "confirmation_resent", at: new Date().toISOString(), to: data?.to ?? email }]);
      setState({ busy: false, note: `Sent to ${data?.to ?? email}. Check your inbox and spam folder.`, ok: true });
    } catch {
      setState({ busy: false, note: "Could not reach the server. Try again.", ok: false });
    }
  };

  const dot = { sent: "bg-emerald-500", scheduled: "bg-brass", waiting: "bg-mist" } as const;

  return (
    <div className="rounded-2xl border border-brass/25 bg-ink-2/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Email updates</p>
          <p className="mt-1 text-sm text-mist">
            {email ? (
              <>
                We email <span className="text-sand">{email}</span> about this booking.
              </>
            ) : (
              "We email you about this booking."
            )}
          </p>
        </div>
        {isConfirmed && email && (
          <button type="button" className="btn-ghost px-3! py-1.5! text-xs!" disabled={state.busy} onClick={() => void resend()}>
            {state.busy ? "Sending…" : "Resend confirmation"}
          </button>
        )}
      </div>

      <ul className="mt-3 divide-y divide-brass/10">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 py-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[r.state]}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug text-sand">{r.label}</span>
              <span className={`mt-0.5 block text-xs ${r.state === "sent" ? "text-emerald-500" : "text-mist"}`}>{r.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {state.note && <p className={`mt-2 text-xs ${state.ok ? "text-emerald-500" : "text-rose"}`}>{state.note}</p>}
    </div>
  );
}

export function PaymentBlock({ booking }: { booking: BookingDTO }) {
  const { money, currency } = useSerai();
  const quote = booking.extra.quote as { grand?: number; taxes?: number; total?: number } | undefined;
  const isPackage = Boolean(booking.extra.package);
  const grandTotal = bookingPackageGrandTotal(booking);
  const paid = bookingIsPaid(booking);
  const refund = booking.extra.refund as { amountPkr: number; percent: number; status: string } | undefined;
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const state =
    booking.status === "cancelled" || booking.status === "declined"
      ? { label: "Cancelled", cls: "bg-sand/10 text-mist" }
      : paid
        ? { label: "Paid", cls: "bg-emerald-500/15 text-emerald-400" }
        : booking.status === "pending_payment"
          ? { label: "Awaiting payment", cls: "bg-brass/20 text-brass" }
          : { label: "Pay on arrival", cls: "bg-brass/20 text-brass" };

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <p className={EYEBROW}>Payment</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${state.cls}`}>{state.label}</span>
      </div>
      <p className="font-display mt-2 text-4xl leading-none">{money(grandTotal)}</p>
      <p className="mt-1.5 text-sm text-mist">{payLabel[booking.payment] || booking.payment}</p>

      {!isPackage && quote && (
        <ul className="mt-3 space-y-1.5 border-t border-brass/10 pt-3 text-sm text-mist">
          <li className="flex justify-between gap-3">
            <span>{booking.listing.kind === "STAY" ? "Accommodation" : "Booking"}</span>
            <span className="tabular-nums text-sand">{money(quote.total ?? 0)}</span>
          </li>
          {(quote.taxes ?? 0) > 0 && (
            <li className="flex justify-between gap-3">
              <span>Taxes & fees</span>
              <span className="tabular-nums text-sand">{money(quote.taxes ?? 0)}</span>
            </li>
          )}
        </ul>
      )}
      {booking.status === "cancelled" && refund ? (
        <p className="mt-3 rounded-lg border border-brass/20 bg-brass/10 px-3 py-2 text-sm text-sand">
          {refund.amountPkr > 0
            ? `Refunded ${money(refund.amountPkr)} (${refund.percent}%) to your card. Banks usually show it within 5 to 10 business days.`
            : "No refund applies under the cancellation terms of this rate."}
        </p>
      ) : null}
      {isPackage && <p className="mt-3 border-t border-brass/10 pt-3 text-xs text-mist">Itemised in your package above. Open the invoice for the full breakdown.</p>}

      {booking.status === "pending_payment" ? (
        <div className="mt-4 space-y-2">
          {payError ? <p className="text-sm text-rose">{payError}</p> : null}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={paying}
            onClick={async () => {
              setPayError("");
              setPaying(true);
              const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: booking.id, currency }),
              });
              const data = await readJson<{ url?: string; error?: string }>(res);
              setPaying(false);
              if (!res.ok || !data?.url) {
                setPayError(data?.error || "Could not restart card payment");
                return;
              }
              window.location.assign(data.url);
            }}
          >
            {paying ? "Opening Stripe…" : "Pay with card"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BookingHero({ booking }: { booking: BookingDTO }) {
  const { money } = useSerai();
  const pack = booking.extra.package as { stays?: { name: string; checkin: string; checkout: string }[] } | undefined;
  const extraHotels = pack?.stays ?? [];
  const isMultiHotelPackage = extraHotels.length > 0;
  const hotelNames = bookingPackageHotelNames(booking);
  const grandTotal = bookingPackageGrandTotal(booking);
  const tripStart = [booking.startDate, ...extraHotels.map((s) => s.checkin)].sort()[0];
  const tripEnd = [booking.endDate, ...extraHotels.map((s) => s.checkout)].sort().slice(-1)[0];
  const info = bookingStatusInfo(booking);
  const [toneText, toneDot] = TONE[info.tone];
  const reservation = Boolean(booking.extra.reservation && booking.extra.time);
  const stay = booking.listing.kind === "STAY";
  const nights = nightsBetween(tripStart, tripEnd);

  const facts: { label: string; value: string; sub?: string }[] = reservation
    ? [
        { label: "Date", value: formatDay(booking.startDate) },
        { label: "Time", value: formatTime(String(booking.extra.time)) },
        { label: "Party", value: `${booking.guests} guest${booking.guests === 1 ? "" : "s"}` },
        { label: "Total", value: money(grandTotal) },
      ]
    : stay || isMultiHotelPackage
      ? [
          { label: "Check-in", value: formatDay(tripStart), sub: booking.listing.checkIn ? `from ${booking.listing.checkIn}` : undefined },
          { label: "Check-out", value: formatDay(tripEnd), sub: `${nights} night${nights === 1 ? "" : "s"}` },
          { label: "Guests", value: `${booking.guests}` },
          { label: "Total", value: money(grandTotal) },
        ]
      : [
          { label: "Date", value: tripStart === tripEnd ? formatDay(tripStart) : `${formatDay(tripStart)} — ${formatDay(tripEnd)}` },
          { label: "Guests", value: `${booking.guests}` },
          { label: "Total", value: money(grandTotal) },
        ];

  return (
    <div className="overflow-hidden rounded-3xl border border-brass/25 bg-ink-2/70">
      <div className="relative h-56 sm:h-64">
        <Image src={booking.listing.cover || "/images/hero-hunza-dusk.png"} alt="" fill priority sizes="(min-width: 1152px) 1100px, 100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <span className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] backdrop-blur ${toneText}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${toneDot}`} />
          {info.label}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-brass">Booking {booking.number}</p>
          <h1 className="font-display mt-1 text-3xl leading-tight text-bone sm:text-4xl">
            {isMultiHotelPackage ? hotelNames.join(" · ") : booking.listing.name}
          </h1>
          <p className="mt-1 text-sm text-sand/80">
            {[booking.listing.city, booking.listing.region].filter(Boolean).join(", ")}
            {isMultiHotelPackage ? ` · ${hotelNames.length} hotels` : ""}
          </p>
        </div>
      </div>
      <dl className={`grid divide-brass/15 sm:divide-x ${facts.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} max-sm:divide-y`}>
        {facts.map((f) => (
          <div key={f.label} className="px-5 py-3.5">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-mist">{f.label}</dt>
            <dd className="mt-0.5 text-base font-semibold text-sand">{f.value}</dd>
            {f.sub && <p className="text-xs text-mist">{f.sub}</p>}
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Property and host contact details. Emails are shown as plain text; phone numbers get a call button. */
export function BookingContacts({ booking }: { booking: BookingDTO }) {
  const l = booking.listing;
  const tel = (v: string) => v.replace(/\s/g, "");
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.name, l.address || `${l.city}, ${l.region}`].join(", "))}`;
  const line = (label: string, value: string) =>
    value ? (
      <div className="flex gap-3 py-1 text-sm">
        <dt className="w-14 shrink-0 text-mist">{label}</dt>
        <dd className="min-w-0 break-words text-sand">{value}</dd>
      </div>
    ) : null;

  return (
    <section className={`${CARD} p-5`}>
      <h2 className="font-display text-xl">Property & host</h2>
      <div className="mt-3 grid gap-5 sm:grid-cols-2 sm:divide-x sm:divide-brass/15">
        <div>
          <p className={EYEBROW}>Property</p>
          <p className="mt-1 font-semibold text-sand">{l.name}</p>
          <dl className="mt-1">
            {line("Phone", l.phone)}
            {line("Email", l.email)}
            {line("Address", l.address || [l.city, l.region].filter(Boolean).join(", "))}
            {line("Check-in", l.checkIn)}
            {line("Check-out", l.checkOut)}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {l.phone && (
              <a className="btn-ghost px-3! py-1.5! text-xs!" href={`tel:${tel(l.phone)}`}>
                Call
              </a>
            )}
            <a className="btn-ghost px-3! py-1.5! text-xs!" href={maps} target="_blank" rel="noreferrer">
              Directions
            </a>
            <Link className="btn-ghost px-3! py-1.5! text-xs!" href={l.path}>
              Property page
            </Link>
          </div>
        </div>

        <div className="sm:pl-5">
          <p className={EYEBROW}>Host</p>
          {l.hostName ? (
            l.hostContactRevealed ? (
              <>
                <p className="mt-1 font-semibold text-sand">{l.hostName}</p>
                <dl className="mt-1">
                  {line("Phone", l.hostPhone)}
                  {line("Email", l.hostEmail)}
                  {line("Best time", l.hostContactHours)}
                </dl>
                {l.hostPhone && (
                  <div className="mt-3">
                    <a className="btn-ghost px-3! py-1.5! text-xs!" href={`tel:${tel(l.hostPhone)}`}>
                      Call host
                    </a>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mt-1 font-semibold text-sand">{l.hostName}</p>
                <p className="mt-1 text-sm text-mist">Full host contact details unlock once your booking is confirmed.</p>
              </>
            )
          ) : (
            <p className="mt-1 text-sm text-mist">Use the messages below to reach the host.</p>
          )}
        </div>
      </div>
    </section>
  );
}
