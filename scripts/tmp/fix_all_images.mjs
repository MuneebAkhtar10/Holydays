import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IMG = {
  extCourtyard: "https://images.unsplash.com/photo-1455587734955-081b22074882?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  extTower: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  twin: "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  king1: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  king2: "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  double1: "https://images.unsplash.com/photo-1591088398332-8a7791972843?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  double2: "https://images.unsplash.com/photo-1444201983204-c43cbd584d93?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  single: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  cityViewRoom: "https://images.unsplash.com/photo-1519449556851-5720b33024e7?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  suite: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  living1: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  living2: "https://images.unsplash.com/photo-1554995207-c18c203602cb?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  apt: "https://images.unsplash.com/photo-1618221469555-7f3ad97540d6?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  bath1: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  bath2: "https://images.unsplash.com/photo-1620626011761-996317b8d101?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  bath3: "https://images.unsplash.com/photo-1560448075-bb485b067938?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?fm=jpg&q=80&w=1600&auto=format&fit=crop",
};

function flatten(g) {
  return [...g.property, ...g.room, ...g.bathroom, ...g.facilities].filter(Boolean);
}

async function apply(slug, { cover, galleries, roomImages }) {
  const row = await prisma.listing.findUnique({ where: { slug } });
  if (!row) return console.log("missing", slug);
  const meta = JSON.parse(row.meta);
  meta.galleries = galleries;
  meta.gallery = flatten(galleries);
  meta.rooms = meta.rooms.map((r) => ({ ...r, images: roomImages[r.id] ? [roomImages[r.id]] : [] }));
  await prisma.listing.update({
    where: { slug },
    data: { cover, meta: JSON.stringify(meta) },
  });
  console.log("fixed", slug);
}

async function main() {
  await apply("coral-hotel-karbala", {
    cover: IMG.extCourtyard,
    galleries: {
      property: [IMG.extCourtyard, IMG.suite],
      room: [IMG.twin, IMG.double1, IMG.single],
      bathroom: [IMG.bath1],
      facilities: [IMG.restaurant],
    },
    roomImages: {
      "room-1": IMG.twin,
      "room-2": IMG.single,
      "room-3": IMG.double1,
      "room-4": IMG.double2,
      "room-5": IMG.suite,
    },
  });

  await apply("baron-hotel-karbala", {
    cover: IMG.extTower,
    galleries: {
      property: [IMG.extTower, IMG.suite, IMG.living1],
      room: [IMG.king2, IMG.cityViewRoom],
      bathroom: [IMG.bath2],
      facilities: [IMG.restaurant],
    },
    roomImages: {
      "room-1": IMG.twin,
      "room-2": IMG.king1,
      "room-3": IMG.cityViewRoom,
      "room-4": IMG.king2,
      "room-5": IMG.suite,
      "room-6": IMG.living1,
    },
  });

  await apply("le-reve-hotel-baghdad", {
    cover: IMG.extCourtyard,
    galleries: {
      property: [IMG.extCourtyard, IMG.living2],
      room: [IMG.double1, IMG.double2],
      bathroom: [IMG.bath3],
      facilities: [IMG.restaurant],
    },
    roomImages: {
      "room-1": IMG.double1,
    },
  });

  await apply("aumary-hotel-residences-baghdad", {
    cover: IMG.extTower,
    galleries: {
      property: [IMG.extTower, IMG.apt],
      room: [IMG.apt, IMG.living2],
      bathroom: [IMG.bath3],
      facilities: [IMG.restaurant],
    },
    roomImages: {
      "room-1": IMG.apt,
      "room-2": IMG.living2,
      "room-3": IMG.living1,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
