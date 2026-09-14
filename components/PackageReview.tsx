"use client";

import type { ReactNode } from "react";
import { formatDay, nightsBetween, stayNightDates } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { TaxiPhotos } from "@/components/TaxiPhotos";
import {
  airportPickupTitle,
  ESIM_PLANS,
  esimPlanRate,
  mealLines,
  parseMealChoice,
  packageMealRates,
  taxiPickCost,
  tripTitle,
  INSURANCE_RATE_PER_GUEST,
  type EsimSelections,
  type MealChoice,
  type MealRates,
  type PackageTaxi,
  type TaxiPick,
} from "@/lib/package-plan";

export type ReviewHotel = {
  id: string;
  name: string;
  city: string;
  checkin: string;
  checkout: string;
  room?: string;
  amount: number;
};

function kindOf(p: TaxiPick, t: PackageTaxi): "pickup" | "dropoff" | "trip" {
  if (t.service !== "airport") return "trip";
  return p.leg === "out" ? "dropoff" : "pickup";
}

function kindLabel(kind: "pickup" | "dropoff" | "trip") {
  if (kind === "pickup") return "Pick up";
  if (kind === "dropoff") return "Drop off";
  return "Day trip";
}

export function HotelStrip({
  hotels,
  onRemove,
  ink,
}: {
  hotels: ReviewHotel[];
  onRemove?: (id: string) => void;
  ink?: boolean;
}) {
  const { money } = useSerai();
  const tone = ink ? "paper-light border-ink/10 bg-white text-ink" : "inset-card";
  const mist = ink ? "text-ink/55" : "text-mist";
  const price = ink ? "text-ink" : "text-sand";
  return (
    <ul className={`grid gap-3 ${hotels.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {hotels.map((h, i) => (
        <li key={`${h.id}-${h.checkin}`} className={`${tone} p-4`}>
          <p className={`text-[11px] uppercase tracking-[0.16em] ${ink ? "text-ink/40" : "text-brass"}`}>
            Stay {hotels.length > 1 ? i + 1 : ""}
          </p>
          <p className="font-display mt-1 text-xl leading-tight">{h.name}</p>
          <p className={`mt-1 text-sm ${mist}`}>
            {h.city} · {formatDay(h.checkin)} — {formatDay(h.checkout)} · {nightsBetween(h.checkin, h.checkout)} night
            {nightsBetween(h.checkin, h.checkout) === 1 ? "" : "s"}
          </p>
          {h.room ? <p className={`text-sm ${mist}`}>{h.room}</p> : null}
          <div className="mt-3 flex items-end justify-between gap-2">
            {h.amount > 0 ? <p className={`font-display text-lg ${price}`}>{money(h.amount)}</p> : <span />}
            {onRemove && i > 0 ? (
              <button type="button" className="text-xs text-mist underline" onClick={() => onRemove(h.id)}>
                Remove
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TransferTimeline({
  picks,
  taxiList,
  stayName,
  lastHotelName,
  guests,
}: {
  picks: TaxiPick[];
  taxiList: PackageTaxi[];
  stayName: string;
  lastHotelName: string;
  guests: number;
}) {
  const { money } = useSerai();
  const rows = picks
    .map((p) => {
      const t = taxiList.find((x) => x.id === p.id);
      if (!t) return null;
      const kind = kindOf(p, t);
      const hotel = p.hotelName || (kind === "dropoff" ? lastHotelName : stayName);
      const title = t.service === "airport" ? airportPickupTitle(t, hotel, kind === "dropoff" ? "out" : "in") : tripTitle(t);
      const order = kind === "pickup" ? 0 : kind === "trip" ? 1 : 2;
      return { p, t, kind, title, order, amount: taxiPickCost(t, p, guests) };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => a.p.date.localeCompare(b.p.date) || a.order - b.order);

  if (!rows.length) return null;

  return (
    <ol className="relative space-y-0 border-l border-brass/30 pl-5">
      {rows.map((r) => (
        <li key={r.p.slotId} className="relative pb-5 last:pb-0">
          <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-flame" />
          <p className="text-[11px] uppercase tracking-[0.16em] text-brass">
            {kindLabel(r.kind)} · {formatDay(r.p.date)}
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <TaxiPhotos
                driver={r.t.driver}
                driverPhoto={r.t.driverPhoto}
                vehicle={r.t.vehicle}
                vehiclePhoto={r.t.vehiclePhoto}
                vehiclePhotos={r.t.vehiclePhotos}
                cover={r.t.cover}
                size="sm"
              />
              <div className="min-w-0">
                <p className="font-display text-lg leading-tight">{r.title}</p>
                <p className="text-sm text-mist">
                  {r.t.driver} · {r.t.vehicle}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-sm text-sand">{money(r.amount)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function BillRow({
  label,
  hint,
  amount,
  compact,
  tone,
}: {
  label: string;
  hint?: string;
  amount: number;
  compact?: boolean;
  tone?: "discount";
}) {
  const { money } = useSerai();
  const num = tone === "discount" ? "text-sage" : compact ? "text-ink" : "text-sand";
  const mist = compact ? "text-ink/50" : "text-mist";
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="min-w-0 leading-snug">
        <span className="block">{label}</span>
        {hint ? <span className={`mt-0.5 block text-[11px] leading-snug ${mist}`}>{hint}</span> : null}
      </span>
      <span className={`shrink-0 pt-0.5 tabular-nums ${num}`}>{money(amount)}</span>
    </li>
  );
}

function BillGroup({ title, compact, children }: { title: string; compact?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-[0.16em] ${compact ? "text-ink/40" : "text-brass"}`}>{title}</p>
      <ul className="mt-2 space-y-2.5">{children}</ul>
    </div>
  );
}

