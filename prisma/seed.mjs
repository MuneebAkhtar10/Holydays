import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const password = "serai123";

const stays = [
  ["qasr-al-dur-najaf", "Qasr Al-Dur Hotel", "قصر الدر", "Najaf", "Iraq", "https://images.unsplash.com/photo-1616855202318-07ea40522c6c?fm=jpg&q=80&w=1600&auto=format&fit=crop", 18500, "A known hotel near the Imam Ali shrine.", 32.0258, 44.3341, "Al-Haidariya / Old City, Najaf, Iraq"],
  ["al-kafeel-karbala", "Al Kafeel Hotel", "الكفيل", "Karbala", "Iraq", "https://images.unsplash.com/photo-1623680904963-5580d963e18e?fm=jpg&q=80&w=1600&auto=format&fit=crop", 24000, "Between the two harams, toward Imam Hussain and Al-Abbas.", 32.6169, 44.0336, "Between the Two Holy Shrines, Karbala, Iraq"],
  ["al-rasheed-baghdad", "Al-Rasheed Hotel Baghdad", "الرشيد", "Baghdad", "Iraq", "https://images.unsplash.com/photo-1468824357306-a439d58ccb1c?fm=jpg&q=80&w=1600&auto=format&fit=crop", 26500, "Central Baghdad stay after the Karbala–Baghdad road.", 33.3152, 44.3661, "International Zone / central Baghdad, Iraq"],
  ["darvishi-mashhad", "Darvishi Hotel", "هتل درویشی", "Mashhad", "Iran", "https://images.unsplash.com/photo-1584027123930-c1f17b17ee1a?fm=jpg&q=80&w=1600&auto=format&fit=crop", 28500, "On Imam Reza Street, beside the holy shrine.", 36.28705, 59.61555, "Imam Reza St, Mashhad, Razavi Khorasan, Iran"],
  ["astan-qom", "Astan Hotel Qom", "هتل آستان قم", "Qom", "Iran", "https://images.unsplash.com/photo-1621293954908-907159247fc8?fm=jpg&q=80&w=1600&auto=format&fit=crop", 19800, "Close to Hazrat Masumeh shrine.", 34.6419, 50.8778, "Near Holy Shrine of Fatima Masumeh, Qom, Iran"],
  ["swissotel-makkah", "Ajyad Grand Hotel", "أجياد جراند", "Makkah", "Saudi Arabia", "https://images.unsplash.com/photo-1561501900-3701fa6a0864?fm=jpg&q=80&w=1600&auto=format&fit=crop", 62000, "Ajyad, connected toward Masjid al-Haram.", 21.4187, 39.8256, "Ajyad St, Makkah 24231, Saudi Arabia"],
  ["movenpick-madinah", "Anwar Al Madinah Hotel", "أنوار المدينة", "Madinah", "Saudi Arabia", "https://images.unsplash.com/photo-1711743266323-5badf42d4797?fm=jpg&q=80&w=1600&auto=format&fit=crop", 54000, "Facing the Prophet’s Mosque.", 24.46735, 39.61115, "King Fahd Rd, Al Haram, Madinah 42311, Saudi Arabia"],
];

const ziyarat = [
  ["imam-ali", "Imam Ali shrine", "حرم امام علی", "Najaf", "Iraq", "/images/stay-walled-city.png", 0, "The heart of Najaf. Walking plan with a local companion.", "Half day"],
  ["imam-hussain", "Imam Hussain & Abbas", "کربلا", "Karbala", "Iraq", "/images/dest-lahore.png", 0, "Between the two harams. Timed around prayer.", "Full day"],
  ["kadhimiya", "Kadhimiya", "کاظمین", "Baghdad", "Iraq", "/images/stay-canal-breeze.png", 4500, "Kazimayn, then return to your hotel.", "Half day"],
  ["imam-reza", "Imam Reza shrine", "حرم امام رضا", "Mashhad", "Iran", "/images/stay-apricot-court.png", 0, "Stay near the haram. Walking, not a checklist.", "Open"],
  ["fatima-masumeh", "Hazrat Masumeh", "قم", "Qom", "Iran", "/images/stay-orchard.png", 0, "Qom haram and the lanes around it.", "Half day"],
  ["haram-makkah", "Masjid al-Haram", "الحرم المكي", "Makkah", "Saudi Arabia", "/images/dest-hunza.png", 0, "Hotel-to-haram walking times and prayer windows.", "Open"],
  ["rawdah", "Masjid an-Nabawi", "المسجد النبوي", "Madinah", "Saudi Arabia", "/images/dest-skardu.png", 0, "Rawdah slot guidance with your dates.", "Open"],
];

