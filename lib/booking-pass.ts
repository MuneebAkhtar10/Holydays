import { createHmac, timingSafeEqual } from "crypto";

/**
 * A booking pass is a QR the guest shows at the door. The code holds a signed link, not booking data,
 * so nothing private travels in the image and the link cannot be guessed or edited into someone
 * else's booking — the signature is checked before anything is loaded.
 */
const VERSION = "1";

function secret() {
  const key = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || "";
  if (!key) throw new Error("NEXTAUTH_SECRET is not set, so booking passes cannot be signed.");
  return key;
}

function sign(bookingId: string) {
  return createHmac("sha256", secret()).update(`${VERSION}:${bookingId}`).digest("base64url").slice(0, 32);
}

/** The token that goes in the QR: the booking id plus a signature over it. */
export function passToken(bookingId: string) {
  return `${bookingId}.${sign(bookingId)}`;
}

/** The booking id a scanned token refers to, or null when the signature does not match. */
export function readPassToken(token: string): string | null {
  const raw = String(token ?? "");
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const bookingId = raw.slice(0, dot);
  const given = raw.slice(dot + 1);
  let expected: string;
  try {
    expected = sign(bookingId);
  } catch {
    return null;
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return bookingId;
}

export function passUrl(origin: string, bookingId: string) {
  return `${origin.replace(/\/$/, "")}/pass/${passToken(bookingId)}`;
}

/** PNG data URL for the booking's pass, sized for a screen or a printed page. */
export async function passQrDataUrl(url: string, width = 320) {
  const { toDataURL } = await import("qrcode");
  return toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width,
    color: { dark: "#0b1c34", light: "#ffffff" },
  });
}

/** Raw PNG bytes for the pass, for embedding in the PDF documents. */
export async function passQrPng(url: string, width = 420) {
  const { toBuffer } = await import("qrcode");
  return toBuffer(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width,
    type: "png",
    color: { dark: "#0b1c34", light: "#ffffff" },
  });
}
