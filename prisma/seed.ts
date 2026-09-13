import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { attractions, ownerAccounts, pilgrimStays, restaurants, taxis } from "../lib/marketplace";
import { pilgrimCountryForPlace } from "../lib/pilgrim";

const prisma = new PrismaClient();
const password = "serai123";

const taxiMeta: Record<string, string> = {
  "najaf-hiace": JSON.stringify({ country: "IQ", driver: "Hajj Kazim al-Najafi", vehicle: "Toyota HiAce", model: "2021 · 14-seater", seats: 14, vacant: 6, routeCities: ["Najaf", "Kufa", "Karbala"] }),
  "karbala-coaster": JSON.stringify({ country: "IQ", driver: "Abu Ali Hussain", vehicle: "Toyota Coaster", model: "2019 · 23-seater", seats: 23, vacant: 11, routeCities: ["Karbala", "Najaf", "Baghdad"] }),
  "baghdad-innova": JSON.stringify({ country: "IQ", driver: "Umm Salam family desk", vehicle: "Toyota Innova", model: "2022 · 7-seater", seats: 7, vacant: 3, routeCities: ["Baghdad", "Kadhimiya", "Samarra"] }),
  "mashhad-van": JSON.stringify({ country: "IR", driver: "Agha Reza", vehicle: "Hyundai H1", model: "2020 · 7-seater", seats: 7, vacant: 4, routeCities: ["Mashhad", "Qom", "Tehran"] }),
  "makkah-gmc": JSON.stringify({ country: "SA", driver: "Abu Abdullah", vehicle: "GMC Yukon", model: "2023 · 7-seater", seats: 7, vacant: 2, routeCities: ["Makkah", "Jeddah", "Madinah"] }),
};

const ziyaratHours: Record<string, string> = {
  "imam-ali": "Half day",
  "imam-hussain": "Full day",
  kadhimiya: "Half day",
  "imam-reza": "Open",
  "fatima-masumeh": "Half day",
  "haram-makkah": "Open",
  rawdah: "Open",
};

async function upsertListing(item: (typeof pilgrimStays)[number], ownerId: string, extraMeta: Record<string, unknown> = {}) {
  const country = pilgrimCountryForPlace(item.city, item.region) ?? "IQ";
  const meta = JSON.stringify({ country, hours: ziyaratHours[item.slug] ?? "", ...extraMeta });
  await prisma.listing.upsert({
    where: { slug: item.slug },
    update: {
      name: item.name,
      nastaliq: item.nastaliq,
      city: item.city,
      region: item.region,
      cover: item.cover,
      description: item.description,
      price: item.price,
      priceUnit: item.priceUnit,
      kind: item.kind,
      ownerId,
      published: true,
      meta,
    },
    create: {
      slug: item.slug,
      kind: item.kind,
      ownerId,
      name: item.name,
      nastaliq: item.nastaliq,
      city: item.city,
      region: item.region,
      cover: item.cover,
      description: item.description,
      price: item.price,
      priceUnit: item.priceUnit,
      published: true,
      meta,
    },
  });
  await prisma.$executeRaw`
    UPDATE Listing SET status = 'approved', rejectReason = '', published = 1, updatedAt = CURRENT_TIMESTAMP WHERE slug = ${item.slug}
  `;
}

async function main() {
  const hash = await bcrypt.hash(password, 10);

  for (const a of ownerAccounts) {
    await prisma.user.upsert({
      where: { email: a.email },
      update: { name: a.name, role: a.role, ownerKind: a.ownerKind, passwordHash: hash, emailVerified: new Date() },
      create: { email: a.email, name: a.name, role: a.role, ownerKind: a.ownerKind, passwordHash: hash, emailVerified: new Date() },
    });
  }

  for (const s of pilgrimStays) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: s.ownerEmail } });
    await upsertListing(s, owner.id);
  }

  for (const item of attractions) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: item.ownerEmail } });
    await upsertListing(item, owner.id, { hours: ziyaratHours[item.slug] ?? "Half day" });
  }

  for (const item of taxis) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: item.ownerEmail } });
    const extra = taxiMeta[item.slug] ? (JSON.parse(taxiMeta[item.slug]) as Record<string, unknown>) : {};
    await upsertListing(item, owner.id, extra);
  }

  for (const item of restaurants) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: item.ownerEmail } });
    await upsertListing(item, owner.id);
  }

  console.log("Seeded Serai (Saudi, Iraq, Iran). Demo password: serai123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
