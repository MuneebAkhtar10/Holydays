import { inBounds } from "@/lib/map-geo";
import type { Occupancy, Stay } from "@/lib/types";
import { searchQuote } from "@/lib/pricing";
import { normalizeRooms } from "@/lib/rooms";
import { pilgrimCountries, pilgrimCountryForPlace } from "@/lib/pilgrim";

export type FacilityKey =
  | "parking"
  | "pool"
  | "gym"
  | "spa"
  | "restaurant"
  | "room_service"
  | "wifi"
  | "ac"
  | "pets"
  | "family"
  | "accessible"
  | "ev"
  | "beach"
  | "kitchen"
  | "washer"
  | "balcony"
  | "nonsmoking"
  | "airport_shuttle"
  | "laundry"
  | "business";

export const FACILITY_LABEL: Record<FacilityKey, string> = {
  parking: "Parking",
  pool: "Swimming pool",
  gym: "Gym",
  spa: "Spa",
  restaurant: "Restaurant",
  room_service: "Room service",
  wifi: "Wi-Fi",
  ac: "Air conditioning",
  pets: "Pet friendly",
  family: "Family friendly",
  accessible: "Wheelchair accessible",
  ev: "EV charging",
  beach: "Beach access",
  kitchen: "Kitchen",
  washer: "Washing machine",
  balcony: "Balcony",
  nonsmoking: "Non-smoking",
  airport_shuttle: "Airport shuttle",
  laundry: "Laundry",
  business: "Business facilities",
};

export const SHOWCASE_FACILITIES: FacilityKey[] = [
  "wifi",
  "parking",
  "pool",
  "gym",
  "restaurant",
  "spa",
  "airport_shuttle",
  "room_service",
  "laundry",
  "business",
  "accessible",
];

export type MealKey = "breakfast" | "half_board" | "full_board" | "all_inclusive";

export const MEAL_LABEL: Record<MealKey, string> = {
  breakfast: "Breakfast included",
  half_board: "Half board",
  full_board: "Full board",
  all_inclusive: "All-inclusive",
};

export type PropertyKind = "hotel" | "haveli" | "lodge" | "camp" | "apartment" | "homestay" | "guest_house";

export const PROPERTY_LABEL: Record<PropertyKind, string> = {
  hotel: "Hotel",
  haveli: "Haveli",
  lodge: "Lodge",
  camp: "Camp / lodge",
  apartment: "Apartment",
  homestay: "Homestay",
  guest_house: "Guest house",
};

export type StayOffer = {
  stars: number;
  reviewAvg: number;
  reviewCount: number;
  centerKm: number;
  airportKm: number;
  landmark: string;
  landmarkKm: number;
  airport: string;
  kind: PropertyKind;
  cancellation: "free" | "partial" | "strict";
  meals: MealKey[];
  payAtProperty: boolean;
  facilities: FacilityKey[];
  offers: string[];
  roomsLeft: number;
  opened: number;
};

export type SearchStay = Stay & StayOffer & { nights: number; total: number; taxes: number; start: number };

export type Suggestion = {
  id: string;
  group: "recent" | "popular" | "trending" | "nearby" | "airports" | "landmarks" | "properties" | "cities";
  kind: "city" | "property" | "landmark" | "airport" | "destination";
  label: string;
  sub: string;
  city: string;
  country: string;
};

export function suggestionPatch(item: Suggestion): Partial<SearchQuery> {
  const city = item.city || item.label;
  return {
    q: item.kind === "property" ? item.label : city,
    city: item.kind === "airport" || item.kind === "landmark" ? item.city : city,
    country: item.country || "",
    landmark: item.kind === "landmark" ? item.label : "",
    airport: item.kind === "airport" ? item.label : "",
    mapX: null,
    mapY: null,
    mapBounds: null,
  };
}

export const QUICK_CITIES = ["Najaf", "Karbala", "Mashhad", "Qom", "Makkah", "Madinah", "Baghdad"];

export type SearchQuery = {
  q: string;
  country: string;
  city: string;
  checkin: string;
  checkout: string;
  rooms: number;
  adults: number;
  children: number;
  childAges: number[];
  guests: number;
  vibe: string;
  landmark: string;
  airport: string;
  mapX: number | null;
  mapY: number | null;
  mapBounds: { x0: number; y0: number; x1: number; y1: number } | null;
};

