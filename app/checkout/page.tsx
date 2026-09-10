"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { stayById } from "@/lib/stays";
import { hydrateCatalogStay } from "@/lib/search-index";
import { addDaysIso, formatDay, nightsBetween, stayNightDates } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { PriceBreakdown } from "@/components/PriceBreakdown";
import { readJson } from "@/lib/readJson";
import { listingToStay } from "@/lib/listing-meta";
import { quoteStay, type QuoteInput } from "@/lib/pricing";
import { CANCEL_LABEL, MEAL_PLAN_LABEL, PAY_LABEL } from "@/lib/rooms";
import { experienceById } from "@/lib/experiences";
import type { Stay } from "@/lib/types";
import { cityNamedIn, pilgrimCountryName } from "@/lib/pilgrim";
import {
  listingToTaxi,
  listingToZiyarat,
  mealLines,
  packageAddonsTotal,
  parseMealRates,
  pilgrimCountryForPlace,
  tripDestinationCity,
  type MealChoice,
  type PackageListing,
  type PackageStaySlice,
  type PackageTaxi,
  type TaxiPick,
  type ZiyaratStop,
} from "@/lib/package-plan";
import { MealPlanStep, AirportTransferStep, DayTripsStep } from "@/components/PackageSteps";
import { PackageHotelPicker, PackageStayList } from "@/components/PackageHotelPicker";
import { HotelStrip, PackageBill, TransferTimeline, type ReviewHotel } from "@/components/PackageReview";
import { PoliciesConsent } from "@/components/PoliciesConsent";
import { BedIcon, CarIcon, CheckIcon, GuestsIcon, LandmarkIcon, TableIcon, WalletIcon } from "@/components/icons";

const ZIYARAT_STEPS = ["Guests", "Meals", "Airport Transfer", "Day trips", "Pay", "Confirm"] as const;
const BUILD_STEPS = ["Guests", "Meals", "Airport pick up", "Hotels & trips", "Airport drop off", "Pay", "Confirm"] as const;
const STAY_STEPS = ["Guests", "Pay", "Confirm"] as const;
const ZIYARAT_ICONS = [GuestsIcon, TableIcon, CarIcon, LandmarkIcon, WalletIcon, CheckIcon];
const BUILD_ICONS = [GuestsIcon, TableIcon, CarIcon, BedIcon, CarIcon, WalletIcon, CheckIcon];
const STAY_ICONS = [GuestsIcon, WalletIcon, CheckIcon];

