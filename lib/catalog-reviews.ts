import { stayOffer } from "@/lib/search-index";
import { stayById } from "@/lib/stays";

export type GuestReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  name: string;
};

const FIRST = ["Ayesha", "Hassan", "Maya", "Omar", "Sara", "Tomas", "Hina", "Daniel", "Fatima", "Noah", "Zara", "Ibrahim", "Elena", "Bilal", "Amira", "James", "Noor", "Leila", "Usman", "Priya", "Rina", "Farid", "Saba", "Kamila", "Yusuf"];
const FROM = ["Lahore", "Karachi", "Islamabad", "London", "Lisbon", "Berlin", "Multan", "Toronto", "Dubai", "Peshawar", "Madrid", "Skardu", "Doha", "Manchester", "Hunza", "Paris", "Faisalabad", "Singapore", "Quetta", "Gwadar"];

const BODIES = [
  "Quiet, clean, and exactly as photographed. We would book again without thinking.",
  "The host answered quickly and the neighbourhood was easy to walk. Breakfast was the highlight.",
  "Better than the score suggested. Light in the morning, hush in the afternoon.",
  "A serious room for the price. Wi-Fi held, water was hot, and checkout was unfussy.",
  "We came for the location and stayed for the house. Small details were looked after.",
  "Not a chain hotel — that is the point. Bring patience and you get a stay that feels like a place.",
  "Spotless linen, a real shower, and a desk that actually works. Rare combination.",
  "The pin on the map is honest. Walked to dinner, slept well, left with no complaints.",
  "Staff (or the keeper) treated us like guests, not bookings. That still matters.",
  "Value for money in this city. The photos understate the light.",
  "One of the easier arrivals we have had in Pakistan. Clear instructions, kind welcome.",
  "Would recommend for a couple or a solo traveller who wants quiet over spectacle.",
  "A few street sounds at night, otherwise perfect. We extended by a night.",
  "Coffee, a window, and no nonsense. This is how a city stay should feel.",
  "Family-friendly without being noisy. Kids slept; we got the evening back.",
  "Left a little sorry to go. That does not happen often on work trips.",
];

function seed(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function dayIso(n: number) {
  const d = new Date("2026-07-01T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - (n % 400));
  return d.toISOString();
}

/** Guest reviews that match the scores shown on search cards, plus any stay stories. */
export function catalogGuestReviews(stayId: string): { avg: number; count: number; reviews: GuestReview[] } {
  const offer = stayOffer(stayId);
  const stay = stayById(stayId);
  if (!offer) return { avg: 0, count: 0, reviews: [] };

  const storyReviews: GuestReview[] = (stay?.stories ?? []).map((st, i) => ({
    id: `story-${stayId}-${i}`,
    rating: 5,
    body: st.body,
    createdAt: dayIso(30 + i * 17),
    name: `${st.author}, ${st.from}`,
  }));

  const s = seed(stayId);
  const extras: GuestReview[] = Array.from({ length: offer.reviewCount }, (_, i) => {
    const rating10 = Math.min(10, Math.max(7, offer.reviewAvg + ((s + i * 13) % 7) / 10 - 0.3));
    return {
      id: `cat-${stayId}-${i}`,
      rating: Math.max(3, Math.min(5, Math.round(rating10 / 2))),
      body: BODIES[(s + i * 5) % BODIES.length],
      createdAt: dayIso(i + 1),
      name: `${FIRST[(s + i * 3) % FIRST.length]}, ${FROM[(s + i * 7) % FROM.length]}`,
    };
  });

  const seen = new Set<string>();
  const reviews: GuestReview[] = [];
  for (const r of [...storyReviews, ...extras]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    reviews.push(r);
  }

  return { avg: offer.reviewAvg, count: offer.reviewCount, reviews };
}