export type FilterState = {
  priceMin: number;
  priceMax: number;
  kinds: PropertyKind[];
  stars: number[];
  guestMin: number;
  centerMax: number;
  airportMax: number;
  freeCancel: boolean;
  payAtProperty: boolean;
  meals: MealKey[];
  facilities: FacilityKey[];
};

export type SortKey = "rec" | "cheap" | "expensive" | "rated" | "reviewed" | "closest" | "value" | "newest";

export const defaultFilters = (): FilterState => ({
  priceMin: 0,
  priceMax: 250000,
  kinds: [],
  stars: [],
  guestMin: 0,
  centerMax: 50,
  airportMax: 120,
  freeCancel: false,
  payAtProperty: false,
  meals: [],
  facilities: [],
});

const meta: Record<string, StayOffer> = {
  "apricot-court": {
    stars: 5, reviewAvg: 9.6, reviewCount: 128, centerKm: 0.8, airportKm: 92, landmark: "Baltit Fort", landmarkKm: 0.6, airport: "GIL · Gilgit",
    kind: "haveli", cancellation: "free", meals: ["breakfast", "half_board"], payAtProperty: true,
    facilities: ["wifi", "kitchen", "family", "nonsmoking", "parking", "restaurant", "airport_shuttle", "laundry"],
    offers: ["Early-bird apricot harvest"], roomsLeft: 2, opened: 2014,
  },
  "walled-roof": {
    stars: 4, reviewAvg: 9.4, reviewCount: 214, centerKm: 0.4, airportKm: 14, landmark: "Badshahi Mosque", landmarkKm: 0.5, airport: "LHE · Allama Iqbal",
    kind: "haveli", cancellation: "free", meals: ["breakfast"], payAtProperty: true,
    facilities: ["wifi", "ac", "family", "accessible", "restaurant", "room_service", "balcony", "nonsmoking", "laundry", "airport_shuttle"],
    offers: ["Rooftop supper included"], roomsLeft: 3, opened: 2018,
  },
  "indigo-well": {
    stars: 4, reviewAvg: 9.1, reviewCount: 87, centerKm: 1.6, airportKm: 8, landmark: "Multan Fort", landmarkKm: 1.2, airport: "MUX · Multan",
    kind: "guest_house", cancellation: "partial", meals: ["breakfast"], payAtProperty: true,
    facilities: ["wifi", "ac", "kitchen", "family", "nonsmoking", "parking", "laundry"],
    offers: [], roomsLeft: 2, opened: 2011,
  },
  "black-granite": {
    stars: 5, reviewAvg: 9.7, reviewCount: 96, centerKm: 12, airportKm: 18, landmark: "Shangrila lake", landmarkKm: 4.5, airport: "KDU · Skardu",
    kind: "camp", cancellation: "partial", meals: ["breakfast", "full_board"], payAtProperty: false,
    facilities: ["parking", "restaurant", "family", "nonsmoking", "wifi", "airport_shuttle"],
    offers: ["Lake dawn package"], roomsLeft: 4, opened: 2016,
  },
  seawind: {
    stars: 4, reviewAvg: 9.0, reviewCount: 61, centerKm: 2.1, airportKm: 11, landmark: "Gwadar East Bay", landmarkKm: 0.3, airport: "GWD · Gwadar",
    kind: "lodge", cancellation: "free", meals: ["breakfast", "half_board"], payAtProperty: true,
    facilities: ["wifi", "ac", "beach", "parking", "restaurant", "balcony", "nonsmoking", "airport_shuttle", "laundry"],
    offers: ["Sea-wind walk"], roomsLeft: 3, opened: 2019,
  },
  "pine-key": {
    stars: 4, reviewAvg: 8.9, reviewCount: 143, centerKm: 3.4, airportKm: 62, landmark: "Patriata chairlift", landmarkKm: 1.1, airport: "ISB · Islamabad",
    kind: "lodge", cancellation: "free", meals: ["breakfast", "half_board"], payAtProperty: true,
    facilities: ["parking", "wifi", "family", "pets", "kitchen", "washer", "nonsmoking", "gym", "laundry"],
    offers: ["Family pine weekend"], roomsLeft: 5, opened: 2012,
  },
  "canal-breeze": {
    stars: 4, reviewAvg: 9.2, reviewCount: 178, centerKm: 4.8, airportKm: 9, landmark: "Lahore Canal", landmarkKm: 0.2, airport: "LHE · Allama Iqbal",
    kind: "apartment", cancellation: "free", meals: ["breakfast"], payAtProperty: true,
    facilities: ["wifi", "ac", "parking", "kitchen", "washer", "balcony", "family", "ev", "nonsmoking", "laundry", "business"],
    offers: ["Stay 3 nights, 4th half-price"], roomsLeft: 4, opened: 2021,
  },
  "orchard-quiet": {
    stars: 5, reviewAvg: 9.5, reviewCount: 72, centerKm: 1.2, airportKm: 88, landmark: "Altit Fort", landmarkKm: 1.4, airport: "GIL · Gilgit",
    kind: "homestay", cancellation: "strict", meals: ["breakfast", "all_inclusive"], payAtProperty: false,
    facilities: ["kitchen", "family", "nonsmoking", "wifi", "parking", "laundry"],
    offers: [], roomsLeft: 1, opened: 2009,
  },
  "desert-kiln": {
    stars: 3, reviewAvg: 8.7, reviewCount: 54, centerKm: 18, airportKm: 42, landmark: "Cholistan dera", landmarkKm: 2.0, airport: "BHV · Bahawalpur",
    kind: "camp", cancellation: "partial", meals: ["full_board", "all_inclusive"], payAtProperty: true,
    facilities: ["parking", "restaurant", "pets", "family", "nonsmoking"],
    offers: ["Desert night fire"], roomsLeft: 6, opened: 2017,
  },
  "river-lantern": {
    stars: 4, reviewAvg: 9.3, reviewCount: 81, centerKm: 0.9, airportKm: 95, landmark: "Swat River", landmarkKm: 0.1, airport: "SDT · Saidu Sharif",
    kind: "lodge", cancellation: "free", meals: ["breakfast", "half_board"], payAtProperty: true,
    facilities: ["wifi", "parking", "restaurant", "spa", "family", "nonsmoking", "balcony", "laundry"],
    offers: ["Trout supper"], roomsLeft: 2, opened: 2015,
  },
  "first-light": {
    stars: 5, reviewAvg: 9.8, reviewCount: 44, centerKm: 6.2, airportKm: 22, landmark: "Deosai fringe", landmarkKm: 8.0, airport: "KDU · Skardu",
    kind: "camp", cancellation: "strict", meals: ["breakfast", "full_board"], payAtProperty: false,
    facilities: ["parking", "nonsmoking", "family"],
    offers: ["First-light watch"], roomsLeft: 2, opened: 2020,
  },
  "truck-art": {
    stars: 3, reviewAvg: 8.8, reviewCount: 190, centerKm: 7.5, airportKm: 16, landmark: "Truck-art yards", landmarkKm: 0.4, airport: "KHI · Jinnah",
    kind: "hotel", cancellation: "free", meals: ["breakfast"], payAtProperty: true,
    facilities: ["wifi", "ac", "parking", "gym", "pool", "restaurant", "room_service", "accessible", "ev", "nonsmoking", "family", "airport_shuttle", "laundry", "business"],
    offers: ["Harbour van day"], roomsLeft: 8, opened: 2022,
  },
};

