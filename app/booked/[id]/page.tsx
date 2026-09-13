"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { BookingActions, BookingNotifyStrip } from "@/components/BookingBits";
import { readJson } from "@/lib/readJson";
import type { BookingDTO } from "@/lib/booking-dto";
import { formatDay } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { PackageSnapshot } from "@/components/PackageSteps";
import { packageGrandTotal, packagePrimaryAmount, type StayPackage } from "@/lib/package-plan";

export default function BookedPage() {
  const { money } = useSerai();
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDTO | null>(null);
  const [ready, setReady] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    let cancelled = false;
    const run = async () => {
      const direct = await fetch(`/api/bookings/${id}`).then((r) => readJson<BookingDTO & { error?: string }>(r));
      if (!cancelled && direct && !direct.error && direct.id) {
        setBooking(direct);
        setReady(true);
        return;
      }
      const list = await fetch("/api/bookings").then((r) => readJson<BookingDTO[]>(r));
      const hit = Array.isArray(list) ? list.find((b) => b.listing.slug === id) : undefined;
      if (!cancelled) {
        setBooking(hit ?? null);
        setReady(true);
      }
    };
    void run().catch(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!ready) return <PageLoader label="Confirming your booking" />;
  if (!booking) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="text-mist">Could not find that reservation.</p>
        <Link href="/trips" className="btn-primary mt-6 inline-flex">
          My bookings
        </Link>
      </div>
    );
  }

  const isCustomTaxi = booking.extra.taxiMode === "custom";
  const customHours = Number(booking.extra.hours) || undefined;
  const customNote = String(booking.extra.note ?? "").trim();
  const isPendingDriver = booking.status === "pending_driver";
  const isDeclined = booking.status === "declined";
  const pack = booking.extra.package as StayPackage | undefined;
  const extraHotels = pack?.stays ?? [];
  const isMultiHotelPackage = extraHotels.length > 0;
  const primaryStay = pack
    ? {
        name: booking.listing.name,
        city: booking.listing.city,
        checkin: booking.startDate,
        checkout: booking.endDate,
        amount: packagePrimaryAmount(booking.total, pack),
      }
    : undefined;
  const grandTotal = pack ? packageGrandTotal(booking.total, pack) : booking.total;
  const hotelNames = [booking.listing.name, ...extraHotels.map((s) => s.name)];
  const tripStart = [booking.startDate, ...extraHotels.map((s) => s.checkin)].sort()[0];
  const tripEnd = [booking.endDate, ...extraHotels.map((s) => s.checkout)].sort().slice(-1)[0];

  return (
    <div className="relative min-h-[80vh]">
      <Image src={booking.listing.cover || "/images/hero-hunza-dusk.png"} alt="" fill className="object-cover opacity-40" />
      <div className="absolute inset-0 bg-ink/75" />
      <div className="relative mx-auto max-w-2xl px-5 py-20">
        <p
          className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
            isDeclined
              ? "border-mist/40 text-mist"
              : isPendingDriver
                ? "border-brass/50 text-brass"
                : "border-sage/50 text-sage"
          }`}
        >
          {isDeclined ? "Declined" : isPendingDriver ? "Awaiting driver" : "Confirmed"}
        </p>
        <p className="mt-4 font-mono text-sm tracking-[0.2em] text-brass">{booking.number}</p>
        <h1 className="font-display mt-3 text-5xl">
          {isDeclined ? "Driver couldn't take this trip." : isPendingDriver ? "Your request is in." : isCustomTaxi ? "Trip confirmed." : "You are booked."}
        </h1>
        {isCustomTaxi ? (
          <>
            <p className="mt-4 text-xl text-sand">Custom trip with {booking.listing.name}</p>
            <p className="mt-3 text-mist">
              {formatDay(booking.startDate)}
              {customHours ? ` · ${customHours} hour${customHours === 1 ? "" : "s"}` : ""}
              {booking.listing.city ? ` · ${booking.listing.city}` : ""}
            </p>
            {customNote && <p className="mt-2 text-sm text-mist">“{customNote}”</p>}
            {isDeclined ? (
              <p className="mt-3 text-sm text-rose">
                {booking.listing.name} could not take this custom trip request. Try another driver or a different time.
              </p>
            ) : isPendingDriver ? (
              <p className="mt-3 text-sm text-brass">
                Please contact {booking.listing.name} or they will contact you shortly to confirm what you want on this trip — the rate is undecided until then. Your booking will be confirmed once the driver agrees to your terms.
              </p>
            ) : (
              <p className="mt-3 text-sm text-brass">
                The driver accepted your request — contact {booking.listing.name} directly to agree on a rate for where you're going.
              </p>
            )}
          </>
        ) : isMultiHotelPackage ? (
          <>
            <p className="mt-4 text-xl text-sand">{hotelNames.join(" · ")}</p>
            <p className="mt-3 text-mist">
              {formatDay(tripStart)} — {formatDay(tripEnd)} · {money(grandTotal)}
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-xl text-sand">{booking.listing.name}</p>
            <p className="mt-3 text-mist">
              {formatDay(booking.startDate)} — {formatDay(booking.endDate)} · {money(booking.total)}
              {booking.listing.city ? ` · ${booking.listing.city}` : ""}
            </p>
          </>
        )}
        <PackageSnapshot
          pack={pack}
          guests={booking.guests}
          stayName={booking.listing.name}
          primaryStay={primaryStay}
          bookingTotal={booking.total}
        />
        <div className="mt-8">
          <BookingNotifyStrip booking={booking} />
        </div>
        <div className="mt-6">
          <BookingActions booking={booking} origin={origin} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/bookings/${booking.id}`} className="btn-primary">
            View booking online
          </Link>
          <Link href="/trips" className="btn-ghost text-sand">
            My bookings
          </Link>
        </div>
      </div>
    </div>
  );
}