const taxis = [
  {
    slug: "najaf-hiace",
    name: "Najaf → Kufa",
    nastaliq: "نجف → کوفہ",
    city: "Najaf",
    region: "Iraq",
    cover: "/images/stay-truck-art.png",
    price: 3500,
    description: "Shared HiAce from your Najaf hotel to Kufa. Stops are timed around ziyarat, not a sightseeing loop.",
    extra: {
      country: "IQ",
      driver: "Hajj Kazim al-Najafi",
      vehicle: "Toyota HiAce",
      model: "2021 · 14-seater",
      seats: 14,
      vacant: 6,
      origin: "Najaf",
      destination: "Kufa",
      hours: "Half day",
      privateRate: 42000,
      routeCities: ["Najaf", "Kufa"],
      itinerary: [
        { time: "07:30", place: "Hotel pickup, Najaf", note: "Driver waits at reception" },
        { time: "08:15", place: "Masjid al-Kufa", note: "Main courtyard and ziyarat" },
        { time: "09:45", place: "Muslim ibn Aqeel", note: "Adjacent shrine" },
        { time: "10:30", place: "Hannana / Bayt Ali", note: "Short stop" },
        { time: "12:00", place: "Return to Najaf hotel", note: "Drop at the same hotel" },
      ],
    },
  },
  {
    slug: "karbala-coaster",
    name: "Karbala → Kufa",
    nastaliq: "کربلا → کوفہ",
    city: "Karbala",
    region: "Iraq",
    cover: "/images/exp-passu.png",
    price: 4500,
    description: "Coaster from Karbala hotels to Kufa and back. Shared per person, or book the whole coach.",
    extra: {
      country: "IQ",
      driver: "Abu Ali Hussain",
      vehicle: "Toyota Coaster",
      model: "2019 · 23-seater",
      seats: 23,
      vacant: 11,
      origin: "Karbala",
      destination: "Kufa",
      hours: "Full day",
      privateRate: 85000,
      routeCities: ["Karbala", "Kufa"],
      itinerary: [
        { time: "07:00", place: "Hotel pickup, Karbala", note: "Between the two harams or your hotel" },
        { time: "08:40", place: "Masjid al-Kufa", note: "Ziyarat window" },
        { time: "10:15", place: "Muslim ibn Aqeel", note: "Included in the same visit" },
        { time: "11:30", place: "Lunch stop, Kufa", note: "Optional, own expense" },
        { time: "14:00", place: "Return to Karbala hotel", note: "Same drop point" },
      ],
    },
  },
  {
    slug: "karbala-baghdad-hiace",
    name: "Karbala → Baghdad",
    nastaliq: "کربلا → بغداد",
    city: "Karbala",
    region: "Iraq",
    cover: "/images/stay-canal-breeze.png",
    price: 5500,
    description: "Private or shared transfer from your Karbala hotel to Baghdad. Overnight in Baghdad if you book a hotel there.",
    extra: {
      country: "IQ",
      driver: "Abu Ali Hussain",
      vehicle: "Toyota HiAce",
      model: "2021 · 14-seater",
      seats: 14,
      vacant: 6,
      origin: "Karbala",
      destination: "Baghdad",
      hours: "Transfer",
      privateRate: 72000,
      routeCities: ["Karbala", "Baghdad"],
      itinerary: [
        { time: "08:00", place: "Hotel pickup, Karbala", note: "Between the two harams or your hotel" },
        { time: "11:00", place: "Baghdad", note: "Drop at your next hotel if you book one, or a central point" },
      ],
    },
  },
  {
    slug: "najaf-karbala-hiace",
    name: "Najaf → Karbala",
    nastaliq: "نجف → کربلا",
    city: "Najaf",
    region: "Iraq",
    cover: "/images/dest-lahore.png",
    price: 5000,
    description: "Hotel-to-hotel run to Imam Hussain and Al-Abbas. Shared seat or private van.",
    extra: {
      country: "IQ",
      driver: "Hajj Kazim al-Najafi",
      vehicle: "Toyota HiAce",
      model: "2021 · 14-seater",
      seats: 14,
      vacant: 8,
      origin: "Najaf",
      destination: "Karbala",
      hours: "Full day",
      privateRate: 55000,
      routeCities: ["Najaf", "Karbala"],
      itinerary: [
        { time: "07:00", place: "Hotel pickup, Najaf", note: "After Fajr window" },
        { time: "08:30", place: "Imam Hussain shrine", note: "Time inside the haram" },
        { time: "11:00", place: "Al-Abbas shrine", note: "Walk between the two harams" },
        { time: "15:30", place: "Return to Najaf hotel", note: "Same hotel drop" },
      ],
    },
  },
  {
    slug: "baghdad-innova",
    name: "Baghdad → Kadhimiya & Samarra",
    nastaliq: "بغداد → کاظمین",
    city: "Baghdad",
    region: "Iraq",
    cover: "/images/stay-canal-breeze.png",
    price: 6000,
    description: "Kazimayn in the morning, Samarra if the road is open. Per person or private Innova.",
    extra: {
      country: "IQ",
      driver: "Umm Salam family desk",
      vehicle: "Toyota Innova",
      model: "2022 · 7-seater",
      seats: 7,
      vacant: 3,
      origin: "Baghdad",
      destination: "Samarra",
      hours: "Full day",
      privateRate: 48000,
      routeCities: ["Baghdad", "Kadhimiya", "Samarra"],
      itinerary: [
        { time: "07:00", place: "Hotel pickup, Baghdad", note: "" },
        { time: "07:45", place: "Kadhimiya (Kazimayn)", note: "Morning ziyarat" },
        { time: "11:00", place: "Road to Samarra", note: "If the route is open that day" },
        { time: "12:30", place: "Askari shrine, Samarra", note: "Time on site" },
        { time: "17:00", place: "Return to Baghdad hotel", note: "" },
      ],
    },
  },
  {
    slug: "mashhad-van",
    name: "Mashhad → Qom",
    nastaliq: "مشهد → قم",
    city: "Mashhad",
    region: "Iran",
    cover: "/images/stay-apricot-court.png",
    price: 8000,
    description: "H1 between Mashhad hotels and Qom. Shared per person or private van.",
    extra: {
      country: "IR",
      driver: "Agha Reza",
      vehicle: "Hyundai H1",
      model: "2020 · 7-seater",
      seats: 7,
      vacant: 4,
      origin: "Mashhad",
      destination: "Qom",
      hours: "Full day",
      privateRate: 52000,
      routeCities: ["Mashhad", "Qom"],
      itinerary: [
        { time: "06:30", place: "Hotel pickup, Mashhad", note: "" },
        { time: "14:00", place: "Hazrat Masumeh, Qom", note: "Haram ziyarat" },
        { time: "18:00", place: "Return toward Mashhad", note: "Or overnight drop in Qom if you book a hotel there" },
      ],
    },
  },
  {
    slug: "makkah-gmc",
    name: "Makkah → Madinah",
    nastaliq: "مكة → المدينة",
    city: "Makkah",
    region: "Saudi Arabia",
    cover: "/images/dest-hunza.png",
    price: 12000,
    description: "Haramain road in a Yukon. Per person on a shared seat, or the whole vehicle.",
    extra: {
      country: "SA",
      driver: "Abu Abdullah",
      vehicle: "GMC Yukon",
      model: "2023 · 7-seater",
      seats: 7,
      vacant: 2,
      origin: "Makkah",
      destination: "Madinah",
      hours: "Full day",
      privateRate: 78000,
      routeCities: ["Makkah", "Madinah"],
      itinerary: [
        { time: "07:00", place: "Hotel pickup, Makkah", note: "Ajyad / Haram hotels" },
        { time: "12:00", place: "Masjid an-Nabawi", note: "Drop near the mosque" },
        { time: "18:00", place: "Optional return to Makkah", note: "If you are not staying in Madinah" },
      ],
    },
  },
  {
    slug: "njf-najaf-hotel",
    name: "Najaf Airport → Hotel",
    nastaliq: "مطار النجف",
    city: "Najaf",
    region: "Iraq",
    cover: "/images/stay-truck-art.png",
    price: 2500,
    description: "Named driver at NJF arrivals. Drop at your Najaf hotel reception.",
    extra: {
      country: "IQ",
      service: "airport",
      driver: "Hajj Kazim al-Najafi",
      vehicle: "Toyota HiAce",
      model: "2021 · 14-seater",
      seats: 14,
      vacant: 8,
      origin: "Najaf Airport (NJF)",
      destination: "Najaf",
      hours: "On arrival",
      privateRate: 28000,
      routeCities: ["Najaf Airport (NJF)", "Najaf"],
      itinerary: [
        { time: "Landing", place: "Najaf Airport (NJF) arrivals", note: "Driver waits with your name" },
        { time: "+40 min", place: "Your Najaf hotel", note: "Drop at reception" },
      ],
    },
  },
  {
    slug: "njf-karbala-hotel",
    name: "Najaf Airport → Karbala hotel",
    nastaliq: "مطار النجف → كربلاء",
    city: "Karbala",
    region: "Iraq",
    cover: "/images/exp-passu.png",
    price: 3500,
    description: "NJF to Karbala hotels. Named driver, shared or private coaster.",
    extra: {
      country: "IQ",
      service: "airport",
      driver: "Abu Ali Hussain",
      vehicle: "Toyota Coaster",
      model: "2019 · 23-seater",
      seats: 23,
      vacant: 12,
      origin: "Najaf Airport (NJF)",
      destination: "Karbala",
      hours: "On arrival",
      privateRate: 62000,
      routeCities: ["Najaf Airport (NJF)", "Karbala"],
      itinerary: [
        { time: "Landing", place: "Najaf Airport (NJF) arrivals", note: "Driver waits with your name" },
        { time: "+90 min", place: "Your Karbala hotel", note: "Drop between the two harams or at reception" },
      ],
    },
  },
  {
    slug: "bgw-baghdad-hotel",
    name: "Baghdad Airport → Hotel",
    nastaliq: "مطار بغداد",
    city: "Baghdad",
    region: "Iraq",
    cover: "/images/stay-canal-breeze.png",
    price: 3200,
    description: "BGW arrivals to your Baghdad hotel. Named driver, shared or private.",
    extra: {
      country: "IQ",
      service: "airport",
      driver: "Umm Salam family desk",
      vehicle: "Toyota Innova",
      model: "2022 · 7-seater",
      seats: 7,
      vacant: 4,
      origin: "Baghdad Airport (BGW)",
      destination: "Baghdad",
      hours: "On arrival",
      privateRate: 38000,
      routeCities: ["Baghdad Airport (BGW)", "Baghdad"],
      itinerary: [
        { time: "Landing", place: "Baghdad Airport (BGW) arrivals", note: "Driver waits with your name" },
        { time: "+45 min", place: "Your Baghdad hotel", note: "Drop at reception" },
      ],
    },
  },
  {
    slug: "mhd-mashhad-hotel",
    name: "Mashhad Airport → Hotel",
    nastaliq: "فرودگاه مشهد",
    city: "Mashhad",
    region: "Iran",
    cover: "/images/stay-apricot-court.png",
    price: 3000,
    description: "MHD arrivals to your Mashhad hotel. Named driver.",
    extra: {
      country: "IR",
      service: "airport",
      driver: "Agha Reza",
      vehicle: "Hyundai H1",
      model: "2020 · 7-seater",
      seats: 7,
      vacant: 4,
      origin: "Mashhad Airport (MHD)",
      destination: "Mashhad",
      hours: "On arrival",
      privateRate: 32000,
      routeCities: ["Mashhad Airport (MHD)", "Mashhad"],
      itinerary: [
        { time: "Landing", place: "Mashhad Airport (MHD)", note: "Name board at arrivals" },
        { time: "+35 min", place: "Your Mashhad hotel", note: "Drop at reception" },
      ],
    },
  },
  {
    slug: "jed-makkah-hotel",
    name: "Jeddah Airport → Makkah hotel",
    nastaliq: "جدة → مكة",
    city: "Makkah",
    region: "Saudi Arabia",
    cover: "/images/dest-hunza.png",
    price: 4500,
    description: "JED to Makkah hotels. Named driver, shared or private.",
    extra: {
      country: "SA",
      service: "airport",
      driver: "Abu Abdullah",
      vehicle: "GMC Yukon",
      model: "2023 · 7-seater",
      seats: 7,
      vacant: 3,
      origin: "Jeddah Airport (JED)",
      destination: "Makkah",
      hours: "On arrival",
      privateRate: 55000,
      routeCities: ["Jeddah Airport (JED)", "Makkah"],
      itinerary: [
        { time: "Landing", place: "Jeddah Airport (JED)", note: "Driver at arrivals" },
        { time: "+75 min", place: "Your Makkah hotel", note: "Ajyad / Haram drop" },
      ],
    },
  },
];