export const airports = [
  { id: "NJF", label: "Najaf International (NJF)", city: "Najaf", country: "IQ" },
  { id: "BGW", label: "Baghdad International (BGW)", city: "Baghdad", country: "IQ" },
  { id: "MHD", label: "Mashhad International (MHD)", city: "Mashhad", country: "IR" },
  { id: "IKA", label: "Imam Khomeini (IKA)", city: "Tehran", country: "IR" },
  { id: "JED", label: "King Abdulaziz (JED)", city: "Jeddah", country: "SA" },
  { id: "MED", label: "Prince Mohammad bin Abdulaziz (MED)", city: "Madinah", country: "SA" },
];

export const landmarks = [
  { id: "imam-ali", label: "Imam Ali shrine", city: "Najaf", country: "IQ" },
  { id: "imam-hussain", label: "Imam Hussain shrine", city: "Karbala", country: "IQ" },
  { id: "kadhimiya", label: "Kadhimiya", city: "Baghdad", country: "IQ" },
  { id: "imam-reza", label: "Imam Reza shrine", city: "Mashhad", country: "IR" },
  { id: "masumeh", label: "Hazrat Masumeh", city: "Qom", country: "IR" },
  { id: "haram", label: "Masjid al-Haram", city: "Makkah", country: "SA" },
  { id: "nabawi", label: "Masjid an-Nabawi", city: "Madinah", country: "SA" },
];

