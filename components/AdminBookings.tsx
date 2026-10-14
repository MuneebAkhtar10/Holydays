"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSerai } from "@/lib/store";
import { formatDay, formatTime } from "@/lib/format";
import { kindLabel, kindPath, type ListingKind } from "@/lib/marketplace";
import { readJson } from "@/lib/readJson";
import { LoaderMark } from "@/components/PageLoader";
import { RefundDecision } from "@/components/RefundDecision";
import type { BookingMessage } from "@/lib/booking-view";
import type { OwnerDetail } from "@/lib/owner-booking-detail";

export type AdminBooking = {
  id: string;
  number: string;
  startDate: string;
  endDate: string;
  guests: number;
  phone: string;
  total: number;
  status: string;
  bucket: "upcoming" | "pending" | "cancel_requested" | "past" | "cancelled";
  payment: string;
  createdAt: string;
  cancelReason: string;
  cancelDecidedBy: string;
  packageId: string;
  isPackage: boolean;
  messages: (BookingMessage & { by?: string })[];
  unreadFromGuest: number;
  lastPreview: string;
  lastAt: string;
  lastFrom: "guest" | "owner" | null;
  emails: { type: string; at: string; to: string }[];
  listing: { id: string; name: string; slug: string; kind: string; city: string; cover: string };
  guest: { id: string; name: string; email: string };
  owner: { id: string; name: string; email: string };
  detail: OwnerDetail;
};

type Totals = { all: number; upcoming: number; pending: number; cancel_requested: number; past: number; cancelled: number; unread: number };

