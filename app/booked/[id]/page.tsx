"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { BookingActions, BookingNotifyStrip } from "@/components/BookingBits";
import { readJson } from "@/lib/readJson";
import type { BookingDTO } from "@/lib/booking-dto";
import { formatDay, nightsBetween } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { PackageSnapshot } from "@/components/PackageSteps";
import type { StayPackage } from "@/lib/package-plan";

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

  return (
    <div className="relative min-h-[80vh]">
      <Image src={booking.listing.cover || "/images/hero-hunza-dusk.png"} alt="" fill className="object-cover opacity-40" />
      <div className="absolute inset-0 bg-ink/75" />
      <div className="relative mx-auto max-w-2xl px-5 py-20">
        <p className="inline-flex rounded-full border border-sage/50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sage">
          Confirmed
        </p>
        <p className="mt-4 font-mono text-sm tracking-[0.2em] text-brass">{booking.number}</p>
        <h1 className="font-display mt-3 text-5xl">You are booked.</h1>
        <p className="mt-4 text-xl text-sand">{booking.listing.name}</p>
        <p className="mt-3 text-mist">
          {formatDay(booking.startDate)} — {formatDay(booking.endDate)} · {money(booking.total)}
          {booking.listing.city ? ` · ${booking.listing.city}` : ""}
        </p>
        <PackageSnapshot
          pack={booking.extra.package as StayPackage | undefined}
          guests={booking.guests}
          nights={Math.max(1, nightsBetween(booking.startDate, booking.endDate))}
          stayName={booking.listing.name}
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
