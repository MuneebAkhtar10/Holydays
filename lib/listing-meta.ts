import type { FacilityKey, MealKey, PropertyKind, SearchStay, StayOffer } from "@/lib/search-index";
import { stays } from "@/lib/stays";
import type { Occupancy, Stay, StayGalleries, StayPricing } from "@/lib/types";
import { parsePricing, searchQuote } from "@/lib/pricing";
import { normalizeRooms, type BookableRoom } from "@/lib/rooms";
import { pilgrimCountryForPlace, pilgrimCountryName, pinForPilgrimCity, coordsForCity } from "@/lib/pilgrim";
import { parseMealRates } from "@/lib/package-plan";

export function emptyGalleries(): StayGalleries {
  return { property: [], room: [], bathroom: [], facilities: [] };
}

function asUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function flattenGalleries(g: StayGalleries) {
  return [...g.property, ...g.room, ...g.bathroom, ...g.facilities].filter(Boolean);
}

export type StayListingMeta = {
  gallery: string[];
  galleries: StayGalleries;
  propertyKind: PropertyKind;
  stars: number;
  address: string;
  checkIn: string;
  checkOut: string;
  reception: string;
  phone: string;
  email: string;
  policies: string[];
  facilities: FacilityKey[];
  meals: MealKey[];
  mealRates: { breakfast: number; lunch: number; dinner: number };
  amenities: string[];
  rooms: BookableRoom[];
  pricing: StayPricing;
  cancellation: "free" | "partial" | "strict";
  payAtProperty: boolean;
  landmark: string;
  airport: string;
  centerKm: number;
  airportKm: number;
  landmarkKm: number;
  lat: number;
  lng: number;
  pin: { x: number; y: number };
  hostName: string;
  hostYears: number;
  hostLetter: string;
  hostPhone: string;
  hostEmail: string;
  hostPortrait: string;
  hostContactHours: string;
  climate: string;
  country: string;
  driver: string;
  driverPhoto: string;
  vehicle: string;
  vehiclePhoto: string;
  model: string;
  seats: number;
  vacant: number;
  routeCities: string[];
  hours: string;
  origin: string;
  destination: string;
  privateRate: number;
  itinerary: { time: string; place: string; note: string }[];
  service: "ziyarat" | "airport";
  closedFrom: string;
};

export type ListingCard = {
  id: string;
  slug: string;
  kind: string;
  ownerId?: string;
  name: string;
  nastaliq: string;
  city: string;
  region: string;
  cover: string;
  description: string;
  price: number;
  priceUnit: string;
  published?: boolean;
  status?: string;
  meta?: string | StayListingMeta;
  reviewAvg?: number;
  reviewCount?: number;
};

