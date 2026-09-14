import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const row = await prisma.listing.findUnique({ where: { slug: "aumary-hotel-residences-baghdad" } });
const meta = JSON.parse(row.meta);
console.log(JSON.stringify(meta.guestReviews, null, 2));
await prisma.$disconnect();