function CheckoutInner() {
  const { money } = useSerai();
  const params = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const catalog = params.get("stay") ? stayById(params.get("stay") ?? "") : undefined;
  const [liveStay, setLiveStay] = useState<Stay | null>(null);
  const [liveReady, setLiveReady] = useState(Boolean(catalog));
  const stay = catalog ? hydrateCatalogStay(catalog) : liveStay;
  const country = stay ? pilgrimCountryForPlace(stay.city, stay.region) : null;
  const packageStay = Boolean(country);
  const buildPackage = packageStay && params.get("flow") === "package";
  const steps = !packageStay ? STAY_STEPS : buildPackage ? BUILD_STEPS : ZIYARAT_STEPS;
  const lastStep = steps.length - 1;
  const payStep = !packageStay ? 1 : buildPackage ? 5 : 4;
  const confirmStep = lastStep;

  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState(params.get("requests") ?? "");
  const [promo, setPromo] = useState(params.get("promo") ?? "");
  const [airport, setAirport] = useState(params.get("airport") === "1");
  const [extras, setExtras] = useState(() => (params.get("extras") ?? "").split(",").filter(Boolean));
  const [meals, setMeals] = useState<MealChoice>(() => {
    const days = stayNightDates(params.get("checkin") ?? "", params.get("checkout") ?? "");
    return { breakfast: days, lunch: [], dinner: days };
  });
  const [ziyaratIds] = useState<string[]>([]);
  const [taxiPicks, setTaxiPicks] = useState<TaxiPick[]>([]);
  const [ziyarat, setZiyarat] = useState<ZiyaratStop[]>([]);
  const [taxiList, setTaxiList] = useState<PackageTaxi[]>([]);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [overlay, setOverlay] = useState<string | null>(null);
  const [firstEnd, setFirstEnd] = useState(params.get("checkout") ?? "");
  const [extraStays, setExtraStays] = useState<PackageStaySlice[]>([]);
  const [hotelAsk, setHotelAsk] = useState<{ city: string; date: string } | null>(null);
  const [addingHotel, setAddingHotel] = useState(false);

  useEffect(() => {
    if (catalog) return;
    const slug = params.get("stay") ?? "";
    if (!slug) {
      setLiveReady(true);
      return;
    }
    fetch(`/api/listings/${slug}`, { cache: "no-store" })
      .then((r) => readJson<Record<string, unknown>>(r))
      .then((d) => {
        if (!d?.error && d?.kind === "STAY") setLiveStay(listingToStay(d as never));
        setLiveReady(true);
      })
      .catch(() => setLiveReady(true));
  }, [catalog, params]);

  useEffect(() => {
    if (!country) {
      setZiyarat([]);
      setTaxiList([]);
      return;
    }
    Promise.all([
      fetch("/api/listings?kind=ATTRACTION", { cache: "no-store" }).then((r) => readJson<PackageListing[]>(r)),
      fetch("/api/listings?kind=TAXI", { cache: "no-store" }).then((r) => readJson<PackageListing[]>(r)),
    ])
      .then(([z, t]) => {
        setZiyarat((Array.isArray(z) ? z : []).map(listingToZiyarat));
        setTaxiList((Array.isArray(t) ? t : []).map(listingToTaxi));
      })
      .catch(() => {
        setZiyarat([]);
        setTaxiList([]);
      });
  }, [country]);

  const input: QuoteInput = useMemo(
    () => ({
      checkin: params.get("checkin") ?? "",
      checkout: buildPackage ? firstEnd || (params.get("checkout") ?? "") : params.get("checkout") ?? "",
      rooms: Number(params.get("rooms") || 1),
      adults: Number(params.get("adults") || params.get("guests") || 2),
      children: Number(params.get("children") || 0),
      childAges: (params.get("ages") ?? "").split(",").map(Number).filter((n) => Number.isFinite(n)),
      roomId: params.get("room") ?? undefined,
      ratePlanId: params.get("rate") ?? undefined,
      extraBeds: Number(params.get("extraBeds") || 0),
      cribs: Number(params.get("cribs") || 0),
      extras,
      airportTransfer: packageStay ? false : airport,
      promo,
      member: Boolean(session?.user?.id),
    }),
    [params, extras, airport, promo, session?.user?.id, packageStay, buildPackage, firstEnd],
  );

  const quote = stay ? quoteStay(stay, input) : null;
  const methods =
    quote?.rate.payment === "now"
      ? [
          { id: "jazz", label: "JazzCash" },
          { id: "easy", label: "EasyPaisa" },
        ]
      : [
          { id: "jazz", label: "JazzCash" },
          { id: "easy", label: "EasyPaisa" },
          { id: "property", label: "Pay at the door" },
        ];
  const [method, setMethod] = useState(quote?.rate.payment === "property" ? "property" : "jazz");

  if (status === "loading" || !liveReady) return <PageLoader label="Preparing checkout" />;
  if (status === "unauthenticated") return <PageLoader label="Redirecting to sign in" />;
  if (!stay || !quote) return <div className="p-10">No ticket to stamp.</div>;

  const addons = stay.experienceIds.map(experienceById);
  const party = input.adults + input.children;
  const lastHotel = extraStays.length ? extraStays[extraStays.length - 1] : { name: stay.name, city: stay.city, checkout: input.checkout };
  const tripCities = [stay.city, ...extraStays.map((s) => s.city)];
  const tripEnd = extraStays.reduce((end, s) => (s.checkout > end ? s.checkout : end), input.checkout);
  const packTotal = packageStay
    ? packageAddonsTotal({
        meals,
        guests: party,
        nights: quote.nights,
        ziyaratIds,
        taxis: taxiPicks,
        ziyarat,
        taxiList,
        mealRates: parseMealRates(stay.mealRates),
        stays: extraStays,
      })
    : 0;
  const grand = quote.grand + packTotal;
  const reviewHotels: ReviewHotel[] = [
    {
      id: stay.id,
      name: stay.name,
      city: stay.city,
      checkin: input.checkin,
      checkout: input.checkout,
      room: `${quote.room.name} · ${quote.rate.name}`,
      amount: quote.grand,
    },
    ...extraStays.map((s) => ({
      id: s.listingId,
      name: s.name,
      city: s.city,
      checkin: s.checkin,
      checkout: s.checkout,
      room: s.roomName,
      amount: s.amount,
    })),
  ];
  const mealBill = mealLines(meals, party, quote.nights, parseMealRates(stay.mealRates));
  const policyHref = `/checkout/policies?stays=${encodeURIComponent([stay.id, ...extraStays.map((s) => s.listingId)].join(","))}`;
  const stepIcons = !packageStay ? STAY_ICONS : buildPackage ? BUILD_ICONS : ZIYARAT_ICONS;

  const addExtraStay = (slice: PackageStaySlice) => {
    if (slice.checkin > input.checkin && slice.checkin < (firstEnd || input.checkout)) {
      setFirstEnd(slice.checkin);
    }
    setExtraStays((rows) => [...rows.filter((s) => s.listingId !== slice.listingId), slice]);
    setHotelAsk(null);
    setAddingHotel(false);
  };

  const payBlock = (
    <div className="mt-6 space-y-3 rounded-2xl border border-sand/[0.08] bg-ink-2 p-5 shadow-[0_12px_40px_rgba(11,28,52,0.05)]">
      <p className="text-sm text-mist">
        {PAY_LABEL[quote.rate.payment]} · {CANCEL_LABEL[quote.rate.cancellation]}
      </p>
      {methods.map((m) => (
        <label
          key={m.id}
          className={`flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3.5 transition ${
            method === m.id ? "bg-flame/10 ring-1 ring-brass/35" : "bg-sand/[0.03] ring-1 ring-sand/[0.08] hover:ring-sand/15"
          }`}
        >
          <span className="font-medium">{m.label}</span>
          <span className="relative">
            <input type="radio" name="pay" className="peer sr-only" checked={method === m.id} onChange={() => setMethod(m.id)} />
            <span className="grid h-5 w-5 place-items-center rounded-full ring-1 ring-sand/20 peer-checked:bg-flame peer-checked:ring-brass/50">
              <span className={`h-1.5 w-1.5 rounded-full bg-ink ${method === m.id ? "opacity-100" : "opacity-0"}`} />
            </span>
          </span>
        </label>
      ))}
      {!packageStay && (
      <label className="flex items-center justify-between rounded-2xl bg-sand/[0.03] px-4 py-3.5 ring-1 ring-sand/[0.08]">
        <span>
          Airport transfer
          <span className="mt-1 block text-xs text-mist">{money(stay.pricing?.airportTransfer ?? 4500)}</span>
        </span>
        <input type="checkbox" checked={airport} onChange={(e) => setAirport(e.target.checked)} />
      </label>
      )}
      {addons.map((exp) =>
        exp ? (
          <label key={exp.id} className="flex items-center justify-between rounded-2xl bg-sand/[0.03] px-4 py-3.5 ring-1 ring-sand/[0.08]">
            <span>
              {exp.title}
              <span className="mt-1 block text-xs text-mist">
                {exp.hours} · {money(exp.price)}
              </span>
            </span>
            <input
              type="checkbox"
              checked={extras.includes(exp.id)}
              onChange={() => setExtras((xs) => (xs.includes(exp.id) ? xs.filter((x) => x !== exp.id) : [...xs, exp.id]))}
            />
          </label>
        ) : null,
      )}
      <label className="block text-sm text-mist">
        Promo code
        <input
          className="mt-2 w-full rounded-xl bg-sand/[0.04] px-3.5 py-2.5 text-sand outline-none ring-1 ring-sand/[0.08] placeholder:text-mist/70 focus:ring-brass/35"
          placeholder="SERAI10"
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
        />
      </label>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] lg:py-8">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-brass">{buildPackage ? "Build a package" : packageStay ? "Ziyarat package" : "Hotel"}</p>
        <h1 className="font-display mt-1 text-3xl md:text-4xl">{packageStay ? `${stay.name}` : "Confirm your hotel"}</h1>
        <p className="mt-1 text-sm text-mist">
          {packageStay && country
            ? `${stay.city}, ${pilgrimCountryName(country)} · ${formatDay(input.checkin)} — ${formatDay(tripEnd)}`
            : "Room and payment only. Package extras are for Iraq, Iran, and Saudi listings."}
        </p>
        <ol className="mt-5 flex flex-wrap gap-2">
          {steps.map((label, i) => {
            const Icon = stepIcons[i];
            return (
            <li key={label}>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] ${
                  i === step
                    ? "bg-flame text-ink shadow-[0_8px_18px_rgba(154,122,58,0.28)]"
                    : i < step
                      ? "bg-flame/15 text-sand"
                      : "text-mist ring-1 ring-brass/25"
                }`}
                onClick={() => {
                  if (i <= step || (i > 0 && phone)) setStep(i);
                }}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {label}
              </button>
            </li>
            );
          })}
        </ol>

        {step === 0 && (
          <div className="mt-6 space-y-3 rounded-2xl border border-sand/[0.08] bg-ink-2 p-5 shadow-[0_12px_40px_rgba(11,28,52,0.05)]">
            <p className="text-sm text-mist">
              Booking as {session?.user?.name} · {session?.user?.email}
            </p>
            <p className="text-sm text-sand">
              {quote.rooms} room{quote.rooms === 1 ? "" : "s"} · {input.adults} adult{input.adults === 1 ? "" : "s"}
              {input.children ? ` · ${input.children} children` : ""}
            </p>
            <input
              className="w-full rounded-xl bg-sand/[0.04] px-3.5 py-2.5 outline-none ring-1 ring-sand/[0.08] focus:ring-brass/35"
              placeholder="Phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl bg-sand/[0.04] px-3.5 py-2.5 outline-none ring-1 ring-sand/[0.08] focus:ring-brass/35"
              rows={2}
              placeholder="Special requests (late arrival, ground floor…)"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
            />
          </div>
        )}

        {packageStay && step === 1 && (
          <div>
            <p className="mt-5 text-sm text-mist">Hotel rate meals: {MEAL_PLAN_LABEL[quote.rate.meal]}. Extra breakfast / lunch / dinner is the package layer.</p>
            <MealPlanStep
              meals={meals}
              onChange={setMeals}
              guests={party}
              dates={stayNightDates(input.checkin, input.checkout)}
              rates={parseMealRates(stay.mealRates)}
            />
          </div>
        )}

        {packageStay && !buildPackage && step === 2 && (
          <AirportTransferStep
            country={country}
            city={stay.city}
            stayName={stay.name}
            catalog={taxiList}
            picks={taxiPicks}
            start={input.checkin}
            end={input.checkout}
            onChange={setTaxiPicks}
          />
        )}

        {buildPackage && step === 2 && (
          <AirportTransferStep
            country={country}
            city={stay.city}
            stayName={stay.name}
            catalog={taxiList}
            picks={taxiPicks}
            start={input.checkin}
            end={input.checkout}
            onChange={setTaxiPicks}
            airportLeg="in"
            title="Airport pick up"
            blurb={`We pick you up and take you to ${stay.name} in ${stay.city}.`}
          />
        )}

        {packageStay && !buildPackage && step === 3 && (
          <DayTripsStep
            country={country}
            city={stay.city}
            catalog={taxiList}
            picks={taxiPicks}
            start={input.checkin}
            end={input.checkout}
            onChange={setTaxiPicks}
          />
        )}

        {buildPackage && step === 3 && (
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-brass">Itinerary</p>
            <h2 className="font-display mt-1 text-3xl">Hotels and day trips</h2>
            <p className="mt-1 max-w-xl text-sm text-mist">
              Add city-to-city trips from any hotel already in this package. When a trip ends in a new city we ask if you want a hotel there. You can also add another hotel yourself.
            </p>
            <PackageStayList
              first={{ name: stay.name, city: stay.city, checkin: input.checkin, checkout: input.checkout }}
              extras={extraStays}
              onRemove={(id) => setExtraStays((rows) => rows.filter((s) => s.listingId !== id))}
            />
            <DayTripsStep
              country={country}
              city={stay.city}
              cities={tripCities}
              catalog={taxiList}
              picks={taxiPicks}
              start={input.checkin}
              end={tripEnd}
              onChange={setTaxiPicks}
              title="City-to-city trips"
              blurb="Choose a trip such as Karbala → Baghdad. After you pick the car we ask if you want a hotel at the destination. Add another trip from the next city when you are ready."
              onTripAdded={(taxi, pick) => {
                const dest = tripDestinationCity(taxi);
                const originCity = cityNamedIn(taxi.origin, country) || taxi.origin.trim();
                if (!dest || dest.toLowerCase() === originCity.toLowerCase()) return;
                const have = tripCities.some((c) => c.toLowerCase() === dest.toLowerCase());
                if (have) return;
                setHotelAsk({ city: dest, date: pick.date || input.checkin });
                setAddingHotel(false);
              }}
            />
            {hotelAsk && !addingHotel ? (
              <div className="mt-5 rounded-2xl border border-brass/30 bg-flame/[0.07] p-4">
                <p className="font-display text-xl">Would you like to book a hotel in {hotelAsk.city}?</p>
                <p className="mt-1 text-sm text-mist">
                  Your trip goes to {hotelAsk.city}. If yes, pick a hotel and dates for that stay. You can still add more cities after this.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary rounded-full" onClick={() => setAddingHotel(true)}>
                    Yes, add a hotel
                  </button>
                  <button
                    type="button"
                    className="btn-ghost rounded-full"
                    onClick={() => {
                      setHotelAsk(null);
                      setAddingHotel(false);
                    }}
                  >
                    No, skip hotel
                  </button>
                </div>
              </div>
            ) : null}
            {addingHotel ? (
              <PackageHotelPicker
                country={country}
                city={hotelAsk?.city || lastHotel.city}
                excludeIds={[stay.id, ...extraStays.map((s) => s.listingId)]}
                defaultCheckin={hotelAsk?.date || lastHotel.checkout || addDaysIso(input.checkin, nightsBetween(input.checkin, input.checkout))}
                rooms={input.rooms}
                adults={input.adults}
                children={input.children}
                childAges={input.childAges}
                onAdd={addExtraStay}
                onCancel={() => {
                  setAddingHotel(false);
                  setHotelAsk(null);
                }}
              />
            ) : (
              <button type="button" className="btn-ghost mt-4 w-full rounded-2xl py-3.5 text-sm" onClick={() => setAddingHotel(true)}>
                Add another hotel
              </button>
            )}
          </div>
        )}

        {buildPackage && step === 4 && (
          <AirportTransferStep
            country={country}
            city={lastHotel.city}
            stayName={lastHotel.name}
            catalog={taxiList}
            picks={taxiPicks}
            start={input.checkin}
            end={tripEnd}
            onChange={setTaxiPicks}
            airportLeg="out"
            title="Airport drop off"
            blurb={`Back to airport from ${lastHotel.name} in ${lastHotel.city}.`}
          />
        )}

        {step === payStep && payBlock}

        {step === confirmStep && (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-brass">Review & confirm</p>
              <h2 className="font-display mt-1 text-3xl leading-tight">{buildPackage ? "Your package" : stay.name}</h2>
              <p className="mt-1 text-sm text-mist">
                {formatDay(input.checkin)} — {formatDay(tripEnd)} · {party} guests · {PAY_LABEL[quote.rate.payment]} · {methods.find((m) => m.id === method)?.label ?? method}
              </p>
            </div>

            {packageStay ? (
              <section>
                <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-brass">Hotels</p>
                <HotelStrip hotels={reviewHotels} />
              </section>
            ) : (
              <div className="pane p-5">
                <p className="font-display text-2xl leading-tight">{stay.name}</p>
                <p className="mt-1 text-sm text-mist">
                  {quote.room.name} · {quote.rate.name} · {CANCEL_LABEL[quote.rate.cancellation]}
                </p>
                <p className="mt-1 text-sm text-sand">
                  {formatDay(input.checkin)} — {formatDay(input.checkout)} · {quote.nights} night{quote.nights === 1 ? "" : "s"}
                </p>
              </div>
            )}

            {packageStay && taxiPicks.length > 0 ? (
              <section className="pane p-5">
                <p className="mb-4 text-[11px] uppercase tracking-[0.16em] text-brass">Transfers</p>
                <TransferTimeline
                  picks={taxiPicks}
                  taxiList={taxiList}
                  stayName={stay.name}
                  lastHotelName={lastHotel.name}
                  guests={party}
                />
              </section>
            ) : null}

            {packageStay && mealBill.length > 0 ? (
              <section className="pane p-5">
                <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-brass">Meals</p>
                <ul className="space-y-2 text-sm">
                  {mealBill.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3">
                      <span className="text-mist">{l.label}</span>
                      <span className="shrink-0 text-sand">{money(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {specialRequests ? <p className="text-sm text-mist">Requests: {specialRequests}</p> : null}

            <div className="pane space-y-4 p-5">
              <PoliciesConsent href={policyHref} cancelLabel={CANCEL_LABEL[quote.rate.cancellation]} checked={terms} onChange={setTerms} />
              {error && <p className="text-sm text-rose">{error}</p>}
              <button
                type="button"
                className="btn-primary w-full py-3.5"
                disabled={!terms || !phone}
                onClick={async () => {
                  setError("");
                  setOverlay("Confirming booking");
                  const res = await fetch("/api/bookings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      listingId: stay.id,
                      startDate: input.checkin,
                      endDate: input.checkout,
                      guests: input.adults + input.children,
                      adults: input.adults,
                      children: input.children,
                      childAges: input.childAges,
                      rooms: input.rooms,
                      roomId: quote.room.id,
                      ratePlanId: quote.rate.id,
                      extraBeds: input.extraBeds,
                      cribs: input.cribs,
                      extraIds: extras,
                      airportTransfer: packageStay ? false : airport,
                      promo,
                      member: Boolean(session?.user?.id),
                      specialRequests,
                      payment: method,
                      phone,
                      package: packageStay
                        ? {
                            flow: buildPackage ? "package" : "ziyarat",
                            meals,
                            ziyaratIds,
                            taxis: taxiPicks,
                            stays: buildPackage ? extraStays : [],
                          }
                        : undefined,
                    }),
                  });
                  const data = await readJson<{ error?: string; id?: string }>(res);
                  if (!res.ok) {
                    setOverlay(null);
                    setError(data?.error || "Could not place reservation");
                    return;
                  }
                  router.push(`/booked/${data?.id ?? stay.id}`);
                }}
              >
                {packageStay ? "Confirm package" : "Confirm booking"} · {money(grand)}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          {step > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          {step < lastStep && (
            <button type="button" className="btn-primary" disabled={step === 0 && !phone} onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          )}
        </div>
      </div>
      <aside className="paper h-fit lg:sticky lg:top-20">
        <Image src={stay.cover} alt="" width={640} height={360} className="h-28 w-full object-cover" />
        <div className="p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink/45">{packageStay ? "Package" : "Hotel"}</p>
          <h2 className="font-display mt-1 text-xl leading-tight text-ink">
            {extraStays.length ? [stay.name, ...extraStays.map((s) => s.name)].join(" · ") : stay.name}
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            {packageStay
              ? `${formatDay(input.checkin)} — ${formatDay(tripEnd)} · ${party} guests`
              : `${quote.room.name} · ${formatDay(input.checkin)} — ${formatDay(input.checkout)} · ${quote.nights} nights${stay.city ? ` · ${stay.city}` : ""}`}
          </p>
          {packageStay ? (
            <div className="mt-4">
              <PackageBill
                hotels={reviewHotels}
                meals={meals}
                guests={party}
                nights={quote.nights}
                mealRates={parseMealRates(stay.mealRates)}
                taxis={taxiPicks}
                taxiList={taxiList}
                stayName={stay.name}
                lastHotelName={lastHotel.name}
                grand={grand}
                compact
                showTotal={false}
              />
              <div className="mt-4 rounded-xl bg-[#c5a46a]/18 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-ink/50">You pay</p>
                <p className="font-display text-2xl text-ink">{money(grand)}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <PriceBreakdown quote={quote} compact />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<PageLoader label="Preparing checkout" />}>
      <CheckoutInner />
    </Suspense>
  );
}
