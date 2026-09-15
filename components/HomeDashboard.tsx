"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchPass } from "@/components/SearchPass";
import { BedIcon, CarIcon, LandmarkIcon, TableIcon } from "@/components/icons";
import { formatDay } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { type ListingKind } from "@/lib/marketplace";
import { readJson } from "@/lib/readJson";
import { PageLoader } from "@/components/PageLoader";

type Booking = {
  id: string;
  startDate: string;
  endDate: string;
  total: number;
  listing: { slug: string; name: string; cover: string; city: string; kind: ListingKind };
};

const tiles = [
  { href: "/search", title: "Hotels", ur: "ہوٹل", icon: BedIcon, img: "/uploads/voco-makkah/480212714.jpg" },
  { href: "/attractions", title: "Ziyarat", ur: "زیارت", icon: LandmarkIcon, img: "/images/home/mosque-night.jpg" },
  {
    href: "/taxis",
    title: "Taxis",
    ur: "کرایہ",
    icon: CarIcon,
    img: "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?auto=format&fit=crop&w=1400&q=80",
  },
  { href: "/food", title: "Food", ur: "کھانا", icon: TableIcon, img: "/images/home/food.jpg" },
];

const destinations: { name: string; ur: string; img: string; city: string; country: string; object?: string }[] = [
  { name: "Makkah", ur: "مكة", img: "/images/home/kaaba.jpg", city: "Makkah", country: "SA" },
  {
    name: "Najaf",
    ur: "نجف",
    img: "https://images.unsplash.com/photo-1513348235070-7e212225beda?auto=format&fit=crop&w=1400&q=80",
    city: "Najaf",
    country: "IQ",
  },
  { name: "Karbala", ur: "کربلا", img: "/images/home/karbala-sunset.jpg", city: "Karbala", country: "IQ" },
  {
    name: "Mashhad",
    ur: "مشهد",
    img: "https://images.unsplash.com/photo-1615124007982-f923ff548c54?auto=format&fit=crop&w=1400&q=80",
    city: "Mashhad",
    country: "IR",
  },
];

export function HomeDashboard() {
  const { money } = useSerai();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Booking[]>([]);
  const [liveStays, setLiveStays] = useState<{ id: string; slug: string; name: string; city: string; cover: string; price: number }[]>([]);
  const featured = liveStays.slice(0, 3);
  const first = session?.user?.name?.split(" ")[0];

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "OWNER") {
      router.replace("/owner");
    }
  }, [router, session?.user?.role, status]);

  useEffect(() => {
    fetch("/api/listings?kind=STAY", { cache: "no-store" })
      .then((r) => readJson<{ slug: string; name: string; city: string; cover: string; price: number }[]>(r))
      .then((d) => setLiveStays(Array.isArray(d) ? d.map((s) => ({ ...s, id: s.slug })) : []))
      .catch(() => setLiveStays([]));
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/bookings")
      .then((r) => readJson<(Booking & { status: string })[]>(r))
      .then((d) =>
        setTrips(Array.isArray(d) ? d.filter((b) => b.status !== "cancelled").slice(0, 2) : []),
      )
      .catch(() => setTrips([]));
  }, [status]);

  if (status === "authenticated" && session?.user?.role === "OWNER") {
    return <PageLoader label="Opening your desk" />;
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-brass">Dashboard</p>
          <h1 className="font-display mt-2 text-4xl md:text-5xl">
            {status === "authenticated" ? `Welcome back${first ? `, ${first}` : ""}` : "Find a hotel"}
          </h1>
          <p className="mt-2 max-w-xl text-mist">
            Browse hotels, ziyarat, and taxis in Saudi Arabia, Iraq, and Iran.
          </p>
        </div>
        {status !== "authenticated" && (
          <Link href="/login" className="btn-ghost text-sand">
            Sign in
          </Link>
        )}
      </div>

      <div className="relative z-30 mt-8">
        <SearchPass />
      </div>

      {trips.length > 0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl">Your bookings</h2>
            <Link href="/trips" className="text-sm text-brass hover:text-sand">
              All trips
            </Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {trips.map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex overflow-hidden rounded-2xl border border-brass/30 bg-ink-2"
              >
                <div className="relative h-28 w-32 shrink-0">
                  <Image src={b.listing.cover || "/images/hero-hunza-dusk.png"} alt="" fill className="object-cover" />
                </div>
                <div className="p-4">
                  <p className="font-display text-xl">{b.listing.name}</p>
                  <p className="mt-1 text-sm text-mist">
                    {formatDay(b.startDate)} — {formatDay(b.endDate)}
                    {b.listing.city ? ` · ${b.listing.city}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="relative z-0 mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.href} href={c.href} className="group relative isolate z-0 min-h-[180px] overflow-hidden rounded-2xl">
              <Image src={c.img} alt={c.title} fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-ink/50" />
              <div className="absolute inset-0 flex flex-col justify-end p-5">
                <Icon className="h-6 w-6 text-brass" />
                <p className="font-display mt-2 text-2xl">{c.title}</p>
                <p className="font-urdu text-sm text-brass">{c.ur}</p>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="relative z-0 mt-14">
        <h2 className="font-display text-3xl">Saudi, Iraq, Iran</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {destinations.map((d) => (
            <Link
              key={d.name}
              href={`/search?country=${d.country}&city=${d.city}&q=${d.city}`}
              className="relative z-0 min-h-[180px] overflow-hidden rounded-2xl"
            >
              <Image src={d.img} alt={d.name} fill sizes="(max-width: 768px) 100vw, 25vw" className={`object-cover ${d.object ?? ""}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <p className="font-display text-2xl">{d.name}</p>
                <p className="font-urdu text-brass">{d.ur}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14 pb-10">
        <h2 className="font-display text-3xl">Hotels worth a night</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
            {featured.map((s) => (
            <Link key={s.id} href={`/stay/${s.id}`} className="overflow-hidden rounded-2xl border border-brass/25 bg-ink-2">
              <div className="relative h-44">
                <Image src={s.cover} alt={s.name} fill className="object-cover" />
              </div>
              <div className="p-5">
                <p className="font-display text-2xl">{s.name}</p>
                <p className="mt-1 text-sm text-mist">
                  {s.city} · {money(s.price)} / night
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
