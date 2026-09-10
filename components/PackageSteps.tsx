"use client";

import { formatDay } from "@/lib/format";
import { useSerai } from "@/lib/store";
import {
  packageLineItems,
  parseMealChoice,
  parseMealRates,
  type MealChoice,
  type MealKind,
  type MealRates,
  type PackageStaySlice,
  type PackageTaxi,
  type TaxiPick,
  type ZiyaratStop,
} from "@/lib/package-plan";

export { AirportTransferStep, DayTripsStep, ItineraryStep } from "@/components/ItineraryPicker";

const MEAL_ROWS: { key: MealKind; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

export function MealPlanStep({
  meals,
  onChange,
  guests,
  dates,
  rates,
}: {
  meals: MealChoice;
  onChange: (next: MealChoice) => void;
  guests: number;
  dates: string[];
  nights?: number;
  rates?: MealRates;
}) {
  const { money } = useSerai();
  const price = parseMealRates(rates);
  const picked = parseMealChoice(meals, dates);

  const setMeal = (key: MealKind, next: string[]) => onChange({ ...picked, [key]: next });

  const toggle = (key: MealKind, day: string) => {
    const cur = picked[key];
    setMeal(key, cur.includes(day) ? cur.filter((d) => d !== day) : dates.filter((d) => cur.includes(d) || d === day));
  };

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-mist">Tap the days you want each meal. Example: breakfast on the first three and last three nights.</p>
      {MEAL_ROWS.map(({ key, label }) => {
        const rate = price[key];
        const selected = picked[key];
        const amount = rate * selected.length * Math.max(1, guests);
        return (
          <div
            key={key}
            className={`rounded-2xl border p-5 shadow-[0_10px_28px_rgba(11,28,52,0.04)] ${
              selected.length ? "border-brass/25 bg-flame/[0.07]" : "border-sand/[0.08] bg-ink-2"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-mist">{rate ? `${money(rate)} / person / day` : "Not offered"}</p>
              </div>
              <p className="text-sm text-sand">{amount ? money(amount) : "—"}</p>
            </div>
            {rate ? (
              <>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    ["All", dates],
                    ["None", [] as string[]],
                    ["First 3", dates.slice(0, 3)],
                    ["Last 3", dates.slice(-3)],
                  ].map(([name, next]) => (
                    <button
                      key={String(name)}
                      type="button"
                      className="rounded-full border border-sand/10 px-3 py-1 text-[11px] text-mist hover:border-brass/40 hover:text-sand"
                      onClick={() => setMeal(key, next as string[])}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {dates.map((day) => {
                    const on = selected.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-xs ${on ? "bg-flame text-ink" : "border border-sand/10 text-sand"}`}
                        onClick={() => toggle(key, day)}
                      >
                        {formatDay(day)}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-mist">
                  {selected.length} of {dates.length} day{dates.length === 1 ? "" : "s"}
                </p>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function PackageSnapshot({
  pack,
  guests,
  nights,
  stayName,
}: {
  pack?: {
    meals?: MealChoice;
    mealRates?: MealRates;
    ziyaratIds?: string[];
    taxis?: TaxiPick[];
    stays?: PackageStaySlice[];
    total?: number;
  } | null;
  guests: number;
  nights: number;
  stayName?: string;
}) {
  const { money } = useSerai();
  if (!pack) return null;
  const meals = parseMealChoice(pack.meals);
  const ziyaratIds = pack.ziyaratIds ?? [];
  const taxis = pack.taxis ?? [];
  const stays = pack.stays ?? [];
  const empty =
    meals.breakfast.length + meals.lunch.length + meals.dinner.length === 0 && ziyaratIds.length === 0 && taxis.length === 0 && stays.length === 0;
  if (empty) return null;
  return (
    <div className="mt-6 rounded-2xl border border-sand/[0.08] bg-ink-2 p-5 shadow-[0_12px_40px_rgba(11,28,52,0.05)]">
      <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Ziyarat package</p>
      <div className="mt-3">
        <PackageCartLines
          meals={meals}
          mealRates={pack.mealRates}
          guests={guests}
          nights={nights}
          ziyaratIds={ziyaratIds}
          taxis={taxis}
          ziyarat={Array.isArray((pack as { ziyarat?: ZiyaratStop[] }).ziyarat) ? (pack as { ziyarat: ZiyaratStop[] }).ziyarat : []}
          taxiList={Array.isArray((pack as { taxiList?: PackageTaxi[] }).taxiList) ? (pack as { taxiList: PackageTaxi[] }).taxiList : []}
          stayName={stayName}
          stays={stays}
        />
      </div>
      {typeof pack.total === "number" && pack.total > 0 ? (
        <p className="mt-3 text-sm text-sand">Package add-ons {money(pack.total)}</p>
      ) : null}
    </div>
  );
}

export function PackageCartLines({
  meals,
  guests,
  nights,
  ziyaratIds,
  taxis,
  ziyarat,
  taxiList,
  mealRates,
  stayName,
  stays,
}: {
  meals: MealChoice;
  guests: number;
  nights: number;
  ziyaratIds: string[];
  taxis: TaxiPick[];
  ziyarat: ZiyaratStop[];
  taxiList: PackageTaxi[];
  mealRates?: MealRates;
  stayName?: string;
  stays?: PackageStaySlice[];
}) {
  const { money } = useSerai();
  const lines = packageLineItems({
    meals,
    guests,
    nights,
    ziyaratIds,
    taxis,
    ziyarat,
    taxiList,
    mealRates,
    stayName,
    stays,
  });
  if (lines.length === 0) return <p className="text-sm opacity-70">Package extras: none yet.</p>;
  return (
    <ul className="space-y-2.5 text-sm">
      {lines.map((l) => (
        <li key={l.id} className="flex justify-between gap-3">
          <span className="leading-snug">{l.label}</span>
          <span className="shrink-0 font-semibold tabular-nums">{l.amount ? money(l.amount) : "—"}</span>
        </li>
      ))}
    </ul>
  );
}
