"use client";

import Image from "next/image";
import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { FACILITY_LABEL, MEAL_LABEL, PROPERTY_LABEL, SHOWCASE_FACILITIES, type FacilityKey, type MealKey, type PropertyKind } from "@/lib/search-index";
import { StayPricingEditor, StayRoomEditor } from "@/components/StayRoomEditor";
import { MoneyInput } from "@/components/MoneyInput";
import { citiesForCountry, pilgrimCountries, pilgrimCountryName, type PilgrimCountry } from "@/lib/pilgrim";
import type { BookableRoom } from "@/lib/rooms";
import type { StayGalleries, StayPricing } from "@/lib/types";

type PhotoBucket = keyof StayGalleries;

const PHOTO_BUCKETS: { id: PhotoBucket; label: string; hint: string }[] = [
  { id: "property", label: "Front view & exterior", hint: "Facade, street, courtyard, garden — used as the cover" },
  { id: "room", label: "Rooms", hint: "Bedrooms, sitting areas, desks" },
  { id: "bathroom", label: "Bathrooms", hint: "Bath, shower, WC" },
  { id: "facilities", label: "Facilities", hint: "Pool, gym, parking, restaurant, spa" },
];

export const STAY_STEPS = [
  { id: "basics", label: "Property" },
  { id: "photos", label: "Photos" },
  { id: "rooms", label: "Rooms" },
  { id: "pricing", label: "Pricing" },
  { id: "facilities", label: "Facilities" },
  { id: "policies", label: "Policies" },
  { id: "host", label: "Host" },
] as const;

type FormShape = Record<string, string | boolean>;

