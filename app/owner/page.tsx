"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { formatDay, nightsBetween } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { kindPath, unitLabel, type ListingKind } from "@/lib/marketplace";
import { ListingForm } from "@/components/ListingForm";
import { PageLoader } from "@/components/PageLoader";
import { MessageComposer, MessageThread } from "@/components/MessageThread";
import { readJson } from "@/lib/readJson";
import type { BookingMessage } from "@/lib/booking-view";

type Listing = {
  id: string;
  slug: string;
  kind: ListingKind;
  name: string;
  city: string;
  price: number;
  priceUnit: string;
  published: boolean;
  status?: string;
  rejectReason?: string;
  reviewCount?: number;
  reviewAvg?: number;
};

type OwnerBooking = {
  id: string;
  startDate: string;
  endDate: string;
  guests: number;
  phone: string;
  total: number;
  status: string;
  payment: string;
  bucket: "upcoming" | "past" | "cancelled";
  listing: { id: string; name: string; slug: string; kind: ListingKind; city: string; cover: string };
  guest: { name: string; email: string };
  messages: BookingMessage[];
  unreadCount: number;
  lastPreview?: string;
  lastAt?: string;
  lastFrom?: "guest" | "owner" | null;
  review: { rating: number; body: string } | null;
};

const labels: Record<string, { title: string; add: string; empty: string }> = {
  TAXI: {
    title: "Your taxis",
    add: "Add a taxi",
    empty: "No trip itineraries yet. Add from → to, the stop list, rate per person, and a private full-vehicle price. Admin must approve before it appears on hotel checkout.",
  },
  STAY: {
    title: "Your hotels",
    add: "Add a hotel",
    empty: "No hotels yet. Add a property — it goes live after admin approval.",
  },
  ATTRACTION: {
    title: "Your ziyarat",
    add: "Add a ziyarat",
    empty: "No ziyarat yet. Add a shrine plan for Iraq, Iran, or Saudi — admin must approve it.",
  },
  RESTAURANT: {
    title: "Your food listings",
    add: "Add food",
    empty: "No food listings yet.",
  },
};

