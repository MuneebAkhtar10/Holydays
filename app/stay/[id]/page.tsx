"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { stayById } from "@/lib/stays";
import { experienceById } from "@/lib/experiences";
import { formatDay, localTodayIso, minCheckoutIso, nightsBetween } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { GoogleStayMap } from "@/components/GoogleStayMap";
import { ListingBook } from "@/components/ListingBook";
import { ListingReviewsLoader } from "@/components/ListingReviews";
import { PropertyGallery } from "@/components/PropertyGallery";
import { SearchPass } from "@/components/SearchPass";
import { StarIcon } from "@/components/StarIcon";
import { PageLoader } from "@/components/PageLoader";
import { useSession } from "next-auth/react";
import { gallerySets, propertyFacts, propertyKindLabel, propertyMeta, type PropertyFacts } from "@/lib/property-details";
import { FACILITY_LABEL, MEAL_LABEL, SHOWCASE_FACILITIES, hydrateCatalogStay, type FacilityKey, type StayOffer } from "@/lib/search-index";
import { listingOffer, listingToStay, parseListingMeta } from "@/lib/listing-meta";
import { quoteStay, stayRooms, roomPicksTotal, type QuoteInput, type RoomPick } from "@/lib/pricing";
import { encodeRoomPicks } from "@/lib/room-picks";
import { RoomPicker } from "@/components/RoomPicker";
import { PriceBreakdown } from "@/components/PriceBreakdown";
import { readJson } from "@/lib/readJson";
import type { Stay } from "@/lib/types";
import { pilgrimCountryForPlace } from "@/lib/pilgrim";

