export const PILGRIM_CODES = ["SA", "IQ", "IR"] as const;
export type PilgrimCountry = (typeof PILGRIM_CODES)[number];

export const pilgrimCountries: { code: PilgrimCountry; name: string; cities: string[] }[] = [
  { code: "SA", name: "Saudi Arabia", cities: ["Makkah", "Madinah", "Jeddah", "Riyadh", "AlUla"] },
  { code: "IQ", name: "Iraq", cities: ["Najaf", "Karbala", "Baghdad", "Kufa", "Kadhimiya", "Samarra", "Basra"] },
  { code: "IR", name: "Iran", cities: ["Mashhad", "Qom", "Tehran", "Isfahan", "Shiraz", "Yazd"] },
];

const NAME_TO_CODE: Record<string, PilgrimCountry> = {
  iraq: "IQ",
  iran: "IR",
  saudi: "SA",
  "saudi arabia": "SA",
};

const CITY_TO_CODE: Record<string, PilgrimCountry> = Object.fromEntries(
  pilgrimCountries.flatMap((c) => c.cities.map((city) => [city.toLowerCase(), c.code])),
) as Record<string, PilgrimCountry>;

const PINS: Record<string, { x: number; y: number }> = {
  najaf: { x: 42, y: 48 },
  karbala: { x: 44, y: 46 },
  baghdad: { x: 46, y: 42 },
  kufa: { x: 42, y: 49 },
  kadhimiya: { x: 46, y: 41 },
  samarra: { x: 47, y: 36 },
  basra: { x: 52, y: 62 },
  mashhad: { x: 72, y: 28 },
  qom: { x: 62, y: 38 },
  tehran: { x: 64, y: 32 },
  isfahan: { x: 62, y: 44 },
  shiraz: { x: 60, y: 52 },
  yazd: { x: 66, y: 46 },
  makkah: { x: 38, y: 58 },
  madinah: { x: 36, y: 50 },
  jeddah: { x: 34, y: 56 },
  riyadh: { x: 48, y: 54 },
  alula: { x: 34, y: 46 },
};

export const pilgrimAirports: Record<PilgrimCountry, { label: string; city: string }[]> = {
  IQ: [
    { label: "Najaf Airport (NJF)", city: "Najaf" },
    { label: "Baghdad Airport (BGW)", city: "Baghdad" },
    { label: "Basra Airport (BSR)", city: "Basra" },
  ],
  IR: [
    { label: "Mashhad Airport (MHD)", city: "Mashhad" },
    { label: "Tehran Imam Khomeini (IKA)", city: "Tehran" },
    { label: "Isfahan Airport (IFN)", city: "Isfahan" },
  ],
  SA: [
    { label: "Jeddah Airport (JED)", city: "Jeddah" },
    { label: "Madinah Airport (MED)", city: "Madinah" },
    { label: "Riyadh Airport (RUH)", city: "Riyadh" },
  ],
};

export function isPilgrimCountry(code: string): code is PilgrimCountry {
  return PILGRIM_CODES.includes(code as PilgrimCountry);
}

export function pilgrimCountryName(code: PilgrimCountry) {
  return pilgrimCountries.find((c) => c.code === code)?.name ?? code;
}

export function citiesForCountry(code: PilgrimCountry) {
  return pilgrimCountries.find((c) => c.code === code)?.cities ?? [];
}

/** Best matching pilgrim city inside a route label (e.g. "Karbala → Baghdad"). */
export function cityNamedIn(text: string, country?: PilgrimCountry | null): string | null {
  const hay = text.trim().toLowerCase();
  if (!hay || hay === "guest hotel") return null;
  const cities = country ? citiesForCountry(country) : pilgrimCountries.flatMap((c) => c.cities);
  const hits = cities.filter((c) => hay.includes(c.toLowerCase()));
  if (!hits.length) return null;
  hits.sort((a, b) => b.length - a.length);
  return hits[0];
}

export function pilgrimCountryForPlace(city: string, hint?: string): PilgrimCountry | null {
  const h = (hint ?? "").trim();
  if (isPilgrimCountry(h)) return h;
  const fromHint = NAME_TO_CODE[h.toLowerCase()];
  if (fromHint) return fromHint;
  const fromCity = CITY_TO_CODE[city.trim().toLowerCase()] ?? NAME_TO_CODE[city.trim().toLowerCase()];
  return fromCity ?? null;
}

export function isPilgrimPlace(city: string, region?: string) {
  return Boolean(pilgrimCountryForPlace(city, region));
}

export function pinForPilgrimCity(city: string) {
  return PINS[city.trim().toLowerCase()] ?? { x: 48, y: 46 };
}

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  najaf: { lat: 32.0284, lng: 44.3356 },
  karbala: { lat: 32.6164, lng: 44.0324 },
  baghdad: { lat: 33.3152, lng: 44.3661 },
  kufa: { lat: 32.034, lng: 44.4 },
  kadhimiya: { lat: 33.3803, lng: 44.338 },
  samarra: { lat: 34.198, lng: 43.874 },
  basra: { lat: 30.508, lng: 47.78 },
  mashhad: { lat: 36.2879, lng: 59.6156 },
  qom: { lat: 34.6416, lng: 50.8764 },
  tehran: { lat: 35.6892, lng: 51.389 },
  isfahan: { lat: 32.6546, lng: 51.668 },
  shiraz: { lat: 29.5918, lng: 52.5836 },
  yazd: { lat: 31.8974, lng: 54.3678 },
  makkah: { lat: 21.4225, lng: 39.8262 },
  madinah: { lat: 24.4672, lng: 39.6111 },
  jeddah: { lat: 21.4858, lng: 39.1925 },
  riyadh: { lat: 24.7136, lng: 46.6753 },
  alula: { lat: 26.6086, lng: 37.9232 },
};

export function airportForCity(country: PilgrimCountry, city: string) {
  const list = pilgrimAirports[country];
  const hit = list.find((a) => a.city.toLowerCase() === city.trim().toLowerCase());
  return hit ?? list[0];
}

export function coordsForCity(city: string) {
  return CITY_COORDS[city.trim().toLowerCase()] ?? { lat: 32.0284, lng: 44.3356 };
}
