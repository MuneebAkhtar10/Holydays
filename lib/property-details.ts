import { PROPERTY_LABEL, stayOffer, type PropertyKind, type StayOffer } from "@/lib/search-index";
import type { Stay } from "@/lib/types";

export type GalleryCategory = "property" | "room" | "bathroom" | "facilities" | "360" | "video";

export const GALLERY_LABEL: Record<GalleryCategory, string> = {
  property: "Property",
  room: "Rooms",
  bathroom: "Bathroom",
  facilities: "Facilities",
  "360": "360°",
  video: "Video",
};

export type PropertyFacts = {
  address: string;
  checkIn: string;
  checkOut: string;
  reception: string;
  phone: string;
  email: string;
  policies: string[];
};

const HOUSE: Record<string, PropertyFacts> = {
  "apricot-court": {
    address: "Baltit lane, Karimabad, Hunza, Gilgit-Baltistan",
    checkIn: "14:00",
    checkOut: "11:00",
    reception: "Desk 07:00–22:00 · after hours, ring the courtyard bell",
    phone: "+92 346 800 1101",
    email: "saba@apricot-court.serai.pk",
    policies: [
      "Free cancellation until 18:00 the day before arrival.",
      "Shoes at the door. No drones over the orchard.",
      "Children welcome. Extra bed on request.",
      "Quiet hours after 22:00.",
    ],
  },
  "walled-roof": {
    address: "Inside Delhi Gate, Walled City, Lahore",
    checkIn: "15:00",
    checkOut: "12:00",
    reception: "Haveli desk 24 hours · Orange Line Anarkali 11 min walk",
    phone: "+92 42 3711 2044",
    email: "keys@walled-roof.serai.pk",
    policies: [
      "Free cancellation until 24 hours before check-in.",
      "Rooftop supper included for brick-suite nights.",
      "Accessible ground-floor sitting; stairs to the sky room.",
    ],
  },
  "indigo-well": {
    address: "Khoo gali, near Hussain Agahi, Multan",
    checkIn: "14:00",
    checkOut: "11:00",
    reception: "08:00–21:00 · night watchman on the lane",
    phone: "+92 61 451 2290",
    email: "well@indigo.serai.pk",
    policies: ["Partial refund up to 48 hours before arrival.", "Workshop below can be noisy until 18:00."],
  },
  "black-granite": {
    address: "Lower Kachura road, Skardu, Gilgit-Baltistan",
    checkIn: "13:00",
    checkOut: "10:00",
    reception: "Camp desk 06:00–21:00 · jeep desk at breakfast",
    phone: "+92 355 500 2218",
    email: "camp@black-granite.serai.pk",
    policies: ["Weather can close the airfield. Hold a flexible ticket.", "Partial refund 72 hours before arrival."],
  },
  seawind: {
    address: "East Bay cliff, Gwadar, Balochistan",
    checkIn: "14:00",
    checkOut: "11:00",
    reception: "10:00–20:00 · host on WhatsApp after hours",
    phone: "+92 864 210 4412",
    email: "wind@seawind.serai.pk",
    policies: ["Free cancellation 24 hours before arrival.", "Sea wind is loud; earplugs in the room."],
  },
  "pine-key": {
    address: "Patriata ridge, Murree Hills, Punjab",
    checkIn: "14:00",
    checkOut: "12:00",
    reception: "08:00–22:00 · family desk",
    phone: "+92 51 341 8802",
    email: "lodge@pine-key.serai.pk",
    policies: ["Free cancellation 48 hours before arrival.", "Pets by arrangement. No fireworks."],
  },
  "canal-breeze": {
    address: "Canal Bank Road, near GOR-I, Lahore",
    checkIn: "15:00",
    checkOut: "11:00",
    reception: "Self check-in with lockbox · host 09:00–21:00 on phone",
    phone: "+92 42 3578 6610",
    email: "studio@canal-breeze.serai.pk",
    policies: [
      "Free cancellation until 14:00 the day before.",
      "Stay 3 nights, 4th half-price.",
      "Quiet building. No parties. Desk hours respected.",
    ],
  },
  "orchard-quiet": {
    address: "Altit village road, Nagar, Hunza",
    checkIn: "13:00",
    checkOut: "10:00",
    reception: "Family house — someone is usually in the courtyard",
    phone: "+92 346 800 2219",
    email: "house@orchard-quiet.serai.pk",
    policies: ["Non-refundable in harvest weeks.", "All meals included. Tell us allergies when you book."],
  },
  "desert-kiln": {
    address: "Cholistan fringe, Derawar road, Bahawalpur District",
    checkIn: "15:00",
    checkOut: "10:00",
    reception: "Camp fire desk from 16:00 · jeep meet in Bahawalpur 14:00",
    phone: "+92 62 288 1044",
    email: "kiln@desert.serai.pk",
    policies: ["Partial refund 72 hours before.", "Nights are cold. Bring a layer even in April."],
  },
  "river-lantern": {
    address: "Riverbank, Madyan, Swat",
    checkIn: "14:00",
    checkOut: "11:00",
    reception: "07:00–22:00 · trout kitchen until 21:00",
    phone: "+92 946 751 2201",
    email: "lodge@river-lantern.serai.pk",
    policies: ["Free cancellation 24 hours before.", "Spa by appointment. River is unsupervised."],
  },
  "first-light": {
    address: "Margalla fringe, Islamabad",
    checkIn: "14:00",
    checkOut: "11:00",
    reception: "Unstaffed cabin · host meets you at the gate",
    phone: "+92 51 265 4418",
    email: "light@first-light.serai.pk",
    policies: ["Non-refundable within 7 days of arrival.", "No extra guests. Trail starts at first light."],
  },
  "truck-art": {
    address: "Mehmoodabad yards side, Karachi",
    checkIn: "14:00",
    checkOut: "12:00",
    reception: "24-hour front desk · airport desk until 23:00",
    phone: "+92 21 3431 2290",
    email: "desk@truck-art.serai.pk",
    policies: ["Free cancellation until 18:00 the day before.", "Pool 07:00–21:00. Gym 06:00–22:00."],
  },
};

