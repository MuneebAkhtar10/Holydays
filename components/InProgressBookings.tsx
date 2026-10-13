"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listDrafts, removeDraft, type DraftSummary } from "@/lib/checkout-drafts";
import { formatDay } from "@/lib/format";

const KIND_LABEL: Record<DraftSummary["kind"], string> = {
  hotel: "Hotel booking",
  ziyarat: "Ziyarat package",
  package: "Custom package",
};

/** Bookings the guest started but has not confirmed yet, so they can jump back to the exact step they left. */
export function InProgressBookings() {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);

  useEffect(() => {
    const read = () => setDrafts(listDrafts());
    read();
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
    };
  }, []);

  if (!drafts.length) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        <h2 className="font-display text-2xl">In progress</h2>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-500">{drafts.length}</span>
      </div>
      <p className="mt-1 text-sm text-mist">You have not confirmed these yet. Pick up exactly where you left off.</p>
      <div className="mt-3 grid gap-3">
        {drafts.map((d) => {
          const pct = Math.round(((d.step + 1) / Math.max(1, d.stepCount)) * 100);
          return (
            <article key={d.url} className="flex flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-ink-2/80 sm:flex-row">
              <div className="relative h-32 sm:h-auto sm:w-48 sm:shrink-0">
                <Image src={d.cover || "/images/hero-hunza-dusk.png"} alt="" fill sizes="192px" className="object-cover" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-500">
                      In progress
                    </span>
                    <span className="rounded-full bg-sand/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-sand">{KIND_LABEL[d.kind]}</span>
                  </div>
                  <h3 className="font-display mt-1.5 truncate text-xl">{d.title}</h3>
                  <p className="mt-0.5 text-sm text-mist">
                    {formatDay(d.checkin)} — {formatDay(d.checkout)} · {d.guests} guest{d.guests === 1 ? "" : "s"}
                    {d.city ? ` · ${d.city}` : ""}
                  </p>
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-xs text-mist">
                      <span>
                        Step {d.step + 1} of {d.stepCount} · <span className="text-sand">{d.stepLabel}</span>
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand/10">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                  <Link href={d.url} className="btn-primary px-4 py-2 text-center text-sm">
                    Continue booking
                  </Link>
                  <button
                    type="button"
                    className="btn-subtle px-4! py-1.5! text-xs!"
                    onClick={() => {
                      removeDraft(d.url);
                      setDrafts(listDrafts());
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