export function parseListingMeta(raw: unknown): StayListingMeta {
  let obj: Partial<StayListingMeta> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw || "{}") as Partial<StayListingMeta>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Partial<StayListingMeta>;
  }
  const flat = asUrls(obj.gallery);
  const hasBuckets = Boolean(obj.galleries && typeof obj.galleries === "object");
  const galleries: StayGalleries = {
    property: asUrls(obj.galleries?.property).length ? asUrls(obj.galleries?.property) : hasBuckets ? [] : flat,
    room: asUrls(obj.galleries?.room),
    bathroom: asUrls(obj.galleries?.bathroom),
    facilities: asUrls(obj.galleries?.facilities),
  };
  const gallery = flattenGalleries(galleries).length ? flattenGalleries(galleries) : flat;
  const rooms = normalizeRooms(obj.rooms, Number((obj as { price?: number }).price) || 15000, {
    meals: Array.isArray(obj.meals) ? obj.meals : [],
    cancellation: obj.cancellation,
    payAtProperty: Boolean(obj.payAtProperty),
  });
  return {
    gallery,
    galleries,
    propertyKind: obj.propertyKind || "guest_house",
    stars: Number(obj.stars) || 3,
    address: String(obj.address ?? ""),
    checkIn: obj.checkIn || "14:00",
    checkOut: obj.checkOut || "11:00",
    reception: obj.reception || "09:00–21:00",
    phone: String(obj.phone ?? ""),
    email: String(obj.email ?? ""),
    policies: Array.isArray(obj.policies) ? obj.policies : [],
    facilities: Array.isArray(obj.facilities) ? obj.facilities : [],
    meals: Array.isArray(obj.meals) ? obj.meals : [],
    mealRates: parseMealRates(obj.mealRates),
    amenities: Array.isArray(obj.amenities) ? obj.amenities : [],
    rooms,
    pricing: parsePricing((obj as { pricing?: unknown }).pricing),
    cancellation: obj.cancellation || "partial",
    payAtProperty: Boolean(obj.payAtProperty),
    landmark: String(obj.landmark ?? ""),
    airport: String(obj.airport ?? ""),
    centerKm: Number(obj.centerKm) || 5,
    airportKm: Number(obj.airportKm) || 20,
    landmarkKm: Number(obj.landmarkKm) || 2,
    lat: Number(obj.lat) || 0,
    lng: Number(obj.lng) || 0,
    pin: obj.pin && typeof obj.pin.x === "number" ? obj.pin : pinForCity(String(obj.address ?? "")),
    hostName: String(obj.hostName ?? ""),
    hostYears: Number(obj.hostYears) || 1,
    hostLetter: String(obj.hostLetter ?? ""),
    hostPhone: String(obj.hostPhone ?? ""),
    hostEmail: String(obj.hostEmail ?? ""),
    hostPortrait: String(obj.hostPortrait ?? ""),
    hostContactHours: String(obj.hostContactHours ?? ""),
    climate: String(obj.climate ?? ""),
    country: String(obj.country ?? ""),
    driver: String(obj.driver ?? ""),
    driverPhoto: String(obj.driverPhoto ?? ""),
    vehicle: String(obj.vehicle ?? ""),
    vehiclePhoto: String(obj.vehiclePhoto ?? ""),
    model: String(obj.model ?? ""),
    seats: Number(obj.seats) || 0,
    vacant: Number(obj.vacant) || 0,
    routeCities: Array.isArray(obj.routeCities)
      ? obj.routeCities.map(String).filter(Boolean)
      : String((obj as { route?: string }).route ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
    hours: String(obj.hours ?? ""),
    origin: String(obj.origin ?? ""),
    destination: String(obj.destination ?? ""),
    privateRate: Number(obj.privateRate) || 0,
    itinerary: Array.isArray(obj.itinerary)
      ? obj.itinerary
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const r = row as { time?: unknown; place?: unknown; note?: unknown };
            const place = String(r.place ?? "").trim();
            if (!place) return null;
            return { time: String(r.time ?? "").trim(), place, note: String(r.note ?? "").trim() };
          })
          .filter((row): row is { time: string; place: string; note: string } => Boolean(row))
      : [],
    service: obj.service === "airport" ? "airport" : "ziyarat",
    closedFrom: String(obj.closedFrom ?? ""),
  };
}

export function pinForCity(city: string) {
  const pilgrim = pinForPilgrimCity(city);
  if (pilgrimCountryForPlace(city)) return pilgrim;
  const c = city.trim().toLowerCase();
  const hit = stays.find(
    (s) => s.city.toLowerCase() === c || s.region.toLowerCase() === c || `${s.city}, ${s.region}`.toLowerCase().includes(c),
  );
  return hit?.pin ?? pilgrim;
}