export function propertyFacts(stay: Stay): PropertyFacts {
  return (
    HOUSE[stay.id] ?? {
      address: `${stay.city}, ${stay.region}`,
      checkIn: "14:00",
      checkOut: "11:00",
      reception: "09:00–21:00",
      phone: "+92 21 111 737 24",
      email: `stay@${stay.id}.serai.pk`,
      policies: ["House rules are confirmed at booking."],
    }
  );
}

export function gallerySets(stay: Stay): Record<GalleryCategory, string[]> {
  const g = stay.gallery.length ? stay.gallery : [stay.cover];
  const buckets = stay.galleries;
  const categorized = Boolean(
    buckets && (buckets.property.length || buckets.room.length || buckets.bathroom.length || buckets.facilities.length),
  );
  const property = buckets?.property?.length ? buckets.property : categorized ? [] : g;
  const room = buckets?.room ?? [];
  const bathroom = buckets?.bathroom ?? [];
  const facilities = buckets?.facilities ?? [];
  const all = [...property, ...room, ...bathroom, ...facilities].filter(Boolean);
  return {
    property: property.length ? property : [stay.cover],
    room: categorized ? room : property.slice(0, 3),
    bathroom: categorized ? bathroom : property.slice(0, 2),
    facilities: categorized ? facilities : property.slice(0, 2),
    "360": property.length ? [property[0], property[1] ?? property[0]] : [stay.cover],
    video: all.length ? all.slice(0, 6) : [stay.cover],
  };
}

export function propertyKind(stay: Stay): PropertyKind {
  return stayOffer(stay.id)?.kind ?? "guest_house";
}

export function propertyKindLabel(stay: Stay) {
  const offer = stayOffer(stay.id);
  return offer ? PROPERTY_LABEL[offer.kind] : stay.type;
}

export function propertyMeta(stay: Stay): StayOffer | undefined {
  return stayOffer(stay.id);
}
