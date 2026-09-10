import { formatDay, formatPKR, todayIso } from "@/lib/format";
import { parseListingMeta } from "@/lib/listing-meta";

export type BookingBucket = "upcoming" | "current" | "completed" | "cancelled";

export function bookingNumber(id: string) {
  const compact = id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase() || "000000";
  return `HD-${compact.padStart(6, "0")}`;
}

export function bookingBucket(row: { status: string; startDate: string; endDate: string }): BookingBucket {
  if (row.status === "cancelled") return "cancelled";
  const today = todayIso();
  if (row.startDate <= today && row.endDate >= today) return "current";
  if (row.endDate < today) return "completed";
  return "upcoming";
}

export function parseBookingExtras(raw: string | Record<string, unknown> | null | undefined) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return { ...raw };
  const text = String(raw ?? "");
  try {
    const obj = JSON.parse(text || "{}");
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
  } catch {
    /* comma-separated experience ids */
  }
  return { extras: text ? text.split(",").filter(Boolean) : [] };
}

export type BookingMessage = {
  at: string;
  message: string;
  from: "guest" | "owner";
};

export function asMessages(extra: Record<string, unknown>): BookingMessage[] {
  const raw = extra.assistance;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const message = String(item.message ?? "").trim();
      if (!message) return null;
      return {
        at: String(item.at ?? ""),
        message,
        from: item.from === "owner" ? ("owner" as const) : ("guest" as const),
      };
    })
    .filter((row): row is BookingMessage => Boolean(row));
}

export type ChatRead = { guest?: string; owner?: string };

export function chatReadOf(extra: Record<string, unknown>): ChatRead {
  const raw = extra.chatRead;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    guest: typeof o.guest === "string" ? o.guest : undefined,
    owner: typeof o.owner === "string" ? o.owner : undefined,
  };
}

function messageTime(at: string | undefined) {
  const t = Date.parse(at || "");
  return Number.isFinite(t) ? t : 0;
}

/** Unread incoming messages for one side. If they already sent the last line, the thread is caught up. */
export function unreadCount(messages: BookingMessage[], readAt: string | undefined, from: "guest" | "owner") {
  const last = messages[messages.length - 1];
  if (!last || last.from !== from) return 0;
  const cut = messageTime(readAt);
  if (cut > 0) {
    return messages.filter((m) => m.from === from && messageTime(m.at) > cut).length;
  }
  let n = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].from !== from) break;
    n += 1;
  }
  return n;
}

export function lastPreview(messages: BookingMessage[]) {
  const last = messages[messages.length - 1];
  if (!last) return "";
  return last.message.length > 72 ? `${last.message.slice(0, 72)}…` : last.message;
}

export function markChatRead(extra: Record<string, unknown>, who: "guest" | "owner") {
  const messages = asMessages(extra);
  const lastAt = messages.reduce((max, m) => Math.max(max, messageTime(m.at)), 0);
  extra.chatRead = { ...chatReadOf(extra), [who]: new Date(Math.max(Date.now(), lastAt)).toISOString() };
  return extra;
}

export function appendMessage(extra: Record<string, unknown>, from: "guest" | "owner", message: string) {
  const assistance = asMessages(extra);
  const at = new Date().toISOString();
  assistance.push({ at, message, from });
  extra.assistance = assistance;
  extra.chatRead = { ...chatReadOf(extra), [from]: at };
  return extra;
}

export function bookingPublicUrl(origin: string, id: string) {
  return `${origin}/bookings/${id}`;
}

export function shareText(input: {
  number: string;
  name: string;
  startDate: string;
  endDate: string;
  total: number;
  url: string;
}) {
  return `HolyDays booking ${input.number}\n${input.name}\n${formatDay(input.startDate)} — ${formatDay(input.endDate)}\n${formatPKR(input.total)}\n${input.url}`;
}

export function listingContact(meta: unknown) {
  const parsed = parseListingMeta(meta);
  return {
    phone: parsed.phone,
    email: parsed.email,
    address: parsed.address,
    checkIn: parsed.checkIn,
    checkOut: parsed.checkOut,
  };
}

export function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function bookingIcs(input: {
  id: string;
  number: string;
  name: string;
  startDate: string;
  endDate: string;
  address?: string;
  url: string;
}) {
  const dt = (iso: string) => iso.replace(/-/g, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HolyDays//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.id}@holydays`,
    `DTSTAMP:${dt(todayIso())}T060000Z`,
    `DTSTART;VALUE=DATE:${dt(input.startDate)}`,
    `DTEND;VALUE=DATE:${dt(input.endDate)}`,
    `SUMMARY:${icsEscape(`HolyDays · ${input.name} (${input.number})`)}`,
    `DESCRIPTION:${icsEscape(`Booking ${input.number}. View: ${input.url}`)}`,
    input.address ? `LOCATION:${icsEscape(input.address)}` : "",
    `URL:${input.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