export function StayListingWizard({
  step,
  setStep,
  form,
  set,
  setForm,
  country,
  cityOptions,
  galleries,
  setGalleries,
  addToBucket,
  removeFromBucket,
  photos,
  uploading,
  fileRef,
  uploadBucket,
  rooms,
  setRooms,
  pricing,
  setPricing,
  facilities,
  toggleFac,
  meals,
  setMeals,
  mealRates,
  setMealRates,
}: {
  step: number;
  setStep: (n: number) => void;
  form: FormShape;
  set: (k: string, v: string | boolean) => void;
  setForm: Dispatch<SetStateAction<FormShape>>;
  country: PilgrimCountry;
  cityOptions: string[];
  galleries: StayGalleries;
  setGalleries: Dispatch<SetStateAction<StayGalleries>>;
  addToBucket: (bucket: PhotoBucket, src: string) => void;
  removeFromBucket: (bucket: PhotoBucket, src: string) => void;
  photos: { src: string; label: string }[];
  uploading: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  uploadBucket: { current: PhotoBucket };
  rooms: BookableRoom[];
  setRooms: (rooms: BookableRoom[]) => void;
  pricing: StayPricing;
  setPricing: (v: StayPricing) => void;
  facilities: FacilityKey[];
  toggleFac: (key: FacilityKey) => void;
  meals: MealKey[];
  setMeals: Dispatch<SetStateAction<MealKey[]>>;
  mealRates: { breakfast: string; lunch: string; dinner: string };
  setMealRates: Dispatch<SetStateAction<{ breakfast: string; lunch: string; dinner: string }>>;
}) {
  const pane = (i: number, node: ReactNode) => (
    <div className={step === i ? "space-y-2.5 pb-3" : "hidden"}>{node}</div>
  );

  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
      <nav className="form-stepper shrink-0 overflow-x-auto lg:w-48 lg:overflow-visible">
        {STAY_STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className="form-stepper-item"
              data-active={active}
              data-done={done}
            >
              <span className="form-stepper-rail">
                <span className="form-stepper-dot">{done ? "✓" : i + 1}</span>
              </span>
              <span className="form-stepper-label">{s.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {pane(
          0,
          <>
            <p className="mb-1 max-w-2xl text-[15px] leading-relaxed text-ink/65">
              Name, place, and how this hotel is listed for guests.
            </p>
            <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              <label className="form-label mt-0">
                Property name
                <input className="paper-field" placeholder="Canal Breeze Studio" value={String(form.name)} onChange={(e) => set("name", e.target.value)} />
              </label>
              <label className="form-label mt-0">
                Nastaliq name
                <input className="paper-field" placeholder="Optional" value={String(form.nastaliq)} onChange={(e) => set("nastaliq", e.target.value)} />
              </label>
              <label className="form-label mt-0">
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
                      city: cities.includes(String(f.city)) ? f.city : cities[0] ?? "",
                      origin: cities.includes(String(f.origin)) ? f.origin : cities[0] ?? "",
                      destination: cities.includes(String(f.destination)) ? f.destination : "",
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
              <label className="form-label mt-0">
                City
                <select className="paper-field" value={String(form.city)} onChange={(e) => set("city", e.target.value)}>
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label mt-0">
                Property type
                <select className="paper-field" value={String(form.propertyKind)} onChange={(e) => set("propertyKind", e.target.value)}>
                  {(Object.keys(PROPERTY_LABEL) as PropertyKind[]).map((k) => (
                    <option key={k} value={k}>
                      {PROPERTY_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label mt-0">
                Star rating
                <select className="paper-field" value={String(form.stars)} onChange={(e) => set("stars", e.target.value)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}★
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="form-label">
              Street address
              <input className="paper-field" placeholder="Canal Bank Road, GOR-I, Lahore" value={String(form.address)} onChange={(e) => set("address", e.target.value)} />
            </label>
            <label className="form-label">
              Description
              <textarea className="paper-field min-h-28 resize-y" rows={4} placeholder="What guests should know" value={String(form.description)} onChange={(e) => set("description", e.target.value)} />
            </label>
            <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
              <MoneyInput compact label="Guide price per night" pkr={String(form.price)} onPkr={(v) => set("price", v)} />
              <label className="form-label">
                Charged
                <select className="paper-field" value={String(form.priceUnit)} onChange={(e) => set("priceUnit", e.target.value)}>
                  <option value="night">per night</option>
                  <option value="day">per day</option>
                </select>
              </label>
            </div>
          </>,
        )}

        {pane(
          1,
          <>
            <div>
              <p className="form-label">Cover photo</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink/60">The first exterior shot is what guests see on search.</p>
              <div className="relative mt-2 h-40 overflow-hidden rounded-2xl border border-ink/10 bg-ink/5">
                <Image src={galleries.property[0] || String(form.cover)} alt="Cover preview" fill className="object-cover" />
              </div>
            </div>
            {PHOTO_BUCKETS.map((bucket) => (
              <div key={bucket.id} className="rounded-2xl border border-ink/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{bucket.label}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink/60">{bucket.hint}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() => {
                      uploadBucket.current = bucket.id;
                      fileRef.current?.click();
                    }}
                  >
                    {uploading && uploadBucket.current === bucket.id ? "Uploading…" : "Upload"}
                  </button>
                </div>
                {galleries[bucket.id].length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {galleries[bucket.id].map((src) => (
                      <button
                        key={src}
                        type="button"
                        className={`relative h-16 w-20 overflow-hidden rounded-lg border ${bucket.id === "property" && galleries.property[0] === src ? "border-flame" : "border-ink/15"}`}
                        title="Click to set as cover (exterior only). Double-click to remove."
                        onClick={() => {
                          if (bucket.id !== "property") return;
                          setGalleries((g) => ({ ...g, property: [src, ...g.property.filter((x) => x !== src)] }));
                          set("cover", src);
                        }}
                        onDoubleClick={() => removeFromBucket(bucket.id, src)}
                      >
                        <Image src={src} alt="" fill className="object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-ink/55">No photos in this set yet.</p>
                )}
                <p className="mt-3 text-sm text-ink/55">Add from library</p>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {photos.map((p) => (
                    <button
                      key={`${bucket.id}-${p.src}`}
                      type="button"
                      onClick={() => addToBucket(bucket.id, p.src)}
                      className={`relative h-14 overflow-hidden rounded-xl border ${galleries[bucket.id].includes(p.src) ? "border-flame ring-2 ring-flame/30" : "border-ink/10"}`}
                      title={p.label}
                    >
                      <Image src={p.src} alt={p.label} fill className="object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>,
        )}

        {pane(
          2,
          <>
            <p className="mb-1 max-w-2xl text-[15px] leading-relaxed text-ink/65">
              Set each room type, how it sleeps, and the ways guests can book it.
            </p>
            <StayRoomEditor rooms={rooms} onChange={setRooms} fallbackPrice={Number(form.price) || 15000} />
          </>,
        )}

        {pane(
          3,
          <>
            <p className="mb-1 max-w-2xl text-[15px] leading-relaxed text-ink/65">
              These rules apply at checkout. Percent fields are of the stay; money fields use the currency in the header.
            </p>
            <StayPricingEditor value={pricing} onChange={setPricing} />
          </>,
        )}

        {pane(
          4,
          <>
            <p className="mb-1 max-w-2xl text-[15px] leading-relaxed text-ink/65">
              Tick what the hotel offers. Guests see these on the listing.
            </p>
            <p className="text-sm font-medium text-ink">Main facilities</p>
            <div className="flex flex-wrap gap-2">
              {SHOWCASE_FACILITIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${facilities.includes(key) ? "border-flame bg-flame/10 text-ink" : "border-ink/15 text-ink/50"}`}
                  onClick={() => toggleFac(key)}
                >
                  {FACILITY_LABEL[key]}
                </button>
              ))}
            </div>
            <p className="text-sm font-medium text-ink">More facilities</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FACILITY_LABEL) as FacilityKey[])
                .filter((k) => !SHOWCASE_FACILITIES.includes(k))
                .map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs ${facilities.includes(key) ? "border-flame bg-flame/10 text-ink" : "border-ink/15 text-ink/50"}`}
                    onClick={() => toggleFac(key)}
                  >
                    {FACILITY_LABEL[key]}
                  </button>
                ))}
            </div>
            <p className="text-sm font-medium text-ink">Meal styles</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MEAL_LABEL) as MealKey[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${meals.includes(m) ? "border-flame bg-flame/10" : "border-ink/15 text-ink/50"}`}
                  onClick={() => setMeals((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]))}
                >
                  {MEAL_LABEL[m]}
                </button>
              ))}
            </div>
            <p className="text-sm font-medium text-ink">Meals guests can add</p>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {(["breakfast", "lunch", "dinner"] as const).map((key) => (
                <MoneyInput
                  key={key}
                  compact
                  label={key[0].toUpperCase() + key.slice(1)}
                  pkr={mealRates[key]}
                  onPkr={(v) => setMealRates((r) => ({ ...r, [key]: v }))}
                />
              ))}
            </div>
            <label className="form-label">
              Other amenities (one per line)
              <textarea className="paper-field min-h-20" value={String(form.amenities)} onChange={(e) => set("amenities", e.target.value)} placeholder="Fibre that works&#10;Standing desk" />
            </label>
          </>,
        )}

        {pane(
          5,
          <>
            <p className="mb-1 max-w-2xl text-[15px] leading-relaxed text-ink/65">
              Check-in times, house rules, and how to reach the property.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="form-label">
                Check-in
                <input className="paper-field" value={String(form.checkIn)} onChange={(e) => set("checkIn", e.target.value)} />
              </label>
              <label className="form-label">
                Check-out
                <input className="paper-field" value={String(form.checkOut)} onChange={(e) => set("checkOut", e.target.value)} />
              </label>
            </div>
            <label className="form-label">
              Reception information
              <input className="paper-field" value={String(form.reception)} onChange={(e) => set("reception", e.target.value)} />
            </label>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="form-label">
                Contact phone
                <input className="paper-field" value={String(form.phone)} onChange={(e) => set("phone", e.target.value)} />
              </label>
              <label className="form-label">
                Contact email
                <input className="paper-field" type="email" value={String(form.email)} onChange={(e) => set("email", e.target.value)} />
              </label>
            </div>
            <label className="form-label">
              House policies (one per line)
              <textarea className="paper-field min-h-24" value={String(form.policies)} onChange={(e) => set("policies", e.target.value)} />
            </label>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="form-label">
                Cancellation
                <select className="paper-field" value={String(form.cancellation)} onChange={(e) => set("cancellation", e.target.value)}>
                  <option value="free">Free cancellation</option>
                  <option value="partial">Partial refund</option>
                  <option value="strict">Non-refundable</option>
                </select>
              </label>
              <label className="mt-6 flex items-center gap-2 text-sm text-ink/75">
                <input type="checkbox" checked={Boolean(form.payAtProperty)} onChange={(e) => set("payAtProperty", e.target.checked)} />
                Pay at property
              </label>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="form-label">
                Landmark nearby
                <input className="paper-field" value={String(form.landmark)} onChange={(e) => set("landmark", e.target.value)} />
              </label>
              <label className="form-label">
                Airport
                <input className="paper-field" placeholder="NJF · Najaf" value={String(form.airport)} onChange={(e) => set("airport", e.target.value)} />
              </label>
              <label className="form-label">
                Latitude
                <input className="paper-field" type="number" step="any" value={String(form.lat)} onChange={(e) => set("lat", e.target.value)} />
              </label>
              <label className="form-label">
                Longitude
                <input className="paper-field" type="number" step="any" value={String(form.lng)} onChange={(e) => set("lng", e.target.value)} />
              </label>
              <label className="form-label sm:col-span-2">
                Street address (Google Maps)
                <input className="paper-field" placeholder="Exact hotel address" value={String(form.address)} onChange={(e) => set("address", e.target.value)} />
              </label>
              <label className="form-label">
                km from airport
                <input className="paper-field" type="number" value={String(form.airportKm)} onChange={(e) => set("airportKm", e.target.value)} />
              </label>
            </div>
            <label className="form-label">
              Climate note
              <input className="paper-field" value={String(form.climate)} onChange={(e) => set("climate", e.target.value)} />
            </label>
          </>,
        )}

        {pane(
          6,
          <>
            <p className="mb-1 max-w-2xl text-[15px] leading-relaxed text-ink/65">
              Who runs the house. Guests see this on the listing.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="form-label">
                Host name
                <input className="paper-field" value={String(form.hostName)} onChange={(e) => set("hostName", e.target.value)} />
              </label>
              <label className="form-label">
                Years with this house
                <input className="paper-field" type="number" min={0} value={String(form.hostYears)} onChange={(e) => set("hostYears", e.target.value)} />
              </label>
            </div>
            <label className="form-label">
              Host letter
              <textarea className="paper-field min-h-20" value={String(form.hostLetter)} onChange={(e) => set("hostLetter", e.target.value)} />
            </label>
          </>,
        )}
      </div>
    </div>
  );
}
