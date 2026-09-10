"use client";

import { useSerai } from "@/lib/store";
import {
  FACILITY_LABEL,
  MEAL_LABEL,
  PROPERTY_LABEL,
  type FacilityKey,
  type FilterState,
  type MealKey,
  type PropertyKind,
} from "@/lib/search-index";

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="filter-chip" data-on={on} onClick={onClick}>
      {label}
    </button>
  );
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function SearchFilters({ value, onChange }: { value: FilterState; onChange: (next: FilterState) => void }) {
  const { money } = useSerai();
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-6">
      <label className="auth-label">
        Price per night
        <div className="mt-2 space-y-2">
          <input type="range" min={0} max={250000} step={1000} value={value.priceMax} onChange={(e) => set({ priceMax: Number(e.target.value) })} className="filter-range w-full" />
          <p className="text-sm font-normal normal-case tracking-normal text-mist">
            {money(value.priceMin)} – {money(value.priceMax)}
          </p>
        </div>
      </label>

      <div>
        <p className="auth-label">Property type</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(PROPERTY_LABEL) as PropertyKind[]).map((k) => (
            <Chip key={k} label={PROPERTY_LABEL[k]} on={value.kinds.includes(k)} onClick={() => set({ kinds: toggle(value.kinds, k) })} />
          ))}
        </div>
      </div>

      <div>
        <p className="auth-label">Hotel star rating</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[3, 4, 5].map((n) => (
            <Chip key={n} label={`${n}★`} on={value.stars.includes(n)} onClick={() => set({ stars: toggle(value.stars, n) })} />
          ))}
        </div>
      </div>

      <label className="auth-label">
        Guest rating
        <select className="auth-field" value={value.guestMin} onChange={(e) => set({ guestMin: Number(e.target.value) })}>
          <option value={0}>Any</option>
          <option value={8}>8+</option>
          <option value={9}>9+</option>
          <option value={9.5}>Exceptional 9.5+</option>
        </select>
      </label>

      <label className="auth-label">
        Distance from airport
        <input type="range" min={5} max={120} value={value.airportMax} onChange={(e) => set({ airportMax: Number(e.target.value) })} className="filter-range mt-2 w-full" />
        <p className="mt-1 text-sm font-normal normal-case tracking-normal text-mist">Up to {value.airportMax} km</p>
      </label>

      <div className="flex flex-wrap gap-2">
        <Chip label="Free cancellation" on={value.freeCancel} onClick={() => set({ freeCancel: !value.freeCancel })} />
        <Chip label="Pay at property" on={value.payAtProperty} onClick={() => set({ payAtProperty: !value.payAtProperty })} />
      </div>

      <div>
        <p className="auth-label">Meals</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(MEAL_LABEL) as MealKey[]).map((k) => (
            <Chip key={k} label={MEAL_LABEL[k]} on={value.meals.includes(k)} onClick={() => set({ meals: toggle(value.meals, k) })} />
          ))}
        </div>
      </div>

      <div>
        <p className="auth-label">Facilities</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(FACILITY_LABEL) as FacilityKey[]).map((k) => (
            <Chip key={k} label={FACILITY_LABEL[k]} on={value.facilities.includes(k)} onClick={() => set({ facilities: toggle(value.facilities, k) })} />
          ))}
        </div>
      </div>
    </div>
  );
}
