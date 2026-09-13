export type Vibe =
  | "Quiet courtyard"
  | "Mountain mist"
  | "Old-city rooftop"
  | "Family haveli"
  | "Desert silence"
  | "Lakeside dawn"
  | "Work-from-haveli"
  | "Chef’s table";

export type MealPlan = "room_only" | "breakfast" | "half_board" | "full_board";
export type PayPolicy = "now" | "later" | "property";
export type CancelPolicy = "free" | "partial" | "strict";

export type BedKind = "king" | "queen" | "twin" | "single" | "sofa";

export type RatePlan = {
  id: string;
  name: string;
  meal: MealPlan;
  cancellation: CancelPolicy;
  payment: PayPolicy;
  nightlyAdjPct: number;
};

export type Room = {
  id: string;
  name: string;
  sleeps: number;
  price: number;
  note: string;
  images?: string[];
  sizeSqm?: number;
  beds?: { kind: BedKind; count: number }[];
  smoking?: boolean;
  extraBedAllowed?: boolean;
  cribAllowed?: boolean;
  includedGuests?: number;
  available?: number;
  facilities?: string[];
  rates?: RatePlan[];
};

export type SeasonWindow = { start: string; end: string; pct: number; label: string };

export type StayPricing = {
  taxPct: number;
  serviceChargePct: number;
  cityTaxPerNight: number;
  cleaningFee: number;
  resortFeePerNight: number;
  extraPerson: number;
  extraBed: number;
  crib: number;
  childFreeMaxAge: number;
  childRateMaxAge: number;
  childRate: number;
  weekendPct: number;
  occupancyPct: number;
  seasons: SeasonWindow[];
  holidays: { date: string; pct: number; label: string }[];
  longStayNights: number;
  longStayPct: number;
  earlyBirdDays: number;
  earlyBirdPct: number;
  lastMinuteDays: number;
  lastMinutePct: number;
  memberPct: number;
  mobilePct: number;
  promoCodes: { code: string; pct: number }[];
  airportTransfer: number;
};

export type Occupancy = {
  rooms: number;
  adults: number;
  children: number;
  childAges: number[];
};

export type Story = {
  author: string;
  from: string;
  body: string;
  mood: string;
};

export type StayGalleries = {
  property: string[];
  room: string[];
  bathroom: string[];
  facilities: string[];
};

export type Stay = {
  id: string;
  name: string;
  nastaliq: string;
  city: string;
  region: string;
  cover: string;
  gallery: string[];
  galleries?: StayGalleries;
  vibes: Vibe[];
  type: string;
  price: number;
  storyScore: number;
  climate: string;
  season: "good" | "shoulder" | "avoid";
  weather: { d: string; t: string }[];
  lat: number;
  lng: number;
  pin: { x: number; y: number };
  amenities: string[];
  rooms: Room[];
  pricing?: StayPricing;
  mealRates?: { breakfast: number; lunch: number; dinner: number };
  stories: Story[];
  experienceIds: string[];
  host: { name: string; portrait: string; years: number; letter: string; phone?: string; email?: string; contactHours?: string };
  description: string;
  address?: string;
};

export type Experience = {
  id: string;
  title: string;
  place: string;
  price: number;
  hours: string;
  cover: string;
  blurb: string;
};

export type Reservation = {
  stayId: string;
  roomId: string;
  checkin: string;
  checkout: string;
  guests: number;
  extras: string[];
  payment: string;
  guestName: string;
  email: string;
  phone: string;
  total: number;
  bookedAt: string;
};
