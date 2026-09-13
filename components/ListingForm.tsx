"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readJson } from "@/lib/readJson";
import { type FacilityKey, type MealKey } from "@/lib/search-index";
import { emptyGalleries, flattenGalleries, parseListingMeta, type StayListingMeta } from "@/lib/listing-meta";
import type { StayGalleries, StayPricing } from "@/lib/types";
import type { BookableRoom } from "@/lib/rooms";
import { StayListingWizard, STAY_STEPS } from "@/components/StayListingWizard";
import { MoneyInput } from "@/components/MoneyInput";
import { airportForCity, citiesForCountry, pilgrimAirports, pilgrimCountries, pilgrimCountryForPlace, pilgrimCountryName, type PilgrimCountry } from "@/lib/pilgrim";
import { isValidEmail, isValidPhone } from "@/lib/validate";

function SavingSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      {label}
    </span>
  );
}

const library: Record<string, { src: string; label: string }[]> = {
  TAXI: [
    { src: "/images/exp-passu.png", label: "Mountain jeep" },
    { src: "/images/stay-black-granite.png", label: "Highland road" },
    { src: "/images/dest-skardu.png", label: "Valley run" },
    { src: "/images/dest-gwadar.png", label: "Coast road" },
    { src: "/images/stay-truck-art.png", label: "City van" },
    { src: "/images/hero-hunza-dusk.png", label: "Dusk valley" },
  ],
  STAY: [
    { src: "/images/stay-apricot-court.png", label: "Courtyard" },
    { src: "/images/stay-walled-city.png", label: "Haveli" },
    { src: "/images/stay-pine-key.png", label: "Lodge" },
    { src: "/images/stay-canal-breeze.png", label: "Canal" },
    { src: "/images/stay-orchard.png", label: "Orchard" },
    { src: "/images/stay-seawind.png", label: "Coast" },
    { src: "/images/stay-black-granite.png", label: "Granite" },
    { src: "/images/hero-hunza-dusk.png", label: "Dusk" },
  ],
  ATTRACTION: [
    { src: "/images/dest-hunza.png", label: "Hunza" },
    { src: "/images/dest-lahore.png", label: "Lahore" },
    { src: "/images/exp-passu.png", label: "Passu" },
    { src: "/images/hero-hunza-dusk.png", label: "Dusk" },
  ],
  RESTAURANT: [
    { src: "/images/stay-apricot-court.png", label: "Kitchen" },
    { src: "/images/stay-walled-city.png", label: "Roof" },
    { src: "/images/stay-river-lantern.png", label: "River" },
    { src: "/images/hero-hunza-dusk.png", label: "Dusk" },
  ],
};

type RoomRow = BookableRoom;
type PhotoBucket = keyof StayGalleries;

function seedStayGalleries(seed: StayListingMeta, cover: string): StayGalleries {
  const g = seed.galleries ?? emptyGalleries();
  if (flattenGalleries(g).length) {
    return {
      property: g.property.length ? g.property : seed.gallery.length ? seed.gallery : [cover],
      room: g.room,
      bathroom: g.bathroom,
      facilities: g.facilities,
    };
  }
  const flat = seed.gallery.length ? seed.gallery : [cover];
  return { ...emptyGalleries(), property: flat };
}

