import type { RoomPick } from "@/lib/pricing";

export function encodeRoomPicks(picks: RoomPick[]): string {
  return picks
    .filter((p) => p.rooms > 0)
    .map((p) => `${p.roomId}~${p.ratePlanId ?? ""}~${p.rooms}~${p.extraBeds ?? 0}~${p.cribs ?? 0}`)
    .join(",");
}

export function decodeRoomPicks(raw: string | null | undefined): RoomPick[] {
  if (!raw?.trim()) return [];
  const picks: RoomPick[] = [];
  for (const part of raw.split(",")) {
    const [roomId, ratePlanId, rooms, extraBeds, cribs] = part.split("~");
    const qty = Number(rooms);
    if (!roomId || !Number.isFinite(qty) || qty < 1) continue;
    picks.push({
      roomId,
      ratePlanId: ratePlanId || undefined,
      rooms: qty,
      extraBeds: Number(extraBeds) || 0,
      cribs: Number(cribs) || 0,
    });
  }
  return picks;
}

export function parseRoomPicksBody(raw: unknown): RoomPick[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const picks: RoomPick[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const roomId = String(r.roomId ?? "").trim();
    const rooms = Number(r.rooms);
    if (!roomId || !Number.isFinite(rooms) || rooms < 1) continue;
    picks.push({
      roomId,
      ratePlanId: r.ratePlanId ? String(r.ratePlanId) : undefined,
      rooms,
      extraBeds: Number(r.extraBeds) || 0,
      cribs: Number(r.cribs) || 0,
    });
  }
  return picks.length ? picks : undefined;
}

export function fallbackPicks(input: { roomId?: string | null; ratePlanId?: string | null; rooms?: number; extraBeds?: number; cribs?: number }): RoomPick[] {
  if (!input.roomId) return [];
  return [
    {
      roomId: input.roomId,
      ratePlanId: input.ratePlanId || undefined,
      rooms: Math.max(1, Number(input.rooms) || 1),
      extraBeds: Number(input.extraBeds) || 0,
      cribs: Number(input.cribs) || 0,
    },
  ];
}