const countryCode = { Iraq: "IQ", Iran: "IR", "Saudi Arabia": "SA" };

async function upsertListing(data) {
  await prisma.listing.upsert({
    where: { slug: data.slug },
    update: data,
    create: data,
  });
}

async function main() {
  const hash = await bcrypt.hash(password, 10);
  const accounts = [
    ["guest@serai.pk", "Ayesha Guest", "TRAVELER", null],
    ["admin@serai.pk", "Serai Admin", "ADMIN", null],
    ["stay.owner@serai.pk", "Saba Stay", "OWNER", "STAY"],
    ["attraction.owner@serai.pk", "Farid Sites", "OWNER", "ATTRACTION"],
    ["taxi.owner@serai.pk", "Omar Roads", "OWNER", "TAXI"],
    ["dine.owner@serai.pk", "Leila Table", "OWNER", "RESTAURANT"],
  ];
  for (const [email, name, role, ownerKind] of accounts) {
    await prisma.user.upsert({
      where: { email },
      update: { name, role, ownerKind, passwordHash: hash },
      create: { email, name, role, ownerKind, passwordHash: hash },
    });
  }

  const stayOwner = await prisma.user.findUniqueOrThrow({ where: { email: "stay.owner@serai.pk" } });
  for (const [slug, name, nastaliq, city, region, cover, price, description, lat, lng, address] of stays) {
    await upsertListing({
      slug,
      name,
      nastaliq,
      city,
      region,
      cover,
      price,
      description,
      kind: "STAY",
      ownerId: stayOwner.id,
      priceUnit: "night",
      published: true,
      status: "approved",
      rejectReason: "",
      meta: JSON.stringify({
        country: countryCode[region],
        lat,
        lng,
        address,
        rooms: [{ id: "room-1", name: "Guest room", sleeps: 2, price, note: "Standard room" }],
      }),
    });
  }

  const ziyaratOwner = await prisma.user.findUniqueOrThrow({ where: { email: "attraction.owner@serai.pk" } });
  for (const [slug, name, nastaliq, city, region, cover, price, description, hours] of ziyarat) {
    await upsertListing({
      slug,
      name,
      nastaliq,
      city,
      region,
      cover,
      price,
      description,
      kind: "ATTRACTION",
      ownerId: ziyaratOwner.id,
      priceUnit: "person",
      published: true,
      status: "approved",
      rejectReason: "",
      meta: JSON.stringify({ country: countryCode[region], hours }),
    });
  }

  const taxiOwner = await prisma.user.findUniqueOrThrow({ where: { email: "taxi.owner@serai.pk" } });
  for (const row of taxis) {
    await upsertListing({
      slug: row.slug,
      name: row.name,
      nastaliq: row.nastaliq,
      city: row.city,
      region: row.region,
      cover: row.cover,
      price: row.price,
      description: row.description,
      kind: "TAXI",
      ownerId: taxiOwner.id,
      priceUnit: "person",
      published: true,
      status: "approved",
      rejectReason: "",
      meta: JSON.stringify(row.extra),
    });
  }

  await upsertListing({
    slug: "pending-najaf-van",
    kind: "TAXI",
    name: "Najaf van (awaiting approval)",
    nastaliq: "",
    city: "Najaf",
    region: "Iraq",
    cover: "/images/stay-truck-art.png",
    price: 15000,
    priceUnit: "day",
    description: "A new van listing waiting on the admin desk.",
    ownerId: taxiOwner.id,
    published: false,
    status: "pending",
    rejectReason: "",
    meta: JSON.stringify({ country: "IQ", driver: "New partner", vehicle: "Toyota HiAce", model: "2018 · 14-seater", seats: 14, vacant: 8, routeCities: ["Najaf", "Kufa"] }),
  });

  const guest = await prisma.user.findUniqueOrThrow({ where: { email: "guest@serai.pk" } });
  const najaf = await prisma.listing.findUnique({ where: { slug: "qasr-al-dur-najaf" } });
  const hiace = await prisma.listing.findUnique({ where: { slug: "najaf-hiace" } });
  const oldHaram = await prisma.listing.findUnique({ where: { slug: "najaf-haram-inn" } });
  if (oldHaram && najaf) {
    await prisma.booking.updateMany({
      where: { listingId: oldHaram.id },
      data: { listingId: najaf.id },
    });
  }
  if (najaf) {
    await prisma.booking.upsert({
      where: { id: "seed-booking-najaf" },
      update: {
        listingId: najaf.id,
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        total: 18500,
        status: "confirmed",
      },
      create: {
        id: "seed-booking-najaf",
        userId: guest.id,
        listingId: najaf.id,
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        guests: 2,
        payment: "property",
        total: 18500,
        status: "confirmed",
      },
    });
  }
  if (hiace) {
    await prisma.booking.upsert({
      where: { id: "seed-booking-hiace" },
      update: {
        listingId: hiace.id,
        startDate: "2026-09-15",
        endDate: "2026-09-17",
        total: 18500,
        status: "confirmed",
      },
      create: {
        id: "seed-booking-hiace",
        userId: guest.id,
        listingId: hiace.id,
        startDate: "2026-09-15",
        endDate: "2026-09-17",
        guests: 2,
        payment: "property",
        total: 18500,
        status: "confirmed",
      },
    });
  }

  console.log("Seeded HolyDays (Iraq, Iran, Saudi). Demo password: serai123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
