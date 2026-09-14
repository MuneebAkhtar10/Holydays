import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const slugs = ["coral-hotel-karbala","baron-hotel-karbala","le-reve-hotel-baghdad","aumary-hotel-residences-baghdad"];
for (const slug of slugs) {
  const row = await prisma.listing.findUnique({ where: { slug } });
  const meta = JSON.parse(row.meta);
  console.log(slug, JSON.stringify(meta.rooms.map(r => ({id:r.id, name:r.name, sleeps:r.sleeps, note:r.note})), null, 2));
}
await prisma.$disconnect();
