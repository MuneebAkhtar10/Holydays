"use client";

import Image from "next/image";
import { useSerai } from "@/lib/store";
import { quoteStay, stayRooms, type QuoteInput, type RoomPick } from "@/lib/pricing";
import { BED_LABEL, CANCEL_LABEL, MEAL_PLAN_LABEL, PAY_LABEL, bedCopy, bedCount, type BookableRoom } from "@/lib/rooms";
import type { RatePlan, Stay } from "@/lib/types";

function roomImage(stay: Stay, room: BookableRoom, fallback: string[]) {
  return room.images[0] || fallback[0] || stay.cover;
}

function pickFor(picks: RoomPick[], room: BookableRoom): RoomPick {
  return picks.find((p) => p.roomId === room.id) ?? {
    roomId: room.id,
    ratePlanId: room.rates[0]?.id,
    rooms: 0,
    extraBeds: 0,
    cribs: 0,
  };
}

export function RoomPicker({
  stay,
  input,
  picks,
  onChangePicks,
  roomShots,
  roomsLeft,
}: {
  stay: Stay;
  input: QuoteInput;
  picks: RoomPick[];
  onChangePicks: (next: RoomPick[]) => void;
  roomShots: string[];
  /** Live rooms remaining for the selected dates, across all room types. null while still checking. */
  roomsLeft?: number | null;
}) {
  const { money } = useSerai();
  const rooms = stayRooms(stay);
  const selectedTotal = picks.reduce((s, p) => s + Math.max(0, p.rooms), 0);

  const upsert = (room: BookableRoom, patch: Partial<RoomPick>) => {
    const current = pickFor(picks, room);
    const nextPick: RoomPick = {
      ...current,
      ...patch,
      roomId: room.id,
      ratePlanId: patch.ratePlanId ?? current.ratePlanId ?? room.rates[0]?.id,
    };
    const without = picks.filter((p) => p.roomId !== room.id);
    onChangePicks(nextPick.rooms > 0 ? [...without, nextPick] : without);
  };

  return (
    <div className="space-y-6">
      {rooms.map((room) => {
        const pick = pickFor(picks, room);
        const selected = pick.rooms > 0;
        const others = selectedTotal - pick.rooms;
        const hotelLeft = roomsLeft == null ? room.available : Math.max(0, roomsLeft - others);
        const cap = Math.max(0, Math.min(room.available, hotelLeft));
        const rateId = pick.ratePlanId || room.rates[0]?.id;
        const quote = quoteStay(stay, {
          ...input,
          extras: [],
          airportTransfer: false,
          promo: undefined,
          picks: [
            {
              roomId: room.id,
              ratePlanId: rateId,
              rooms: Math.max(1, pick.rooms),
              extraBeds: selected ? pick.extraBeds : 0,
              cribs: selected ? pick.cribs : 0,
            },
          ],
        });
        return (
          <article
            key={room.id}
            className={`pane overflow-hidden ${selected ? "ring-1 ring-brass/50" : ""}`}
            onDoubleClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("button, select, label, a, input")) return;
              if (selected) upsert(room, { rooms: 0 });
            }}
          >
            <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="relative min-h-[160px]">
                <Image src={roomImage(stay, room, roomShots)} alt={room.name} fill className="object-cover" />
              </div>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl">{room.name}</h3>
                    <p className="mt-1 text-sm text-mist">{room.note}</p>
                  </div>
                  <p className="font-display text-xl">
                    {money(quote.start)} <span className="text-sm text-mist">/ night</span>
                  </p>
                </div>
                <ul className="mt-3 grid gap-1 text-sm text-mist sm:grid-cols-2">
                  <li>{room.sizeSqm} m²</li>
                  <li>
                    {bedCopy(room)} · {bedCount(room)} bed{bedCount(room) === 1 ? "" : "s"}
                  </li>
                  <li>Max {room.sleeps} guests</li>
                  <li>{room.smoking ? "Smoking" : "Non-smoking"}</li>
                  <li className={cap === 0 ? "text-red-500" : ""}>
                    {cap === 0 ? "Not available for these dates" : `${cap} room${cap === 1 ? "" : "s"} available`}
                  </li>
                  <li>Breakfast depends on rate</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-1">
                  {room.facilities.map((f) => (
                    <span key={f} className="rounded-full bg-sand/5 px-2 py-0.5 text-[11px] text-mist">
                      {f}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="text-sm text-mist">
                    Rooms
                    <select
                      className="ml-2 rounded-lg bg-ink-2 px-2 py-1 text-sand ring-1 ring-sand/10"
                      value={Math.min(pick.rooms, cap)}
                      disabled={cap === 0 && pick.rooms === 0}
                      onChange={(e) => upsert(room, { rooms: Number(e.target.value) })}
                    >
                      {Array.from({ length: cap + 1 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  {room.extraBedAllowed && (
                    <label className="text-sm text-mist">
                      Extra bed
                      <select
                        className="ml-2 rounded-lg bg-ink-2 px-2 py-1 text-sand ring-1 ring-sand/10"
                        value={selected ? pick.extraBeds ?? 0 : 0}
                        disabled={!selected}
                        onChange={(e) => upsert(room, { extraBeds: Number(e.target.value) })}
                      >
                        {[0, 1, 2].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {room.cribAllowed && (
                    <label className="text-sm text-mist">
                      Baby cot
                      <select
                        className="ml-2 rounded-lg bg-ink-2 px-2 py-1 text-sand ring-1 ring-sand/10"
                        value={selected ? pick.cribs ?? 0 : 0}
                        disabled={!selected}
                        onChange={(e) => upsert(room, { cribs: Number(e.target.value) })}
                      >
                        {[0, 1].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-sand/10">
              {room.rates.map((rate) => (
                <RateRow
                  key={rate.id}
                  stay={stay}
                  room={room}
                  rate={rate}
                  input={{
                    ...input,
                    extras: [],
                    airportTransfer: false,
                    promo: undefined,
                    picks: [
                      {
                        roomId: room.id,
                        ratePlanId: rate.id,
                        rooms: Math.max(1, pick.rooms),
                        extraBeds: selected ? pick.extraBeds : 0,
                        cribs: selected ? pick.cribs : 0,
                      },
                    ],
                  }}
                  on={selected && rateId === rate.id}
                  onPick={() => upsert(room, { ratePlanId: rate.id, rooms: Math.max(1, pick.rooms) })}
                  onClear={() => upsert(room, { rooms: 0 })}
                />
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RateRow({
  stay,
  room,
  rate,
  input,
  on,
  onPick,
  onClear,
}: {
  stay: Stay;
  room: BookableRoom;
  rate: RatePlan;
  input: QuoteInput;
  on: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const { money } = useSerai();
  const quote = quoteStay(stay, input);
  return (
    <button
      type="button"
      title={on ? "Double-click to remove this room type" : undefined}
      onMouseDown={(e) => {
        e.currentTarget.dataset.wasOn = on ? "1" : "0";
      }}
      onClick={(e) => {
        if (e.currentTarget.dataset.wasOn === "1") return;
        onPick();
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        if (e.currentTarget.dataset.wasOn === "1") onClear();
      }}
      className={`flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left ${on ? "bg-flame/10" : "hover:bg-sand/5"}`}
    >
      <span>
        <span className="block font-display text-lg">{rate.name}</span>
        <span className="text-xs text-mist">
          {MEAL_PLAN_LABEL[rate.meal]} · {CANCEL_LABEL[rate.cancellation]} · {PAY_LABEL[rate.payment]}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-display">{money(quote.grand)}</span>
        <span className="text-xs text-mist">
          {quote.nights} night{quote.nights === 1 ? "" : "s"} · {BED_LABEL[room.beds[0]?.kind ?? "queen"]}
        </span>
      </span>
    </button>
  );
}
