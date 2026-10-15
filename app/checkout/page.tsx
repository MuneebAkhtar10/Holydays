"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { stayById } from "@/lib/stays";
import { hydrateCatalogStay } from "@/lib/search-index";
import { addDaysIso, clampCheckoutIso, formatDay, minCheckoutIso, nightsBetween, stayNightDates } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { PriceBreakdown } from "@/components/PriceBreakdown";
import { readJson } from "@/lib/readJson";
import { listingToStay } from "@/lib/listing-meta";
import { quoteStay, stayRooms, roomPicksTotal, type QuoteInput, type RoomPick } from "@/lib/pricing";
import { decodeRoomPicks, fallbackPicks } from "@/lib/room-picks";
import { CANCEL_LABEL, PAY_LABEL } from "@/lib/rooms";
import { experienceById } from "@/lib/experiences";
import type { Stay } from "@/lib/types";
import { cityNamedIn, pilgrimCountryName } from "@/lib/pilgrim";
import { isValidPhone } from "@/lib/validate";
import {
  ESIM_PLANS,
  INSURANCE_RATE_PER_GUEST,
  esimPlanRate,
  esimSelectionsCount,
  esimSelectionsTotal,
  listingToTaxi,
  listingToZiyarat,
  mealLines,
  mergeMealChoiceScope,
  parseMealChoice,
  packageAddonsTotal,
  packageMealRates,
  pilgrimCountryForPlace,
  tripDestinationCity,
  type EsimSelections,
  type MealChoice,
  type PackageListing,
  type PackageStaySlice,
  type PackageTaxi,
  type TaxiPick,
  type ZiyaratStop,
} from "@/lib/package-plan";
import { MealPlanStep, AirportTransferStep, DayTripsStep } from "@/components/PackageSteps";
import { PackageHotelPicker } from "@/components/PackageHotelPicker";
import { HotelStrip, PackageBill, TransferTimeline, type ReviewHotel } from "@/components/PackageReview";
import { PoliciesConsent } from "@/components/PoliciesConsent";
import { CheckoutAuth } from "@/components/CheckoutAuth";
import { DRAFT_PREFIX, DRAFT_TTL_MS, type DraftSummary } from "@/lib/checkout-drafts";
import { BedIcon, CarIcon, CheckIcon, ChevronIcon, GuestsIcon, LandmarkIcon, MinusIcon, PlusIcon, ShieldIcon, SimIcon, TableIcon, WalletIcon } from "@/components/icons";

const ZIYARAT_STEPS = ["Guests", "Meals", "Airport Transfer", "Day trips", "Pay", "Confirm"] as const;
const BUILD_STEPS = ["Guests", "Hotels & trips", "Meals", "Airport pick up", "Airport drop off", "Insurance", "eSIM", "Pay", "Confirm"] as const;
const STEP_SHORT: Record<string, string> = {
  "Hotels & trips": "Hotels",
  "Airport Transfer": "Transfer",
  "Airport pick up": "Pick up",
  "Airport drop off": "Drop off",
  "Day trips": "Day trips",
};

const STAY_STEPS = ["Guests", "Pay", "Confirm"] as const;
const ZIYARAT_ICONS = [GuestsIcon, TableIcon, CarIcon, LandmarkIcon, WalletIcon, CheckIcon];
const BUILD_ICONS = [GuestsIcon, BedIcon, TableIcon, CarIcon, CarIcon, ShieldIcon, SimIcon, WalletIcon, CheckIcon];
const STAY_ICONS = [GuestsIcon, WalletIcon, CheckIcon];

function GuestStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  readOnly = false,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  readOnly?: boolean;
  hint?: string;
}) {
  if (readOnly) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-sand/[0.03] px-4 py-3 ring-1 ring-sand/[0.08]">
        <div>
          <span className="text-sm text-sand">{label}</span>
          {hint && <p className="mt-0.5 text-xs text-mist">{hint}</p>}
        </div>
        <span className="w-5 text-center text-sm text-sand">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-xl bg-sand/[0.03] px-4 py-3 ring-1 ring-sand/[0.08]">
      <span className="text-sm text-sand">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-full text-sand ring-1 ring-sand/20 disabled:opacity-30"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="w-5 text-center text-sm text-sand">{value}</span>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-full text-sand ring-1 ring-sand/20 disabled:opacity-30"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

type TripLeg = { id: string; name: string; city: string; cover?: string; checkin: string; checkout: string; room?: string; amount: number; isPrimary: boolean; rooms: number; mixed?: boolean };
type LegAvailability = { checking: boolean; roomsLeft: number | null; error?: string };

function TripOrderEditor({
  legs,
  money,
  availability,
  onMove,
  onRemove,
  onEditDates,
  onRoomsChange,
}: {
  legs: TripLeg[];
  money: (n: number) => string;
  availability: Record<string, LegAvailability | undefined>;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onEditDates: (id: string, checkin: string, checkout: string) => void;
  onRoomsChange: (id: string, rooms: number) => void;
}) {
  return (
    <div className="space-y-3">
      {legs.map((leg, i) => {
        const status = availability[leg.id];
        const unavailable = status && status.roomsLeft !== null && status.roomsLeft < leg.rooms;
        const nights = nightsBetween(leg.checkin, leg.checkout);
        return (
          <article key={leg.id} className="overflow-hidden rounded-2xl bg-sand/[0.03] ring-1 ring-sand/[0.08]">
            {/* Title row: order, hotel, price */}
            <div className="flex items-start gap-3 p-4 pb-3">
              {legs.length > 1 ? (
                <div className="flex shrink-0 flex-col gap-1 pt-0.5">
                  <button
                    type="button"
                    disabled={i === 0}
                    aria-label={`Move ${leg.name} earlier`}
                    title="Move earlier"
                    className="grid h-6 w-6 place-items-center rounded-md text-sand ring-1 ring-sand/20 transition-colors hover:bg-sand/10 disabled:opacity-20 disabled:hover:bg-transparent"
                    onClick={() => onMove(leg.id, -1)}
                  >
                    <ChevronIcon open className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={i === legs.length - 1}
                    aria-label={`Move ${leg.name} later`}
                    title="Move later"
                    className="grid h-6 w-6 place-items-center rounded-md text-sand ring-1 ring-sand/20 transition-colors hover:bg-sand/10 disabled:opacity-20 disabled:hover:bg-transparent"
                    onClick={() => onMove(leg.id, 1)}
                  >
                    <ChevronIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-flame/20 text-sm font-bold text-sand">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="font-display truncate text-lg leading-tight">{leg.name}</h3>
                  {leg.isPrimary ? (
                    <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brass">
                      First booked
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-sm text-mist">
                  {leg.city}
                  {leg.room ? ` · ${leg.room}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-lg leading-none text-sand">{money(leg.amount)}</p>
                {!leg.isPrimary ? (
                  <button
                    type="button"
                    className="mt-1.5 text-xs text-mist underline decoration-mist/40 underline-offset-2 hover:text-rose"
                    onClick={() => onRemove(leg.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            {/* Dates, rooms and nights on one aligned row */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-sand/[0.06] px-4 py-3 sm:grid-cols-4">
              <label className="col-span-2 block min-w-0 sm:col-span-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-mist">Check-in</span>
                <input
                  type="date"
                  className="date-chip mt-1.5 w-full text-sm"
                  min={minCheckoutIso()}
                  value={leg.checkin}
                  onChange={(e) => onEditDates(leg.id, e.target.value, clampCheckoutIso(leg.checkout, e.target.value))}
                />
              </label>
              <label className="col-span-2 block min-w-0 sm:col-span-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-mist">Check-out</span>
                <input
                  type="date"
                  className="date-chip mt-1.5 w-full text-sm"
                  min={minCheckoutIso(leg.checkin)}
                  value={leg.checkout}
                  onChange={(e) => onEditDates(leg.id, leg.checkin, clampCheckoutIso(e.target.value, leg.checkin))}
                />
              </label>
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-mist">Rooms</span>
                {leg.mixed ? (
                  <p className="mt-1.5 py-1 text-sm text-sand">{leg.room || `${leg.rooms} rooms`}</p>
                ) : (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-sand/[0.05] p-0.5 ring-1 ring-sand/10">
                    <button
                      type="button"
                      disabled={leg.rooms <= 1}
                      aria-label="Fewer rooms"
                      className="grid h-7 w-7 place-items-center rounded-md text-sand transition-colors hover:bg-sand/10 disabled:opacity-30 disabled:hover:bg-transparent"
                      onClick={() => onRoomsChange(leg.id, Math.max(1, leg.rooms - 1))}
                    >
                      <MinusIcon className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold text-sand">{leg.rooms}</span>
                    <button
                      type="button"
                      disabled={leg.rooms >= 8}
                      aria-label="More rooms"
                      className="grid h-7 w-7 place-items-center rounded-md text-sand transition-colors hover:bg-sand/10 disabled:opacity-30 disabled:hover:bg-transparent"
                      onClick={() => onRoomsChange(leg.id, Math.min(8, leg.rooms + 1))}
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-mist">Length</span>
                <p className="mt-1.5 py-1 text-sm text-sand">
                  {nights} night{nights === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {status ? (
              <p
                className={`flex items-center gap-1.5 border-t px-4 py-2.5 text-xs font-medium ${
                  status.checking
                    ? "border-sand/[0.06] text-mist"
                    : unavailable || status.error
                      ? "border-rose/25 bg-rose/10 text-rose"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {status.checking
                  ? "Checking availability…"
                  : status.error
                    ? status.error
                    : unavailable
                      ? `Only ${status.roomsLeft} room${status.roomsLeft === 1 ? "" : "s"} left for these dates — you need ${leg.rooms}`
                      : `Available — ${status.roomsLeft} room${status.roomsLeft === 1 ? "" : "s"} left for these dates`}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function CheckoutInner() {
  const { money, currency } = useSerai();
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
  const payStep = !packageStay ? 1 : buildPackage ? 7 : 4;
  const confirmStep = lastStep;

  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [specialRequests, setSpecialRequests] = useState(params.get("requests") ?? "");
  const [promo, setPromo] = useState(params.get("promo") ?? "");
  const [promoChecked, setPromoChecked] = useState(false);
  const [roomsOv, setRoomsOv] = useState(() => {
    const decoded = decodeRoomPicks(params.get("picks"));
    if (decoded.length) return roomPicksTotal(decoded);
    return Number(params.get("rooms") || 1);
  });
  const [picksOv, setPicksOv] = useState<RoomPick[]>(() => {
    const decoded = decodeRoomPicks(params.get("picks"));
    if (decoded.length) return decoded;
    return fallbackPicks({
      roomId: params.get("room"),
      ratePlanId: params.get("rate"),
      rooms: Number(params.get("rooms") || 1),
      extraBeds: Number(params.get("extraBeds") || 0),
      cribs: Number(params.get("cribs") || 0),
    });
  });
  const [adultsOv, setAdultsOv] = useState(() => Number(params.get("adults") || params.get("guests") || 2));
  const [childrenOv, setChildrenOv] = useState(() => Number(params.get("children") || 0));
  const [childAgesOv, setChildAgesOv] = useState<number[]>(() => {
    const ages = (params.get("ages") ?? "").split(",").map(Number).filter((n) => Number.isFinite(n));
    const n = Number(params.get("children") || 0);
    return ages.length === n ? ages : Array.from({ length: n }, (_, i) => ages[i] ?? 8);
  });
  const setChildrenCount = (n: number) => {
    setChildrenOv(n);
    setChildAgesOv((ages) => {
      const next = ages.slice(0, n);
      while (next.length < n) next.push(8);
      return next;
    });
  };
  const [insurance, setInsurance] = useState(false);
  const [esimSelections, setEsimSelections] = useState<EsimSelections>({});
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
  const [primaryCheckin, setPrimaryCheckin] = useState<string | null>(null);
  const [extraStays, setExtraStays] = useState<PackageStaySlice[]>([]);
  const [hotelAsk, setHotelAsk] = useState<{ city: string; date: string } | null>(null);
  const [addingHotel, setAddingHotel] = useState(false);
  const [legOrder, setLegOrder] = useState<string[] | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [legAvailability, setLegAvailability] = useState<Record<string, LegAvailability>>({});
  const [extraStayCache, setExtraStayCache] = useState<Record<string, Stay>>({});

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
      checkin: (buildPackage && primaryCheckin) || (params.get("checkin") ?? ""),
      checkout: buildPackage ? firstEnd || (params.get("checkout") ?? "") : params.get("checkout") ?? "",
      rooms: roomPicksTotal(picksOv) || roomsOv,
      adults: adultsOv,
      children: childrenOv,
      childAges: childAgesOv,
      roomId: picksOv[0]?.roomId ?? params.get("room") ?? undefined,
      ratePlanId: picksOv[0]?.ratePlanId ?? params.get("rate") ?? undefined,
      extraBeds: picksOv[0]?.extraBeds ?? Number(params.get("extraBeds") || 0),
      cribs: picksOv[0]?.cribs ?? Number(params.get("cribs") || 0),
      picks: picksOv,
      extras,
      airportTransfer: packageStay ? false : airport,
      promo,
      member: Boolean(session?.user?.id),
    }),
    [params, extras, airport, promo, session?.user?.id, packageStay, buildPackage, firstEnd, primaryCheckin, roomsOv, adultsOv, childrenOv, childAgesOv, picksOv],
  );

  const quote = stay ? quoteStay(stay, input) : null;
  const methods = [
    { id: "card", label: "Card · Visa, Mastercard, Amex" },
    ...(quote?.payPolicy === "now" ? [] : [{ id: "property", label: "Pay at Reception" }]),
  ];
  const [method, setMethod] = useState("card");

  useEffect(() => {
    if (!buildPackage) return;
    const hotels = [
      { id: stay?.id ?? "", name: stay?.name ?? "", checkout: input.checkout },
      ...extraStays.map((s) => ({ id: s.listingId, name: s.name, checkout: s.checkout })),
    ];
    const allIds = hotels.map((h) => h.id);
    const order = legOrder ? [...legOrder.filter((id) => allIds.includes(id)), ...allIds.filter((id) => !legOrder.includes(id))] : allIds;
    const lastId = order[order.length - 1];
    const target = hotels.find((h) => h.id === lastId) ?? hotels[hotels.length - 1];
    const targetEnd = target?.checkout || input.checkout;
    setTaxiPicks((picks) => {
      let changed = false;
      const next: typeof picks = [];
      for (const p of picks) {
        if (p.leg === "out") {
          // A drop-off booked for a hotel that's no longer last in the itinerary is stale — drop it so the user re-picks.
          if (p.hotelName && target?.name && p.hotelName !== target.name) {
            changed = true;
            continue;
          }
          if (p.date !== targetEnd) {
            changed = true;
            next.push({ ...p, date: targetEnd });
            continue;
          }
        }
        next.push(p);
      }
      return changed ? next : picks;
    });
  }, [buildPackage, extraStays, input.checkout, legOrder, stay?.id, stay?.name]);

  const extraStaysKey = extraStays.map((s) => `${s.listingId}:${s.checkin}:${s.checkout}`).join("|");
  useEffect(() => {
    if (!packageStay || !stay) return;
    const allIds = [stay.id, ...extraStays.map((s) => s.listingId)];
    const order = legOrder ? [...legOrder.filter((id) => allIds.includes(id)), ...allIds.filter((id) => !legOrder.includes(id))] : allIds;
    const legs = order
      .map((id) => {
        if (id === stay.id) return { id: stay.id, checkin: input.checkin, checkout: input.checkout };
        const s = extraStays.find((x) => x.listingId === id);
        return s ? { id: s.listingId, checkin: s.checkin, checkout: s.checkout } : null;
      })
      .filter((l): l is { id: string; checkin: string; checkout: string } => Boolean(l));
    legs.forEach((l) => {
      checkAndRequoteLeg(l.id, l.checkin, l.checkout);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageStay, stay?.id, extraStaysKey, legOrder, input.checkin, input.checkout, input.rooms]);

  // Progress is saved on this device after every change, so a refresh (or a Google sign-in round trip) picks up where the guest left off.
  const draftKeyFor = () => `${DRAFT_PREFIX}${window.location.pathname}${window.location.search}`;
  const draftData = { step, phone, specialRequests, promo, roomsOv, picksOv, adultsOv, childrenOv, childAgesOv, insurance, esimSelections, airport, extras, meals, taxiPicks, firstEnd, primaryCheckin, extraStays, legOrder, method, terms };
  const saveDraft = () => {
    try {
      const summary: Omit<DraftSummary, "savedAt"> | undefined = stay
        ? {
            url: `${window.location.pathname}${window.location.search}`,
            kind: !packageStay ? "hotel" : buildPackage ? "package" : "ziyarat",
            title: stay.name,
            city: stay.city,
            cover: stay.cover,
            checkin: input.checkin,
            checkout: input.checkout,
            guests: input.adults + input.children,
            step,
            stepCount: steps.length,
            stepLabel: steps[step] ?? "",
            started: step > 0 || phone.trim().length > 0,
          }
        : undefined;
      localStorage.setItem(draftKeyFor(), JSON.stringify({ savedAt: Date.now(), data: draftData, summary }));
    } catch {
      /* private mode or full storage: progress just is not remembered */
    }
  };
  const clearDraft = () => {
    discardDraft.current = true;
    try {
      localStorage.removeItem(draftKeyFor());
    } catch {
      /* nothing to clear */
    }
  };
  const [restored, setRestored] = useState(false);
  const discardDraft = useRef(false);
  const [savedNote, setSavedNote] = useState(false);
  useEffect(() => {
    if (restored || !liveReady) return;
    setRestored(true);
    try {
      const raw = localStorage.getItem(draftKeyFor());
      if (!raw) return;
      const saved = JSON.parse(raw) as { savedAt?: number; data?: Record<string, unknown> };
      // Drafts older than a week are dropped.
      if (!saved.data || !saved.savedAt || Date.now() - saved.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(draftKeyFor());
        return;
      }
      const d = saved.data as Record<string, never>;
      if ("phone" in d) setPhone(d.phone);
      if ("specialRequests" in d) setSpecialRequests(d.specialRequests);
      if ("promo" in d) setPromo(d.promo);
      if ("roomsOv" in d) setRoomsOv(d.roomsOv);
      if ("picksOv" in d) setPicksOv(d.picksOv);
      if ("adultsOv" in d) setAdultsOv(d.adultsOv);
      if ("childrenOv" in d) setChildrenOv(d.childrenOv);
      if ("childAgesOv" in d) setChildAgesOv(d.childAgesOv);
      if ("insurance" in d) setInsurance(d.insurance);
      if ("esimSelections" in d) setEsimSelections(d.esimSelections);
      if ("airport" in d) setAirport(d.airport);
      if ("extras" in d) setExtras(d.extras);
      if ("meals" in d) setMeals(d.meals);
      if ("taxiPicks" in d) setTaxiPicks(d.taxiPicks);
      if ("firstEnd" in d) setFirstEnd(d.firstEnd);
      if ("primaryCheckin" in d) setPrimaryCheckin(d.primaryCheckin);
      if ("extraStays" in d) setExtraStays(d.extraStays);
      if ("legOrder" in d) setLegOrder(d.legOrder);
      if ("method" in d) setMethod(d.method);
      if ("terms" in d) setTerms(d.terms);
      if ("step" in d) setStep(d.step);
    } catch {
      /* a broken draft is simply ignored */
    }
  }, [restored, liveReady]);

  // Autosave a moment after any change (step, guests, meals, trips, hotels...).
  useEffect(() => {
    if (!restored || !liveReady || discardDraft.current) return;
    const t = window.setTimeout(() => {
      if (discardDraft.current) return;
      saveDraft();
      setSavedNote(true);
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, liveReady, JSON.stringify(draftData)]);

  if (status === "loading" || !liveReady) return <PageLoader label="Preparing checkout" />;
  if (!stay || !quote) return <div className="p-10">No ticket to stamp.</div>;

  const addons = stay.experienceIds.map(experienceById);
  const party = input.adults + input.children;
  const esimTotalQty = esimSelectionsCount(esimSelections);
  const esimRemaining = Math.max(0, Math.max(1, party) - esimTotalQty);
  const adjustEsim = (id: keyof EsimSelections, delta: number) => {
    setEsimSelections((prev) => {
      const cur = prev[id] ?? 0;
      const others = ESIM_PLANS.reduce((s, p) => s + (p.id === id ? 0 : prev[p.id] ?? 0), 0);
      const cap = Math.max(0, Math.max(1, party) - others);
      const nextQty = Math.min(cap, Math.max(0, cur + delta));
      const next = { ...prev };
      if (nextQty <= 0) delete next[id];
      else next[id] = nextQty;
      return next;
    });
  };
  const promoInvalid = promoChecked && Boolean(promo.trim()) && !quote.rulesApplied.includes("promo_codes");

  // Every hotel in the package, in the order the guest chose to visit them — the primary (anchor) hotel plus any added stays.
  const allLegIds = [stay.id, ...extraStays.map((s) => s.listingId)];
  const effectiveOrder = legOrder
    ? [...legOrder.filter((id) => allLegIds.includes(id)), ...allLegIds.filter((id) => !legOrder.includes(id))]
    : allLegIds;
  const orderedLegs: TripLeg[] = effectiveOrder
    .map((id): TripLeg | null => {
      if (id === stay.id) {
        return {
          id: stay.id,
          name: stay.name,
          city: stay.city,
          cover: stay.cover,
          checkin: input.checkin,
          checkout: input.checkout,
          room: quote.roomLabel || `${quote.room.name} · ${quote.rate.name}`,
          amount: quote.grand,
          isPrimary: true,
          rooms: quote.rooms,
          mixed: quote.picks.length > 1,
        };
      }
      const s = extraStays.find((x) => x.listingId === id);
      return s
        ? { id: s.listingId, name: s.name, city: s.city, cover: s.cover, checkin: s.checkin, checkout: s.checkout, room: s.roomName, amount: s.amount, isPrimary: false, rooms: s.rooms, mixed: Boolean(s.picks && s.picks.length > 1) }
        : null;
    })
    .filter((l): l is TripLeg => Boolean(l));
  const lastHotel = orderedLegs[orderedLegs.length - 1] ?? { name: stay.name, city: stay.city, checkout: input.checkout };
  const tripCities = orderedLegs.map((l) => l.city);
  const tripEnd = orderedLegs.reduce((end, l) => (l.checkout > end ? l.checkout : end), input.checkout);
  const anyLegUnavailable = orderedLegs.some((l) => {
    const st = legAvailability[l.id];
    return st && !st.checking && st.roomsLeft !== null && st.roomsLeft < l.rooms;
  });

  // Meals default to "on" for every night from the moment the page loads, so their presence alone can't signal
  // the guest actually customized anything — only real, explicit choices (a trip/transfer picked) are used to
  // decide whether a confirmation is worth showing.
  const hasDownstreamPicks = () => taxiPicks.length > 0;
  const clearDownstream = () => {
    setTaxiPicks([]);
    setMeals({ breakfast: [], lunch: [], dinner: [] });
  };
  const withConfirmClear = (action: () => void) => {
    if (!hasDownstreamPicks()) {
      action();
      return;
    }
    setConfirmDialog({
      message: "Changing your hotels or dates clears your city-to-city trips, airport transfers, and meal selections so you can reassign them for the new plan.",
      onConfirm: () => {
        clearDownstream();
        action();
        setConfirmDialog(null);
      },
    });
  };
  const fetchFullStay = async (listingId: string): Promise<Stay | null> => {
    if (listingId === stay.id) return stay;
    if (extraStayCache[listingId]) return extraStayCache[listingId];
    try {
      const res = await fetch(`/api/listings/${listingId}`, { cache: "no-store" });
      const d = await readJson<Record<string, unknown>>(res);
      if (!d || d.error || d.kind !== "STAY") return null;
      const full = listingToStay(d as never);
      setExtraStayCache((c) => ({ ...c, [listingId]: full }));
      return full;
    } catch {
      return null;
    }
  };

  /** Re-checks live room availability for a hotel leg's (new) dates, and — for added hotels — re-quotes its price against those dates and that hotel's own room count. */
  const checkAndRequoteLeg = async (id: string, checkin: string, checkout: string, roomsOverride?: number) => {
    setLegAvailability((s) => ({ ...s, [id]: { checking: true, roomsLeft: null } }));
    const fullStay = await fetchFullStay(id);
    if (!fullStay) {
      setLegAvailability((s) => ({ ...s, [id]: { checking: false, roomsLeft: null, error: "Could not check this hotel's availability." } }));
      return;
    }
    try {
      const availRes = await fetch(`/api/listings/${id}/availability?checkin=${checkin}&checkout=${checkout}`, { cache: "no-store" });
      const availData = await readJson<{ overlapping?: number }>(availRes);
      const overlapping = typeof availData?.overlapping === "number" ? availData.overlapping : 0;
      const rooms = stayRooms(fullStay);
      const totalCapacity = rooms.reduce((sum, r) => sum + r.available, 0);
      const roomsLeft = Math.max(0, totalCapacity - overlapping);
      setLegAvailability((s) => ({ ...s, [id]: { checking: false, roomsLeft } }));
      if (id !== stay.id) {
        const slice = extraStays.find((s) => s.listingId === id);
        const room = rooms.find((r) => r.id === slice?.roomId) ?? rooms[0];
        const q = quoteStay(fullStay, {
          checkin,
          checkout,
          rooms: roomsOverride ?? slice?.rooms ?? 1,
          adults: input.adults,
          children: input.children,
          childAges: input.childAges,
          roomId: room?.id,
          ratePlanId: slice?.ratePlanId || room?.rates[0]?.id,
          picks:
            slice?.picks && slice.picks.length
              ? roomsOverride && slice.picks.length === 1
                ? [{ ...slice.picks[0], rooms: roomsOverride }]
                : slice.picks
              : undefined,
        });
        setExtraStays((rows) =>
          rows.map((s) =>
            s.listingId === id
              ? {
                  ...s,
                  checkin,
                  checkout,
                  amount: q.grand,
                  cancellation: q.cancelPolicy,
                  rooms: roomsOverride ?? s.rooms,
                  roomName: q.roomLabel,
                  picks: q.picks.map((p) => ({ roomId: p.room.id, ratePlanId: p.rate.id, rooms: p.rooms })),
                }
              : s,
          ),
        );
      }
    } catch {
      setLegAvailability((s) => ({ ...s, [id]: { checking: false, roomsLeft: null, error: "Could not check availability." } }));
    }
  };

  const onLegRoomsChange = (id: string, rooms: number) => {
    if (id === stay.id) {
      setRoomsOv(rooms);
      setPicksOv((ps) => (ps.length <= 1 ? [{ ...(ps[0] ?? { roomId: input.roomId || "", rooms: 1 }), rooms }] : ps));
      return;
    }
    const slice = extraStays.find((s) => s.listingId === id);
    if (slice?.picks && slice.picks.length > 1) return;
    setExtraStays((rows) =>
      rows.map((s) =>
        s.listingId === id
          ? { ...s, rooms, picks: s.picks?.length === 1 ? [{ ...s.picks[0], rooms }] : s.picks }
          : s,
      ),
    );
    if (slice) checkAndRequoteLeg(id, slice.checkin, slice.checkout, rooms);
  };

  const onEditLegDates = (id: string, checkin: string, checkout: string) => {
    const nextCheckout = clampCheckoutIso(checkout, checkin);
    withConfirmClear(() => {
      if (id === stay.id) {
        setPrimaryCheckin(checkin);
        setFirstEnd(nextCheckout);
      }
      checkAndRequoteLeg(id, checkin, nextCheckout);
    });
  };

  const moveLeg = (id: string, dir: -1 | 1) => {
    const idx = effectiveOrder.indexOf(id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= effectiveOrder.length) return;
    const aId = effectiveOrder[idx];
    const bId = effectiveOrder[swapIdx];
    const aLeg = orderedLegs.find((l) => l.id === aId);
    const bLeg = orderedLegs.find((l) => l.id === bId);
    if (!aLeg || !bLeg) return;
    const next = [...effectiveOrder];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    withConfirmClear(() => {
      setLegOrder(next);
      // Swap dates too, so the itinerary stays chronological — each hotel takes on the other's date range.
      if (aId === stay.id) {
        setPrimaryCheckin(bLeg.checkin);
        setFirstEnd(bLeg.checkout);
      }
      if (bId === stay.id) {
        setPrimaryCheckin(aLeg.checkin);
        setFirstEnd(aLeg.checkout);
      }
      checkAndRequoteLeg(aId, bLeg.checkin, bLeg.checkout);
      checkAndRequoteLeg(bId, aLeg.checkin, aLeg.checkout);
    });
  };

  const packTotal = packageStay
    ? packageAddonsTotal({
        meals,
        guests: party,
        nights: quote.nights,
        ziyaratIds,
        taxis: taxiPicks,
        ziyarat,
        taxiList,
        mealRates: packageMealRates(stay.mealRates),
        stays: extraStays,
        insurance: buildPackage && insurance,
        esimSelections: buildPackage ? esimSelections : {},
      })
    : 0;
  const grand = quote.grand + packTotal;
  const reviewHotels: ReviewHotel[] = orderedLegs.map((l) => ({ id: l.id, name: l.name, city: l.city, checkin: l.checkin, checkout: l.checkout, room: l.room, amount: l.amount }));
  const mealGroups = orderedLegs.map((h) => ({
    hotel: h,
    rows: mealLines(parseMealChoice(meals, stayNightDates(h.checkin, h.checkout)), party, nightsBetween(h.checkin, h.checkout), packageMealRates(stay.mealRates)),
  }));
  const mealBill = mealGroups.flatMap((g) => g.rows);
  const policyHref = `/checkout/policies?stays=${encodeURIComponent(orderedLegs.map((l) => l.id).join(","))}`;
  const stepIcons = !packageStay ? STAY_ICONS : buildPackage ? BUILD_ICONS : ZIYARAT_ICONS;

  const addExtraStay = (slice: PackageStaySlice) => {
    // Adding a hotel is purely additive — it appends to the end of the trip and never invalidates
    // an existing trip/transfer, so this never needs the "clear downstream" confirmation.
    if (slice.checkin > input.checkin && slice.checkin < (firstEnd || input.checkout)) {
      setFirstEnd(slice.checkin);
    }
    setExtraStays((rows) => [...rows.filter((s) => s.listingId !== slice.listingId), slice]);
    setHotelAsk(null);
    setAddingHotel(false);
  };
  const removeExtraStay = (listingId: string) => {
    withConfirmClear(() => {
      setExtraStays((rows) => rows.filter((s) => s.listingId !== listingId));
      setLegOrder((order) => (order ? order.filter((id) => id !== listingId) : order));
    });
  };
  const payBlock = (
    <div className="mt-6 space-y-3 rounded-2xl border border-sand/[0.08] bg-ink-2 p-5 shadow-[0_12px_40px_rgba(11,28,52,0.05)]">
      <p className="text-sm text-mist">
        {PAY_LABEL[quote.payPolicy]} · {CANCEL_LABEL[quote.cancelPolicy]}
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
      {method === "card" ? (
        <p className="text-xs text-mist">You will pay securely on Stripe. The booking is confirmed after the charge succeeds.</p>
      ) : (
        <p className="text-xs text-mist">Pay the property at check-in. No card is charged now.</p>
      )}
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
          className={`mt-2 w-full rounded-xl bg-sand/[0.04] px-3.5 py-2.5 text-sand outline-none ring-1 placeholder:text-mist/70 focus:ring-brass/35 ${
            promoInvalid ? "ring-rose/60" : "ring-sand/[0.08]"
          }`}
          placeholder="SERAI10"
          value={promo}
          onChange={(e) => {
            setPromo(e.target.value);
            setPromoChecked(false);
          }}
          onBlur={() => setPromoChecked(true)}
        />
      </label>
      {promoInvalid ? (
        <p className="flex items-center justify-between gap-3 text-sm text-rose">
          <span>“{promo.trim()}” isn’t a valid promo code.</span>
          <button
            type="button"
            className="shrink-0 underline hover:text-sand"
            onClick={() => {
              setPromo("");
              setPromoChecked(false);
            }}
          >
            Clear
          </button>
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] lg:py-8">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      {confirmDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-5">
          <div className="w-full max-w-md rounded-2xl border border-brass/30 bg-ink-2 p-6">
            <p className="font-display text-xl">Reassign your trip details?</p>
            <p className="mt-2 text-sm text-mist">{confirmDialog.message}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="btn-primary rounded-full" onClick={confirmDialog.onConfirm}>
                Continue and clear them
              </button>
              <button type="button" className="btn-ghost rounded-full" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.3em] text-brass">{buildPackage ? "Package" : packageStay ? "Ziyarah package" : "Hotel"}</p>
        <h1 className="font-display mt-1 text-3xl md:text-4xl">
          {buildPackage && country ? `Preparing ${pilgrimCountryName(country)} Ziyarah package` : packageStay ? `${stay.name}` : "Confirm your hotel"}
        </h1>
        <p className="mt-1 text-sm text-mist">
          {packageStay && country
            ? `${stay.city}, ${pilgrimCountryName(country)} · ${formatDay(input.checkin)} — ${formatDay(tripEnd)}`
            : "Room and payment only."}
        </p>
        <div className="mt-5 rounded-2xl border border-sand/[0.08] bg-ink-2/60 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <p className="text-sm">
              <span className="text-mist">Step {step + 1} of {steps.length}</span>
              <span className="mx-2 text-brass/50">·</span>
              <span className="font-semibold text-sand">{steps[step]}</span>
            </p>
            {/* The full bill sits in the sidebar, which drops below the form on phones — keep the number in view. */}
            <p className="text-sm lg:hidden">
              <span className="text-mist">You pay </span>
              <span className="font-display text-lg text-sand">{money(grand)}</span>
            </p>
            {savedNote && (
              <p className="flex items-center gap-x-3 text-xs text-mist">
                <span className="inline-flex items-center gap-1.5 text-emerald-500">
                  <CheckIcon className="h-3.5 w-3.5" /> Progress saved
                </span>
                <button
                  type="button"
                  className="underline decoration-brass/50 underline-offset-4 hover:text-sand"
                  onClick={() => {
                    clearDraft();
                    window.location.reload();
                  }}
                >
                  Start over
                </button>
              </p>
            )}
          </div>


          {/* Every stage at a glance: a connected rail on desktop, compact dots on phones. */}
          <ol
            className="mt-4 hidden pb-0.5 sm:grid"
            style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          >
            {steps.map((label, i) => {
              const Icon = stepIcons[i];
              const done = i < step;
              const here = i === step;
              const reachable = i <= step || Boolean(phone);
              return (
                <li key={label} className="relative flex min-w-0 flex-col items-center">
                  {i > 0 ? (
                    <span
                      aria-hidden
                      className={`absolute right-1/2 top-[1.06rem] h-0.5 w-full ${done || here ? "bg-flame/70" : "bg-sand/12"}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={!reachable}
                    aria-current={here ? "step" : undefined}
                    title={label}
                    className="group relative z-10 flex w-full min-w-0 flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                    onClick={() => {
                      if (reachable) setStep(i);
                    }}
                  >
                    <span
                      className={`grid h-[2.15rem] w-[2.15rem] shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-colors ${
                        here
                          ? "border-flame bg-flame text-ink shadow-[0_0_0_5px_rgba(197,164,106,0.18)]"
                          : done
                            ? "border-flame/70 bg-flame/20 text-brass"
                            : reachable
                              ? "border-sand/20 bg-ink-2 text-mist group-hover:border-brass/60 group-hover:text-sand"
                              : "border-sand/12 bg-ink-2 text-mist/50"
                      }`}
                    >
                      {done ? <CheckIcon className="h-[1.1rem] w-[1.1rem]" /> : Icon ? <Icon className="h-[1.15rem] w-[1.15rem]" /> : i + 1}
                    </span>
                    <span
                      className={`w-full truncate px-0.5 text-center text-[13px] leading-tight ${
                        here ? "font-bold text-sand" : done ? "font-semibold text-brass" : "font-medium text-mist"
                      }`}
                    >
                      {STEP_SHORT[label] ?? label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <ol className="mt-3 flex items-center gap-1.5 sm:hidden">
            {steps.map((label, i) => {
              const done = i < step;
              const here = i === step;
              const reachable = i <= step || Boolean(phone);
              return (
                <li key={label} className="flex-1">
                  <button
                    type="button"
                    disabled={!reachable}
                    aria-label={`Step ${i + 1}: ${label}`}
                    aria-current={here ? "step" : undefined}
                    className={`h-1.5 w-full rounded-full transition-colors ${
                      here ? "bg-flame" : done ? "bg-flame/45" : "bg-sand/12"
                    }`}
                    onClick={() => {
                      if (reachable) setStep(i);
                    }}
                  />
                </li>
              );
            })}
          </ol>
        </div>

        {step === 0 && (
          <div className="mt-6 space-y-3 rounded-2xl border border-sand/[0.08] bg-ink-2 p-5 shadow-[0_12px_40px_rgba(11,28,52,0.05)]">
            <p className="text-sm text-mist">
              {status === "authenticated"
                ? `Booking as ${session?.user?.name} · ${session?.user?.email}`
                : "Booking as a guest. You will sign in or create an account at the very end, just before you confirm."}
            </p>
            <div className="space-y-2">
              <GuestStepper
                label={buildPackage ? "Rooms (first hotel)" : "Rooms"}
                value={roomsOv}
                onChange={(n) => {
                  setRoomsOv(n);
                  setPicksOv((ps) => (ps.length <= 1 ? [{ ...(ps[0] ?? { roomId: params.get("room") || "", rooms: 1 }), rooms: n }] : ps));
                }}
                min={1}
                max={8}
                readOnly={buildPackage || picksOv.length > 1}
                hint={
                  picksOv.length > 1
                    ? "You mixed room types. Change the mix on the hotel page."
                    : buildPackage
                      ? "Each hotel has its own room count — set it in Hotels & trips."
                      : undefined
                }
              />
              <GuestStepper label="Adults" value={adultsOv} onChange={setAdultsOv} min={1} max={16} />
              <GuestStepper label="Children" value={childrenOv} onChange={setChildrenCount} min={0} max={8} />
            </div>
            {childrenOv > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {childAgesOv.map((age, i) => (
                  <label key={i} className="text-xs text-mist">
                    Child {i + 1} age
                    <select
                      className="mt-1 w-full rounded-lg bg-ink-2 px-2 py-1.5 text-sand ring-1 ring-sand/10"
                      value={age}
                      onChange={(e) => setChildAgesOv((ages) => ages.map((a, idx) => (idx === i ? Number(e.target.value) : a)))}
                    >
                      {Array.from({ length: 18 }, (_, n) => n).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <input
              className={`w-full rounded-xl bg-sand/[0.04] px-3.5 py-2.5 outline-none ring-1 focus:ring-brass/35 ${
                phoneError ? "ring-rose/60" : "ring-sand/[0.08]"
              }`}
              placeholder="+92 300 1234567"
              type="tel"
              required
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (isValidPhone(e.target.value)) setPhoneError(false);
              }}
              onBlur={() => {
                if (phone.trim() && !isValidPhone(phone)) setPhoneError(true);
              }}
            />
            {phoneError && (
              <p className="text-sm text-rose">
                {phone.trim() ? "Enter a valid phone number, e.g. +92 300 1234567" : "Phone number is required to continue."}
              </p>
            )}
            <textarea
              className="w-full rounded-xl bg-sand/[0.04] px-3.5 py-2.5 outline-none ring-1 ring-sand/[0.08] focus:ring-brass/35"
              rows={2}
              placeholder="Special requests (late arrival, ground floor…)"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
            />
          </div>
        )}

        {packageStay && !buildPackage && step === 1 && (
          <div>
            <MealPlanStep
              meals={meals}
              onChange={setMeals}
              guests={party}
              dates={stayNightDates(input.checkin, input.checkout)}
              rates={packageMealRates(stay.mealRates)}
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

        {buildPackage && step === 1 && (
          <div className="mt-6 space-y-6">
            {/* Hotels */}
            <section>
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-brass">Itinerary</p>
                  <h2 className="font-display mt-1 text-2xl md:text-3xl">Your hotels</h2>
                </div>
                <p className="text-sm text-mist">
                  {orderedLegs.length} hotel{orderedLegs.length === 1 ? "" : "s"} · {formatDay(input.checkin)} — {formatDay(tripEnd)}
                </p>
              </div>
              <div className="mt-4">
                <TripOrderEditor
                  legs={orderedLegs}
                  money={money}
                  availability={legAvailability}
                  onMove={moveLeg}
                  onRemove={removeExtraStay}
                  onEditDates={onEditLegDates}
                  onRoomsChange={onLegRoomsChange}
                />
              </div>
              {addingHotel && !hotelAsk ? (
                <div className="mt-4">
                  <PackageHotelPicker
                    country={country}
                    city={lastHotel.city}
                    excludeIds={[stay.id, ...extraStays.map((s) => s.listingId)]}
                    defaultCheckin={lastHotel.checkout || addDaysIso(input.checkin, nightsBetween(input.checkin, input.checkout))}
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
                </div>
              ) : !addingHotel ? (
                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brass/35 bg-sand/[0.02] py-4 text-sm font-semibold text-sand transition-colors hover:border-brass/60 hover:bg-flame/[0.06]"
                  onClick={() => setAddingHotel(true)}
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-flame/20 text-brass">
                    <PlusIcon className="h-3 w-3" />
                  </span>
                  Add another hotel
                </button>
              ) : null}
            </section>

            <div className="h-px bg-sand/[0.08]" />

            {/* City-to-city trips */}
            <section>
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
                blurb="Travel between cities by private car. We offer a hotel at each new destination."
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
                <div className="mt-5 rounded-2xl border border-brass/30 bg-flame/[0.07] p-4 sm:p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-brass">New city on your trip</p>
                  <p className="font-display mt-1 text-xl">Would you like to book a hotel in {hotelAsk.city}?</p>
                  <p className="mt-1.5 text-sm text-mist">Your trip ends there. You can add more cities afterwards.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
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
              {hotelAsk && addingHotel ? (
                <div className="mt-5">
                  <PackageHotelPicker
                    country={country}
                    city={hotelAsk.city}
                    excludeIds={[stay.id, ...extraStays.map((s) => s.listingId)]}
                    defaultCheckin={hotelAsk.date || lastHotel.checkout || addDaysIso(input.checkin, nightsBetween(input.checkin, input.checkout))}
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
                </div>
              ) : null}
            </section>
          </div>
        )}

        {buildPackage && step === 2 && (
          <div className="space-y-8">
            {orderedLegs.map((h) => {
              const hotelDates = stayNightDates(h.checkin, h.checkout);
              return (
                <div key={h.id}>
                  {orderedLegs.length > 1 && <p className="mb-2 font-display text-xl">Meals for {h.name}</p>}
                  <MealPlanStep
                    meals={meals}
                    onChange={(next) => setMeals((prev) => mergeMealChoiceScope(prev, next, hotelDates))}
                    guests={party}
                    dates={hotelDates}
                    rates={packageMealRates(stay.mealRates)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {buildPackage && step === 3 && (
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
          />
        )}

        {buildPackage && step === 4 && (
          <div className="mt-4">
            <AirportTransferStep
              country={country}
              city={lastHotel.city}
              cities={tripCities}
              stayName={lastHotel.name}
              catalog={taxiList}
              picks={taxiPicks}
              start={input.checkin}
              end={lastHotel.checkout}
              onChange={setTaxiPicks}
              airportLeg="out"
              title="Airport drop off"
            />
          </div>
        )}

        {buildPackage && step === 5 && (
          <div className="mt-6 rounded-2xl border border-sand/[0.08] bg-ink-2 p-5 shadow-[0_12px_40px_rgba(11,28,52,0.05)]">
            <p className="text-[11px] uppercase tracking-[0.28em] text-brass">Insurance</p>
            <h2 className="font-display mt-1 text-2xl">Travel insurance</h2>
            <p className="mt-1 text-sm text-mist">One flat price per guest, covering the whole trip.</p>
            <label
              className={`mt-4 flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3.5 ring-1 transition ${
                insurance ? "bg-flame/10 ring-brass/35" : "bg-sand/[0.03] ring-sand/[0.08] hover:ring-sand/15"
              }`}
            >
              <span>
                <span className="font-medium">Add travel insurance</span>
                <span className="mt-1 block text-xs text-mist">
                  {money(INSURANCE_RATE_PER_GUEST)} / guest · {party} guest{party === 1 ? "" : "s"} · {money(INSURANCE_RATE_PER_GUEST * Math.max(1, party))} total
                </span>
              </span>
              <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} />
            </label>
          </div>
        )}

        {buildPackage && step === 6 && (
          <div className="mt-6 rounded-2xl border border-sand/[0.08] bg-ink-2 p-5 shadow-[0_12px_40px_rgba(11,28,52,0.05)]">
            <p className="text-[11px] uppercase tracking-[0.28em] text-brass">eSIM</p>
            <h2 className="font-display mt-1 text-2xl">Data for your trip</h2>
            <p className="mt-1 text-sm text-mist">
              Choose a plan per guest. {party} guest{party === 1 ? "" : "s"} in this party.
            </p>
            <div className="mt-4 space-y-2">
              {ESIM_PLANS.map((p) => {
                const qty = esimSelections[p.id] ?? 0;
                const max = qty + esimRemaining;
                return (
                  <div key={p.id} className={`rounded-2xl px-4 py-3.5 ring-1 transition ${qty ? "bg-flame/10 ring-brass/35" : "bg-sand/[0.03] ring-sand/[0.08]"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="font-medium">{p.label}</span>
                        <span className="mt-1 block text-xs text-mist">{p.blurb} · {money(p.pricePerGuest)} / eSIM</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center rounded-full text-sand ring-1 ring-sand/20 disabled:opacity-30"
                          disabled={qty <= 0}
                          onClick={() => adjustEsim(p.id, -1)}
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm text-sand">{qty}</span>
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center rounded-full text-sand ring-1 ring-sand/20 disabled:opacity-30"
                          disabled={qty >= max}
                          onClick={() => adjustEsim(p.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-mist">
              {esimTotalQty} of {Math.max(1, party)} eSIM{Math.max(1, party) === 1 ? "" : "s"} selected
              {esimTotalQty ? ` · ${money(esimSelectionsTotal(esimSelections))} total` : ""}
            </p>
            <label className="mt-4 block text-sm text-mist">
              Promo code
              <input
                className={`mt-2 w-full rounded-xl bg-sand/[0.04] px-3.5 py-2.5 text-sand outline-none ring-1 placeholder:text-mist/70 focus:ring-brass/35 ${
                  promoInvalid ? "ring-rose/60" : "ring-sand/[0.08]"
                }`}
                placeholder="SERAI10"
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value);
                  setPromoChecked(false);
                }}
                onBlur={() => setPromoChecked(true)}
              />
            </label>
            {promoInvalid ? (
              <p className="mt-2 flex items-center justify-between gap-3 text-sm text-rose">
                <span>“{promo.trim()}” isn’t a valid promo code.</span>
                <button
                  type="button"
                  className="shrink-0 underline hover:text-sand"
                  onClick={() => {
                    setPromo("");
                    setPromoChecked(false);
                  }}
                >
                  Clear
                </button>
              </p>
            ) : null}
          </div>
        )}

        {step === payStep && payBlock}

        {step === confirmStep && (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-brass">Review & confirm</p>
              <h2 className="font-display mt-1 text-3xl leading-tight">{buildPackage ? "Your package" : stay.name}</h2>
              <p className="mt-1 text-sm text-mist">
                {formatDay(input.checkin)} — {formatDay(tripEnd)} · {party} guests · {PAY_LABEL[quote.payPolicy]} · {methods.find((m) => m.id === method)?.label ?? method}
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
                  {quote.roomLabel} · {CANCEL_LABEL[quote.cancelPolicy]}
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

            {packageStay && mealBill.length > 0
              ? mealGroups.map((g) =>
                  g.rows.length ? (
                    <section key={g.hotel.id} className="pane p-5">
                      <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-brass">
                        Meals{mealGroups.length > 1 ? ` · ${g.hotel.name}` : ""}
                      </p>
                      <ul className="space-y-2 text-sm">
                        {g.rows.map((l) => (
                          <li key={l.id} className="flex justify-between gap-3">
                            <span className="text-mist">{l.label}</span>
                            <span className="shrink-0 text-sand">{money(l.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null,
                )
              : null}

            {packageStay && quote.discounts.length > 0 ? (
              <section className="pane p-5">
                <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-brass">Discounts</p>
                <ul className="space-y-2 text-sm">
                  {quote.discounts.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3">
                      <span className="text-mist">{l.label}</span>
                      <span className="shrink-0 text-sage">{money(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {buildPackage && (insurance || esimTotalQty) ? (
              <section className="pane p-5">
                <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-brass">Add-ons</p>
                <ul className="space-y-2 text-sm">
                  {insurance ? (
                    <li className="flex justify-between gap-3">
                      <span className="text-mist">Travel insurance · {party} guest{party === 1 ? "" : "s"}</span>
                      <span className="shrink-0 text-sand">{money(INSURANCE_RATE_PER_GUEST * Math.max(1, party))}</span>
                    </li>
                  ) : null}
                  {ESIM_PLANS.map((p) => {
                    const qty = esimSelections[p.id] ?? 0;
                    if (!qty) return null;
                    return (
                      <li key={p.id} className="flex justify-between gap-3">
                        <span className="text-mist">eSIM · {p.label} × {qty}</span>
                        <span className="shrink-0 text-sand">{money(esimPlanRate(p.id) * qty)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {specialRequests ? <p className="text-sm text-mist">Requests: {specialRequests}</p> : null}

            <div className="pane space-y-4 p-5">
              <PoliciesConsent href={policyHref} cancelLabel={CANCEL_LABEL[quote.cancelPolicy]} checked={terms} onChange={setTerms} />
              {error && <p className="text-sm text-rose">{error}</p>}
              {status !== "authenticated" ? (
                <CheckoutAuth
                  returnTo={typeof window === "undefined" ? "/checkout" : `${window.location.pathname}${window.location.search}`}
                  onBeforeGoogle={saveDraft}
                />
              ) : (
                <p className="text-sm text-mist">
                  Signed in as <span className="text-sand">{session?.user?.name || session?.user?.email}</span>. Your booking is ready to confirm.
                </p>
              )}
              {status === "authenticated" && (
              <button
                type="button"
                className="btn-primary w-full py-3.5"
                onClick={async () => {
                  if (!isValidPhone(phone)) {
                    setPhoneError(true);
                    setStep(0);
                    return;
                  }
                  if (anyLegUnavailable) {
                    setError("One of your hotels is no longer available for its dates. Go back to Hotels & trips to fix it.");
                    return;
                  }
                  if (!terms) {
                    setError("Please accept the policies to continue.");
                    return;
                  }
                  setError("");
                  setOverlay(method === "card" ? "Opening card payment" : "Confirming booking");
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
                      picks: picksOv,
                      extraIds: extras,
                      airportTransfer: packageStay ? false : airport,
                      promo,
                      member: Boolean(session?.user?.id),
                      specialRequests,
                      payment: method,
                      currency,
                      phone,
                      package: packageStay
                        ? {
                            flow: buildPackage ? "package" : "ziyarat",
                            meals,
                            ziyaratIds,
                            taxis: taxiPicks,
                            stays: buildPackage ? extraStays : [],
                            insurance: buildPackage && insurance,
                            esimSelections: buildPackage ? esimSelections : {},
                          }
                        : undefined,
                    }),
                  });
                  const data = await readJson<{ error?: string; id?: string; payUrl?: string }>(res);
                  if (!res.ok) {
                    setOverlay(null);
                    setError(data?.error || "Could not place reservation");
                    return;
                  }
                  clearDraft();
                  if (data?.payUrl) {
                    window.location.assign(data.payUrl);
                    return;
                  }
                  router.push(`/booked/${data?.id ?? stay.id}`);
                }}
              >
                {method === "card" ? "Pay with card" : packageStay ? "Confirm package" : "Confirm booking"} · {money(grand)}
              </button>
              )}
            </div>
          </div>
        )}

        {step < lastStep && (
          <div className="mt-6 border-t border-sand/[0.08] pt-5">
            {step === 1 && anyLegUnavailable ? (
              <p className="mb-3 rounded-xl border border-rose/30 bg-rose/10 px-3.5 py-2.5 text-sm text-rose">
                One of your hotels isn’t available for its current dates — fix the dates or remove it to continue.
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              {step > 0 ? (
                <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={() => setStep((s) => s - 1)}>
                  <ChevronIcon className="h-4 w-4 rotate-90" />
                  Back
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                disabled={step === 1 && anyLegUnavailable}
                className="btn-primary inline-flex items-center gap-2 px-6 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (step === 0 && !isValidPhone(phone)) {
                    setPhoneError(true);
                    return;
                  }
                  setStep((s) => s + 1);
                }}
              >
                <span>Continue</span>
                <ChevronIcon className="h-4 w-4 -rotate-90" />
              </button>
            </div>
          </div>
        )}
      </div>
      <aside className="ticket h-fit min-w-0 lg:sticky lg:top-20">
        {/* A boarding pass: photo header, itemised body, perforation, then the total. */}
        <div className="ticket-card relative overflow-hidden rounded-3xl">
          <div className="relative h-40">
            <Image src={stay.cover} alt="" fill sizes="(min-width: 1024px) 26rem, 100vw" className="object-cover" />
            <span aria-hidden className="ticket-scrim absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e2c488]">{packageStay ? "Package" : "Hotel"}</p>
              <h2 className="font-display mt-1 text-xl leading-tight text-white [text-shadow:0_1px_12px_rgba(3,12,26,0.75)]">
                {packageStay ? orderedLegs.map((l) => l.name).join(" · ") : stay.name}
              </h2>
              <p className="mt-1 text-sm text-white/80">
                {packageStay
                  ? `${formatDay(input.checkin)} — ${formatDay(tripEnd)} · ${party} guest${party === 1 ? "" : "s"}`
                  : `${quote.roomLabel} · ${formatDay(input.checkin)} — ${formatDay(input.checkout)} · ${quote.nights} night${quote.nights === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          <div className="px-5 pb-5 pt-5">
            {packageStay ? (
              <PackageBill
                hotels={reviewHotels}
                meals={meals}
                guests={party}
                nights={quote.nights}
                mealRates={packageMealRates(stay.mealRates)}
                taxis={taxiPicks}
                taxiList={taxiList}
                stayName={stay.name}
                lastHotelName={lastHotel.name}
                grand={grand}
                insurance={buildPackage && insurance}
                esimSelections={buildPackage ? esimSelections : {}}
                discounts={quote.discounts}
                compact
                showTotal={false}
              />
            ) : (
              <PriceBreakdown quote={quote} compact onTicket />
            )}

            {/* Perforation — the notches are cut with circles in the page colour. */}
            <div className="relative my-5 h-px" aria-hidden>
              <span className="absolute -left-8 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-ink" />
              <span className="absolute -right-8 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-ink" />
              <span className="ticket-perf block h-px w-full" />
            </div>

            <div className="ticket-plate relative overflow-hidden rounded-2xl">
              <span aria-hidden className="ticket-hair pointer-events-none absolute inset-x-5 top-0 h-px" />
              <span aria-hidden className="ticket-hi pointer-events-none absolute inset-x-0 top-0 h-1/2" />
              <div className="relative flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="ticket-label text-[11px] font-bold uppercase tracking-[0.22em]">You pay</p>
                  <p className="ticket-muted mt-1 text-xs">
                    {party} guest{party === 1 ? "" : "s"} · {orderedLegs.length} hotel{orderedLegs.length === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="ticket-amount font-display shrink-0 text-3xl leading-none">{money(grand)}</p>
              </div>
            </div>
          </div>
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
