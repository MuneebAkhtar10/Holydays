"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/readJson";
import type { BookingDTO } from "@/lib/booking-dto";

/**
 * The guest's scannable pass. Staff scan it at the door and the link opens the booking's live state,
 * so a cancelled booking can never read as valid on a saved screenshot.
 */
export function BookingPass({ booking }: { booking: BookingDTO }) {
  const [pass, setPass] = useState<{ url: string; qr: string } | null>(null);
  const [error, setError] = useState("");
  const [big, setBig] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/bookings/${booking.id}/pass`, { cache: "no-store" })
      .then((r) => readJson<{ url?: string; qr?: string; error?: string }>(r))
      .then((d) => {
        if (!live) return;
        if (d?.qr && d.url) setPass({ url: d.url, qr: d.qr });
        else setError(d?.error || "Could not build your pass.");
      })
      .catch(() => live && setError("Could not build your pass."));
    return () => {
      live = false;
    };
  }, [booking.id]);

  const cancelled = booking.status === "cancelled" || booking.status === "declined";
  const pending = booking.status === "pending_payment" || booking.status === "pending_driver";

  return (
    <section className="rounded-2xl border border-brass/25 bg-ink-2/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-brass">Your pass</p>
          <h2 className="font-display mt-1 text-xl">Present this on arrival</h2>
        </div>
        <span className="font-display text-lg tracking-wide text-sand">{booking.number}</span>
      </div>

      {cancelled ? (
        <p className="mt-3 rounded-xl border border-rose/30 bg-rose/10 px-3.5 py-2.5 text-sm text-rose">
          This reservation has been cancelled, so the pass is no longer valid.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0 rounded-2xl bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          {pass ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pass.qr}
              alt={`QR code for booking ${booking.number}`}
              width={176}
              height={176}
              className={`block h-44 w-44 ${cancelled ? "opacity-40" : ""}`}
            />
          ) : (
            <div className="grid h-44 w-44 place-items-center text-xs text-ink/50">{error || "Building your pass…"}</div>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm text-sand">
            Reception staff scan this code to confirm your reservation. No printed copy is required.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-mist">
            <li>· Works without a connection on your device; the code is scanned by staff.</li>
            <li>· Always reflects the current status of your reservation.</li>
            <li>· The same code appears on your invoice and voucher.</li>
          </ul>
          {pending ? (
            <p className="mt-3 text-sm text-amber-500">
              {booking.status === "pending_payment"
                ? "This pass becomes valid once payment is complete."
                : "This pass becomes valid once the driver confirms the trip."}
            </p>
          ) : null}
          {pass ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setBig(true)}>
                Full screen
              </button>
              <a className="btn-ghost px-3 py-1.5 text-sm" href={pass.qr} download={`holydays-${booking.number}.png`}>
                Save image
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {big && pass ? (
        <div
          role="dialog"
          aria-label="Booking pass"
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-white p-6"
          onClick={() => setBig(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pass.qr} alt={`QR code for booking ${booking.number}`} className="h-auto w-[min(78vw,26rem)]" />
          <p className="font-display text-2xl text-[#0b1c34]">{booking.number}</p>
          <p className="text-sm text-[#0b1c34]/60">Tap anywhere to close. Increase screen brightness for faster scanning.</p>
        </div>
      ) : null}
    </section>
  );
}
