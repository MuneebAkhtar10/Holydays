"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { BookingDTO } from "@/lib/booking-dto";
import { formatDay } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { shareText } from "@/lib/booking-view";
import { bookingInvoiceBreakdown, bookingPackageGrandTotal, bookingPackageHotelNames } from "@/lib/booking-invoice";

const payLabel: Record<string, string> = {
  jazz: "JazzCash",
  easy: "EasyPaisa",
  property: "Pay at property",
};

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

  return (
    <div className="flex flex-wrap gap-2">
      <a className="btn-primary" href={`/api/bookings/${booking.id}/ics`}>
        Add to calendar
      </a>
      <Link className="btn-ghost text-sand" href={`/bookings/${booking.id}`}>
        View booking online
      </Link>
      <Link className="btn-ghost text-sand" href={`/bookings/${booking.id}/invoice`}>
        Invoice
      </Link>
      <Link className="btn-ghost text-sand" href={`/bookings/${booking.id}/receipt`}>
        Receipt
      </Link>
      <Link className="btn-ghost text-sand" href={`/bookings/${booking.id}/voucher`}>
        Download confirmation
      </Link>
      <a className="btn-ghost text-sand" href={wa} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <button type="button" className="btn-ghost text-sand" onClick={() => void share()}>
        {copied ? "Copied" : "Share booking"}
      </button>
    </div>
  );
}

export function BookingNotifyStrip({ booking }: { booking: BookingDTO }) {
  const notify = (booking.extra.notify as { email?: boolean; sms?: boolean; whatsapp?: boolean; push?: boolean } | undefined) ?? {
    email: true,
    sms: Boolean(booking.phone),
    whatsapp: Boolean(booking.phone),
    push: true,
  };
  const [push, setPush] = useState("Browser push ready");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPush("Push not supported on this device");
      return;
    }
    const body = `${booking.listing.name} · ${formatDay(booking.startDate)} — ${formatDay(booking.endDate)}`;
    const fire = () => new Notification(`HolyDays ${booking.number} confirmed`, { body });
    if (Notification.permission === "granted") fire();
    else if (Notification.permission === "default") {
      void Notification.requestPermission().then((p) => {
        if (p === "granted") fire();
        setPush(p === "granted" ? "Push sent" : "Push permission skipped");
      });
    } else setPush("Push blocked in this browser");
  }, [booking.id, booking.listing.name, booking.number, booking.startDate, booking.endDate]);

  const row = [
    ["Email", notify.email],
    ["SMS", notify.sms],
    ["WhatsApp", notify.whatsapp],
    ["Push", notify.push],
  ] as const;

  return (
    <div className="rounded-2xl border border-brass/25 bg-ink-2/70 p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Notifications</p>
      <ul className="mt-3 grid gap-2 text-sm text-sand sm:grid-cols-2">
        {row.map(([label, on]) => (
          <li key={label}>
            {label}: {on ? "Sent / queued" : "Not sent"}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-mist">{push}</p>
    </div>
  );
}

export function PaymentBlock({ booking }: { booking: BookingDTO }) {
  const { money } = useSerai();
  const quote = booking.extra.quote as { grand?: number; taxes?: number; total?: number } | undefined;
  const isPackage = Boolean(booking.extra.package);
  const breakdown = isPackage ? bookingInvoiceBreakdown(booking) : null;
  const grandTotal = bookingPackageGrandTotal(booking);
  return (
    <div className="rounded-2xl border border-brass/25 p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Payment</p>
      <p className="mt-2 font-display text-2xl">{money(grandTotal)}</p>
      <p className="mt-1 text-sm text-mist">{payLabel[booking.payment] || booking.payment}</p>

      {breakdown ? (
        <div className="mt-4 space-y-3">
          {breakdown.hotels.map((h) => (
            <div key={h.id} className="rounded-xl bg-ink/20 p-3">
              <div className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-sand">{h.name}</p>
                  <p className="text-xs text-mist">
                    {h.city} · {formatDay(h.checkin)} — {formatDay(h.checkout)}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-sand">{money(h.roomAmount)}</span>
              </div>
              {h.mealLines.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-sand/10 pt-2 text-xs text-mist">
                  {h.mealLines.map((m) => (
                    <li key={m.id} className="flex justify-between gap-3">
                      <span className="leading-snug">{m.label}</span>
                      <span className="shrink-0">{money(m.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {breakdown.extras.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-mist">Transfers & ziyarat</p>
              <ul className="mt-1.5 space-y-1 text-sm text-mist">
                {breakdown.extras.map((line) => (
                  <li key={line.id} className="flex justify-between gap-3">
                    <span className="leading-snug">{line.label}</span>
                    <span className="shrink-0">{money(line.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : quote ? (
        <ul className="mt-3 space-y-1 text-sm text-mist">
          <li className="flex justify-between gap-3">
            <span>Hotel</span>
            <span>{money(quote.total ?? 0)}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span>Taxes & fees</span>
            <span>{money(quote.taxes ?? 0)}</span>
          </li>
        </ul>
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
  return (
    <div className="overflow-hidden rounded-2xl border border-brass/25">
      <div className="relative h-48">
        <Image src={booking.listing.cover || "/images/hero-hunza-dusk.png"} alt="" fill className="object-cover" />
      </div>
      <div className="p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-brass">{booking.number}</p>
        {isMultiHotelPackage ? (
          <>
            <h1 className="font-display mt-1 text-3xl">{hotelNames.join(" · ")}</h1>
            <p className="mt-2 text-mist">
              {formatDay(tripStart)} — {formatDay(tripEnd)} · {booking.guests} guest{booking.guests === 1 ? "" : "s"} · {money(grandTotal)}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display mt-1 text-3xl">{booking.listing.name}</h1>
            <p className="mt-2 text-mist">
              {formatDay(booking.startDate)} — {formatDay(booking.endDate)} · {booking.guests} guest{booking.guests === 1 ? "" : "s"}
              {booking.listing.city ? ` · ${booking.listing.city}` : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
