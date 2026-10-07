import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const RESEND_COOLDOWN_SECONDS = 45;
const MAX_WRONG_CODES = 5;
const WINDOW_MS = 10 * 60 * 1000;

/** Demo codes and links are only handed back to the browser outside production, so nobody can "verify" a number or inbox they don't own. */
export const showDemoCodes = () => process.env.NODE_ENV !== "production";

/** Seconds the user must still wait before another code or link of this type can be sent. */
export async function cooldownLeft(userId: string, type: string) {
  const row = await prisma.authToken.findFirst({ where: { userId, type }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (!row) return 0;
  const left = RESEND_COOLDOWN_SECONDS - (Date.now() - row.createdAt.getTime()) / 1000;
  return left > 0 ? Math.ceil(left) : 0;
}

export async function tooManyWrongCodes(userId: string) {
  const n = await prisma.authToken.count({ where: { userId, type: "phone_otp_try", createdAt: { gt: new Date(Date.now() - WINDOW_MS) } } });
  return n >= MAX_WRONG_CODES;
}

export async function recordWrongCode(userId: string) {
  await prisma.authToken.create({
    data: { userId, type: "phone_otp_try", token: randomBytes(8).toString("hex"), expiresAt: new Date(Date.now() + WINDOW_MS) },
  });
}

/** True when `code` is this user's live phone code. The code is used up on success; other users' codes are never touched. */
export async function consumePhoneCode(userId: string, code: string) {
  const row = await prisma.authToken.findFirst({ where: { userId, type: "phone_otp", token: code }, select: { id: true, expiresAt: true } });
  if (!row || row.expiresAt.getTime() < Date.now()) return false;
  await prisma.authToken.deleteMany({ where: { userId, type: { in: ["phone_otp", "phone_otp_try"] } } });
  return true;
}
