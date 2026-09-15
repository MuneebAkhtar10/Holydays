import { randomBytes, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  passwordHash: string | null;
  googleId: string | null;
  emailVerified: Date | string | null;
  phone: string | null;
  phoneVerified: Date | string | null;
  nationality: string | null;
  residency: string | null;
  preferences: string | null;
};

export async function fetchAccount(id: string): Promise<AccountRow | null> {
  const rows = await prisma.$queryRaw<AccountRow[]>`
    SELECT
      id, name, email, image, role, passwordHash AS "passwordHash", googleId AS "googleId",
      emailVerified AS "emailVerified", phone, phoneVerified AS "phoneVerified", nationality, residency, preferences
    FROM "user"
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function fetchAccountByEmail(email: string): Promise<AccountRow | null> {
  const normalized = email.toLowerCase().trim();
  const rows = await prisma.$queryRaw<AccountRow[]>`
    SELECT
      id, name, email, image, role, passwordHash AS "passwordHash", googleId AS "googleId",
      emailVerified AS "emailVerified", phone, phoneVerified AS "phoneVerified", nationality, residency, preferences
    FROM "user"
    WHERE lower(email) = ${normalized}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updateAccount(
  id: string,
  data: {
    name: string;
    email: string;
    image: string | null;
    nationality: string;
    residency: string;
    preferences: string;
    emailVerified: Date | string | null;
  },
) {
  await prisma.$executeRaw`
    UPDATE "user"
    SET name = ${data.name},
        email = ${data.email},
        image = ${data.image},
        nationality = ${data.nationality},
        residency = ${data.residency},
        preferences = ${data.preferences},
        emailVerified = ${data.emailVerified}
    WHERE id = ${id}
  `;
}

export async function setUserPhone(id: string, phone: string) {
  await prisma.$executeRaw`
    UPDATE "user" SET phone = ${phone}, phoneVerified = NULL WHERE id = ${id}
  `;
}

export async function markEmailVerified(id: string) {
  await prisma.$executeRaw`UPDATE "user" SET emailVerified = CURRENT_TIMESTAMP WHERE id = ${id}`;
}

export async function markPhoneVerified(id: string) {
  await prisma.$executeRaw`UPDATE "user" SET phoneVerified = CURRENT_TIMESTAMP WHERE id = ${id}`;
}

export async function setPasswordHash(id: string, hash: string) {
  await prisma.$executeRaw`UPDATE "user" SET passwordHash = ${hash} WHERE id = ${id}`;
}

export async function deleteAccount(id: string) {
  await prisma.$executeRaw`DELETE FROM "user" WHERE id = ${id}`;
}

export async function issueToken(userId: string, type: string, ttlMs: number, token?: string) {
  const value = token ?? randomBytes(24).toString("hex");
  await prisma.authToken.deleteMany({ where: { userId, type } });
  await prisma.authToken.create({
    data: {
      userId,
      type,
      token: value,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return value;
}

export async function consumeToken(type: string, token: string) {
  const row = await prisma.authToken.findFirst({
    where: { type, token },
    select: { userId: true, expiresAt: true },
  });
  if (!row) return null;
  const exp = new Date(row.expiresAt).getTime();
  if (Number.isNaN(exp) || exp < Date.now()) return null;
  await prisma.authToken.deleteMany({ where: { type, token } });
  return fetchAccount(row.userId);
}

export function sixDigitOtp() {
  return String(randomInt(100000, 1000000));
}

export function publicOrigin() {
  return process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
}

export function normalizePhone(raw: string) {
  const compact = raw.replace(/[^\d+]/g, "");
  if (/^03\d{9}$/.test(compact)) return compact;
  if (/^\+923\d{9}$/.test(compact)) return compact;
  if (/^923\d{9}$/.test(compact)) return `+${compact}`;
  if (/^\+\d{10,15}$/.test(compact)) return compact;
  return "";
}
