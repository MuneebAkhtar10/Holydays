import { PrismaClient } from "@prisma/client";

const CLIENT_GEN = 4;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaGen?: number;
};

function makeClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

if (globalForPrisma.prisma && globalForPrisma.prismaGen !== CLIENT_GEN) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaGen = CLIENT_GEN;
}