function OwnerDesk() {
  const { money } = useSerai();
  const { data, status } = useSession();
  const params = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [bookTab, setBookTab] = useState<"upcoming" | "past" | "cancelled" | "all">("all");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(params.get("new") === "1");
  const [desk, setDesk] = useState<"listings" | "messages" | "bookings">("listings");
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const openChatRef = useRef<string | null>(null);
  openChatRef.current = openChat;
  const kind = data?.user?.ownerKind || "TAXI";
  const copy = labels[kind] ?? labels.TAXI;

  const load = async () => {
    try {
      const [listingRes, bookingRes] = await Promise.all([
        fetch("/api/listings?mine=1", { cache: "no-store" }),
        fetch("/api/owner/bookings", { cache: "no-store" }),
      ]);
      const d = await readJson<Listing[]>(listingRes);
      const b = await readJson<OwnerBooking[]>(bookingRes);
      setListings(Array.isArray(d) ? d : []);
      const viewing = openChatRef.current;
      setBookings(
        Array.isArray(b)
          ? b.map((row) => (viewing && row.id === viewing ? { ...row, unreadCount: 0 } : row))
          : [],
      );
      if (viewing && Array.isArray(b) && b.some((row) => row.id === viewing && (row.unreadCount || 0) > 0)) {
        void fetch(`/api/owner/bookings/${viewing}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        });
      }
    } catch {
      setListings([]);
      setBookings([]);
    }
    setReady(true);
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (params.get("new") === "1") setOpen(true);
  }, [params]);

  useEffect(() => {
    const apply = () => {
      const h = window.location.hash;
      if (h === "#messages") setDesk("messages");
      else if (h === "#bookings") setDesk("bookings");
      else setDesk("listings");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    if (desk !== "messages") return;
    const threads = bookings.filter((b) => b.status !== "cancelled");
    if (!threads.length) return;
    if (!openChat || !threads.some((b) => b.id === openChat)) {
      const pick = threads.find((b) => (b.unreadCount || 0) > 0) ?? threads[0];
      setOpenChat(pick.id);
    }
  }, [desk, bookings, openChat]);

  if (status === "loading" || !ready) return <PageLoader label="Opening the desk" />;

  if (data?.user?.role === "ADMIN") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20">
        <h1 className="font-display text-4xl">Admin desk</h1>
        <p className="mt-3 text-mist">Approvals live on the admin queue, not the partner desk.</p>
        <Link href="/admin" className="btn-primary mt-6 inline-flex">
          Open approvals
        </Link>
      </div>
    );
  }

  if (data?.user && data.user.role !== "OWNER") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20">
        <h1 className="font-display text-4xl">Become a partner</h1>
        <p className="mt-3 text-mist">This login is a traveller account. Choose taxi, hotel, ziyarat, or food to open an owner desk.</p>
        <BecomeOwner />
      </div>
    );
  }

  const showDesk = (id: "listings" | "messages" | "bookings") => {
    setDesk(id);
    const url = id === "listings" ? "/owner" : `/owner#${id}`;
    history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const unreadTotal = bookings.reduce((s, b) => {
    if (b.status === "cancelled") return s;
    if (desk === "messages" && b.id === openChat) return s;
    return s + (b.unreadCount || 0);
  }, 0);

  const mine = listings.filter((l) => l.kind === kind);

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Partner desk · {kind}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{copy.title}</h1>
          <p className="mt-1 max-w-xl text-sm text-mist">Signed in as {data?.user?.email}. New listings wait for admin approval.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          {copy.add}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["listings", copy.title.replace("Your ", "")],
            ["messages", "Messages"],
            ["bookings", "Bookings"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className="filter-chip relative" data-on={desk === id} onClick={() => showDesk(id)}>
            {label}
            {id === "messages" && unreadTotal > 0 ? (
              <span className="ml-1.5 rounded-full bg-rose px-1.5 py-0.5 text-[10px] font-semibold text-bone">
                {unreadTotal}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {desk === "listings" && (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {mine.length === 0 && <p className="text-sm text-mist sm:col-span-2">{copy.empty}</p>}
        {mine.map((l) => (
          <div key={l.id} className="lift-card flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-display truncate text-lg leading-tight">{l.name}</p>
              <p className="mt-0.5 text-xs text-mist">
                {l.city} · {money(l.price)} / {unitLabel[l.priceUnit] ?? l.priceUnit} ·{" "}
                {l.status === "approved" ? "Live" : l.status === "rejected" ? "Rejected" : "Pending admin"}
                {(l.reviewCount ?? 0) > 0 ? ` · ${l.reviewAvg}★ (${l.reviewCount})` : ""}
              </p>
              {l.status === "rejected" && l.rejectReason && <p className="mt-1 text-xs text-rose">{l.rejectReason}</p>}
            </div>
            <div className="flex shrink-0 gap-2 text-sm">
              {l.status === "approved" && (
                <Link className="btn-ghost px-3 py-1.5" href={`/${kindPath[l.kind]}/${l.slug}`}>
                  View
                </Link>
              )}
              <Link className="btn-ghost px-3 py-1.5" href={`/owner/${l.id}`}>
                Edit
              </Link>
            </div>
          </div>
        ))}
      </div>
      )}

      {desk === "messages" && (
      <section id="messages" className="mt-4 scroll-mt-24">
        <h2 className="font-display text-2xl">Talk to guests</h2>
        <p className="mt-1 text-sm text-mist">Live chat on each booking. Unread counts show on this tab and in the header.</p>
        {bookings.filter((b) => b.status !== "cancelled").length === 0 ? (
          <p className="mt-3 text-sm text-mist">No confirmed bookings to message yet.</p>
        ) : (
          <OwnerInbox
            bookings={bookings.filter((b) => b.status !== "cancelled")}
            selectedId={openChat}
            onSelect={async (id) => {
              setOpenChat(id);
              const row = bookings.find((b) => b.id === id);
              if (row?.unreadCount) {
                await fetch(`/api/owner/bookings/${id}/messages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ read: true }),
                });
                setBookings((list) => list.map((b) => (b.id === id ? { ...b, unreadCount: 0 } : b)));
              }
            }}
            onUpdated={(id, messages) =>
              setBookings((list) => list.map((row) => (row.id === id ? { ...row, messages, unreadCount: 0 } : row)))
            }
          />
        )}
      </section>
      )}

      {desk === "bookings" && (
      <section id="bookings" className="mt-4 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Guest bookings</h2>
            <p className="mt-1 text-sm text-mist">Stay details on the left, guest chat on the right.</p>
          </div>
          <p className="text-sm text-mist">{bookings.length} reservation{bookings.length === 1 ? "" : "s"}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["upcoming", "past", "cancelled", "all"] as const).map((id) => {
            const count = id === "all" ? bookings.length : bookings.filter((b) => b.bucket === id).length;
            return (
              <button key={id} type="button" className="filter-chip capitalize" data-on={bookTab === id} onClick={() => setBookTab(id)}>
                {id === "past" ? "History" : id}
                <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <GuestBookingsDesk
          bookings={bookings.filter((b) => bookTab === "all" || b.bucket === bookTab)}
          selectedId={openBooking}
          money={money}
          onSelect={setOpenBooking}
          onChatUpdated={(id, messages) =>
            setBookings((list) => list.map((row) => (row.id === id ? { ...row, messages, unreadCount: 0 } : row)))
          }
        />
      </section>
      )}
      {open && (
        <ListingForm
          kind={kind}
          onClose={() => setOpen(false)}
          onSaved={() => {
            load();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function OwnerInbox({
  bookings,
  selectedId,
  onSelect,
  onUpdated,
}: {
  bookings: OwnerBooking[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdated: (id: string, messages: BookingMessage[]) => void;
}) {
  const sorted = [...bookings].sort((a, b) => {
    const u = (b.unreadCount || 0) - (a.unreadCount || 0);
    if (u) return u;
    return String(b.lastAt || "").localeCompare(String(a.lastAt || ""));
  });
  const active = sorted.find((b) => b.id === selectedId) ?? sorted[0];

  return (
    <div className="mt-3 grid overflow-hidden rounded-2xl border border-brass/25 bg-ink-2 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
      <ul className="max-h-[32rem] overflow-y-auto border-b border-brass/20 lg:border-b-0 lg:border-r">
        {sorted.map((b) => {
          const on = active?.id === b.id;
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                className={`flex w-full items-start gap-2 px-4 py-3 text-left ${on ? "bg-flame/10" : "hover:bg-sand/5"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sand">{b.guest.name}</p>
                  <p className="truncate text-xs text-mist">{b.listing.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-mist">{b.lastPreview || "No messages yet"}</p>
                </div>
                {(b.unreadCount || 0) > 0 && (
                  <span className="mt-0.5 rounded-full bg-rose px-1.5 py-0.5 text-[10px] font-semibold text-bone">{b.unreadCount}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {active ? (
        <div className="flex h-[32rem] flex-col p-4">
          <div className="mb-3">
            <p className="font-display text-xl">{active.guest.name}</p>
            <p className="text-xs text-mist">
              {active.listing.name} · {formatDay(active.startDate)} — {formatDay(active.endDate)}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-ink/30 p-3">
            <MessageThread messages={active.messages ?? []} viewer="owner" />
          </div>
          <MessageComposer
            label="Send"
            placeholder="Type a message…"
            onSend={async (message) => {
              const res = await fetch(`/api/owner/bookings/${active.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
              });
              const data = await readJson<{ error?: string; messages?: BookingMessage[] }>(res);
              if (!res.ok) throw new Error(data?.error || "Could not send");
              onUpdated(active.id, data?.messages ?? []);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

function payLabel(payment: string) {
  if (payment === "property") return "Pay at property";
  if (!payment) return "—";
  return payment.replace(/[_-]+/g, " ");
}

function statusTone(b: OwnerBooking) {
  if (b.status === "cancelled") return "bg-sand/10 text-mist";
  if (b.bucket === "past") return "bg-brass/15 text-brass";
  return "bg-sage/15 text-sage";
}

function statusLabel(b: OwnerBooking) {
  if (b.status === "cancelled") return "Cancelled";
  if (b.bucket === "past") return "Completed";
  return "Upcoming";
}

function GuestBookingsDesk({
  bookings,
  selectedId,
  money,
  onSelect,
  onChatUpdated,
}: {
  bookings: OwnerBooking[];
  selectedId: string | null;
  money: (n: number) => string;
  onSelect: (id: string) => void;
  onChatUpdated: (id: string, messages: BookingMessage[]) => void;
}) {
  const active = bookings.find((b) => b.id === selectedId) ?? bookings[0];
  if (bookings.length === 0) {
    return <p className="mt-6 text-sm text-mist">No bookings in this view yet.</p>;
  }
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-brass/25 bg-ink-2 lg:grid lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]">
      <ul className="max-h-[38rem] overflow-y-auto border-b border-brass/20 lg:border-b-0 lg:border-r lg:border-brass/20">
        {bookings.map((b) => {
          const on = active?.id === b.id;
          return (
            <li key={b.id} className="border-b border-brass/10 last:border-0">
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                className={`flex w-full gap-3 px-4 py-3.5 text-left ${on ? "bg-flame/12" : "hover:bg-sand/5"}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brass/20 text-xs font-semibold text-sand">
                  {initials(b.guest.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-sand">{b.guest.name}</span>
                    {(b.unreadCount || 0) > 0 && (
                      <span className="rounded-full bg-rose px-1.5 py-0.5 text-[10px] font-semibold text-bone">{b.unreadCount}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-mist">{b.listing.name}</span>
                  <span className="mt-0.5 block text-[11px] text-mist">
                    {formatDay(b.startDate)} — {formatDay(b.endDate)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {active ? (
        <BookingDetail booking={active} money={money} onChatUpdated={onChatUpdated} />
      ) : null}
    </div>
  );
}

function BookingDetail({
  booking,
  money,
  onChatUpdated,
}: {
  booking: OwnerBooking;
  money: (n: number) => string;
  onChatUpdated: (id: string, messages: BookingMessage[]) => void;
}) {
  const nights = nightsBetween(booking.startDate, booking.endDate);
  return (
    <div className="grid min-h-[38rem] lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
      <div className="flex flex-col border-b border-brass/20 p-5 lg:border-b-0 lg:border-r">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-2xl leading-tight">{booking.listing.name}</p>
            <p className="mt-1 text-sm text-mist">
              {formatDay(booking.startDate)} — {formatDay(booking.endDate)}
              {booking.listing.city ? ` · ${booking.listing.city}` : ""}
              {` · ${nights} night${nights === 1 ? "" : "s"}`}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${statusTone(booking)}`}>
            {statusLabel(booking)}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-brass/20 bg-ink/25 px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-flame/20 text-sm font-semibold">
            {initials(booking.guest.name)}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-sand">{booking.guest.name}</p>
            <p className="truncate text-xs text-mist">{booking.guest.email}</p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["Total", money(booking.total)],
            ["Payment", payLabel(booking.payment)],
            ["Party", `${booking.guests} guest${booking.guests === 1 ? "" : "s"}`],
            ["Phone", booking.phone || "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-brass/15 bg-ink/20 px-3 py-2.5">
              <dt className="text-[10px] uppercase tracking-[0.16em] text-brass">{label}</dt>
              <dd className="mt-1 truncate text-sm text-sand">{value}</dd>
            </div>
          ))}
        </dl>

        {booking.review && (
          <p className="mt-4 rounded-xl border border-brass/20 px-3 py-2 text-sm text-sand">
            Review · {booking.review.rating}/5 — {booking.review.body}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {booking.phone && (
            <a href={`tel:${booking.phone.replace(/\s/g, "")}`} className="btn-ghost px-3 py-1.5 text-sm">
              Call
            </a>
          )}
          <a
            href={`mailto:${booking.guest.email}?subject=${encodeURIComponent(`HolyDays booking ${booking.listing.name}`)}`}
            className="btn-ghost px-3 py-1.5 text-sm"
          >
            Email
          </a>
          <Link href={`/${kindPath[booking.listing.kind]}/${booking.listing.slug}`} className="btn-ghost px-3 py-1.5 text-sm">
            Listing
          </Link>
        </div>
      </div>

      <div className="flex min-h-[22rem] flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Guest chat</p>
          {(booking.unreadCount || 0) > 0 ? (
            <span className="rounded-full bg-rose px-2 py-0.5 text-[10px] font-semibold text-bone">{booking.unreadCount} new</span>
          ) : (
            <span className="text-[11px] text-mist">Caught up</span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-ink/20 p-3">
          <MessageThread messages={booking.messages ?? []} viewer="owner" />
        </div>
        <MessageComposer
          label="Send"
          placeholder="Write to the guest…"
          onSend={async (message) => {
            const res = await fetch(`/api/owner/bookings/${booking.id}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message }),
            });
            const data = await readJson<{ error?: string; messages?: BookingMessage[] }>(res);
            if (!res.ok) throw new Error(data?.error || "Could not send");
            onChatUpdated(booking.id, data?.messages ?? []);
          }}
        />
      </div>
    </div>
  );
}

function BecomeOwner() {
  const [kind, setKind] = useState("TAXI");
  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch("/api/owner/become", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerKind: kind }),
        });
        location.href = "/owner";
      }}
    >
      <select className="w-full bg-ink-2 px-3 py-3" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="TAXI">Taxi (Iraq / Iran / Saudi)</option>
        <option value="STAY">Hotels (Iraq / Iran / Saudi)</option>
        <option value="ATTRACTION">Ziyarat</option>
        <option value="RESTAURANT">Food</option>
      </select>
      <button className="btn-primary" type="submit">
        Open owner desk
      </button>
    </form>
  );
}

export default function OwnerPage() {
  return (
    <Suspense fallback={<PageLoader label="Opening the desk" />}>
      <OwnerDesk />
    </Suspense>
  );
}
