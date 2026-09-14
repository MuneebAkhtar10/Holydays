import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const aumaryGalleries = {
  property: ["867745781", "874012519", "867742508", "867743258", "873610118"].map((id) => `/uploads/aumary/${id}.jpg`),
  room: ["861771994", "861772042", "861771977", "867746449", "861771883", "861771948", "861772028", "861771740"].map(
    (id) => `/uploads/aumary/${id}.jpg`,
  ),
  bathroom: ["861771876", "861771832", "861771911", "861771843"].map((id) => `/uploads/aumary/${id}.jpg`),
  facilities: ["868201008", "865289273", "865292684", "868212443", "868226245", "874009304"].map(
    (id) => `/uploads/aumary/${id}.jpg`,
  ),
};

const lereveGalleries = {
  property: ["907894502", "907894684", "907894691"].map((id) => `/uploads/lereve/${id}.jpg`),
  room: ["907896361", "907894706", "907895887", "907895889", "907896354", "907894712"].map((id) => `/uploads/lereve/${id}.jpg`),
  bathroom: ["907894697", "907894725", "907894729", "907894733"].map((id) => `/uploads/lereve/${id}.jpg`),
  facilities: ["907896394", "907698605", "907895883", "907895884", "907895886"].map((id) => `/uploads/lereve/${id}.jpg`),
};

const aumaryReviews = [
  {
    name: "Duraid, United Kingdom",
    rating: 10,
    createdAt: "2026-08-20T12:00:00.000Z",
    body: "The location is central in Almansour district very close to Abu Jaafar Almansour monument. The modern apartment design with all appliances rather than the bedroom design was amazing.",
  },
  {
    name: "Marah, United Kingdom",
    rating: 10,
    createdAt: "2026-08-18T12:00:00.000Z",
    body: "Everything, from reception staff to the modern clean comfortable building / apartment, to the generous portions of breakfast and dinner, amazing drinks.",
  },
  {
    name: "Samer, Turkey",
    rating: 9,
    createdAt: "2026-08-12T12:00:00.000Z",
    body: "The rooms were large and the breakfast was great too. The location is central and markets and restaurants and a mall are in walking distance.",
  },
  {
    name: "Marah, United Kingdom",
    rating: 10,
    createdAt: "2026-08-10T12:00:00.000Z",
    body: "It's an amazing place, modern and new building and furniture, high quality in everything, towels, toiletries, and the roof restaurant on the 8th floor, generous breakfast.",
  },
  {
    name: "Namir, United Kingdom",
    rating: 10,
    createdAt: "2026-08-15T12:00:00.000Z",
    body: "Very spacious, modern, clean. The A/C and WiFi is excellent. The staff and service was impeccable.",
  },
  {
    name: "Bashar, Sweden",
    rating: 10,
    createdAt: "2026-08-08T12:00:00.000Z",
    body: "Perfect location, very central in Al Mansour. Great personnel. The building is brand new and clean with free parking. The apartment is spacious, fully equipped and comfortable. We slept very well during our stay. I highly recommend it!",
  },
  {
    name: "Hussain, Australia",
    rating: 10,
    createdAt: "2026-07-30T12:00:00.000Z",
    body: "I liked everything. It was a very lovely, nice and clean apartment that me and my family enjoyed so much. The service was the best.",
  },
  {
    name: "Abdulrahman, Iraq",
    rating: 9,
    createdAt: "2026-07-22T12:00:00.000Z",
    body: "The hotel is in a very excellent place, close to shopping centers and markets. You just have to walk maybe 10 minutes to get to it.",
  },
  {
    name: "Mushreq, United States",
    rating: 10,
    createdAt: "2026-07-14T12:00:00.000Z",
    body: "Excellent hotel with a beautiful modern design. The room was clean, comfortable, and spacious, and the staff were very friendly and helpful. The location was convenient, and the overall atmosphere was excellent.",
  },
  {
    name: "Ali, Norway",
    rating: 10,
    createdAt: "2026-08-02T12:00:00.000Z",
    body: "بصراحة تجربة جميلة ورائعة جدا والفندق والشقق جديدة ومميزة وجميلة ونظيفة جدا والموقع جميل ورائع في منطقة المنصور في قلب بغداد الحبيبة وقريب على كل شيء. احب اشكر جميع الموظفين في هذا المكان المميز والجميل على حسن الاستقبال والتعامل.",
  },
];

const lereveReviews = [
  {
    name: "Hassan, Malaysia",
    rating: 10,
    createdAt: "2026-08-16T12:00:00.000Z",
    body: "The Host Abdullah is an amazing and well mannered man. He knows how to entertain customers.",
  },
  {
    name: "Loay, Sweden",
    rating: 9,
    createdAt: "2026-08-11T12:00:00.000Z",
    body: "Allt var bra, tyst, städat väl, nya rum och viktigaste är trevliga personal.",
  },
  {
    name: "Yousif, United Arab Emirates",
    rating: 8,
    createdAt: "2026-08-05T12:00:00.000Z",
    body: "المكان جديد وجميل ونظيف والموظفين محترمين لكن صادفت انه في اعمال وتعديلات ما اخذت راحتنا في نوم الصباح للاسف.",
  },
  {
    name: "Omran, Iraq",
    rating: 9,
    createdAt: "2026-07-28T12:00:00.000Z",
    body: "Clean, big and a comfortable suite. Nice staff, nice kitchen and a beautiful living room. The furniture was very good.",
  },
  {
    name: "Omar, Iraq",
    rating: 9,
    createdAt: "2026-07-21T12:00:00.000Z",
    body: "Very wonderful place, clean, new, and very affordable.",
  },
  {
    name: "Kashani, Netherlands",
    rating: 9,
    createdAt: "2026-07-12T12:00:00.000Z",
    body: "The hotel is very new. We had a big and modern suite with a good price. Thanks to Yanna. He was very helpful.",
  },
  {
    name: "Mustafa, Iraq",
    rating: 9,
    createdAt: "2026-07-04T12:00:00.000Z",
    body: "The hotel apartments are new. Facilities are really cool and of high quality. The hotel location is also excellent. The staff is so friendly and supportive.",
  },
];

const hotels = [
  {
    slug: "aumary-hotel-residences-baghdad",
    cover: "/uploads/aumary/867745781.jpg",
    galleries: aumaryGalleries,
    externalRating: { source: "Booking.com", score: 9.5, count: 62 },
    guestReviews: aumaryReviews,
  },
  {
    slug: "le-reve-hotel-baghdad",
    cover: "/uploads/lereve/907894502.jpg",
    galleries: lereveGalleries,
    externalRating: { source: "Booking.com", score: 8.8, count: 24 },
    guestReviews: lereveReviews,
  },
];

for (const hotel of hotels) {
  const row = await prisma.listing.findUnique({ where: { slug: hotel.slug } });
  if (!row) {
    console.log("MISSING", hotel.slug);
    continue;
  }
  const meta = JSON.parse(row.meta || "{}");
  const gallery = [...hotel.galleries.property, ...hotel.galleries.room, ...hotel.galleries.bathroom, ...hotel.galleries.facilities];
  meta.galleries = hotel.galleries;
  meta.gallery = gallery;
  meta.externalRating = hotel.externalRating;
  meta.guestReviews = hotel.guestReviews;
  await prisma.listing.update({
    where: { id: row.id },
    data: { cover: hotel.cover, meta: JSON.stringify(meta) },
  });
  console.log("updated", hotel.slug, "photos", gallery.length, "reviews", hotel.guestReviews.length);
}

await prisma.$disconnect();