function seedRoomPicks(stay: Stay | null | undefined, rooms: number): RoomPick[] {
  const first = stay ? stayRooms(stay)[0] : undefined;
  if (!first) return [];
  return [{ roomId: first.id, ratePlanId: first.rates[0]?.id, rooms: Math.max(1, rooms), extraBeds: 0, cribs: 0 }];
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function maskContact(value: string) {
  const visible = 2;
  return value
    .split("")
    .map((ch, i, all) => (i < visible || i >= all.length - visible || ch === " " || ch === "@" || ch === "." ? ch : "•"))
    .join("");
}

export default function StayPage() {
  return (
    <Suspense fallback={<div className="p-10 text-mist">Lighting the lamps…</div>}>
      <StayInner />
    </Suspense>
  );
}

function Accordion({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl pane">
      <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpen((v) => !v)}>
        <span>
          <span className="font-display block text-xl leading-tight">{title}</span>
          {hint ? <span className="mt-0.5 block text-xs text-mist">{hint}</span> : null}
        </span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-flame/10 text-sm text-brass ${open ? "bg-flame/20" : ""}`}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <div className="border-t border-sand/10 px-4 py-4">{children}</div> : null}
    </div>
  );
}

function StayInner() {
  const { id } = useParams<{ id: string }>();
  const catalogRaw = stayById(id);
  const catalog = catalogRaw ? hydrateCatalogStay(catalogRaw) : undefined;
  const [partnerStay, setPartnerStay] = useState<Stay | null>(null);
  const [partnerOffer, setPartnerOffer] = useState<StayOffer | null>(null);
  const [partnerFacts, setPartnerFacts] = useState<PropertyFacts | null>(null);
  const [partnerExternalRating, setPartnerExternalRating] = useState<{ source: string; score: number; count: number; url?: string } | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<string | null>(null);
  const [partnerRejectReason, setPartnerRejectReason] = useState("");
  const [partnerOwnerId, setPartnerOwnerId] = useState<string | undefined>(undefined);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReasonInput, setRejectReasonInput] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [liveReady, setLiveReady] = useState(Boolean(catalog));
  const stay = catalog ?? partnerStay;
  const router = useRouter();
  const params = useSearchParams();
  const { search, setSearch, toggleWish, wishlist, money } = useSerai();
  const { status, data: session } = useSession();
  const [picks, setPicks] = useState<RoomPick[]>(() => seedRoomPicks(stay, Number(params.get("rooms") || search.rooms || 1)));
  const [extras, setExtras] = useState<string[]>([]);

  const loadListing = () => {
    if (catalog) return;
    return fetch(`/api/listings/${id}`, { cache: "no-store" })
      .then((r) => readJson<Record<string, unknown>>(r))
      .then((d) => {
        if (d?.error || d?.kind !== "STAY") {
          setLiveReady(true);
          return;
        }
        const mapped = listingToStay(d as never);
        const meta = parseListingMeta(d.meta);
        setPartnerStay(mapped);
        setPartnerStatus(String(d.status ?? "approved"));
        setPartnerRejectReason(String(d.rejectReason ?? ""));
        setPartnerOwnerId(typeof d.ownerId === "string" ? d.ownerId : undefined);
        setPartnerOffer(listingOffer(d as never));
        setPartnerFacts({
          address: meta.address || `${mapped.city}, ${mapped.region}`,
          checkIn: meta.checkIn,
          checkOut: meta.checkOut,
          reception: meta.reception,
          phone: meta.phone,
          email: meta.email,
          policies: meta.policies,
        });
        setPartnerExternalRating(meta.externalRating?.source ? meta.externalRating : null);
        setPicks(seedRoomPicks(mapped, Number(params.get("rooms") || search.rooms || 1)));
        setLiveReady(true);
      })
      .catch(() => setLiveReady(true));
  };

  useEffect(() => {
    void loadListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, catalog]);

  const checkin = params.get("checkin") || search.checkin;
  const checkout = params.get("checkout") || search.checkout;
  const adults = Number(params.get("adults") || search.adults || 2);
  const children = Number(params.get("children") || search.children || 0);
  const childAges = (params.get("ages") ?? "").split(",").map(Number).filter((n) => Number.isFinite(n));
  const guests = adults + children;

  const urlCheckin = params.get("checkin");
  const urlCheckout = params.get("checkout");
  useEffect(() => {
    if (urlCheckin && urlCheckout && (urlCheckin !== search.checkin || urlCheckout !== search.checkout)) {
      setSearch({ checkin: urlCheckin, checkout: urlCheckout });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCheckin, urlCheckout]);
  useEffect(() => {
    if (stay?.city && !search.city && !search.q) {
      setSearch({ city: stay.city, q: stay.city });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stay?.city]);
  const nights = nightsBetween(checkin, checkout);
  const roomsList = stay ? stayRooms(stay) : [];
  const activePicks = picks.filter((p) => p.rooms > 0);
  const roomCount = roomPicksTotal(activePicks);
  const totalCapacity = roomsList.reduce((sum, r) => sum + r.available, 0);

  const [overlapBookings, setOverlapBookings] = useState<number | null>(null);
  useEffect(() => {
    if (!id || !checkin || !checkout) return;
    let cancelled = false;
    setOverlapBookings(null);
    fetch(`/api/listings/${id}/availability?checkin=${checkin}&checkout=${checkout}`, { cache: "no-store" })
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
  }, [id, checkin, checkout]);
  const roomsLeft = overlapBookings === null ? null : Math.max(0, totalCapacity - overlapBookings);

  useEffect(() => {
    if (roomsLeft == null) return;
    setPicks((current) => {
      let changed = false;
      const next = current.map((p) => {
        const room = roomsList.find((r) => r.id === p.roomId);
        if (!room) return p;
        const others = current.filter((x) => x.roomId !== p.roomId).reduce((s, x) => s + x.rooms, 0);
        const cap = Math.max(0, Math.min(room.available, Math.max(0, roomsLeft - others)));
        if (p.rooms > cap) {
          changed = true;
          return { ...p, rooms: cap };
        }
        return p;
      }).filter((p) => p.rooms > 0);
      return changed ? next : current;
    });
  }, [roomsLeft, stay?.id]);

  const quoteInput: QuoteInput = {
    checkin,
    checkout,
    rooms: Math.max(1, roomCount),
    adults,
    children,
    childAges: childAges.length ? childAges : search.childAges,
    picks: activePicks,
    extras,
  };
  const quote = stay && activePicks.length ? quoteStay(stay, quoteInput) : null;

  if (!liveReady) return <PageLoader label="Opening the house" />;
  if (!stay || !roomsList[0]) return <ListingBook fallbackSlug={id} />;

  const offer = catalog ? propertyMeta(stay) : partnerOffer ?? undefined;
  const facts = catalog ? propertyFacts(stay) : partnerFacts ?? propertyFacts(stay);
  const roomsGallery = gallerySets(stay).room;
  const seasonLabel = stay.season === "good" ? "In season" : stay.season === "shoulder" ? "Shoulder" : "Avoid if you can";
  const have = new Set(offer?.facilities ?? []);
  const availableFacilities = SHOWCASE_FACILITIES.filter((key) => have.has(key));
  const missingFacilities = SHOWCASE_FACILITIES.filter((key) => !have.has(key));
  const extraFacilities = ((offer?.facilities ?? []) as FacilityKey[]).filter((f) => !SHOWCASE_FACILITIES.includes(f));
  const weatherReal = stay.weather.filter((w) => w.t && w.t !== "—");
  const pilgrimStay = Boolean(pilgrimCountryForPlace(stay.city, stay.region));
  const asAdmin = session?.user?.role === "ADMIN";
  const mine = Boolean(session?.user?.id && partnerOwnerId && session.user.id === partnerOwnerId);
  const pendingPreview = !catalog && Boolean(partnerStatus) && partnerStatus !== "approved" && (asAdmin || mine);

  const decideListing = async (next: "approved" | "rejected", reason?: string) => {
    setDecisionBusy(true);
    await fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, rejectReason: reason ?? "" }),
    });
    setDecisionBusy(false);
    setRejecting(false);
    setRejectReasonInput("");
    await loadListing();
  };

  return (
    <div>
      <div className="mx-auto max-w-7xl px-5 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {stay.nastaliq ? <p className="font-urdu text-lg text-brass">{stay.nastaliq}</p> : null}
            <h1 className="font-display mt-1 text-4xl md:text-5xl">{stay.name}</h1>
            <p className="mt-2 text-sm text-mist">
              {propertyKindLabel(stay)}
              {offer ? ` · ${offer.stars}★` : ` · ${stay.type}`}
              {" · "}
              {facts.address}
            </p>
            {offer && (
              <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-sand">
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="h-4 w-4 text-brass" />
                  {offer.reviewCount ? `${offer.reviewAvg} · ${offer.reviewCount} reviews` : "New on HolyDays"}
                </span>
                <span className="text-mist">
                  {offer.landmarkKm} km to {offer.landmark}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-full bg-flame/10 px-4 py-2 text-sm text-brass hover:bg-flame/20 hover:text-sand"
            onClick={() => toggleWish(stay.id)}
          >
            {wishlist.includes(stay.id) ? "♥ Saved" : "♡ Save"}
          </button>
        </div>
        {!catalog && partnerStatus && partnerStatus !== "approved" && (asAdmin || mine) && (
          <div className="mt-5 rounded-2xl border border-brass/35 bg-ink-2/70 px-5 py-4 text-sm text-sand">
            <p>Status: {partnerStatus === "rejected" ? "Rejected by admin" : "Waiting for admin approval"}. Guests cannot see this yet.</p>
            {partnerStatus === "rejected" && partnerRejectReason && <p className="mt-1 text-rose">{partnerRejectReason}</p>}
            {asAdmin && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {partnerStatus !== "approved" && (
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 text-sm"
                    disabled={decisionBusy}
                    onClick={() => void decideListing("approved")}
                  >
                    Approve & publish
                  </button>
                )}
                {partnerStatus !== "rejected" && !rejecting && (
                  <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setRejecting(true)}>
                    Reject
                  </button>
                )}
                {rejecting && (
                  <div className="flex w-full flex-wrap items-center gap-2 pt-1">
                    <input
                      className="auth-field flex-1"
                      placeholder="Rejection reason (optional)"
                      value={rejectReasonInput}
                      onChange={(e) => setRejectReasonInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-primary px-3 py-1.5 text-sm"
                      disabled={decisionBusy}
                      onClick={() => void decideListing("rejected", rejectReasonInput || "Does not meet Serai standards.")}
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-sm"
                      onClick={() => {
                        setRejecting(false);
                        setRejectReasonInput("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {mine && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brass/35 bg-ink-2/70 px-5 py-4 text-sm text-sand">
            <p>This is your listing. Guests see it once admin approves it.</p>
            <Link href={`/owner/${stay.id}`} className="btn-primary">
              Edit listing
            </Link>
          </div>
        )}
        <nav className="mt-5 flex flex-wrap gap-1.5">
          {[
            ["gallery", "Gallery"],
            ["info", "Property"],
            ["facilities", "Facilities"],
            ["rooms", "Rooms"],
            ["policies", "Policies"],
            ["reviews", "Reviews"],
            ["map", "Map"],
          ].map(([href, label]) => (
            <a key={href} href={`#${href}`} className="rounded-full bg-ink-2 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-mist shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-sand/10 hover:text-sand hover:ring-brass/40">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div className="relative mx-auto max-w-7xl px-5 pt-6">
        <SearchPass compact stayCity={stay.city} />
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-6 pb-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div id="gallery">
            <PropertyGallery stay={stay} />
          </div>
          <section id="info" className="mt-8">
            <h2 className="font-display text-3xl">About this hotel</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-sand/90">{stay.description}</p>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Check-in", facts.checkIn],
                ["Check-out", facts.checkOut],
                ["Reception", facts.reception],
                ["Best season", stay.climate],
              ].map(([k, v]) => (
                <div key={k} className="pane px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-brass">{k}</p>
                  <p className="mt-1 text-sm font-medium leading-snug text-sand">{v}</p>
                </div>
              ))}
            </div>
            {offer ? (
              <p className="mt-3 text-sm text-mist">
                {offer.airportKm} km from {offer.airport}
                {weatherReal.length ? ` · ${seasonLabel}` : ""}
              </p>
            ) : null}
          </section>

          <section id="facilities" className="mt-10">
            <h2 className="font-display text-3xl">Facilities</h2>
            <p className="mt-1 text-sm text-mist">What guests can use at this hotel.</p>
            {availableFacilities.length || extraFacilities.length ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {[...availableFacilities, ...extraFacilities].map((key) => (
                  <li key={key} className="pane flex items-center gap-2 px-3 py-2.5 text-sm">
                    <span className="text-brass">✓</span>
                    {FACILITY_LABEL[key]}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-mist">The owner has not listed facilities yet.</p>
            )}
            {offer?.meals?.length ? (
              <p className="mt-3 text-sm text-sand">Board: {offer.meals.map((m) => MEAL_LABEL[m]).join(" · ")}</p>
            ) : null}
            {stay.amenities.length ? (
              <ul className="mt-3 space-y-1 text-sm text-mist">
                {stay.amenities.map((a) => (
                  <li key={a}>— {a}</li>
                ))}
              </ul>
            ) : null}
            {missingFacilities.length ? (
              <div className="mt-4">
                <Accordion title="Not offered" hint={`${missingFacilities.length} items`}>
                  <ul className="grid gap-1 text-sm text-mist sm:grid-cols-2">
                    {missingFacilities.map((key) => (
                      <li key={key}>{FACILITY_LABEL[key]}</li>
                    ))}
                  </ul>
                </Accordion>
              </div>
            ) : null}
          </section>

          <section id="rooms" className="mt-10">
            <h2 className="font-display text-3xl">Choose a room</h2>
            <p className="mt-1 text-sm text-mist">You can mix room types — for example one 1-bedroom and one 2-bedroom. Double-click a selected rate to remove that type.</p>
            <div className="mt-5">
              <RoomPicker
                stay={stay}
                input={quoteInput}
                picks={picks}
                onChangePicks={setPicks}
                roomsLeft={roomsLeft}
                roomShots={roomsGallery}
              />
            </div>
          </section>

          <section id="policies" className="mt-10 space-y-3">
            <h2 className="font-display text-3xl">Policies & host</h2>
            <Accordion title="House rules" defaultOpen>
              <ul className="space-y-2 text-sm text-mist">
                {facts.policies.map((p) => (
                  <li key={p}>— {p}</li>
                ))}
              </ul>
              <a href={`/stay/${stay.id}/policies`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-brass underline">
                Open full cancellation and house policies
              </a>
            </Accordion>
            <Accordion title="Reception hours" hint={`${facts.checkIn} in · ${facts.checkOut} out`}>
              <p className="text-sm text-sand">{facts.reception}</p>
              <p className="mt-2 text-sm text-mist">
                Check-in from {facts.checkIn}. Check-out until {facts.checkOut}.
              </p>
            </Accordion>
            <div className="pane flex gap-3 p-4">
              {stay.host.portrait ? (
                <Image src={stay.host.portrait} alt={stay.host.name} width={56} height={56} className="h-14 w-14 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brass/20 text-sm font-semibold text-sand">
                  {initials(stay.host.name)}
                </span>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-brass">Host</p>
                <p className="font-display text-xl">{stay.host.name}</p>
                {stay.host.letter ? <p className="mt-1 text-sm italic text-mist">“{stay.host.letter}”</p> : null}
                {(stay.host.phone || stay.host.email) && (
                  <div className="mt-2 space-y-0.5">
                    {stay.host.phone && (
                      <p className="select-none text-sm text-mist blur-[3px]" aria-hidden="true">
                        {maskContact(stay.host.phone)}
                      </p>
                    )}
                    {stay.host.email && (
                      <p className="select-none text-sm text-mist blur-[3px]" aria-hidden="true">
                        {maskContact(stay.host.email)}
                      </p>
                    )}
                    <p className="text-xs text-brass/80">Full contact details unlock once your booking is confirmed.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div id="reviews" className="mt-10">
            <ListingReviewsLoader slug={stay.id} externalRating={catalog ? undefined : partnerExternalRating ?? undefined} />
          </div>

          {stay.stories.length > 0 ? (
            <>
              <h2 className="font-display mt-10 text-3xl">Hotel stories</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {stay.stories.map((st) => (
                  <blockquote key={st.author} className="pane p-5">
                    <p className="text-[11px] uppercase tracking-widest text-brass">{st.mood}</p>
                    <p className="mt-3 leading-relaxed">“{st.body}”</p>
                    <footer className="mt-3 text-sm text-mist">
                      {st.author}, {st.from}
                    </footer>
                  </blockquote>
                ))}
              </div>
            </>
          ) : null}

          {stay.experienceIds.length > 0 ? (
            <>
              <h2 className="font-display mt-10 text-3xl">Add to this stay</h2>
              <div className="mt-4 space-y-2">
                {stay.experienceIds.map((eid) => {
                  const exp = experienceById(eid);
                  if (!exp) return null;
                  const on = extras.includes(eid);
                  return (
                    <label key={eid} className={`flex cursor-pointer items-center justify-between pane p-4 ${on ? "ring-1 ring-brass/40 bg-flame/10" : ""}`}>
                      <span>
                        <span className="block font-display text-xl">{exp.title}</span>
                        <span className="text-sm text-mist">
                          {exp.hours} · {exp.blurb}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span>{money(exp.price)}</span>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setExtras((xs) => (on ? xs.filter((x) => x !== eid) : [...xs, eid]))}
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : null}

          <div id="map" className="mt-10">
            <GoogleStayMap
              stays={[{ id: stay.id, name: stay.name, city: stay.city, address: stay.address || facts.address, lat: stay.lat, lng: stay.lng }]}
              active={stay.id}
            />
          </div>
        </div>

        <aside className="paper h-fit lg:sticky lg:top-24">
          <div className="bg-flame px-5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-ink">
            {pilgrimStay ? "Ziyarat stay" : "Your stay"}
          </div>
          <div className="p-5">
            <p className="font-display text-3xl leading-none text-ink">
              {money(quote?.start ?? roomsList[0].price)}
              <span className="ml-1 text-sm font-sans font-normal text-ink/50">/ night</span>
            </p>
            {offer && (
              <p className="mt-2 text-sm text-ink/55">
                {offer.stars}★{offer.reviewCount ? ` · ${offer.reviewAvg} guest score` : " · New listing"}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="text-[10px] uppercase tracking-[0.14em] text-mist">
                Arrive
                <input
                  type="date"
                  className="date-chip mt-1 w-full rounded-xl px-2 py-2 text-sm"
                  min={localTodayIso()}
                  value={checkin}
                  onChange={(e) => setSearch({ checkin: e.target.value })}
                />
              </label>
              <label className="text-[10px] uppercase tracking-[0.14em] text-mist">
                Depart
                <input
                  type="date"
                  className="date-chip mt-1 w-full rounded-xl px-2 py-2 text-sm"
                  min={minCheckoutIso(checkin)}
                  value={checkout}
                  onChange={(e) => setSearch({ checkout: e.target.value })}
                />
              </label>
            </div>
            <p
              className={`mt-3 text-xs font-medium ${
                roomsLeft === null ? "text-ink/45" : roomsLeft > 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {roomsLeft === null
                ? "Checking availability…"
                : roomsLeft > 0
                  ? `✓ Available — ${roomsLeft} room${roomsLeft === 1 ? "" : "s"} left for these dates`
                  : "✗ Not available for these dates"}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink/55">
              {formatDay(checkin)} — {formatDay(checkout)} · {nights} night{nights > 1 ? "s" : ""} · {guests} guests · {roomCount || 0} room
              {roomCount === 1 ? "" : "s"}
              {quote?.roomLabel ? ` · ${quote.roomLabel}` : ""}
            </p>
            <p className="mt-1 text-xs text-ink/45">
              In {facts.checkIn} · out {facts.checkOut}
            </p>
            <div className="mt-4 border-t border-ink/10 pt-3">{quote && <PriceBreakdown quote={quote} compact />}</div>
            {pilgrimStay ? (
              <p className="mt-3 text-xs text-ink/55">Build ziyarat keeps today&apos;s flow. Build a package adds airport pick up, extra hotels, and drop off.</p>
            ) : null}
            {(() => {
              const first = activePicks[0];
              const p = new URLSearchParams({
                stay: stay.id,
                room: first?.roomId || roomsList[0].id,
                rate: first?.ratePlanId || roomsList[0].rates[0]?.id || "",
                checkin,
                checkout,
                guests: String(guests),
                rooms: String(Math.max(1, roomCount)),
                adults: String(adults),
                children: String(children),
                ages: (childAges.length ? childAges : search.childAges).join(","),
                extras: extras.join(","),
                extraBeds: String(first?.extraBeds ?? 0),
                cribs: String(first?.cribs ?? 0),
                picks: encodeRoomPicks(activePicks),
              });
              const go = (flow?: "package") => {
                const nextParams = new URLSearchParams(p);
                if (flow) nextParams.set("flow", flow);
                const next = `/checkout?${nextParams.toString()}`;
                if (status !== "authenticated") {
                  const backHere = `${window.location.pathname}${window.location.search}`;
                  router.push(`/login?callbackUrl=${encodeURIComponent(backHere)}`);
                  return;
                }
                router.push(next);
              };
              const soldOut = roomsLeft === 0 || roomCount < 1 || (roomsLeft != null && roomCount > roomsLeft);
              const blockedLabel = roomCount < 1 ? "Select a room" : "Not available for these dates";
              if (pendingPreview) {
                return (
                  <p className="mt-4 rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/55">
                    Booking opens once this listing is approved and live.
                  </p>
                );
              }
              if (status !== "authenticated") {
                return (
                  <button type="button" disabled={soldOut} className="btn-primary mt-4 w-full py-3 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => go()}>
                    {soldOut ? blockedLabel : "Sign in to book"}
                  </button>
                );
              }
              if (!pilgrimStay) {
                return (
                  <button type="button" disabled={soldOut} className="btn-primary mt-4 w-full py-3 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => go()}>
                    {soldOut ? blockedLabel : "Continue to guest details"}
                  </button>
                );
              }
              return (
                <div className="mt-4 space-y-2">
                  <button type="button" disabled={soldOut} className="btn-primary w-full py-3 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => go()}>
                    {soldOut ? blockedLabel : "Book Now"}
                  </button>
                  <button type="button" disabled={soldOut} className="btn-ghost w-full py-3 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => go("package")}>
                    Build a package
                  </button>
                </div>
              );
            })()}
            <a href="#map" className="mt-3 block text-center text-sm text-ink/45 hover:text-ink">
              See map & nearby
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
