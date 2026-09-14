import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const slugs = ["coral-hotel-karbala","baron-hotel-karbala","le-reve-hotel-baghdad","aumary-hotel-residences-baghdad"];
for (const slug of slugs) {
  const row = await prisma.listing.findUnique({ where: { slug } });
  const meta = JSON.parse(row.meta);
  console.log("===", slug, "===");
  console.log("cover:", row.cover);
  console.log("galleries:", JSON.stringify(meta.galleries, null, 2));
}
await prisma.$disconnect();
