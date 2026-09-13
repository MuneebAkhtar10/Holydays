"use client";

import { formatDay } from "@/lib/format";
import { useSerai } from "@/lib/store";
import {
  packageGrandTotal,
  packageInvoiceBreakdown,
  parseMealChoice,
  parseMealRates,
  type EsimSelections,
  type MealChoice,
  type MealKind,
  type MealRates,
  type PackageStaySlice,
  type PackageTaxi,
  type PrimaryStaySummary,
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
  const heads = Math.max(1, guests);

  const setMeal = (key: MealKind, next: string[]) => onChange({ ...picked, [key]: next });

  const toggle = (key: MealKind, day: string) => {
    const cur = picked[key];
    setMeal(key, cur.includes(day) ? cur.filter((d) => d !== day) : dates.filter((d) => cur.includes(d) || d === day));
  };

  return (
    <div className="mt-4">
      <p className="text-sm text-mist">Tap a day to add or remove that meal. Use All / None to fill a whole column at once.</p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-sand/[0.08] bg-ink-2">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-sand/[0.08]">
              <th className="px-3 py-2.5 text-left text-xs font-normal uppercase tracking-wide text-mist">Day</th>
              {MEAL_ROWS.map(({ key, label }) => {
                const rate = price[key];
                return (
                  <th key={key} className="px-3 py-2.5 text-center align-top">
                    <p className="text-xs font-medium normal-case text-sand">{label}</p>
                    <p className="mt-0.5 text-[10px] font-normal text-mist">{rate ? `${money(rate)}/day` : "Not offered"}</p>
                    {rate ? (
                      <div className="mt-1.5 flex justify-center gap-1">
                        <button type="button" className="rounded-full border border-sand/10 px-2 py-0.5 text-[10px] text-mist hover:border-brass/40 hover:text-sand" onClick={() => setMeal(key, dates)}>
                          All
                        </button>
                        <button type="button" className="rounded-full border border-sand/10 px-2 py-0.5 text-[10px] text-mist hover:border-brass/40 hover:text-sand" onClick={() => setMeal(key, [])}>
                          None
                        </button>
                      </div>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dates.map((day) => (
              <tr key={day} className="border-b border-sand/[0.05] last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-sand">{formatDay(day)}</td>
                {MEAL_ROWS.map(({ key }) => {
                  const rate = price[key];
                  const on = picked[key].includes(day);
                  return (
                    <td key={key} className="px-3 py-2 text-center">
                      <button
                        type="button"
                        disabled={!rate}
                        aria-label={`${key} on ${formatDay(day)}`}
                        onClick={() => toggle(key, day)}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                          !rate ? "cursor-not-allowed opacity-20" : on ? "bg-flame text-ink" : "border border-sand/20 hover:border-brass/40"
                        }`}
                      >
                        {on && rate ? "✓" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {MEAL_ROWS.map(({ key, label }) => {
          const rate = price[key];
          const count = picked[key].length;
          const amount = rate * count * heads;
          return (
            <div key={key} className="rounded-xl bg-sand/[0.03] px-3 py-2 text-xs ring-1 ring-sand/[0.06]">
              <p className="text-mist">{label}</p>
              <p className="mt-0.5 text-sand">
                {count} of {dates.length} day{dates.length === 1 ? "" : "s"}
              </p>
              {amount ? <p className="mt-0.5 font-medium text-sand">{money(amount)}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PackageSnapshot({
  pack,
  guests,
  stayName,
  primaryStay,
  bookingTotal,
}: {
  pack?: {
    meals?: MealChoice;
    mealRates?: MealRates;
    ziyaratIds?: string[];
    taxis?: TaxiPick[];
    stays?: PackageStaySlice[];
    total?: number;
    insurance?: boolean;
    esimSelections?: EsimSelections;
  } | null;
  guests: number;
  stayName?: string;
  /** The primary (first-booked) hotel, so it can be listed alongside any extra hotels instead of being implied by the page header. */
  primaryStay?: PrimaryStaySummary;
  /** This booking's stored total — pass it (together with primaryStay) to show the true full package total, since the stored total excludes extra hotels. */
  bookingTotal?: number;
}) {
  const { money } = useSerai();
  if (!pack) return null;
  const meals = parseMealChoice(pack.meals);
  const ziyaratIds = pack.ziyaratIds ?? [];
  const taxis = pack.taxis ?? [];
  const stays = pack.stays ?? [];
  const esimQty = pack.esimSelections
    ? Object.values(pack.esimSelections).reduce((s, n) => s + (Number(n) || 0), 0)
    : 0;
  const empty =
    !primaryStay &&
    meals.breakfast.length + meals.lunch.length + meals.dinner.length === 0 &&
    ziyaratIds.length === 0 &&
    taxis.length === 0 &&
    stays.length === 0 &&
    !pack.insurance &&
    esimQty === 0;
  if (empty) return null;
  const breakdown = packageInvoiceBreakdown({
    meals,
    guests,
    ziyaratIds,
    taxis,
    ziyarat: Array.isArray((pack as { ziyarat?: ZiyaratStop[] }).ziyarat) ? (pack as { ziyarat: ZiyaratStop[] }).ziyarat : [],
    taxiList: Array.isArray((pack as { taxiList?: PackageTaxi[] }).taxiList) ? (pack as { taxiList: PackageTaxi[] }).taxiList : [],
    mealRates: pack.mealRates,
    stayName,
    stays,
    primaryStay,
    insurance: pack.insurance,
    esimSelections: pack.esimSelections,
  });
  const grandTotal = typeof bookingTotal === "number" ? packageGrandTotal(bookingTotal, { stays }) : breakdown.total;

  return (
    <div className="mt-6 rounded-2xl border border-sand/[0.08] bg-ink-2 p-5 shadow-[0_12px_40px_rgba(11,28,52,0.05)]">
      <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Ziyarat package</p>

      {breakdown.hotels.length > 0 && (
        <div className="mt-4 space-y-3">
          {breakdown.hotels.map((h) => (
            <div key={h.id} className="rounded-xl border border-sand/[0.08] bg-sand/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg leading-tight text-sand">{h.name}</p>
                  <p className="mt-0.5 text-xs text-mist">
                    {h.city} · {formatDay(h.checkin)} — {formatDay(h.checkout)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-sand">{money(h.roomAmount)}</p>
              </div>
              {h.mealLines.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-sand/[0.06] pt-3 text-sm">
                  {h.mealLines.map((m) => (
                    <li key={m.id} className="flex justify-between gap-3 text-mist">
                      <span className="leading-snug">{m.label}</span>
                      <span className="shrink-0 tabular-nums">{money(m.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {breakdown.extras.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-mist">Transfers & ziyarat</p>
          <ul className="mt-2 space-y-2 text-sm">
            {breakdown.extras.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="leading-snug text-sand">{l.label}</span>
                <span className="shrink-0 font-medium tabular-nums text-sand">{l.amount ? money(l.amount) : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {grandTotal > 0 ? (
        <p className="mt-4 flex items-baseline justify-between border-t border-sand/[0.1] pt-3 text-base font-semibold text-sand">
          <span>Package total</span>
          <span className="font-display text-xl">{money(grandTotal)}</span>
        </p>
      ) : null}
    </div>
  );
}