export function PackageBill({
  hotels,
  meals,
  guests,
  nights,
  mealRates,
  taxis,
  taxiList,
  stayName,
  lastHotelName,
  grand,
  compact,
  showTotal = true,
  insurance,
  esimSelections,
  discounts,
}: {
  hotels: ReviewHotel[];
  meals: MealChoice;
  guests: number;
  nights: number;
  mealRates?: MealRates;
  taxis: TaxiPick[];
  taxiList: PackageTaxi[];
  stayName: string;
  lastHotelName: string;
  grand: number;
  compact?: boolean;
  showTotal?: boolean;
  insurance?: boolean;
  esimSelections?: EsimSelections;
  discounts?: { id: string; label: string; amount: number }[];
}) {
  const { money } = useSerai();
  const rates = packageMealRates(mealRates);
  const mealGroups = hotels.map((h) => ({
    hotel: h,
    rows: mealLines(parseMealChoice(meals, stayNightDates(h.checkin, h.checkout)), guests, nightsBetween(h.checkin, h.checkout), rates),
  }));
  const mealRows = mealGroups.flatMap((g) => g.rows);
  const splitMealsByHotel = hotels.length > 1;
  const transfers = taxis
    .map((p) => {
      const t = taxiList.find((x) => x.id === p.id);
      if (!t) return null;
      const kind = kindOf(p, t);
      const hotel = p.hotelName || (kind === "dropoff" ? lastHotelName : stayName);
      const title = t.service === "airport" ? airportPickupTitle(t, hotel, kind === "dropoff" ? "out" : "in") : tripTitle(t);
      const order = kind === "pickup" ? 0 : kind === "trip" ? 1 : 2;
      return {
        id: p.slotId,
        kind,
        title,
        hint: `${formatDay(p.date)} · ${t.vehicle}`,
        amount: taxiPickCost(t, p, guests),
        date: p.date,
        order,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  const text = compact ? "text-sm text-ink/75" : "text-sm text-mist";

  return (
    <div className={`space-y-4 ${text}`}>
      {hotels.length ? (
        <BillGroup title="Hotels" compact={compact}>
          {hotels.map((h) => (
            <BillRow
              key={`${h.id}-${h.checkin}`}
              compact={compact}
              label={h.name}
              hint={`${h.city} · ${formatDay(h.checkin)} — ${formatDay(h.checkout)}${h.room ? ` · ${h.room}` : ""}`}
              amount={h.amount}
            />
          ))}
        </BillGroup>
      ) : null}
      {transfers.length ? (
        <BillGroup title="Transfers" compact={compact}>
          {transfers.map((r) => (
            <BillRow key={r.id} compact={compact} label={`${kindLabel(r.kind)} · ${r.title}`} hint={r.hint} amount={r.amount} />
          ))}
        </BillGroup>
      ) : null}
      {mealRows.length ? (
        splitMealsByHotel ? (
          mealGroups.map((g) =>
            g.rows.length ? (
              <BillGroup key={g.hotel.id} title={`Meals · ${g.hotel.name}`} compact={compact}>
                {g.rows.map((l) => (
                  <BillRow key={`${g.hotel.id}-${l.id}`} compact={compact} label={l.label} amount={l.amount} />
                ))}
              </BillGroup>
            ) : null,
          )
        ) : (
          <BillGroup title="Meals" compact={compact}>
            {mealRows.map((l) => (
              <BillRow key={l.id} compact={compact} label={l.label} amount={l.amount} />
            ))}
          </BillGroup>
        )
      ) : null}
      {discounts && discounts.length > 0 ? (
        <BillGroup title="Discounts" compact={compact}>
          {discounts.map((d) => (
            <BillRow key={d.id} compact={compact} label={d.label} amount={d.amount} tone="discount" />
          ))}
        </BillGroup>
      ) : null}
      {insurance || (esimSelections && Object.values(esimSelections).some((n) => n)) ? (
        <BillGroup title="Add-ons" compact={compact}>
          {insurance ? <BillRow compact={compact} label="Travel insurance" amount={INSURANCE_RATE_PER_GUEST * Math.max(1, guests)} /> : null}
          {ESIM_PLANS.map((p) => {
            const qty = esimSelections?.[p.id] ?? 0;
            if (!qty) return null;
            return <BillRow key={p.id} compact={compact} label={`eSIM · ${p.label} × ${qty}`} amount={esimPlanRate(p.id) * qty} />;
          })}
        </BillGroup>
      ) : null}
      {showTotal ? (
        <p className={`flex justify-between gap-3 border-t pt-3 font-medium ${compact ? "border-ink/10 text-ink" : "border-sand/10 text-sand"}`}>
          <span>You pay</span>
          <span className="tabular-nums">{money(grand)}</span>
        </p>
      ) : null}
    </div>
  );
}
