export type PoiKind = "attraction" | "restaurant" | "airport" | "transit";

export type MapPoi = {
  id: string;
  kind: PoiKind;
  title: string;
  sub: string;
  pin: { x: number; y: number };
  city: string;
  walk?: string;
  extra?: string;
};

export const MAP_POIS: MapPoi[] = [
  { id: "air-gil", kind: "airport", title: "Gilgit Airport (GIL)", sub: "92 km from Hunza stays · jeep + air", pin: { x: 54, y: 16 }, city: "Karimabad", extra: "Flights from ISB · 1h" },
  { id: "air-kdu", kind: "airport", title: "Skardu Airport (KDU)", sub: "18–22 km from Skardu camps", pin: { x: 62, y: 18 }, city: "Skardu", extra: "Flights from ISB · weather holds" },
  { id: "air-isb", kind: "airport", title: "Islamabad International (ISB)", sub: "22 km from First Light", pin: { x: 39, y: 31 }, city: "Islamabad", extra: "Metrobus + ride-hail" },
  { id: "air-lhe", kind: "airport", title: "Allama Iqbal (LHE)", sub: "9–14 km from Lahore stays", pin: { x: 51, y: 41 }, city: "Lahore", extra: "Orange Line + taxi ~35 min" },
  { id: "air-mux", kind: "airport", title: "Multan International (MUX)", sub: "8 km from Indigo Well", pin: { x: 43, y: 52 }, city: "Multan", extra: "Rickshaw + taxi" },
  { id: "air-bhv", kind: "airport", title: "Bahawalpur (BHV)", sub: "42 km from desert camp", pin: { x: 47, y: 58 }, city: "Bahawalpur", extra: "Jeep transfer" },
  { id: "air-khi", kind: "airport", title: "Jinnah International (KHI)", sub: "16 km from truck-art hotel", pin: { x: 26, y: 79 }, city: "Karachi", extra: "Green Line + taxi ~40 min" },
  { id: "air-gwd", kind: "airport", title: "Gwadar Airport (GWD)", sub: "11 km from Sea-wind", pin: { x: 14, y: 75 }, city: "Gwadar", extra: "Taxi · limited flights" },
  { id: "air-sdt", kind: "airport", title: "Saidu Sharif (SDT)", sub: "95 km from Madyan lodge", pin: { x: 36, y: 25 }, city: "Madyan", extra: "Van along Swat River" },

  { id: "att-baltit", kind: "attraction", title: "Baltit Fort", sub: "0.6 km · Karimabad", pin: { x: 57, y: 7.5 }, city: "Karimabad", walk: "8 min walk" },
  { id: "att-altit", kind: "attraction", title: "Altit Fort", sub: "1.4 km · Nagar road", pin: { x: 61, y: 10 }, city: "Nagar", walk: "18 min walk" },
  { id: "att-badshahi", kind: "attraction", title: "Badshahi Mosque", sub: "0.5 km · Walled City", pin: { x: 53, y: 43 }, city: "Lahore", walk: "7 min walk" },
  { id: "att-canal", kind: "attraction", title: "Lahore Canal", sub: "0.2 km · evening walk", pin: { x: 57, y: 47 }, city: "Lahore", walk: "3 min walk" },
  { id: "att-multan", kind: "attraction", title: "Multan Fort", sub: "1.2 km", pin: { x: 43, y: 53.5 }, city: "Multan", walk: "15 min walk" },
  { id: "att-shangrila", kind: "attraction", title: "Shangrila lake", sub: "4.5 km · Lower Kachura", pin: { x: 65, y: 13 }, city: "Skardu", walk: "12 min drive" },
  { id: "att-deosai", kind: "attraction", title: "Deosai fringe", sub: "8 km · first light", pin: { x: 41, y: 34.5 }, city: "Islamabad", walk: "Day jeep" },
  { id: "att-eastbay", kind: "attraction", title: "Gwadar East Bay", sub: "0.3 km from the terrace", pin: { x: 11, y: 79 }, city: "Gwadar", walk: "4 min walk" },
  { id: "att-yards", kind: "attraction", title: "Truck-art yards", sub: "0.4 km", pin: { x: 29, y: 83 }, city: "Karachi", walk: "6 min walk" },
  { id: "att-patriata", kind: "attraction", title: "Patriata chairlift", sub: "1.1 km", pin: { x: 41, y: 27.5 }, city: "Patriata", walk: "14 min walk" },
  { id: "att-swat", kind: "attraction", title: "Swat River", sub: "0.1 km · lantern lodge", pin: { x: 37, y: 21.5 }, city: "Madyan", walk: "2 min walk" },
  { id: "att-dera", kind: "attraction", title: "Cholistan dera", sub: "2 km · desert night", pin: { x: 47, y: 63.5 }, city: "Bahawalpur", walk: "Camp jeep" },

  { id: "eat-apricot", kind: "restaurant", title: "Orchard kitchen", sub: "Wood-fired Hunza supper", pin: { x: 59.2, y: 10.2 }, city: "Karimabad", walk: "On property" },
  { id: "eat-roof", kind: "restaurant", title: "Haveli roof supper", sub: "Old-city rooftop", pin: { x: 55.2, y: 44.8 }, city: "Lahore", walk: "On property" },
  { id: "eat-canal", kind: "restaurant", title: "Canal dhabba", sub: "Late chai · GOR", pin: { x: 56.8, y: 45.2 }, city: "Lahore", walk: "9 min walk" },
  { id: "eat-indigo", kind: "restaurant", title: "Blue-tile courtyard", sub: "Multan breakfast", pin: { x: 45, y: 54.8 }, city: "Multan", walk: "On property" },
  { id: "eat-granite", kind: "restaurant", title: "River broth tent", sub: "Skardu camp kitchen", pin: { x: 64.5, y: 15 }, city: "Skardu", walk: "On property" },
  { id: "eat-sea", kind: "restaurant", title: "Fish supper terrace", sub: "East Bay catch", pin: { x: 13.2, y: 77.2 }, city: "Gwadar", walk: "On property" },
  { id: "eat-pine", kind: "restaurant", title: "Pine lodge table", sub: "Murree road", pin: { x: 43.2, y: 29.8 }, city: "Patriata", walk: "On property" },
  { id: "eat-lantern", kind: "restaurant", title: "Trout supper", sub: "Madyan river", pin: { x: 38.8, y: 22.8 }, city: "Madyan", walk: "On property" },
  { id: "eat-burns", kind: "restaurant", title: "Burns Road grill", sub: "Karachi late sitting", pin: { x: 27.2, y: 81.2 }, city: "Karachi", walk: "18 min drive" },
  { id: "eat-kiln", kind: "restaurant", title: "Desert night fire", sub: "Cholistan camp", pin: { x: 45.2, y: 61.2 }, city: "Bahawalpur", walk: "On property" },

  { id: "tr-orange", kind: "transit", title: "Orange Line — Anarkali", sub: "Metro · Walled City", pin: { x: 53.5, y: 45.5 }, city: "Lahore", extra: "To LHE ~45 min with taxi", walk: "11 min walk" },
  { id: "tr-metrobus", kind: "transit", title: "Metrobus — Blue Area", sub: "Islamabad BRT", pin: { x: 40.8, y: 32.2 }, city: "Islamabad", extra: "To ISB via ride-hail", walk: "22 min" },
  { id: "tr-green", kind: "transit", title: "Green Line — Numaish", sub: "Karachi BRT", pin: { x: 27.8, y: 82.4 }, city: "Karachi", extra: "To KHI ~40 min", walk: "14 min drive" },
  { id: "tr-kcr", kind: "transit", title: "Karachi Cantt station", sub: "Rail · long-distance", pin: { x: 28.6, y: 80.6 }, city: "Karachi", extra: "Pakistan Railways" },
  { id: "tr-lahore-station", kind: "transit", title: "Lahore Junction", sub: "Rail · north & south", pin: { x: 54.8, y: 45.8 }, city: "Lahore", extra: "Tezgam / Green Line train" },
  { id: "tr-rawalpindi", kind: "transit", title: "Rawalpindi station", sub: "Rail for Murree / north", pin: { x: 41.5, y: 30.4 }, city: "Islamabad", extra: "Van to Patriata" },
  { id: "tr-hunza-jeep", kind: "transit", title: "Karimabad jeep stand", sub: "KKH · Passu / Gilgit", pin: { x: 58.8, y: 9.8 }, city: "Karimabad", extra: "Shared jeep to GIL" },
  { id: "tr-skardu-van", kind: "transit", title: "Skardu van stand", sub: "Airport & lakes", pin: { x: 63.2, y: 14.6 }, city: "Skardu", extra: "Toyota to KDU" },
  { id: "tr-gwadar", kind: "transit", title: "Gwadar bus adda", sub: "Coastal highway", pin: { x: 12.8, y: 76.6 }, city: "Gwadar", extra: "Coach to Turbat / KHI" },
  { id: "tr-swat", kind: "transit", title: "Madyan flying coach", sub: "Mingora · Saidu Sharif", pin: { x: 37.2, y: 23.2 }, city: "Madyan", extra: "Van to SDT" },
];

export const POI_ZOOM: Record<PoiKind, number> = {
  airport: 1.12,
  attraction: 1.45,
  restaurant: 1.75,
  transit: 1.9,
};