const BUCKETS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "pending", label: "Awaiting payment" },
  { id: "cancel_requested", label: "Cancellation asked" },
  { id: "past", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

const KINDS = [
  { id: "", label: "All types" },
  { id: "STAY", label: "Hotels" },
  { id: "ATTRACTION", label: "Ziyarah" },
  { id: "TAXI", label: "Taxis" },
  { id: "RESTAURANT", label: "Food" },
] as const;

const EMAIL_LABEL: Record<string, string> = {
  confirmation: "Booking confirmation",
  confirmation_resent: "Confirmation re-sent",
  cancel_requested: "Cancellation request",
  cancelled: "Cancellation confirmed",
  cancel_denied: "Cancellation declined",
};

function statusPill(b: AdminBooking) {
  if (b.status === "cancelled" || b.status === "declined") return { label: "Cancelled", cls: "bg-sand/10 text-mist" };
  if (b.status === "cancel_requested") return { label: "Cancellation asked", cls: "bg-rose/15 text-rose" };
  if (b.status === "pending_payment") return { label: "Awaiting payment", cls: "bg-amber-500/15 text-amber-500" };
  if (b.status === "pending_driver") return { label: "Awaiting driver", cls: "bg-amber-500/15 text-amber-500" };
  if (b.bucket === "past") return { label: "Completed", cls: "bg-sand/10 text-mist" };
  return { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-500" };
}

const stamp = (iso: string) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export function AdminBookings({ onBusy }: { onBusy: (label: string | null) => void }) {
  const { money } = useSerai();
  const [rows, setRows] = useState<AdminBooking[]>([]);
  const [totals, setTotals] = useState<Totals>({ all: 0, upcoming: 0, pending: 0, cancel_requested: 0, past: 0, cancelled: 0, unread: 0 });
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]["id"]>("all");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ bucket, kind, q: query });
      const d = await readJson<{ bookings?: AdminBooking[]; totals?: Totals; error?: string }>(
        await fetch(`/api/admin/bookings?${p.toString()}`, { cache: "no-store" }),
      );
      if (d?.bookings) {
        setRows(d.bookings);
        if (d.totals) setTotals(d.totals);
        setError("");
      } else {
        setRows([]);
        setError(d?.error || "Could not load bookings.");
      }
    } catch {
      setRows([]);
      setError("Could not load bookings.");
    }
    setLoading(false);
  }, [bucket, kind, query]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), query ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, query]);

  const active = useMemo(() => rows.find((b) => b.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    setReply("");
    setCancelOpen(false);
    setCancelReason("");
  }, [selectedId]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [active?.id, active?.messages.length]);

  const openBooking = async (b: AdminBooking) => {
    setSelectedId(b.id);
    if (b.unreadFromGuest > 0) {
      await fetch(`/api/admin/bookings/${b.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      }).catch(() => null);
      setRows((list) => list.map((r) => (r.id === b.id ? { ...r, unreadFromGuest: 0 } : r)));
    }
  };

  const send = async () => {
    const message = reply.trim();
    if (!message || !active) return;
    setSending(true);
    const res = await fetch(`/api/admin/bookings/${active.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await readJson<{ messages?: AdminBooking["messages"]; error?: string }>(res);
    if (res.ok && data?.messages) {
      setRows((list) => list.map((r) => (r.id === active.id ? { ...r, messages: data.messages!, unreadFromGuest: 0 } : r)));
      setReply("");
    } else {
      setError(data?.error || "Could not send this message.");
    }
    setSending(false);
  };

  const decide = async (id: string, approve: boolean, refundPercent?: number) => {
    onBusy(approve ? "Approving cancellation" : "Declining cancellation");
    const res = await fetch(`/api/admin/bookings/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve, refundPercent }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (!res.ok) setError(data?.error || "Could not update this cancellation.");
    await load();
    onBusy(null);
  };

  const forceCancel = async (id: string, refundPercent?: number) => {
    if (!cancelReason.trim()) {
      setError("Give a reason so the guest and the partner know why.");
      return;
    }
    onBusy("Cancelling booking");
    const res = await fetch(`/api/admin/bookings/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true, reason: cancelReason.trim(), refundPercent }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (!res.ok) setError(data?.error || "Could not cancel this booking.");
    else {
      setCancelOpen(false);
      setCancelReason("");
      setError("");
    }
    await load();
    onBusy(null);
  };

  return (
    <div>
      {/* Filters */}
      <div className="rounded-2xl border border-brass/30 bg-ink-2/70 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {BUCKETS.map((b) => {
            const n = totals[b.id as keyof Totals];
            return (
              <button key={b.id} type="button" className="filter-chip" data-on={bucket === b.id} onClick={() => setBucket(b.id)}>
                {b.label}
                {typeof n === "number" && n > 0 ? <span className="ml-1.5 opacity-60">{n}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {KINDS.map((k) => (
            <button key={k.id} type="button" className="filter-chip" data-on={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
          <input
            className="auth-field w-full py-2! text-sm! normal-case tracking-normal sm:ml-auto sm:max-w-xs"
            placeholder="Search booking, guest, partner…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose/30 bg-rose/10 px-3.5 py-2.5 text-sm text-rose">
          {error}
          <button type="button" className="shrink-0 underline" onClick={() => setError("")}>
            Dismiss
          </button>
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* List — on phones it steps aside once a booking is open, so the detail gets the whole screen */}
        <div className={`relative max-h-[32rem] space-y-2 overflow-y-auto pr-1 lg:max-h-[64rem] ${active ? "hidden lg:block" : ""}`}>
          {loading && (
            <div className="grid min-h-40 place-items-center">
              <LoaderMark label="Loading bookings" />
            </div>
          )}
          {!loading && rows.length === 0 && <p className="text-sm text-mist">No bookings match these filters.</p>}
          {!loading &&
            rows.map((b) => {
              const pill = statusPill(b);
              const on = b.id === selectedId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => void openBooking(b)}
                  className={`flex w-full gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                    on ? "border-brass bg-brass/10" : "border-brass/20 bg-ink-2 hover:border-brass/50"
                  }`}
                >
                  <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-ink/30">
                    <Image src={b.listing.cover || "/images/hero-hunza-dusk.png"} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${pill.cls}`}>{pill.label}</span>
                      {b.unreadFromGuest > 0 && (
                        <span className="rounded-full bg-flame px-1.5 py-0.5 text-[10px] font-bold text-ink">{b.unreadFromGuest}</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-sand">{b.listing.name}</p>
                    <p className="truncate text-xs text-mist">
                      {b.number} · {b.guest.name} · {money(b.total)}
                    </p>
                    <p className="truncate text-xs text-mist">
                      {formatDay(b.startDate)}
                      {b.endDate !== b.startDate ? ` — ${formatDay(b.endDate)}` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
        </div>

        {/* Detail */}
        <div className={`rounded-2xl border border-brass/25 bg-ink-2/60 p-4 sm:p-5 ${active ? "" : "hidden lg:block"}`}>
          {active && (
            <button
              type="button"
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-mist hover:text-sand lg:hidden"
              onClick={() => setSelectedId(null)}
            >
              <span aria-hidden>←</span> All bookings
            </button>
          )}
          {!active ? (
            <p className="py-20 text-center text-sm text-mist">Pick a booking to see everything about it, reply to the guest, or cancel it.</p>
          ) : (
            <AdminBookingDetail
              b={active}
              money={money}
              reply={reply}
              setReply={setReply}
              sending={sending}
              onSend={send}
              threadRef={threadRef}
              cancelOpen={cancelOpen}
              setCancelOpen={setCancelOpen}
              cancelReason={cancelReason}
              setCancelReason={setCancelReason}
              onDecide={decide}
              onForceCancel={forceCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist">{label}</dt>
      <dd className="mt-0.5 text-sm text-sand">{value}</dd>
    </div>
  );
}

function AdminBookingDetail({
  b,
  money,
  reply,
  setReply,
  sending,
  onSend,
  threadRef,
  cancelOpen,
  setCancelOpen,
  cancelReason,
  setCancelReason,
  onDecide,
  onForceCancel,
}: {
  b: AdminBooking;
  money: (n: number) => string;
  reply: string;
  setReply: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  threadRef: React.RefObject<HTMLDivElement | null>;
  cancelOpen: boolean;
  setCancelOpen: (v: boolean) => void;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  onDecide: (id: string, approve: boolean, refundPercent?: number) => void;
  onForceCancel: (id: string, refundPercent?: number) => void;
}) {
  const d = b.detail;
  const pill = statusPill(b);
  const live = b.status !== "cancelled" && b.status !== "declined";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${pill.cls}`}>{pill.label}</span>
            <span className="rounded-full bg-sand/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-sand">
              {kindLabel[b.listing.kind as ListingKind] ?? b.listing.kind}
            </span>
            {b.isPackage && <span className="rounded-full bg-flame/20 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-sand">Package</span>}
          </div>
          <h2 className="font-display mt-1.5 text-2xl leading-tight">{b.listing.name}</h2>
          <p className="mt-0.5 text-sm text-mist">
            {b.number} · placed {formatDay(b.createdAt.slice(0, 10))} · {b.listing.city}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl leading-none">{money(b.total)}</p>
          <p className="mt-1 text-xs text-mist">{d.paid ? "Paid online" : d.wasPaid ? "Paid · cancelled" : "Due on arrival"}</p>
        </div>
      </div>

      {/* Who */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-brass/20 bg-ink/25 px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brass">Guest</p>
          <p className="mt-1 truncate text-sm font-semibold text-sand">{b.guest.name}</p>
          <p className="truncate text-xs text-mist">{b.guest.email}</p>
          {b.phone ? <p className="text-xs text-mist">{b.phone}</p> : null}
        </div>
        <div className="rounded-xl border border-brass/20 bg-ink/25 px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brass">Partner</p>
          <p className="mt-1 truncate text-sm font-semibold text-sand">{b.owner.name}</p>
          <p className="truncate text-xs text-mist">{b.owner.email}</p>
          <Link href={`/${kindPath[b.listing.kind as ListingKind]}/${b.listing.slug}`} className="text-xs text-brass underline">
            View listing
          </Link>
        </div>
      </div>

      {/* Facts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-brass/20 bg-ink/20 p-3.5 sm:grid-cols-4">
        <Row
          label={b.listing.kind === "STAY" ? "Check-in" : "Date"}
          value={`${formatDay(b.startDate)}${d.reservation ? ` · ${formatTime(d.reservation.time)}` : ""}`}
        />
        <Row label={b.listing.kind === "STAY" ? "Check-out" : "Ends"} value={b.endDate !== b.startDate ? formatDay(b.endDate) : "Same day"} />
        <Row
          label="Length"
          value={b.listing.kind === "STAY" ? `${d.nights} night${d.nights === 1 ? "" : "s"}` : d.visit ? `${d.visit.days} day${d.visit.days === 1 ? "" : "s"}` : "—"}
        />
        <Row label="Guests" value={`${b.guests}`} />
      </dl>

      {d.rooms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {d.rooms.map((r, i) => (
            <span key={`${r.name}-${i}`} className="rounded-full bg-sand/10 px-2.5 py-1 text-xs text-sand">
              {r.name}
              {r.count > 1 ? ` × ${r.count}` : ""}
              {r.rate ? ` · ${r.rate}` : ""}
            </span>
          ))}
        </div>
      )}

      {/* Money */}
      <section className="mt-4 rounded-xl border border-brass/20 bg-ink/20 p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brass">Charges on this listing</p>
        <ul className="mt-2 divide-y divide-brass/10 text-sm">
          {d.invoice.map((l, i) => (
            <li key={`${l.label}-${i}`} className={`flex items-start justify-between gap-3 ${l.indent ? "py-1 pl-4 text-xs text-mist" : "py-1.5 text-sand"}`}>
              <span className="min-w-0">
                {l.label}
                {l.note && <span className="block text-xs text-mist">{l.note}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{money(l.amount)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center justify-between border-t border-brass/15 pt-2 text-sm">
          <span className="text-mist">Total</span>
          <span className="font-display text-lg text-sand">{money(d.invoiceTotal)}</span>
        </p>
        {d.refund ? (
          <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-sand">
            {d.refund.amountPkr > 0
              ? `Refunded ${money(d.refund.amountPkr)} (${d.refund.percent}%) to the guest's card${d.refund.at ? ` on ${formatDay(d.refund.at.slice(0, 10))}` : ""}.`
              : "Cancelled with no refund under the rate's terms."}
          </p>
        ) : null}
      </section>

      {d.requests ? (
        <p className="mt-3 rounded-xl border border-brass/20 bg-ink/20 p-3.5 text-sm italic text-sand/90">“{d.requests}”</p>
      ) : null}

      {/* Emails sent */}
      {b.emails.length > 0 && (
        <section className="mt-3 rounded-xl border border-brass/20 bg-ink/20 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brass">Emails sent</p>
          <ul className="mt-2 space-y-1 text-xs text-mist">
            {b.emails.map((e, i) => (
              <li key={`${e.type}-${i}`} className="flex flex-wrap justify-between gap-x-3">
                <span className="text-sand">{EMAIL_LABEL[e.type] ?? e.type}</span>
                <span>
                  {e.to} · {stamp(e.at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cancellation request */}
      {b.status === "cancel_requested" && (
        <section className="mt-4 rounded-xl border-2 border-rose/40 bg-rose/10 p-3.5">
          <p className="text-sm font-semibold text-rose">The guest asked to cancel</p>
          {b.cancelReason ? <p className="mt-1 text-sm italic text-sand/90">“{b.cancelReason}”</p> : null}
          <div className="mt-3">
            <RefundDecision
              outlook={d.refundOutlook}
              paidPkr={b.total}
              denyLabel="Decline — keep booking"
              onApprove={(pct) => onDecide(b.id, true, pct)}
              onDeny={() => onDecide(b.id, false)}
            />
          </div>
        </section>
      )}

      {/* Chat */}
      <section className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brass">Conversation</p>
          <p className="text-xs text-mist">{b.messages.length} message{b.messages.length === 1 ? "" : "s"}</p>
        </div>
        <div ref={threadRef} className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-brass/20 bg-ink/25 p-3">
          {b.messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-mist">No messages yet. Write the first one below.</p>
          ) : (
            b.messages.map((m, i) => {
              const fromGuest = m.from === "guest";
              const who = fromGuest ? b.guest.name : m.by === "admin" ? "HolyDays support" : b.owner.name;
              return (
                <div key={`${m.at}-${i}`} className={`flex ${fromGuest ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${fromGuest ? "bg-sand/[0.07] text-sand" : m.by === "admin" ? "bg-flame/25 text-sand" : "bg-brass/15 text-sand"}`}>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-mist">
                      {who} · {stamp(m.at)}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{m.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <textarea
            className="auth-field min-h-11 flex-1 normal-case tracking-normal"
            rows={2}
            placeholder="Reply as HolyDays support — the guest and the partner are both emailed."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend();
            }}
          />
          <button type="button" className="btn-primary shrink-0 px-4 py-2.5 text-sm sm:self-end" disabled={sending || !reply.trim()} onClick={onSend}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </section>

      {/* Cancel anytime */}
      {live && b.status !== "cancel_requested" && (
        <section className="mt-4 border-t border-brass/15 pt-4">
          {!cancelOpen ? (
            <button type="button" className="btn-subtle px-3.5! py-2! text-xs! text-rose!" onClick={() => setCancelOpen(true)}>
              Cancel this booking
            </button>
          ) : (
            <div className="rounded-xl border border-rose/40 bg-rose/10 p-3.5">
              <p className="text-sm font-semibold text-rose">Cancel {b.number}?</p>
              <p className="mt-1 text-xs text-sand/90">
                The guest and {b.owner.name} are both emailed, the dates are released
                {b.isPackage ? ", and the rest of this package is cancelled with it" : ""}. This cannot be undone.
              </p>
              <textarea
                className="auth-field mt-2.5 min-h-16 w-full normal-case tracking-normal"
                placeholder="Why is this being cancelled? The guest sees this."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <div className="mt-3">
                <RefundDecision
                  outlook={d.refundOutlook}
                  paidPkr={b.total}
                  denyLabel="Keep booking"
                  onApprove={(pct) => onForceCancel(b.id, pct)}
                  onDeny={() => setCancelOpen(false)}
                />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
