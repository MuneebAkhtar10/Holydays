"use client";

import type { ReactNode } from "react";
import type { BedKind, RatePlan, Room, StayPricing, MealPlan, PayPolicy, CancelPolicy } from "@/lib/types";
import { BED_LABEL, CANCEL_LABEL, MEAL_PLAN_LABEL, PAY_LABEL, ROOM_FACILITY_OPTIONS, emptyRoom, newItemId, normalizeRate, type BookableRoom } from "@/lib/rooms";
import { defaultPricing } from "@/lib/pricing";
import { MoneyInput } from "@/components/MoneyInput";

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="paper-light rounded-xl border border-ink/[0.08] bg-white/70 p-4 sm:p-5">
      <p className="font-display text-xl leading-tight text-ink">{title}</p>
      {hint ? <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink/60">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function StayRoomEditor({
  rooms,
  onChange,
  fallbackPrice,
}: {
  rooms: BookableRoom[];
  onChange: (rooms: BookableRoom[]) => void;
  fallbackPrice: number;
}) {
  const patch = (i: number, next: Partial<Room>) => onChange(rooms.map((r, n) => (n === i ? { ...r, ...next } : r)));
  return (
    <div className="space-y-5">
      {rooms.map((r, i) => (
        <div key={`${r.id}-${i}`} className="rounded-2xl border border-ink/10 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-xl">{r.name.trim() || `Room type ${i + 1}`}</p>
            {rooms.length > 1 && (
              <button type="button" className="text-sm text-rose" onClick={() => onChange(rooms.filter((_, n) => n !== i))}>
                Remove room
              </button>
            )}
          </div>

          <div className="space-y-3">
            <Block title="1 · Room basics" hint="What this room is, how many it sleeps, and the nightly base price.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="form-label">
                  Room name
                  <input className="paper-field mt-1" placeholder="Deluxe twin" value={r.name} onChange={(e) => patch(i, { name: e.target.value })} />
                </label>
                <label className="form-label">
                  Short note
                  <input className="paper-field mt-1" placeholder="Quiet, courtyard view" value={r.note} onChange={(e) => patch(i, { note: e.target.value })} />
                </label>
                <label className="form-label">
                  Size m²
                  <input className="paper-field mt-1" type="number" min={8} value={r.sizeSqm} onChange={(e) => patch(i, { sizeSqm: Number(e.target.value) })} />
                </label>
                <label className="form-label">
                  Max guests
                  <input className="paper-field mt-1" type="number" min={1} value={r.sleeps} onChange={(e) => patch(i, { sleeps: Number(e.target.value), includedGuests: Number(e.target.value) })} />
                </label>
                <MoneyInput compact label="Base price / night" pkr={r.price} onPkr={(v) => patch(i, { price: Number(v) || 0 })} />
                <label className="form-label">
                  Rooms of this type
                  <input className="paper-field mt-1" type="number" min={1} value={r.available} onChange={(e) => patch(i, { available: Number(e.target.value) })} />
                </label>
              </div>
            </Block>

            <Block title="2 · Beds & extras">
              <div className="grid gap-2 sm:grid-cols-3">
                {r.beds.map((b, bi) => (
                  <div key={`${r.id}-bed-${bi}`} className="flex gap-2">
                    <select className="paper-field mt-0" value={b.kind} onChange={(e) => patch(i, { beds: r.beds.map((x, n) => (n === bi ? { ...x, kind: e.target.value as BedKind } : x)) })}>
                      {(Object.keys(BED_LABEL) as BedKind[]).map((k) => (
                        <option key={k} value={k}>
                          {BED_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    <input className="paper-field mt-0 w-16" type="number" min={1} value={b.count} onChange={(e) => patch(i, { beds: r.beds.map((x, n) => (n === bi ? { ...x, count: Number(e.target.value) } : x)) })} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={r.smoking} onChange={(e) => patch(i, { smoking: e.target.checked })} />
                  Smoking
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={r.extraBedAllowed} onChange={(e) => patch(i, { extraBedAllowed: e.target.checked })} />
                  Extra bed
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={r.cribAllowed} onChange={(e) => patch(i, { cribAllowed: e.target.checked })} />
                  Baby cot
                </label>
              </div>
            </Block>

            <Block title="3 · In the room">
              <div className="flex flex-wrap gap-2">
                {ROOM_FACILITY_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs ${r.facilities.includes(f) ? "border-flame bg-flame/10" : "border-ink/15 text-ink/50"}`}
                    onClick={() =>
                      patch(i, { facilities: r.facilities.includes(f) ? r.facilities.filter((x) => x !== f) : [...r.facilities, f] })
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Block>

            <Block title="4 · Booking options" hint="Each card is one way to sell this room — meals, cancellation, and when the guest pays.">
              <div className="space-y-3">
                {r.rates.map((rate, ri) => (
                  <div key={`${rate.id}-${ri}`} className="paper-light rounded-xl border border-ink/10 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink/80">Option {ri + 1}</p>
                      {r.rates.length > 1 && (
                        <button type="button" className="text-sm text-rose" onClick={() => patch(i, { rates: r.rates.filter((_, k) => k !== ri) })}>
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm text-ink/65 sm:col-span-2">
                        Plan name
                        <input
                          className="paper-field mt-1.5"
                          value={rate.name}
                          onChange={(e) => patchRate(rooms, onChange, i, ri, { name: e.target.value })}
                        />
                      </label>
                      <label className="block text-sm text-ink/65">
                        Meals
                        <select
                          className="paper-field mt-1.5"
                          value={rate.meal}
                          onChange={(e) => patchRate(rooms, onChange, i, ri, { meal: e.target.value as MealPlan })}
                        >
                          {(Object.keys(MEAL_PLAN_LABEL) as MealPlan[]).map((k) => (
                            <option key={k} value={k}>
                              {MEAL_PLAN_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm text-ink/65">
                        Cancellation
                        <select
                          className="paper-field mt-1.5"
                          value={rate.cancellation}
                          onChange={(e) => patchRate(rooms, onChange, i, ri, { cancellation: e.target.value as CancelPolicy })}
                        >
                          {(Object.keys(CANCEL_LABEL) as CancelPolicy[]).map((k) => (
                            <option key={k} value={k}>
                              {CANCEL_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm text-ink/65">
                        When to pay
                        <select
                          className="paper-field mt-1.5"
                          value={rate.payment}
                          onChange={(e) => patchRate(rooms, onChange, i, ri, { payment: e.target.value as PayPolicy })}
                        >
                          {(Object.keys(PAY_LABEL) as PayPolicy[]).map((k) => (
                            <option key={k} value={k}>
                              {PAY_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm text-ink/65">
                        Price vs nightly base (%)
                        <input
                          className="paper-field mt-1.5"
                          type="number"
                          value={rate.nightlyAdjPct}
                          onChange={(e) => patchRate(rooms, onChange, i, ri, { nightlyAdjPct: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink/55">
                      0 keeps the base nightly price. −8 is 8% cheaper. +10 is 10% more.
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn-ghost mt-4 text-sm"
                onClick={() =>
                  patch(i, {
                    rates: [
                      ...r.rates,
                      normalizeRate({
                        id: newItemId("rate"),
                        name: "Custom rate",
                        meal: "room_only",
                        cancellation: "free",
                        payment: "property",
                        nightlyAdjPct: 0,
                      }),
                    ],
                  })
                }
              >
                Add another booking option
              </button>
            </Block>
          </div>
        </div>
      ))}
      <button type="button" className="btn-ghost text-sm" onClick={() => onChange([...rooms, emptyRoom({ price: fallbackPrice })])}>
        Add a room type
      </button>
    </div>
  );
}

function patchRate(rooms: BookableRoom[], onChange: (rooms: BookableRoom[]) => void, i: number, ri: number, next: Partial<RatePlan>) {
  onChange(rooms.map((r, n) => (n === i ? { ...r, rates: r.rates.map((rate, k) => (k === ri ? { ...rate, ...next } : rate)) } : r)));
}

export function StayPricingEditor({ value, onChange }: { value: StayPricing; onChange: (p: StayPricing) => void }) {
  const p = defaultPricing(value);
  const set = (patch: Partial<StayPricing>) => onChange({ ...p, ...patch });
  const moneyKeys = new Set<keyof StayPricing>([
    "cityTaxPerNight",
    "cleaningFee",
    "resortFeePerNight",
    "extraPerson",
    "extraBed",
    "crib",
    "childRate",
    "airportTransfer",
  ]);
  const field = (key: keyof StayPricing, label: string) =>
    moneyKeys.has(key) ? (
      <MoneyInput compact label={label} pkr={Number(p[key] ?? 0)} onPkr={(v) => set({ [key]: Number(v) || 0 } as Partial<StayPricing>)} />
    ) : (
      <label className="block">
        <span className="form-label">{label}</span>
        <input className="paper-field mt-1.5" type="number" value={Number(p[key] ?? 0)} onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<StayPricing>)} />
      </label>
    );
  return (
    <div className="space-y-4">
      <Block title="Taxes & hotel fees" hint="Added on top of the room rate at checkout.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {field("taxPct", "Hotel tax %")}
          {field("serviceChargePct", "Service charge %")}
          {field("cityTaxPerNight", "City tax per night")}
          {field("cleaningFee", "Cleaning fee")}
          {field("resortFeePerNight", "Resort fee per night")}
        </div>
      </Block>
      <Block title="Extra guests" hint="Charged when the party is larger than the room’s included occupancy.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {field("extraPerson", "Extra adult per night")}
          {field("extraBed", "Extra bed per night")}
          {field("crib", "Baby cot per night")}
          {field("childFreeMaxAge", "Children stay free under age")}
          {field("childRateMaxAge", "Child rate applies up to age")}
          {field("childRate", "Child rate per night")}
        </div>
      </Block>
      <Block title="Discounts" hint="Percent off the stay. Leave at 0 if you do not use that rule.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {field("weekendPct", "Weekend extra %")}
          {field("occupancyPct", "Nearly full extra %")}
          {field("longStayNights", "Long-stay after nights")}
          {field("longStayPct", "Long-stay % off")}
          {field("earlyBirdDays", "Early-bird days ahead")}
          {field("earlyBirdPct", "Early-bird % off")}
          {field("lastMinuteDays", "Last-minute within days")}
          {field("lastMinutePct", "Last-minute % off")}
          {field("memberPct", "Member % off")}
          {field("mobilePct", "Mobile-only % off")}
        </div>
      </Block>
      <Block title="Hotel airport transfer" hint="Only if this hotel sells its own transfer. Partner taxis at checkout are separate.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{field("airportTransfer", "Transfer price")}</div>
      </Block>
    </div>
  );
}