export function defaultStayMeta(partial?: Partial<StayListingMeta> & { city?: string; cover?: string; price?: number; name?: string }): StayListingMeta {
  const city = partial?.city || "";
  const country = pilgrimCountryForPlace(city, partial?.country) ?? (partial?.country as "IQ" | "IR" | "SA" | undefined);
  const place = country ? pilgrimCountryName(country) : "";
  const cover = partial?.cover || "/images/hero-hunza-dusk.png";
  const price = partial?.price || 15000;
  return parseListingMeta({
    gallery: partial?.gallery?.length ? partial.gallery : [cover],
    galleries: partial?.galleries ?? { property: partial?.gallery?.length ? partial.gallery : [cover], room: [], bathroom: [], facilities: [] },
    propertyKind: partial?.propertyKind || "guest_house",
    stars: partial?.stars ?? 3,
    address: partial?.address || (city && place ? `${city}, ${place}` : city),
    checkIn: partial?.checkIn || "14:00",
    checkOut: partial?.checkOut || "11:00",
    reception: partial?.reception || "08:00–22:00 · host on phone after hours",
    phone: partial?.phone || "",
    email: partial?.email || "",
    policies: partial?.policies?.length
      ? partial.policies
      : ["Free cancellation until 18:00 the day before arrival.", "Quiet hours after 22:00.", "Government ID at check-in."],
    facilities: partial?.facilities ?? ["wifi", "parking"],
    meals: partial?.meals ?? [],
    mealRates: parseMealRates(partial?.mealRates),
    amenities: partial?.amenities ?? [],
    rooms: partial?.rooms?.length ? partial.rooms : [{ id: "room-1", name: "Guest room", sleeps: 2, price, note: "Standard room" }],
    pricing: partial?.pricing,
    cancellation: partial?.cancellation || "free",
    payAtProperty: partial?.payAtProperty ?? true,
    landmark: partial?.landmark || city,
    airport: partial?.airport || "",
    centerKm: partial?.centerKm ?? 3,
    airportKm: partial?.airportKm ?? 18,
    landmarkKm: partial?.landmarkKm ?? 1,
    lat: partial?.lat,
    lng: partial?.lng,
    pin: partial?.pin || pinForCity(city),
    hostName: partial?.hostName || "",
    hostYears: partial?.hostYears ?? 1,
    hostLetter: partial?.hostLetter || "Welcome. We keep this house for guests who want a real stay, not a lobby.",
    hostPhone: partial?.hostPhone || "",
    hostEmail: partial?.hostEmail || "",
    hostPortrait: partial?.hostPortrait || "",
    hostContactHours: partial?.hostContactHours || "",
    climate: partial?.climate || "Best window: Oct–Mar",
    country: country ?? partial?.country ?? "",
    driver: partial?.driver ?? "",
    driverPhoto: partial?.driverPhoto ?? "",
    vehicle: partial?.vehicle ?? "",
    vehiclePhoto: partial?.vehiclePhoto ?? "",
    model: partial?.model ?? "",
    seats: partial?.seats ?? 0,
    vacant: partial?.vacant ?? 0,
    routeCities: partial?.routeCities ?? [],
    hours: partial?.hours ?? "",
    origin: partial?.origin ?? "",
    destination: partial?.destination ?? "",
    privateRate: partial?.privateRate ?? 0,
    itinerary: partial?.itinerary ?? [],
    service: partial?.service === "airport" ? "airport" : "ziyarat",
  });
}

export function listingToStay(listing: ListingCard): Stay {
  const meta = parseListingMeta(listing.meta);
  const galleries = {
    property: meta.galleries.property.length ? meta.galleries.property : [listing.cover],
    room: meta.galleries.room,
    bathroom: meta.galleries.bathroom,
    facilities: meta.galleries.facilities,
  };
  const gallery = flattenGalleries(galleries);
  const rooms = normalizeRooms(meta.rooms, listing.price, {
    meals: meta.meals,
    cancellation: meta.cancellation,
    payAtProperty: meta.payAtProperty,
  });
  const pin = meta.pin?.x ? meta.pin : pinForCity(listing.city);
  const coords = coordsForCity(listing.city);
  return {
    id: listing.slug,
    name: listing.name,
    nastaliq: listing.nastaliq || "",
    city: listing.city,
    region: listing.region,
    cover: listing.cover || gallery[0],
    gallery,
    galleries,
    vibes: [],
    type: meta.propertyKind,
    price: listing.price,
    storyScore: 80,
    climate: meta.climate || "Year-round",
    season: "good",
    weather: [
      { d: "Thu", t: "—" },
      { d: "Fri", t: "—" },
      { d: "Sat", t: "—" },
    ],
    lat: meta.lat || coords.lat,
    lng: meta.lng || coords.lng,
    pin,
    amenities: meta.amenities,
    rooms,
    pricing: meta.pricing,
    mealRates: meta.mealRates,
    stories: [],
    experienceIds: [],
    host: {
      name: meta.hostName || "Host",
      portrait: meta.hostPortrait || "",
      years: meta.hostYears || 1,
      letter: meta.hostLetter || "",
      phone: meta.hostPhone || "",
      email: meta.hostEmail || "",
      contactHours: meta.hostContactHours || "",
    },
    description: listing.description,
    address: meta.address,
  };
}

