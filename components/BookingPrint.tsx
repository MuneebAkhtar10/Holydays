"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { PageLoader } from "@/components/PageLoader";
import { readJson } from "@/lib/readJson";
import type { BookingDTO } from "@/lib/booking-dto";
import { bookingInvoiceBreakdown, bookingPackageGrandTotal, bookingPackageHotelNames } from "@/lib/booking-invoice";
import { APP_NAME } from "@/lib/brand";
import { formatDay } from "@/lib/format";
import { useSerai } from "@/lib/store";

export function BookingPrint({ kind }: { kind: "invoice" | "receipt" | "voucher" }) {
  const { money } = useSerai();
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDTO | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch(`/api/bookings/${id}`)
      .then((r) => readJson<BookingDTO & { error?: string }>(r))
      .then((d) => {
        setBooking(!d || d.error ? null : d);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [id]);

  const breakdown = useMemo(() => (booking ? bookingInvoiceBreakdown(booking) : null), [booking]);

  if (!ready) return <PageLoader label="Opening document" />;
  if (!booking) return <p className="p-10 text-mist">Booking not found.</p>;

  const title = kind === "invoice" ? "Invoice" : kind === "receipt" ? "Receipt" : "Booking confirmation";
  const quote = booking.extra.quote as { total?: number; taxes?: number; grand?: number } | undefined;
  const isPackage = Boolean(booking.extra.package);
  const hotelNames = bookingPackageHotelNames(booking);
  const grandTotal = bookingPackageGrandTotal(booking);
  const stay = quote?.total ?? booking.total;
  const taxes = quote?.taxes ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 text-sand print:text-black">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <Link href={`/bookings/${booking.id}`} className="btn-ghost">
          Back
        </Link>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          Print / save PDF
        </button>
      </div>
      <div className="paper mt-6 p-8">
        <BrandLogo size="sm" />
        <h1 className="font-display mt-2 text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink/60">Booking {booking.number}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="uppercase tracking-widest text-[11px] text-ink/40">Guest</p>
            <p className="mt-1">{booking.guestName}</p>
            <p>{booking.guestEmail}</p>
            <p>{booking.phone}</p>
          </div>
          <div>
            <p className="uppercase tracking-widest text-[11px] text-ink/40">{isPackage ? "Ziyarat package" : "Property"}</p>
            {isPackage ? (
              hotelNames.map((name) => <p key={name}>{name}</p>)
            ) : (
              <>
                <p className="mt-1">{booking.listing.name}</p>
                <p>{booking.listing.address || `${booking.listing.city}, ${booking.listing.region}`}</p>
              </>
            )}
          </div>
        </div>
        <p className="mt-6">
          {formatDay(booking.startDate)} — {formatDay(booking.endDate)} · {booking.guests} guests
        </p>
        {kind === "invoice" && (
          <div className="mt-6">
            {isPackage && breakdown ? (
              <div className="space-y-4">
                {breakdown.hotels.map((h) => (
                  <div key={h.id} className="rounded-xl border border-ink/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{h.name}</p>
                        <p className="text-xs text-ink/50">
                          {h.city} · {formatDay(h.checkin)} — {formatDay(h.checkout)}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium">{money(h.roomAmount)}</p>
                    </div>
                    {h.mealLines.length > 0 && (
                      <table className="mt-3 w-full border-t border-ink/10 pt-1 text-sm">
                        <tbody>
                          {h.mealLines.map((m) => (
                            <tr key={m.id} className="text-ink/65">
                              <td className="py-1 pr-4">{m.label}</td>
                              <td className="py-1 text-right">{money(m.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
                {breakdown.extras.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-ink/40">Transfers & ziyarat</p>
                    <table className="mt-2 w-full text-sm">
                      <tbody>
                        {breakdown.extras.map((line) => (
                          <tr key={line.id} className="border-b border-ink/10">
                            <td className="py-2 pr-4 leading-snug">{line.label}</td>
                            <td className="py-2 text-right align-top">{money(line.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex items-baseline justify-between border-t border-ink/20 pt-3">
                  <p className="font-display text-xl">Amount due</p>
                  <p className="font-display text-xl">{money(grandTotal)}</p>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {stay > 0 && (
                    <tr className="border-b border-ink/10">
                      <td className="py-2">Accommodation</td>
                      <td className="py-2 text-right">{money(stay)}</td>
                    </tr>
                  )}
                  {taxes > 0 && (
                    <tr className="border-b border-ink/10">
                      <td className="py-2">Taxes & fees</td>
                      <td className="py-2 text-right">{money(taxes)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-3 font-display text-xl">Amount due</td>
                    <td className="py-3 text-right font-display text-xl">{money(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}
        {kind === "receipt" && (
          <div className="mt-6 rounded-xl bg-ink/5 p-4">
            <p className="text-sm">Payment method: {booking.payment === "property" ? "Pay at property" : booking.payment}</p>
            {isPackage && breakdown ? (
              <div className="mt-3 space-y-3">
                {breakdown.hotels.map((h) => (
                  <div key={h.id}>
                    <div className="flex justify-between gap-3 text-sm font-medium">
                      <span>{h.name}</span>
                      <span>{money(h.subtotal)}</span>
                    </div>
                    {h.mealLines.length > 0 && (
                      <ul className="mt-1 space-y-1 pl-3 text-sm text-ink/60">
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
                  <ul className="space-y-1.5 border-t border-ink/10 pt-2 text-sm">
                    {breakdown.extras.map((line) => (
                      <li key={line.id} className="flex justify-between gap-3">
                        <span className="leading-snug">{line.label}</span>
                        <span className="shrink-0">{money(line.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            <p className="mt-3 font-display text-2xl">{money(grandTotal)}</p>
            <p className="mt-1 text-sm text-ink/50">
              {booking.payment === "property"
                ? "Collect at check-in. This is not a card capture."
                : booking.payment === "card" || booking.payment === "stripe"
                  ? `Paid by card on ${APP_NAME}.`
                  : `Marked paid on ${APP_NAME}.`}
            </p>
          </div>
        )}
        {kind === "voucher" && (
          <div className="mt-6 border border-dashed border-ink/20 p-6 text-center">
            <p className="font-display text-5xl tracking-[0.2em]">{booking.number}</p>
            <p className="mt-3 text-sm text-ink/60">Show this at reception · Check-in {booking.listing.checkIn}</p>
            <p className="mt-6 text-xs uppercase tracking-widest text-ink/40">Status: {booking.status}</p>
          </div>
        )}
        <p className="mt-8 text-xs text-ink/40">
          Issued {formatDay(booking.createdAt.slice(0, 10))} · {APP_NAME}
        </p>
      </div>
    </div>
  );
}