export const popularDestinations = [
  { label: "Najaf", city: "Najaf", country: "IQ" },
  { label: "Karbala", city: "Karbala", country: "IQ" },
  { label: "Mashhad", city: "Mashhad", country: "IR" },
  { label: "Makkah", city: "Makkah", country: "SA" },
  { label: "Madinah", city: "Madinah", country: "SA" },
];

export const trendingDestinations = [
  { label: "Qom", city: "Qom", country: "IR" },
  { label: "Baghdad", city: "Baghdad", country: "IQ" },
  { label: "Jeddah", city: "Jeddah", country: "SA" },
];

export const nearbyDestinations = [
  { label: "Kufa", city: "Kufa", country: "IQ" },
  { label: "Samarra", city: "Samarra", country: "IQ" },
  { label: "Shiraz", city: "Shiraz", country: "IR" },
  { label: "AlUla", city: "AlUla", country: "SA" },
];

const RECENT_KEY = "serai-recent-search";

export function readRecent(): Suggestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as Suggestion[];
    return Array.isArray(raw) ? raw.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: Suggestion) {
  const next = [item, ...readRecent().filter((r) => r.id !== item.id)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function hydrateCatalogStay(stay: Stay): Stay {
  const offer = meta[stay.id];
  return {
    ...stay,
    rooms: normalizeRooms(stay.rooms, stay.price, offer
      ? { meals: offer.meals, cancellation: offer.cancellation, payAtProperty: offer.payAtProperty }
      : undefined),
  };
}

export function occupancyFrom(rooms: number, adults = 2, children = 0, childAges: number[] = []): Occupancy {
  return { rooms: Math.max(1, rooms), adults: Math.max(1, adults), children: Math.max(0, children), childAges };
}

export function enrichStay(stay: Stay, checkin: string, checkout: string, occupancy: Occupancy | number): SearchStay | null {
  const offer = meta[stay.id];
  if (!offer) return null;
  const occ = typeof occupancy === "number" ? occupancyFrom(occupancy) : occupancy;
  const hydrated = hydrateCatalogStay(stay);
  const quote = searchQuote(hydrated, checkin, checkout, occ);
  return {
    ...hydrated,
    ...offer,
    nights: quote.nights,
    start: quote.start,
    total: quote.total,
    taxes: quote.taxes + quote.fees.reduce((s, f) => s + f.amount, 0),
  };
}

export function stayOffer(id: string) {
  return meta[id];
}

export function catalogStays(_checkin: string, _checkout: string, _occupancy: Occupancy | number): SearchStay[] {
  return [];
}

export function suggest(query: string): Suggestion[] {
  const q = query.trim().toLowerCase();
  const cities = pilgrimCountries.flatMap((c) =>
    c.cities.map((city) => ({
      id: `city-${city}`,
      group: "cities" as const,
      kind: "city" as const,
      label: city,
      sub: c.name,
      city,
      country: c.code,
    })),
  );
  const props: Suggestion[] = [];
  const air = airports.map((a) => ({
    id: `air-${a.id}`,
    group: "airports" as const,
    kind: "airport" as const,
    label: a.label,
    sub: "Airport",
    city: a.city,
    country: a.country,
  }));
  const land = landmarks.map((a) => ({
    id: `lm-${a.id}`,
    group: "landmarks" as const,
    kind: "landmark" as const,
    label: a.label,
    sub: `Landmark · ${a.city}`,
    city: a.city,
    country: a.country,
  }));
  const dest = [
    ...popularDestinations.map((d) => ({
      id: `pop-${d.city}`,
      group: "popular" as const,
      kind: "destination" as const,
      label: d.label,
      sub: "Popular destination",
      city: d.city,
      country: d.country,
    })),
    ...trendingDestinations.map((d) => ({
      id: `tr-${d.city}`,
      group: "trending" as const,
      kind: "destination" as const,
      label: d.label,
      sub: "Trending",
      city: d.city,
      country: d.country,
    })),
    ...nearbyDestinations.map((d) => ({
      id: `nb-${d.city}`,
      group: "nearby" as const,
      kind: "destination" as const,
      label: d.label,
      sub: "Nearby",
      city: d.city,
      country: d.country,
    })),
  ];
  const all = [...dest, ...cities, ...air, ...land, ...props];
  if (!q) return all;
  const aliases: Record<string, string> = {
    karbala: "karbala",
    najaf: "najaf",
    mashhad: "mashhad",
    mecca: "makkah",
    makkah: "makkah",
    medina: "madinah",
    madinah: "madinah",
    qom: "qom",
  };
  const needle = aliases[q] ?? q;
  return all.filter((s) => `${s.label} ${s.sub} ${s.city}`.toLowerCase().includes(needle));
}

export function applyFilters(list: SearchStay[], query: SearchQuery, filters: FilterState, sort: SortKey, opts?: { ignoreCapacity?: boolean }) {
  const needle = query.q.trim().toLowerCase();
  let out = list.filter((s) => {
    const stayCountry = pilgrimCountryForPlace(s.city, s.region);
    if (!stayCountry) return false;
    const hasPlace = Boolean(query.city || query.q.trim() || query.landmark || query.airport);
    if (hasPlace && query.country && query.country !== stayCountry) return false;
    const hay = `${s.name} ${s.city} ${s.region} ${s.landmark} ${s.airport} ${s.type}`.toLowerCase();
    if (query.city) {
      const c = query.city.toLowerCase();
      if (s.city.toLowerCase() !== c && s.region.toLowerCase() !== c && !hay.includes(c)) return false;
    } else if (needle && !["iraq", "iran", "saudi", "saudi arabia"].includes(needle) && !hay.includes(needle)) return false;
    if (query.landmark && s.landmark.toLowerCase() !== query.landmark.toLowerCase() && !hay.includes(query.landmark.toLowerCase())) return false;
    if (query.airport && !s.airport.toLowerCase().includes(query.airport.toLowerCase())) return false;
    if (query.vibe && !s.vibes.includes(query.vibe as never)) return false;
    if (s.start < filters.priceMin || s.start > filters.priceMax) return false;
    if (filters.kinds.length && !filters.kinds.includes(s.kind)) return false;
    if (filters.stars.length && !filters.stars.includes(s.stars)) return false;
    if (filters.guestMin && s.reviewAvg < filters.guestMin) return false;
    if (filters.airportMax < 120 && s.airportKm > filters.airportMax) return false;
    if (filters.freeCancel && s.cancellation !== "free") return false;
    if (filters.payAtProperty && !s.payAtProperty) return false;
    if (filters.meals.length && !filters.meals.some((m) => s.meals.includes(m))) return false;
    if (filters.facilities.length && !filters.facilities.every((f) => s.facilities.includes(f))) return false;
    const need = query.adults + query.children;
    if (!opts?.ignoreCapacity && need && s.rooms.length && !s.rooms.some((r) => r.sleeps * query.rooms >= need)) return false;
    if (query.mapBounds && !inBounds(s.pin, query.mapBounds, 1.5)) return false;
    return true;
  });

  if (query.mapX != null && query.mapY != null) {
    out = [...out].sort((a, b) => pinDist(a, query) - pinDist(b, query));
  }

  if (sort === "cheap") out = [...out].sort((a, b) => a.start - b.start);
  if (sort === "expensive") out = [...out].sort((a, b) => b.start - a.start);
  if (sort === "rated") out = [...out].sort((a, b) => b.reviewAvg - a.reviewAvg);
  if (sort === "reviewed") out = [...out].sort((a, b) => b.reviewCount - a.reviewCount);
  if (sort === "closest") out = [...out].sort((a, b) => a.centerKm - b.centerKm);
  if (sort === "value") out = [...out].sort((a, b) => b.reviewAvg / a.start - a.reviewAvg / b.start);
  if (sort === "newest") out = [...out].sort((a, b) => b.opened - a.opened);
  if (sort === "rec") out = [...out].sort((a, b) => b.storyScore - a.storyScore);
  return out;
}

function pinDist(s: SearchStay, query: SearchQuery) {
  const dx = s.pin.x - (query.mapX ?? s.pin.x);
  const dy = s.pin.y - (query.mapY ?? s.pin.y);
  return dx * dx + dy * dy;
}

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "rec", label: "Recommended" },
  { id: "cheap", label: "Cheapest" },
  { id: "expensive", label: "Most expensive" },
  { id: "rated", label: "Highest rated" },
  { id: "reviewed", label: "Most reviewed" },
  { id: "closest", label: "Closest" },
  { id: "value", label: "Best value" },
  { id: "newest", label: "Newest properties" },
];