export function listingOffer(listing: ListingCard): StayOffer {
  const meta = parseListingMeta(listing.meta);
  return {
    stars: meta.stars,
    reviewAvg: listing.reviewAvg ?? 0,
    reviewCount: listing.reviewCount ?? 0,
    centerKm: meta.centerKm,
    airportKm: meta.airportKm,
    landmark: meta.landmark || listing.city,
    landmarkKm: meta.landmarkKm,
    airport: meta.airport,
    kind: meta.propertyKind,
    cancellation: meta.cancellation,
    meals: meta.meals,
    payAtProperty: meta.payAtProperty,
    facilities: meta.facilities,
    offers: [],
    roomsLeft: Math.max(1, meta.rooms.reduce((n, r) => n + (r.available || 1), 0)),
    opened: new Date().getFullYear(),
  };
}

export function listingToSearchStay(
  listing: ListingCard,
  checkin: string,
  checkout: string,
  occupancy: Occupancy | number,
): SearchStay {
  const stay = listingToStay(listing);
  const offer = listingOffer(listing);
  const occ: Occupancy =
    typeof occupancy === "number" ? { rooms: occupancy, adults: 2, children: 0, childAges: [] } : occupancy;
  const quote = searchQuote(stay, checkin, checkout, occ);
  return {
    ...stay,
    ...offer,
    nights: quote.nights,
    start: quote.start,
    total: quote.total,
    taxes: quote.taxes + quote.fees.reduce((s, f) => s + f.amount, 0),
  };
}