export function ListingForm({
  kind,
  initial,
  onClose,
  onSaved,
}: {
  kind: string;
  initial?: Partial<{
    id: string;
    name: string;
    nastaliq: string;
    city: string;
    region: string;
    cover: string;
    description: string;
    price: number;
    priceUnit: string;
    published: boolean;
    meta: StayListingMeta | string;
  }>;
  onClose?: () => void;
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const driverPhotoRef = useRef<HTMLInputElement>(null);
  const vehiclePhotoRef = useRef<HTMLInputElement>(null);
  const uploadBucket = useRef<PhotoBucket>("property");
  const [uploading, setUploading] = useState(false);
  const [hostPhotoUploading, setHostPhotoUploading] = useState(false);
  const [driverPhotoUploading, setDriverPhotoUploading] = useState(false);
  const [vehiclePhotoUploading, setVehiclePhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const seed = parseListingMeta(initial?.meta);
  const seedCountry = ((seed.country as PilgrimCountry) || pilgrimCountryForPlace(initial?.city ?? "", initial?.region) || "IQ") as PilgrimCountry;
  const seedAir =
    seed.service === "airport"
      ? pilgrimAirports[seedCountry].find((a) => a.label === seed.origin || a.label === seed.destination) ??
        airportForCity(seedCountry, initial?.city || "")
      : null;
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    nastaliq: initial?.nastaliq ?? "",
    city: seedAir?.city ?? initial?.city ?? "Najaf",
    region: initial?.region ?? "",
    cover: initial?.cover ?? "/images/hero-hunza-dusk.png",
    description: initial?.description ?? "",
    price: String(initial?.price ?? 15000),
    priceUnit:
      initial?.priceUnit ?? (kind === "TAXI" ? "day" : kind === "STAY" ? "night" : kind === "RESTAURANT" ? "table" : "person"),
    published: initial?.published ?? false,
    kind,
    propertyKind: seed.propertyKind,
    stars: String(seed.stars || 3),
    address: seed.address,
    checkIn: seed.checkIn,
    checkOut: seed.checkOut,
    reception: seed.reception,
    phone: seed.phone,
    email: seed.email,
    policies: seed.policies.join("\n"),
    amenities: seed.amenities.join("\n"),
    cancellation: seed.cancellation,
    payAtProperty: seed.payAtProperty,
    landmark: seed.landmark,
    airport: seed.airport,
    airportKm: String(seed.airportKm),
    lat: String(seed.lat || ""),
    lng: String(seed.lng || ""),
    hostName: seed.hostName,
    hostYears: String(seed.hostYears),
    hostLetter: seed.hostLetter,
    hostPhone: seed.hostPhone,
    hostEmail: seed.hostEmail,
    hostPortrait: seed.hostPortrait,
    hostContactHours: seed.hostContactHours,
    climate: seed.climate,
    country: seedCountry,
    driver: seed.driver,
    driverPhoto: seed.driverPhoto,
    vehicle: seed.vehicle,
    vehiclePhoto: seed.vehiclePhoto,
    model: seed.model,
    seats: String(seed.seats || (kind === "TAXI" ? 7 : 0)),
    vacant: String(seed.vacant || (kind === "TAXI" ? 7 : 0)),
    routeCities: (seed.routeCities.length ? seed.routeCities : initial?.city ? [initial.city] : []).join(", "),
    hours: seed.hours || (kind === "ATTRACTION" ? "Half day" : kind === "TAXI" ? (seedAir ? "Airport pickup / drop-off" : "Full day") : ""),
    origin: seedAir?.label ?? (seed.origin || initial?.city || "Najaf"),
    destination: seedAir ? "Guest hotel" : seed.destination || "",
    privateRate: String(seed.privateRate || ""),
    service: seed.service === "airport" ? "airport" : "ziyarat",
  });
  const [itinerary, setItinerary] = useState<{ time: string; place: string; note: string }[]>(
    seed.itinerary.length ? seed.itinerary : [{ time: "07:30", place: "", note: "Hotel pickup" }],
  );
  const [gallery, setGallery] = useState<string[]>(seed.gallery.length ? seed.gallery : [initial?.cover ?? "/images/hero-hunza-dusk.png"]);
  const [galleries, setGalleries] = useState<StayGalleries>(() => seedStayGalleries(seed, initial?.cover ?? "/images/hero-hunza-dusk.png"));
  const [facilities, setFacilities] = useState<FacilityKey[]>(seed.facilities.length ? seed.facilities : ["wifi", "parking"]);
  const [meals, setMeals] = useState<MealKey[]>(seed.meals);
  const [mealRates, setMealRates] = useState({
    breakfast: String(seed.mealRates.breakfast),
    lunch: String(seed.mealRates.lunch),
    dinner: String(seed.mealRates.dinner),
  });
  const [rooms, setRooms] = useState<RoomRow[]>(seed.rooms);
  const [pricing, setPricing] = useState<StayPricing>(seed.pricing);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [stayStep, setStayStep] = useState(0);
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const photos = library[kind] ?? library.TAXI;
  const stay = kind === "STAY";
  const taxi = kind === "TAXI";
  const ziyarat = kind === "ATTRACTION";
  const country = (form.country === "IQ" || form.country === "IR" || form.country === "SA" ? form.country : "IQ") as PilgrimCountry;
  const cityOptions = citiesForCountry(country);
  const taxiFromOptions = form.service === "airport" ? pilgrimAirports[country].map((a) => a.label) : cityOptions;

  useEffect(() => setMounted(true), []);

  const applyAirport = (airportLabel: string) => {
    const air = pilgrimAirports[country].find((a) => a.label === airportLabel) ?? pilgrimAirports[country][0];
    if (!air) return;
    setForm((f) => ({
      ...f,
      service: "airport",
      origin: air.label,
      destination: "Guest hotel",
      city: air.city,
      hours: "Airport pickup / drop-off",
      name: `${air.label} · hotel transfers`,
    }));
    setItinerary([
      { time: "Arrival", place: air.label, note: "Drop at the guest’s booked hotel" },
      { time: "Departure", place: "Guest hotel", note: "Pickup at the booked hotel, drop at the airport" },
    ]);
  };

  const addPhoto = (src: string) => {
    setGallery((g) => (g.includes(src) ? g : [...g, src]));
    if (!form.cover || form.cover === "/images/hero-hunza-dusk.png") set("cover", src);
  };

  const addToBucket = (bucket: PhotoBucket, src: string) => {
    setGalleries((g) => {
      if (g[bucket].includes(src)) return g;
      return { ...g, [bucket]: [...g[bucket], src] };
    });
    if (bucket === "property") set("cover", src);
  };

  const removeFromBucket = (bucket: PhotoBucket, src: string) => {
    setGalleries((g) => {
      const next = { ...g, [bucket]: g[bucket].filter((x) => x !== src) };
      if (bucket === "property" && form.cover === src) set("cover", next.property[0] || "/images/hero-hunza-dusk.png");
      return next;
    });
  };

  const pickFile = async (file: File) => {
    setUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body });
    const data = await readJson<{ error?: string; url?: string }>(res);
    setUploading(false);
    if (!res.ok) {
      setError(data?.error || "Could not upload image");
      return;
    }
    if (data?.url) {
      if (stay) addToBucket(uploadBucket.current, data.url);
      else {
        set("cover", data.url);
        addPhoto(data.url);
      }
    }
  };

  const pickHostPhoto = async (file: File) => {
    setHostPhotoUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body });
    const data = await readJson<{ error?: string; url?: string }>(res);
    setHostPhotoUploading(false);
    if (!res.ok) {
      setError(data?.error || "Could not upload photo");
      return;
    }
    if (data?.url) set("hostPortrait", data.url);
  };

  const pickDriverPhoto = async (file: File) => {
    setDriverPhotoUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body });
    const data = await readJson<{ error?: string; url?: string }>(res);
    setDriverPhotoUploading(false);
    if (!res.ok) {
      setError(data?.error || "Could not upload photo");
      return;
    }
    if (data?.url) set("driverPhoto", data.url);
  };

  const pickVehiclePhoto = async (file: File) => {
    setVehiclePhotoUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body });
    const data = await readJson<{ error?: string; url?: string }>(res);
    setVehiclePhotoUploading(false);
    if (!res.ok) {
      setError(data?.error || "Could not upload photo");
      return;
    }
    if (data?.url) set("vehiclePhoto", data.url);
  };

  const toggleFac = (key: FacilityKey) =>
    setFacilities((list) => (list.includes(key) ? list.filter((x) => x !== key) : [...list, key]));

  const validateStayStep = (n: number): string => {
    if (!stay) return "";
    if (n === 0) {
      if (!form.name.trim()) return "Property name is required";
      if (!form.address.trim()) return "Google Maps address is required";
    }
    if (n === STAY_STEPS.findIndex((s) => s.id === "policies")) {
      if (form.phone.trim() && !isValidPhone(form.phone)) return "Contact phone is not a valid phone number";
      if (form.email.trim() && !isValidEmail(form.email)) return "Contact email is not a valid email address";
    }
    if (n === STAY_STEPS.length - 1) {
      if (!form.hostName.trim()) return "Host name is required";
      if (!form.hostPhone.trim()) return "Host phone number is required";
      if (!isValidPhone(form.hostPhone)) return "Host phone number is not a valid phone number";
      if (!form.hostEmail.trim()) return "Host email address is required";
      if (!isValidEmail(form.hostEmail)) return "Host email address is not a valid email address";
      if (!form.hostPortrait.trim()) return "Host picture is required";
      if (!form.hostContactHours.trim()) return "Time to contact the host is required";
    }
    return "";
  };

  const validateTaxi = (): string => {
    if (!taxi) return "";
    if (!form.name.trim()) return "Trip name is required";
    if (!form.driver.trim()) return "Driver name is required";
    if (!form.driverPhoto.trim()) return "Driver photo is required";
    if (!form.vehicle.trim()) return "Vehicle is required";
    if (!form.vehiclePhoto.trim()) return "Vehicle photo is required";
    if (!form.model.trim()) return "Model is required";
    if (!String(form.seats).trim()) return "Total seats is required";
    if (!String(form.vacant).trim()) return "Vacant seats is required";
    if (!form.price || Number(form.price) <= 0) return "Rate per person is required";
    if (!form.privateRate || Number(form.privateRate) <= 0) return "Private / full vehicle rate is required";
    if (!form.hours.trim()) return "Duration is required";
    if (form.service === "airport") {
      if (!form.origin.trim()) return "Airport is required";
    } else {
      if (!form.origin.trim()) return "\"From\" city is required";
      if (!form.destination.trim()) return "\"To\" city is required";
    }
    if (!itinerary[0]?.place?.trim()) return "At least one stop is required";
    if (!form.description.trim()) return "Description is required";
    return "";
  };

  const goToStayStep = (n: number) => {
    if (n > stayStep) {
      for (let i = stayStep; i < n; i++) {
        const err = validateStayStep(i);
        if (err) {
          setError(err);
          return;
        }
      }
    }
    setError("");
    setStayStep(n);
  };

  const saveListing = async () => {
          if (saving) return;
          setError("");
          if (stay) {
            const stepErr =
              validateStayStep(0) ||
              validateStayStep(STAY_STEPS.findIndex((s) => s.id === "policies")) ||
              validateStayStep(STAY_STEPS.length - 1);
            if (stepErr) {
              setError(stepErr);
              return;
            }
          }
          if (taxi) {
            const err = validateTaxi();
            if (err) {
              setError(err);
              return;
            }
          }
          setSaving(true);
          const url = initial?.id ? `/api/listings/${initial.id}` : "/api/listings";
          const payload = {
            ...form,
            price: Number(form.price),
            stars: Number(form.stars),
            airportKm: Number(form.airportKm),
            lat: Number(form.lat) || undefined,
            lng: Number(form.lng) || undefined,
            address: form.address,
            hostYears: Number(form.hostYears),
            gallery: stay ? flattenGalleries(galleries) : gallery.length ? gallery : [form.cover],
            galleries: stay ? galleries : undefined,
            cover: stay ? galleries.property[0] || form.cover : form.cover,
            facilities,
            meals,
            mealRates: {
              breakfast: Number(mealRates.breakfast) || 0,
              lunch: Number(mealRates.lunch) || 0,
              dinner: Number(mealRates.dinner) || 0,
            },
            rooms,
            pricing,
            policies: form.policies.split("\n").map((s) => s.trim()).filter(Boolean),
            amenities: form.amenities,
            country,
            region: pilgrimCountryName(country),
            driver: form.driver,
            vehicle: form.vehicle,
            model: form.model,
            seats: Number(form.seats) || 0,
            vacant: Number(form.vacant) || 0,
            origin: form.service === "airport"
              ? (pilgrimAirports[country].find((a) => a.label === form.origin)?.label ?? form.origin)
              : form.origin,
            destination: form.service === "airport" ? "Guest hotel" : form.destination,
            hours: form.hours,
            privateRate: Number(form.privateRate) || 0,
            service: form.service,
            city: form.service === "airport"
              ? (pilgrimAirports[country].find((a) => a.label === form.origin)?.city ?? airportForCity(country, form.city).city)
              : form.origin || form.city,
            itinerary: itinerary.filter((s) => s.place.trim()),
            routeCities: form.service === "airport"
              ? [
                  pilgrimAirports[country].find((a) => a.label === form.origin)?.city ?? form.city,
                  form.origin,
                  "Guest hotel",
                ].filter(Boolean)
              : [form.origin, form.destination, ...itinerary.map((s) => s.place)]
              .map((s) => s.trim())
              .filter(Boolean)
              .filter((s, i, all) => all.indexOf(s) === i),
            priceUnit: taxi ? "person" : form.priceUnit,
          };
          try {
            const res = await fetch(url, {
              method: initial?.id ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await readJson<{ error?: string }>(res);
            if (!res.ok) {
              setError(data?.error || "Could not save");
              return;
            }
            onSaved();
            onClose?.();
          } catch {
            setError("Could not reach the server. Check your connection and try again.");
          } finally {
            setSaving(false);
          }
  };

  const shell = (
    <div className={`fixed inset-0 z-[80] overscroll-contain bg-black/55 ${stay ? "overflow-hidden" : "overflow-y-auto"}`} onClick={onClose}>
      <div className={`mx-auto flex w-full max-w-[92rem] items-start justify-center p-3 sm:p-6 ${stay ? "h-full max-h-full py-4" : "min-h-full py-6"}`}>
      <div
        className={`paper relative w-full max-w-6xl rounded-2xl shadow-2xl ${stay ? "flex h-[min(92vh,54rem)] flex-col overflow-hidden p-4 sm:p-5" : "paper-scroll p-6 sm:p-8"}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
      >
        <div className="shrink-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">{stay ? "Hotel" : taxi ? "Taxi" : ziyarat ? "Ziyarat" : "Listing"}</p>
        <h2 className={`font-display text-ink ${stay ? "mt-0.5 text-xl" : "mt-1 text-3xl"}`}>{initial?.id ? "Edit listing" : stay ? "New hotel" : taxi ? "New taxi" : ziyarat ? "New ziyarat" : "New listing"}</h2>
        {!stay && (
          <p className="mt-2 text-sm text-ink/60">
            {taxi
              ? "Saudi, Iraq, or Iran only. Airport transfer is one taxi per airport: checkout fills the guest’s hotel. Day trips still pick from → to cities. Admin must approve before guests see it."
              : ziyarat
                ? "Saudi, Iraq, or Iran only. This ziyarat shows on hotel checkout for that country."
                : "Saudi Arabia, Iraq, and Iran only."}
          </p>
        )}
        {stay && (
          <p className="mt-0.5 text-[13px] text-ink/60">
            Step {stayStep + 1} of {STAY_STEPS.length} · {STAY_STEPS[stayStep].label}
          </p>
        )}
        </div>

        {!stay && (
        <>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="paper-label mt-0">
          {taxi ? "Trip name" : ziyarat ? "Ziyarat name" : "Property name"} <span className="text-red-500">*</span>
          <input className="paper-field" placeholder={taxi ? "Karbala → Kufa" : "Canal Breeze Studio"} value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </label>
        <label className="paper-label mt-0">
          Nastaliq name
          <input className="paper-field" placeholder="Optional" value={form.nastaliq} onChange={(e) => set("nastaliq", e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:contents">
          <label className="paper-label mt-0">
            Country
            <select
              className="paper-field"
              value={country}
              onChange={(e) => {
                const next = e.target.value as PilgrimCountry;
                const cities = citiesForCountry(next);
                setForm((f) => ({
                  ...f,
                  country: next,
                  region: pilgrimCountryName(next),
                  city: f.service === "airport"
                    ? pilgrimAirports[next][0]?.city ?? cities[0] ?? ""
                    : cities.includes(f.city)
                      ? f.city
                      : cities[0] ?? "",
                  origin:
                    f.service === "airport"
                      ? pilgrimAirports[next][0]?.label ?? ""
                      : cities.includes(f.origin)
                        ? f.origin
                        : cities[0] ?? "",
                  destination: f.service === "airport" ? "Guest hotel" : cities.includes(f.destination) ? f.destination : "",
                }));
              }}
            >
              {pilgrimCountries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {!taxi && (
          <label className="paper-label">
            City
            <select className="paper-field" value={form.city} onChange={(e) => set("city", e.target.value)} required>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          )}
        </div>
        </div>
        {taxi && (
          <div className="mt-5 space-y-4 rounded-2xl border border-ink/10 p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink/40">Trip type</p>
            <div className="grid grid-cols-2 gap-2 lg:max-w-xl">
              <button
                type="button"
                aria-pressed={form.service === "ziyarat"}
                className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  form.service === "ziyarat" ? "border-flame bg-flame/10" : "border-ink/10 hover:border-ink/25"
                }`}
                onClick={() => {
                  if (form.service === "ziyarat") return;
                  const fallbackCity = cityOptions[0] || "Najaf";
                  setForm((f) => ({
                    ...f,
                    service: "ziyarat",
                    hours: "Full day",
                    origin: cityOptions.includes(String(f.origin)) ? f.origin : fallbackCity,
                    destination: cityOptions.includes(String(f.destination)) ? f.destination : "",
                    city: cityOptions.includes(String(f.origin)) ? f.origin : fallbackCity,
                  }));
                  setItinerary([{ time: "07:30", place: "", note: "Hotel pickup" }]);
                }}
              >
                <span className="text-sm font-medium">City-to-city day</span>
                <span className="mt-0.5 block text-xs text-ink/50">A named from → to route, e.g. Karbala → Kufa</span>
              </button>
              <button
                type="button"
                aria-pressed={form.service === "airport"}
                className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  form.service === "airport" ? "border-flame bg-flame/10" : "border-ink/10 hover:border-ink/25"
                }`}
                onClick={() => {
                  if (form.service === "airport") return;
                  applyAirport(airportForCity(country, form.city || cityOptions[0] || "Najaf").label);
                }}
              >
                <span className="text-sm font-medium">Airport transfer</span>
                <span className="mt-0.5 block text-xs text-ink/50">One taxi per airport; checkout fills the guest's hotel</span>
              </button>
            </div>
            {form.service === "airport" ? (
              <>
                <p className="text-sm text-ink/60">
                  List once per airport. Checkout uses the guest’s hotel as drop-off on arrival and pickup on departure — you do not pick a hotel here.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                <label className="paper-label mt-0">
                  Airport <span className="text-red-500">*</span>
                  <select
                    className="paper-field"
                    value={form.origin}
                    onChange={(e) => applyAirport(e.target.value)}
                    required
                  >
                    {pilgrimAirports[country].map((a) => (
                      <option key={a.label} value={a.label}>
                        {a.label} · {a.city}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="paper-label mt-0">
                  Duration <span className="text-red-500">*</span>
                  <input className="paper-field" placeholder="Airport pickup / drop-off" value={form.hours} onChange={(e) => set("hours", e.target.value)} required />
                </label>
                </div>
              </>
            ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="paper-label mt-0">
                From <span className="text-red-500">*</span>
                <select
                  className="paper-field"
                  value={form.origin}
                  onChange={(e) => {
                    set("origin", e.target.value);
                    set("city", e.target.value);
                  }}
                  required
                >
                  {!taxiFromOptions.includes(form.origin) && form.origin ? (
                    <option value={form.origin}>{form.origin}</option>
                  ) : null}
                  {taxiFromOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="paper-label">
                To <span className="text-red-500">*</span>
                <select
                  className="paper-field"
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value)}
                  required
                >
                  <option value="">Select destination</option>
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="paper-label mt-0">
                Duration <span className="text-red-500">*</span>
                <input className="paper-field" placeholder="Half day · Full day" value={form.hours} onChange={(e) => set("hours", e.target.value)} required />
              </label>
            </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="paper-label mt-0">
              Driver name <span className="text-red-500">*</span>
              <input className="paper-field" value={form.driver} onChange={(e) => set("driver", e.target.value)} required />
            </label>
            <label className="paper-label mt-0">
                Vehicle <span className="text-red-500">*</span>
                <input className="paper-field" placeholder="Toyota Coaster" value={form.vehicle} onChange={(e) => set("vehicle", e.target.value)} required />
              </label>
              <label className="paper-label mt-0">
                Model <span className="text-red-500">*</span>
                <input className="paper-field" placeholder="2019 · 23-seater" value={form.model} onChange={(e) => set("model", e.target.value)} required />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="paper-label mt-0">
                  Driver photo <span className="text-red-500">*</span>
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border border-ink/10 bg-ink/5">
                    {form.driverPhoto ? (
                      <Image src={String(form.driverPhoto)} alt="Driver preview" fill className="object-cover" />
                    ) : null}
                  </div>
                  <button type="button" className="btn-ghost text-sm" onClick={() => driverPhotoRef.current?.click()}>
                    {driverPhotoUploading ? "Uploading…" : "Upload photo"}
                  </button>
                  <input
                    ref={driverPhotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void pickDriverPhoto(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="paper-label mt-0">
                  Vehicle photo <span className="text-red-500">*</span>
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-16 w-24 overflow-hidden rounded-xl border border-ink/10 bg-ink/5">
                    {form.vehiclePhoto ? (
                      <Image src={String(form.vehiclePhoto)} alt="Vehicle preview" fill className="object-cover" />
                    ) : null}
                  </div>
                  <button type="button" className="btn-ghost text-sm" onClick={() => vehiclePhotoRef.current?.click()}>
                    {vehiclePhotoUploading ? "Uploading…" : "Upload photo"}
                  </button>
                  <input
                    ref={vehiclePhotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void pickVehiclePhoto(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="paper-label mt-0">
                Total seats <span className="text-red-500">*</span>
                <input className="paper-field" type="number" min={1} value={form.seats} onChange={(e) => set("seats", e.target.value)} required />
              </label>
              <label className="paper-label mt-0">
                Vacant seats <span className="text-red-500">*</span>
                <input className="paper-field" type="number" min={0} value={form.vacant} onChange={(e) => set("vacant", e.target.value)} required />
              </label>
              <MoneyInput
                label="Rate per person"
                pkr={form.price}
                onPkr={(v) => set("price", v)}
                required
              />
              <MoneyInput
                label="Private / full vehicle"
                pkr={form.privateRate}
                onPkr={(v) => set("privateRate", v)}
                required
                placeholder="Whole coaster"
              />
            </div>
            <p className="text-xs text-ink/45">Rates follow the header currency (PKR, USD, or GBP) and are stored in PKR.</p>
            <div>
              <p className="paper-label mt-0">
                Stops (what the guest actually does) <span className="text-red-500">*</span>
              </p>
              <div className="mt-2 space-y-2">
                {itinerary.map((stop, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
                    <input
                      className="paper-field"
                      placeholder="08:00"
                      value={stop.time}
                      onChange={(e) => setItinerary((rows) => rows.map((r, n) => (n === i ? { ...r, time: e.target.value } : r)))}
                    />
                    <input
                      className="paper-field"
                      placeholder="Masjid al-Kufa"
                      value={stop.place}
                      onChange={(e) => setItinerary((rows) => rows.map((r, n) => (n === i ? { ...r, place: e.target.value } : r)))}
                      required={i === 0}
                    />
                    <input
                      className="paper-field"
                      placeholder="Note"
                      value={stop.note}
                      onChange={(e) => setItinerary((rows) => rows.map((r, n) => (n === i ? { ...r, note: e.target.value } : r)))}
                    />
                    <button
                      type="button"
                      className="btn-ghost text-sm"
                      onClick={() => setItinerary((rows) => rows.filter((_, n) => n !== i))}
                      disabled={itinerary.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn-ghost mt-2 text-sm"
                onClick={() => setItinerary((rows) => [...rows, { time: "", place: "", note: "" }])}
              >
                Add stop
              </button>
            </div>
          </div>
        )}
        {ziyarat && (
          <label className="paper-label">
            Duration
            <input className="paper-field" placeholder="Half day" value={form.hours} onChange={(e) => set("hours", e.target.value)} />
          </label>
        )}
        </>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void pickFile(file);
          }}
        />

        {stay ? (
          <StayListingWizard
            step={stayStep}
            setStep={goToStayStep}
            form={form as never}
            set={set}
            setForm={setForm as never}
            country={country}
            cityOptions={cityOptions}
            galleries={galleries}
            setGalleries={setGalleries}
            addToBucket={addToBucket}
            removeFromBucket={removeFromBucket}
            photos={photos}
            uploading={uploading}
            fileRef={fileRef}
            uploadBucket={uploadBucket}
            rooms={rooms}
            setRooms={setRooms}
            pricing={pricing}
            setPricing={setPricing}
            facilities={facilities}
            toggleFac={toggleFac}
            meals={meals}
            setMeals={setMeals}
            mealRates={mealRates}
            setMealRates={setMealRates}
            hostPhotoUploading={hostPhotoUploading}
            onHostPhoto={pickHostPhoto}
          />
        ) : (
          <>
          <div className="mt-5 grid items-start gap-6 lg:grid-cols-2">
            <div>
            <p className="paper-label mt-0">Cover photo</p>
            <div className="mt-2 overflow-hidden rounded-2xl border border-ink/10">
              <div className="relative h-40 bg-ink/5">
                <Image src={form.cover} alt="Cover preview" fill className="object-cover" />
              </div>
              <div className="paper-light flex flex-wrap items-center gap-3 bg-white px-4 py-3">
                <button type="button" className="btn-ghost text-sm" onClick={() => fileRef.current?.click()}>
                  {uploading ? "Uploading…" : "Choose from computer"}
                </button>
                <p className="text-xs text-ink/45">PNG, JPG, or WebP · under 6MB</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-ink/40">Library</p>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {photos.map((p) => (
                <button
                  key={p.src}
                  type="button"
                  onClick={() => {
                    set("cover", p.src);
                    addPhoto(p.src);
                  }}
                  className={`relative h-16 overflow-hidden rounded-xl border ${form.cover === p.src ? "border-flame ring-2 ring-flame/30" : "border-ink/10"}`}
                  title={p.label}
                >
                  <Image src={p.src} alt={p.label} fill className="object-cover" />
                </button>
              ))}
            </div>
            </div>
            <label className="paper-label mt-0">
              Description {taxi && <span className="text-red-500">*</span>}
              <textarea
                className="paper-field min-h-40 resize-y"
                rows={6}
                placeholder="What guests should know"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                required={taxi}
              />
            </label>
          </div>
        {!taxi && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <MoneyInput
            label="Price"
            pkr={form.price}
            onPkr={(v) => set("price", v)}
          />
          <label className="paper-label">
            Charged
            <select className="paper-field" value={form.priceUnit} onChange={(e) => set("priceUnit", e.target.value)}>
              <option value="night">per night</option>
              <option value="day">per day</option>
              <option value="person">per person</option>
              <option value="table">per meal</option>
            </select>
          </label>
        </div>
        )}
          </>
        )}

        {stay ? (
          <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-2.5">
            <p className="max-w-md text-sm leading-relaxed text-ink/60">
              {initial?.id
                ? "Saving sends this listing back to admin until they approve it again."
                : "New listings wait in the admin queue."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {onClose && (
                <button type="button" className="btn-subtle" disabled={saving} onClick={onClose}>
                  Cancel
                </button>
              )}
              <button type="button" className="btn-ghost" disabled={saving || stayStep === 0} onClick={() => setStayStep((n) => Math.max(0, n - 1))}>
                Back
              </button>
              <button type="button" className="btn-outline" disabled={saving} onClick={saveListing}>
                {saving ? <SavingSpinner label="Saving…" /> : "Save draft"}
              </button>
              {stayStep < STAY_STEPS.length - 1 ? (
                <button type="button" className="btn-primary" disabled={saving} onClick={() => goToStayStep(Math.min(STAY_STEPS.length - 1, stayStep + 1))}>
                  Next
                </button>
              ) : (
                <button type="button" className="btn-primary" disabled={saving} onClick={saveListing}>
                  {saving ? <SavingSpinner label="Saving…" /> : "Save hotel"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
        <p className="mt-4 rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/70">
          {initial?.id
            ? "Saving sends this listing back to admin. It stays off the public site until they approve it again."
            : "New listings wait in the admin queue. They appear on HolyDays only after approval."}
        </p>
        {error && <p className="mt-3 text-sm text-rose">{error}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={saving} onClick={saveListing}>
            {saving ? <SavingSpinner label="Saving…" /> : "Save"}
          </button>
          {onClose && (
            <button type="button" className="btn-subtle" disabled={saving} onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
          </>
        )}
        {stay && error && <p className="mt-2 text-sm text-rose">{error}</p>}
      </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(shell, document.body);
}
