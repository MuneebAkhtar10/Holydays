"use client";

import Image from "next/image";
import { useSerai } from "@/lib/store";
import { quoteStay, stayRooms, type QuoteInput } from "@/lib/pricing";
import { BED_LABEL, CANCEL_LABEL, MEAL_PLAN_LABEL, PAY_LABEL, bedCopy, bedCount, type BookableRoom } from "@/lib/rooms";
import type { RatePlan, Stay } from "@/lib/types";

function roomImage(stay: Stay, room: BookableRoom, fallback: string[]) {
  return room.images[0] || fallback[0] || stay.cover;
}

export function RoomPicker({
  stay,
  input,
  roomId,
  ratePlanId,
  extraBeds,
  cribs,
  onRoom,
  onRate,
  onRooms,
  onExtraBeds,
  onCribs,
  roomShots,
}: {
  stay: Stay;
  input: QuoteInput;
  roomId: string;
  ratePlanId: string;
  extraBeds: number;
  cribs: number;
  onRoom: (id: string) => void;
  onRate: (id: string) => void;
  onRooms: (n: number) => void;
  onExtraBeds: (n: number) => void;
  onCribs: (n: number) => void;
  roomShots: string[];
}) {
  const { money } = useSerai();
  const rooms = stayRooms(stay);

  return (
    <div className="space-y-6">
      {rooms.map((room) => {
        const selected = room.id === roomId;
        const quote = quoteStay(stay, { ...input, roomId: room.id, ratePlanId: selected ? ratePlanId : room.rates[0]?.id, extraBeds: selected ? extraBeds : 0, cribs: selected ? cribs : 0 });
        return (
          <article key={room.id} className={`pane overflow-hidden ${selected ? "ring-1 ring-brass/50" : ""}`}>
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
                  <p className="font-display text-xl">{money(quote.start)} <span className="text-sm text-mist">/ night</span></p>
                </div>
                <ul className="mt-3 grid gap-1 text-sm text-mist sm:grid-cols-2">
                  <li>{room.sizeSqm} m²</li>
                  <li>{bedCopy(room)} · {bedCount(room)} bed{bedCount(room) === 1 ? "" : "s"}</li>
                  <li>Max {room.sleeps} guests</li>
                  <li>{room.smoking ? "Smoking" : "Non-smoking"}</li>
                  <li>{room.available} rooms available</li>
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
                      value={selected ? input.rooms : 1}
                      onChange={(e) => {
                        onRoom(room.id);
                        onRooms(Number(e.target.value));
                      }}
                    >
                      {Array.from({ length: room.available }, (_, i) => i + 1).map((n) => (
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
                        value={selected ? extraBeds : 0}
                        onChange={(e) => {
                          onRoom(room.id);
                          onExtraBeds(Number(e.target.value));
                        }}
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
                        value={selected ? cribs : 0}
                        onChange={(e) => {
                          onRoom(room.id);
                          onCribs(Number(e.target.value));
                        }}
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
                  input={{ ...input, roomId: room.id, ratePlanId: rate.id, extraBeds: selected ? extraBeds : 0, cribs: selected ? cribs : 0 }}
                  on={selected && ratePlanId === rate.id}
                  onPick={() => {
                    onRoom(room.id);
                    onRate(rate.id);
                  }}
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
}: {
  stay: Stay;
  room: BookableRoom;
  rate: RatePlan;
  input: QuoteInput;
  on: boolean;
  onPick: () => void;
}) {
  const { money } = useSerai();
  const quote = quoteStay(stay, input);
  return (
    <button type="button" onClick={onPick} className={`flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left ${on ? "bg-flame/10" : "hover:bg-sand/5"}`}>
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