export function encodeStayMeta(body: Record<string, unknown>, fallback?: Partial<StayListingMeta> & { city?: string; cover?: string; price?: number }): string {
  const roomsRaw = Array.isArray(body.rooms) ? body.rooms : fallback?.rooms;
  const galleryRaw = Array.isArray(body.gallery) ? body.gallery.map(String) : asUrls(fallback?.gallery);
  const galleriesRaw = body.galleries && typeof body.galleries === "object" ? (body.galleries as StayGalleries) : fallback?.galleries;
  const galleries: StayGalleries = {
    property: asUrls(galleriesRaw?.property),
    room: asUrls(galleriesRaw?.room),
    bathroom: asUrls(galleriesRaw?.bathroom),
    facilities: asUrls(galleriesRaw?.facilities),
  };
  if (!flattenGalleries(galleries).length && galleryRaw?.length) galleries.property = galleryRaw;
  const gallery = flattenGalleries(galleries).length ? flattenGalleries(galleries) : galleryRaw;
  const cover = String(body.cover ?? galleries.property[0] ?? gallery?.[0] ?? fallback?.cover ?? "");
  const meta = defaultStayMeta({
    ...parseListingMeta(fallback),
    city: String(body.city ?? fallback?.city ?? ""),
    cover,
    price: Number(body.price ?? fallback?.price ?? 0),
    gallery,
    galleries,
    propertyKind: (body.propertyKind as StayListingMeta["propertyKind"]) || fallback?.propertyKind,
    stars: body.stars !== undefined ? Number(body.stars) : fallback?.stars,
    address: body.address !== undefined ? String(body.address) : fallback?.address,
    checkIn: body.checkIn !== undefined ? String(body.checkIn) : fallback?.checkIn,
    checkOut: body.checkOut !== undefined ? String(body.checkOut) : fallback?.checkOut,
    reception: body.reception !== undefined ? String(body.reception) : fallback?.reception,
    phone: body.phone !== undefined ? String(body.phone) : fallback?.phone,
    email: body.email !== undefined ? String(body.email) : fallback?.email,
    policies: Array.isArray(body.policies) ? body.policies.map(String).filter(Boolean) : fallback?.policies,
    facilities: Array.isArray(body.facilities) ? (body.facilities as StayListingMeta["facilities"]) : fallback?.facilities,
    meals: Array.isArray(body.meals) ? (body.meals as StayListingMeta["meals"]) : fallback?.meals,
    mealRates: parseMealRates(body.mealRates ?? fallback?.mealRates),
    amenities: typeof body.amenities === "string"
      ? String(body.amenities).split("\n").map((s) => s.trim()).filter(Boolean)
      : Array.isArray(body.amenities)
        ? body.amenities.map(String)
        : fallback?.amenities,
    rooms: normalizeRooms(roomsRaw, Number(body.price ?? fallback?.price ?? 0) || 15000, {
      meals: Array.isArray(body.meals) ? (body.meals as StayListingMeta["meals"]) : fallback?.meals,
      cancellation: (body.cancellation as StayListingMeta["cancellation"]) || fallback?.cancellation,
      payAtProperty: body.payAtProperty !== undefined ? Boolean(body.payAtProperty) : fallback?.payAtProperty,
    }),
    pricing: parsePricing(body.pricing ?? fallback?.pricing),
    cancellation: (body.cancellation as StayListingMeta["cancellation"]) || fallback?.cancellation,
    payAtProperty: body.payAtProperty !== undefined ? Boolean(body.payAtProperty) : fallback?.payAtProperty,
    landmark: body.landmark !== undefined ? String(body.landmark) : fallback?.landmark,
    airport: body.airport !== undefined ? String(body.airport) : fallback?.airport,
    centerKm: body.centerKm !== undefined ? Number(body.centerKm) : fallback?.centerKm,
    airportKm: body.airportKm !== undefined ? Number(body.airportKm) : fallback?.airportKm,
    hostName: body.hostName !== undefined ? String(body.hostName) : fallback?.hostName,
    hostYears: body.hostYears !== undefined ? Number(body.hostYears) : fallback?.hostYears,
    hostLetter: body.hostLetter !== undefined ? String(body.hostLetter) : fallback?.hostLetter,
    hostPhone: body.hostPhone !== undefined ? String(body.hostPhone) : fallback?.hostPhone,
    hostEmail: body.hostEmail !== undefined ? String(body.hostEmail) : fallback?.hostEmail,
    hostPortrait: body.hostPortrait !== undefined ? String(body.hostPortrait) : fallback?.hostPortrait,
    hostContactHours: body.hostContactHours !== undefined ? String(body.hostContactHours) : fallback?.hostContactHours,
    climate: body.climate !== undefined ? String(body.climate) : fallback?.climate,
    country: String(body.country ?? fallback?.country ?? ""),
    driver: body.driver !== undefined ? String(body.driver) : fallback?.driver,
    driverPhoto: body.driverPhoto !== undefined ? String(body.driverPhoto) : fallback?.driverPhoto,
    vehicle: body.vehicle !== undefined ? String(body.vehicle) : fallback?.vehicle,
    vehiclePhoto: body.vehiclePhoto !== undefined ? String(body.vehiclePhoto) : fallback?.vehiclePhoto,
    model: body.model !== undefined ? String(body.model) : fallback?.model,
    seats: body.seats !== undefined ? Number(body.seats) : fallback?.seats,
    vacant: body.vacant !== undefined ? Number(body.vacant) : fallback?.vacant,
    routeCities: Array.isArray(body.routeCities)
      ? body.routeCities.map(String)
      : typeof body.routeCities === "string"
        ? body.routeCities.split(",").map((s) => s.trim()).filter(Boolean)
        : fallback?.routeCities,
    hours: body.hours !== undefined ? String(body.hours) : fallback?.hours,
    origin: body.origin !== undefined ? String(body.origin) : fallback?.origin,
    destination: body.destination !== undefined ? String(body.destination) : fallback?.destination,
    privateRate: body.privateRate !== undefined ? Number(body.privateRate) : fallback?.privateRate,
    itinerary: Array.isArray(body.itinerary)
      ? body.itinerary
      : fallback?.itinerary,
    service: body.service === "airport" || fallback?.service === "airport" ? "airport" : "ziyarat",
    lat: body.lat !== undefined ? Number(body.lat) : fallback?.lat,
    lng: body.lng !== undefined ? Number(body.lng) : fallback?.lng,
    pin: pinForCity(String(body.city ?? fallback?.city ?? "")),
  });
  return JSON.stringify(meta);
}
