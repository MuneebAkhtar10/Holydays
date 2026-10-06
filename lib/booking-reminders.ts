import { prisma } from "@/lib/prisma";
import { parseBookingExtras } from "@/lib/booking-view";
import { toBookingDTO } from "@/lib/booking-dto";
import { reminderEmail, thankYouEmail, type BuiltEmail, type ReminderKind } from "@/lib/booking-emails";
import { notifyUser } from "@/lib/notify";
import { addDaysIso, todayIso } from "@/lib/format";
import { publicOrigin } from "@/lib/auth-tokens";

type Key = ReminderKind | "review";

function dayDiff(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Which email (if any) is due for a booking today. Each is sent at most once, tracked in booking extras. */
export function dueReminder(
  b: { startDate: string; endDate: string; createdAt: Date | string },
  sent: Partial<Record<Key, string>>,
  today: string,
): Key | null {
  const toStart = dayDiff(today, b.startDate);
  const sinceEnd = dayDiff(b.endDate, today);
  const ageHours = (Date.now() - new Date(b.createdAt).getTime()) / 3600000;

  if (toStart >= 4 && toStart <= 7 && !sent.d7 && ageHours >= 24) return "d7";
  if (toStart === 1 && !sent.d1) return "d1";
  if (toStart === 0 && !sent.d0 && !sent.d1) return "d0";
  if (sinceEnd >= 1 && sinceEnd <= 3 && !sent.review) return "review";
  return null;
}

export async function runBookingReminders(opts: { dryRun?: boolean } = {}) {
  const today = todayIso();
  const origin = publicOrigin();
  const rows = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      startDate: { lte: addDaysIso(today, 7) },
      endDate: { gte: addDaysIso(today, -3) },
    },
    include: { listing: { include: { owner: true } }, user: true },
  });

  const result = { checked: rows.length, sent: [] as string[], skipped: [] as string[], failed: [] as string[] };

  for (const row of rows) {
    const extra = parseBookingExtras(row.extras);
    // Extra hotels in a package are billed as their own rows; the main booking's email already covers them.
    if (extra.packageId && extra.packageId !== row.id) continue;

    const sent = (extra.reminders && typeof extra.reminders === "object" ? extra.reminders : {}) as Partial<Record<Key, string>>;
    const due = dueReminder(row, sent, today);
    const to = row.user?.email ?? "";
    if (!due) continue;
    if (!to.includes("@")) {
      result.skipped.push(`${row.id}:${due}:no-email`);
      continue;
    }
    if (opts.dryRun) {
      result.sent.push(`${row.id}:${due}:dry-run`);
      continue;
    }

    const dto = toBookingDTO(row);
    const mail: BuiltEmail = due === "review" ? thankYouEmail(dto, origin) : reminderEmail(dto, origin, due);
    const res = await notifyUser({ to, subject: mail.subject, text: mail.text, html: mail.html });
    if (!res.delivered) {
      result.failed.push(`${row.id}:${due}`);
      continue;
    }

    // Re-read so we don't overwrite chat or status changes made while sending.
    const fresh = await prisma.booking.findUnique({ where: { id: row.id }, select: { extras: true } });
    const latest = parseBookingExtras(fresh?.extras ?? row.extras);
    latest.reminders = { ...((latest.reminders as object) ?? {}), [due]: new Date().toISOString() };
    await prisma.booking.update({ where: { id: row.id }, data: { extras: JSON.stringify(latest) } });
    result.sent.push(`${row.id}:${due}`);
  }

  return { today, ...result };
}
