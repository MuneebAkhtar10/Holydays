"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDaysIso, nightsBetween } from "@/lib/format";
import { listingToStay, type ListingCard } from "@/lib/listing-meta";
import { quoteStay, stayRooms, roomPicksTotal, type RoomPick } from "@/lib/pricing";
import { citiesForCountry, type PilgrimCountry } from "@/lib/pilgrim";
import type { PackageStaySlice } from "@/lib/package-plan";
import { HotelStrip, type ReviewHotel } from "@/components/PackageReview";
import { readJson } from "@/lib/readJson";
import { useSerai } from "@/lib/store";
import { CANCEL_LABEL } from "@/lib/rooms";
import { RoomPicker } from "@/components/RoomPicker";
import { gallerySets } from "@/lib/property-details";

type StayCard = ListingCard & { kind?: string };

export function PackageHotelPicker({
  country,
  city,
  excludeIds,
  defaultCheckin,
  rooms,
  adults,
  children,
  childAges,
  onAdd,
  onCancel,
}: {
  country: PilgrimCountry | null;
  city: string;
  excludeIds: string[];
  defaultCheckin: string;
  rooms: number;
  adults: number;
  children: number;
  childAges: number[];
  onAdd: (stay: PackageStaySlice) => void;
  onCancel: () => void;
}) {
  const { money } = useSerai();
  const cityOptions = country ? citiesForCountry(country) : [city];
  const [place, setPlace] = useState(city || cityOptions[0] || "");
  const [checkin, setCheckin] = useState(defaultCheckin);
  const [checkout, setCheckout] = useState(addDaysIso(defaultCheckin || new Date().toISOString().slice(0, 10), 2));
  const [rows, setRows] = useState<StayCard[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [picks, setPicks] = useState<RoomPick[]>([]);

  useEffect(() => {
    setPlace(city || cityOptions[0] || "");
    if (defaultCheckin) {
      setCheckin(defaultCheckin);
      setCheckout(addDaysIso(defaultCheckin, 2));
    }
    setPicked(null);
  }, [city, defaultCheckin]);

  useEffect(() => {
    fetch("/api/listings?kind=STAY", { cache: "no-store" })
      .then((r) => readJson<StayCard[]>(r))
      .then((list) => {
        setRows(Array.isArray(list) ? list.filter((l) => l.kind === "STAY" || !l.kind) : []);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  const hotels = useMemo(() => {
    const needle = place.trim().toLowerCase();
    const blocked = new Set(excludeIds.map((id) => id.toLowerCase()));
    return rows.filter((row) => {
      const id = (row.slug || row.id || "").toLowerCase();
      if (blocked.has(id)) return false;
      return row.city.trim().toLowerCase() === needle;
    });
  }, [rows, place, excludeIds]);

  const selected = hotels.find((h) => (h.slug || h.id) === picked) ?? null;
  const stay = selected ? listingToStay(selected) : null;
  const stayRoomList = stay ? stayRooms(stay) : [];
  const activePicks = picks.filter((p) => p.rooms > 0);
  const roomsCount = roomPicksTotal(activePicks);
  const totalCapacity = stayRoomList.reduce((sum, r) => sum + r.available, 0);

  useEffect(() => {
    if (!stay) return;
    const first = stayRooms(stay)[0];
    setPicks(first ? [{ roomId: first.id, ratePlanId: first.rates[0]?.id, rooms: Math.max(1, rooms), extraBeds: 0, cribs: 0 }] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const [overlapBookings, setOverlapBookings] = useState<number | null>(null);
  const stayId = stay?.id ?? "";
  useEffect(() => {
    if (!stayId || !checkin || !checkout || checkout <= checkin) {
      setOverlapBookings(null);
      return;
    }
    let cancelled = false;
    setOverlapBookings(null);
    fetch(`/api/listings/${stayId}/availability?checkin=${checkin}&checkout=${checkout}`, { cache: "no-store" })
      .then((r) => readJson<{ overlapping?: number }>(r))
      .then((d) => {
        if (!cancelled) setOverlapBookings(typeof d?.overlapping === "number" ? d.overlapping : 0);
      })
      .catch(() => {
        if (!cancelled) setOverlapBookings(0);
      });
    return () => {
      cancelled = true;
    };
  }, [stayId, checkin, checkout]);
  const roomsLeft = overlapBookings === null ? null : Math.max(0, totalCapacity - overlapBookings);

  const quote =
    stay && activePicks.length && checkin && checkout && checkout > checkin
      ? quoteStay(stay, {
          checkin,
          checkout,
          rooms: roomsCount,
          adults,
          children,
          childAges,
          picks: activePicks,
        })
      : null;

  return (
    <div className="pane mt-5 space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-brass">Add another hotel</p>
          <h3 className="font-display mt-1 text-2xl">Stay in {place || "this city"}</h3>
          <p className="mt-1 text-sm text-mist">Pick dates, then a hotel. This stay is added to the same package.</p>
        </div>
        <button type="button" className="text-sm text-mist" onClick={onCancel}>
          Not now
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
          City
          <select className="mt-1 w-full rounded-xl bg-sand/[0.04] px-3 py-2.5 text-sm text-sand outline-none ring-1 ring-sand/[0.08]" value={place} onChange={(e) => { setPlace(e.target.value); setPicked(null); }}>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
          Check-in
          <input type="date" className="mt-1 w-full rounded-xl bg-sand/[0.04] px-3 py-2.5 text-sm text-sand outline-none ring-1 ring-sand/[0.08]" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
        </label>
        <label className="text-[11px] uppercase tracking-[0.14em] text-mist">
          Check-out
          <input type="date" className="mt-1 w-full rounded-xl bg-sand/[0.04] px-3 py-2.5 text-sm text-sand outline-none ring-1 ring-sand/[0.08]" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
        </label>
      </div>

      {!ready ? <p className="text-sm text-mist">Loading hotels…</p> : null}
      {ready && hotels.length === 0 ? <p className="text-sm text-mist">No live hotels in {place} yet.</p> : null}

      <div className="space-y-2">
        {hotels.map((h) => {
          const id = h.slug || h.id;
          const on = picked === id;
          return (
            <div key={id} className={`flex w-full items-center gap-3 rounded-2xl p-3 ring-1 ${on ? "bg-flame/10 ring-brass/40" : "bg-sand/[0.03] ring-sand/[0.08]"}`}>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setPicked(id)}>
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                  <Image src={h.cover || "/images/hero-hunza-dusk.png"} alt="" fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="font-display truncate text-lg leading-tight">{h.name}</p>
                  <p className="text-sm text-mist">{h.city} · from {money(h.price)}</p>
                </div>
              </button>
              <Link
                href={`/stay/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 whitespace-nowrap text-xs text-mist underline hover:text-sand"
              >
                View details
              </Link>
            </div>
          );
        })}
      </div>

      {stay && quote ? (
        <div>
          <p className="mb-2 text-sm text-mist">
            {stayRoomList.length} room type{stayRoomList.length === 1 ? "" : "s"} · {nightsBetween(checkin, checkout)} night
            {nightsBetween(checkin, checkout) === 1 ? "" : "s"}
          </p>
          <p className={`mb-3 text-sm font-medium ${roomsLeft === null ? "text-mist" : roomsLeft > 0 ? "text-emerald-600" : "text-red-600"}`}>
            {roomsLeft === null
              ? "Checking availability…"
              : roomsLeft > 0
                ? `✓ Available — ${roomsLeft} room${roomsLeft === 1 ? "" : "s"} left for these dates`
                : "✗ Not available for these dates"}
          </p>
          <RoomPicker
            stay={stay}
            input={{ checkin, checkout, rooms: Math.max(1, roomsCount), adults, children, childAges, picks: activePicks }}
            picks={picks}
            onChangePicks={setPicks}
            roomsLeft={roomsLeft}
            roomShots={gallerySets(stay).room}
          />
          <div className="mt-4 rounded-xl bg-ink/30 px-3 py-3 text-sm">
            <p className="text-sand">
              {quote.roomLabel} · {CANCEL_LABEL[quote.cancelPolicy]}
            </p>
            <p className="mt-1 font-display text-xl">{money(quote.grand)}</p>
            <button
              type="button"
              disabled={roomsLeft === 0 || roomsCount < 1}
              className="btn-primary mt-3 rounded-full disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() =>
                onAdd({
                  listingId: stay.id,
                  name: stay.name,
                  city: stay.city,
                  cover: stay.cover,
                  checkin,
                  checkout,
                  roomId: quote.room.id,
                  ratePlanId: quote.rate.id,
                  picks: activePicks,
                  roomName: quote.roomLabel,
                  amount: quote.grand,
                  cancellation: quote.cancelPolicy,
                  rooms: roomsCount,
                })
              }
            >
              {roomsLeft === 0 ? "Not available for these dates" : "Add this hotel"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PackageStayList({
  first,
  extras,
  onRemove,
}: {
  first: { name: string; city: string; checkin: string; checkout: string };
  extras: PackageStaySlice[];
  onRemove: (listingId: string) => void;
}) {
  const hotels: ReviewHotel[] = [
    { id: "first", name: first.name, city: first.city, checkin: first.checkin, checkout: first.checkout, amount: 0 },
    ...extras.map((s) => ({
      id: s.listingId,
      name: s.name,
      city: s.city,
      checkin: s.checkin,
      checkout: s.checkout,
      room: s.roomName,
      amount: s.amount,
    })),
  ];
  return (
    <div className="mt-4">
      <HotelStrip hotels={hotels} onRemove={onRemove} />
    </div>
  );
}
