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
      id, name, email, image, role, passwordHash, googleId,
      emailVerified, phone, phoneVerified, nationality, residency, preferences
    FROM "user"
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function fetchAccountByEmail(email: string): Promise<AccountRow | null> {
  const rows = await prisma.$queryRaw<AccountRow[]>`
    SELECT
      id, name, email, image, role, passwordHash, googleId,
      emailVerified, phone, phoneVerified, nationality, residency, preferences
    FROM "user"
    WHERE email = ${email}
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
  const id = randomBytes(12).toString("hex");
  const expires = new Date(Date.now() + ttlMs).toISOString();
  await prisma.$executeRaw`DELETE FROM AuthToken WHERE userId = ${userId} AND type = ${type}`;
  await prisma.$executeRaw`
    INSERT INTO AuthToken (id, userId, type, token, expiresAt, createdAt)
    VALUES (${id}, ${userId}, ${type}, ${value}, ${expires}, CURRENT_TIMESTAMP)
  `;
  return value;
}

export async function consumeToken(type: string, token: string) {
  const rows = await prisma.$queryRaw<{ userId: string; expiresAt: Date | string }[]>`
    SELECT userId, expiresAt FROM AuthToken WHERE type = ${type} AND token = ${token} LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const exp = new Date(row.expiresAt).getTime();
  if (Number.isNaN(exp) || exp < Date.now()) return null;
  await prisma.$executeRaw`DELETE FROM AuthToken WHERE type = ${type} AND token = ${token}`;
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
