"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { formatDay, nightsBetween, todayIso } from "@/lib/format";
import { useSerai } from "@/lib/store";
import { kindPath, unitLabel, type ListingKind } from "@/lib/marketplace";
import { ListingForm } from "@/components/ListingForm";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
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
  closedFrom?: string;
};

type OwnerBooking = {
  id: string;
  startDate: string;
  endDate: string;
  guests: number;
  phone: string;
  total: number;
  status: string;
  cancelReason?: string;
  customTaxi?: boolean;
  customHours?: number;
  customNote?: string;
  packageId?: string;
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
    empty: "No ziyarat yet. Add a shrine plan for Saudi, Iraq, or Iran — admin must approve it.",
  },
  RESTAURANT: {
    title: "Your food listings",
    add: "Add food",
    empty: "No food listings yet.",
  },
};

function ListingStatusBadge({ listing }: { listing: Listing }) {
  const closingSoon = Boolean(listing.closedFrom && listing.closedFrom > todayIso());
  let tone = "bg-sage/15 text-sage";
  let label = "Live";
  let dot = "bg-sage";

  if (listing.status === "closed") {
    tone = "bg-sand/10 text-mist";
    label = "Deactivated";
    dot = "bg-mist";
  } else if (listing.status === "rejected") {
    tone = "bg-rose/15 text-rose";
    label = "Rejected";
    dot = "bg-rose";
  } else if (listing.status !== "approved") {
    tone = "bg-brass/15 text-brass";
    label = "Pending admin";
    dot = "bg-brass";
  } else if (closingSoon) {
    tone = "bg-brass/15 text-brass";
    label = `Closing ${formatDay(listing.closedFrom!)}`;
    dot = "bg-brass";
  }

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

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
  const [manageTarget, setManageTarget] = useState<Listing | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
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
      const keyOf = (row: OwnerBooking) => row.packageId || row.id;
      setBookings(
        Array.isArray(b)
          ? b.map((row) => (viewing && keyOf(row) === viewing ? { ...row, unreadCount: 0 } : row))
          : [],
      );
      if (viewing && Array.isArray(b)) {
        const toClear = b.filter((row) => keyOf(row) === viewing && (row.unreadCount || 0) > 0);
        await Promise.all(
          toClear.map((row) =>
            fetch(`/api/owner/bookings/${row.id}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ read: true }),
            }),
          ),
        );
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
    const keyOf = (b: OwnerBooking) => b.packageId || b.id;
    if (!openChat || !threads.some((b) => keyOf(b) === openChat)) {
      const pick = threads.find((b) => (b.unreadCount || 0) > 0) ?? threads[0];
      setOpenChat(keyOf(pick));
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
    if (desk === "messages" && (b.packageId || b.id) === openChat) return s;
    return s + (b.unreadCount || 0);
  }, 0);
  const cancelRequestTotal = bookings.filter((b) => b.status === "cancel_requested").length;
  const pendingRequestTotal = bookings.filter((b) => b.status === "pending_driver").length;
  const bookingsTabTotal = cancelRequestTotal + pendingRequestTotal;

  const mine = listings.filter((l) => l.kind === kind);

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
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
            {id === "bookings" && bookingsTabTotal > 0 ? (
              <span className="ml-1.5 rounded-full bg-rose px-1.5 py-0.5 text-[10px] font-semibold text-bone">
                {bookingsTabTotal}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {desk === "listings" && (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {mine.length === 0 && <p className="text-sm text-mist sm:col-span-2">{copy.empty}</p>}
        {mine.map((l) => (
          <div
            key={l.id}
            className="flex flex-col gap-3 rounded-2xl border border-brass/25 bg-ink-2 px-4 py-3.5 transition-colors hover:border-brass/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display truncate text-lg leading-tight">{l.name}</p>
                <ListingStatusBadge listing={l} />
              </div>
              <p className="mt-1 text-xs text-mist">
                {l.city} · {money(l.price)} / {unitLabel[l.priceUnit] ?? l.priceUnit}
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
              <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setManageTarget(l)}>
                Manage
              </button>
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
            onSelect={async (ids) => {
              setOpenChat(ids[0]);
              const unreadIds = ids.filter((id) => bookings.find((b) => b.id === id)?.unreadCount);
              if (unreadIds.length) {
                await Promise.all(
                  unreadIds.map((id) =>
                    fetch(`/api/owner/bookings/${id}/messages`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ read: true }),
                    }),
                  ),
                );
                setBookings((list) => list.map((b) => (unreadIds.includes(b.id) ? { ...b, unreadCount: 0 } : b)));
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
          onCancelDecision={async (id, approve) => {
            setOverlay(approve ? "Approving cancellation" : "Denying cancellation");
            await fetch(`/api/owner/bookings/${id}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ approve }),
            });
            await load();
            setOverlay(null);
          }}
          onRespondRequest={async (id, accept) => {
            setOverlay(accept ? "Accepting trip request" : "Declining trip request");
            await fetch(`/api/owner/bookings/${id}/respond`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accept }),
            });
            await load();
            setOverlay(null);
          }}
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
      {manageTarget && (
        <ManageListingModal
          listing={manageTarget}
          onClose={() => setManageTarget(null)}
          onUpdated={() => {
            load();
          }}
        />
      )}
    </div>
  );
}

function ManageListingModal({
  listing,
  onClose,
  onUpdated,
}: {
  listing: Listing;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [mode, setMode] = useState<"menu" | "schedule" | "confirm-delete">("menu");
  const [closeDate, setCloseDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  const closingSoon = Boolean(listing.closedFrom && listing.closedFrom > todayIso());

  const call = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/listings/${listing.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJson<{ error?: string; blockedUntil?: string }>(res);
      if (!res.ok) {
        setError(data?.error || "Could not update listing");
        if (data?.blockedUntil) {
          setBlockedUntil(data.blockedUntil);
          const min = new Date(data.blockedUntil);
          min.setDate(min.getDate() + 1);
          setCloseDate(min.toISOString().slice(0, 10));
          setMode("schedule");
        }
        return;
      }
      onUpdated();
      onClose();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const deleteListing = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/listings/${listing.id}`, { method: "DELETE" });
      const data = await readJson<{ error?: string; blockedUntil?: string }>(res);
      if (!res.ok) {
        setError(data?.error || "Could not delete listing");
        if (data?.blockedUntil) {
          setBlockedUntil(data.blockedUntil);
          const min = new Date(data.blockedUntil);
          min.setDate(min.getDate() + 1);
          setCloseDate(min.toISOString().slice(0, 10));
          setMode("schedule");
        }
        return;
      }
      onUpdated();
      onClose();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div className="paper w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Manage listing</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="font-display truncate text-2xl">{listing.name}</h2>
          <ListingStatusBadge listing={listing} />
        </div>

        {mode === "menu" && (
          <div className="mt-4 space-y-3">
            {listing.status === "closed" ? (
              <>
                <p className="text-sm text-mist">This listing is deactivated and hidden from guests.</p>
                <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => call({ mode: "reactivate" })}>
                  {busy ? <ButtonSpinner label="Reactivating…" /> : "Reactivate"}
                </button>
              </>
            ) : (
              <>
                {closingSoon && (
                  <div className="rounded-xl bg-brass/10 px-3 py-2.5 text-sm text-ink/70">
                    Scheduled to stop taking new bookings from {formatDay(listing.closedFrom!)}.
                    <button type="button" className="ml-2 font-medium text-brass underline" disabled={busy} onClick={() => call({ mode: "reactivate" })}>
                      Cancel this
                    </button>
                  </div>
                )}
                <button type="button" className="btn-outline w-full" disabled={busy} onClick={() => call({ mode: "now" })}>
                  {busy ? <ButtonSpinner label="Deactivating…" /> : "Deactivate now"}
                </button>
                <button type="button" className="btn-outline w-full" disabled={busy} onClick={() => setMode("schedule")}>
                  Schedule a closing date
                </button>
                <div className="border-t border-ink/10 pt-3">
                  <button type="button" className="btn-danger w-full" disabled={busy} onClick={() => setMode("confirm-delete")}>
                    Delete listing
                  </button>
                </div>
              </>
            )}
            {error && (
              <p className="text-sm text-rose">
                {error}
                {blockedUntil ? " You can schedule a closing date for after that instead." : ""}
              </p>
            )}
            <button type="button" className="btn-subtle w-full" disabled={busy} onClick={onClose}>
              Cancel
            </button>
          </div>
        )}

        {mode === "confirm-delete" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-rose/10 px-3.5 py-3 text-sm text-rose">
              This permanently deletes “{listing.name}” and cannot be undone.
            </div>
            {error && (
              <p className="text-sm text-rose">
                {error}
                {blockedUntil ? " You can schedule a closing date for after that instead." : ""}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-danger flex-1" disabled={busy} onClick={deleteListing}>
                {busy ? <ButtonSpinner label="Deleting…" /> : "Yes, delete permanently"}
              </button>
              <button type="button" className="btn-subtle" disabled={busy} onClick={() => setMode("menu")}>
                Back
              </button>
            </div>
          </div>
        )}

        {mode === "schedule" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-mist">
              {blockedUntil
                ? `This listing has a confirmed booking ending ${formatDay(blockedUntil)}. Choose a date after that — no new bookings will be taken from that date onward.`
                : "Choose the date from which this listing should stop taking new bookings."}
            </p>
            <input
              type="date"
              className="paper-field w-full"
              value={closeDate}
              min={blockedUntil ? undefined : todayIso()}
              onChange={(e) => setCloseDate(e.target.value)}
            />
            {error && <p className="text-sm text-rose">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn-primary flex-1" disabled={busy} onClick={() => call({ mode: "schedule", closedFrom: closeDate })}>
                {busy ? <ButtonSpinner label="Saving…" /> : "Confirm closing date"}
              </button>
              <button type="button" className="btn-subtle" disabled={busy} onClick={() => setMode("menu")}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ButtonSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      {label}
    </span>
  );
}

type InboxThread = { key: string; primary: OwnerBooking; bookings: OwnerBooking[] };

function groupInboxThreads(bookings: OwnerBooking[]): InboxThread[] {
  const byKey = new Map<string, OwnerBooking[]>();
  for (const b of bookings) {
    const key = b.packageId || b.id;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(b);
  }
  return Array.from(byKey.entries()).map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const primary = sorted.find((b) => b.id === key) ?? sorted[0];
    return { key, primary, bookings: sorted };
  });
}

function OwnerInbox({
  bookings,
  selectedId,
  onSelect,
  onUpdated,
}: {
  bookings: OwnerBooking[];
  selectedId: string | null;
  onSelect: (ids: string[]) => void;
  onUpdated: (id: string, messages: BookingMessage[]) => void;
}) {
  const threads = groupInboxThreads(bookings);
  const unreadOf = (t: InboxThread) => t.bookings.reduce((s, b) => s + (b.unreadCount || 0), 0);
  const lastAtOf = (t: InboxThread) => t.bookings.reduce((max, b) => (String(b.lastAt || "") > max ? String(b.lastAt || "") : max), "");
  const sorted = [...threads].sort((a, b) => {
    const u = unreadOf(b) - unreadOf(a);
    if (u) return u;
    return lastAtOf(b).localeCompare(lastAtOf(a));
  });
  const active = sorted.find((t) => t.key === selectedId) ?? sorted[0];
  const isMultiHotel = (t: InboxThread) => t.bookings.length > 1;
  const lastPreviewOf = (t: InboxThread) => {
    const latest = [...t.bookings].sort((a, b) => String(a.lastAt || "").localeCompare(String(b.lastAt || ""))).pop();
    return latest?.lastPreview || "No messages yet";
  };
  const mergedMessages = (t: InboxThread) =>
    t.bookings
      .flatMap((b) => b.messages ?? [])
      .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));

  return (
    <div className="mt-3 grid overflow-hidden rounded-2xl border border-brass/25 bg-ink-2 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
      <ul className="max-h-[32rem] overflow-y-auto border-b border-brass/20 lg:border-b-0 lg:border-r">
        {sorted.map((t) => {
          const on = active?.key === t.key;
          const unread = unreadOf(t);
          return (
            <li key={t.key} className="border-b border-sand/10 last:border-0">
              <button
                type="button"
                onClick={() => onSelect([t.primary.id, ...t.bookings.filter((b) => b.id !== t.primary.id).map((b) => b.id)])}
                className={`relative flex w-full gap-3 px-4 py-3 text-left outline-none transition-colors ${
                  on ? "bg-flame/10" : "hover:bg-sand/5"
                }`}
              >
                {on && <span className="absolute inset-y-0 left-0 w-0.5 bg-flame" />}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brass/20 text-xs font-semibold text-sand">
                  {initials(t.primary.guest.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-sand">{t.primary.guest.name}</p>
                    {unread > 0 && (
                      <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-rose px-1 text-[10px] font-semibold text-bone">
                        {unread}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-mist">
                    {isMultiHotel(t) ? t.bookings.map((b) => b.listing.name).join(" · ") : t.primary.listing.name}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-mist">{lastPreviewOf(t)}</p>
                  <span className="mt-1.5 block">
                    <OwnerBookingStatusBadge booking={t.primary} compact />
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {active ? (
        <div className="flex h-[32rem] flex-col p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-xl">{active.primary.guest.name}</p>
              <p className="text-xs text-mist">
                {isMultiHotel(active)
                  ? `${active.bookings.length} hotels · ${active.bookings.map((b) => b.listing.name).join(" · ")}`
                  : `${active.primary.listing.name} · ${formatDay(active.primary.startDate)} — ${formatDay(active.primary.endDate)}`}
              </p>
            </div>
            <OwnerBookingStatusBadge booking={active.primary} compact />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-ink/30 p-3">
            <MessageThread messages={mergedMessages(active)} viewer="owner" />
          </div>
          <MessageComposer
            label="Send"
            placeholder="Type a message…"
            onSend={async (message) => {
              const res = await fetch(`/api/owner/bookings/${active.primary.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
              });
              const data = await readJson<{ error?: string; messages?: BookingMessage[] }>(res);
              if (!res.ok) throw new Error(data?.error || "Could not send");
              onUpdated(active.primary.id, data?.messages ?? []);
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
  if (b.status === "cancelled" || b.status === "declined") return "bg-sand/10 text-mist";
  if (b.status === "cancel_requested") return "bg-rose/15 text-rose";
  if (b.status === "pending_driver") return "bg-brass/15 text-brass";
  if (b.bucket === "past") return "bg-brass/15 text-brass";
  return "bg-sage/15 text-sage";
}

function statusLabel(b: OwnerBooking) {
  if (b.status === "cancelled") return "Cancelled";
  if (b.status === "declined") return "Declined";
  if (b.status === "cancel_requested") return "Cancellation requested";
  if (b.status === "pending_driver") return "Awaiting your response";
  if (b.bucket === "past") return "Completed";
  return "Upcoming";
}

function statusDot(b: OwnerBooking) {
  if (b.status === "cancelled" || b.status === "declined") return "bg-mist";
  if (b.status === "cancel_requested") return "bg-rose";
  if (b.status === "pending_driver") return "bg-brass";
  if (b.bucket === "past") return "bg-brass";
  return "bg-sage";
}

function OwnerBookingStatusBadge({ booking, compact }: { booking: OwnerBooking; compact?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium uppercase tracking-[0.08em] ${statusTone(booking)} ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-[11px] tracking-[0.14em]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(booking)}`} />
      {statusLabel(booking)}
    </span>
  );
}

function GuestBookingsDesk({
  bookings,
  selectedId,
  money,
  onSelect,
  onChatUpdated,
  onCancelDecision,
  onRespondRequest,
}: {
  bookings: OwnerBooking[];
  selectedId: string | null;
  money: (n: number) => string;
  onSelect: (id: string) => void;
  onChatUpdated: (id: string, messages: BookingMessage[]) => void;
  onCancelDecision: (id: string, approve: boolean) => void;
  onRespondRequest: (id: string, accept: boolean) => void;
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
            <li key={b.id} className="border-b border-sand/10 last:border-0">
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                className={`relative flex w-full gap-3 px-4 py-3 text-left outline-none transition-colors ${
                  on ? "bg-flame/10" : "hover:bg-sand/5"
                }`}
              >
                {on && <span className="absolute inset-y-0 left-0 w-0.5 bg-flame" />}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brass/20 text-xs font-semibold text-sand">
                  {initials(b.guest.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-sand">{b.guest.name}</span>
                    {(b.unreadCount || 0) > 0 && (
                      <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-rose px-1 text-[10px] font-semibold text-bone">
                        {b.unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-mist">
                    {b.listing.name} · {formatDay(b.startDate)} — {formatDay(b.endDate)}
                  </span>
                  <span className="mt-1.5 block">
                    <OwnerBookingStatusBadge booking={b} compact />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {active ? (
        <BookingDetail
          booking={active}
          money={money}
          onChatUpdated={onChatUpdated}
          onCancelDecision={onCancelDecision}
          onRespondRequest={onRespondRequest}
        />
      ) : null}
    </div>
  );
}

function BookingDetail({
  booking,
  money,
  onChatUpdated,
  onCancelDecision,
  onRespondRequest,
}: {
  booking: OwnerBooking;
  money: (n: number) => string;
  onChatUpdated: (id: string, messages: BookingMessage[]) => void;
  onCancelDecision: (id: string, approve: boolean) => void;
  onRespondRequest: (id: string, accept: boolean) => void;
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
          <OwnerBookingStatusBadge booking={booking} />
        </div>

        {booking.status === "pending_driver" && (
          <div className="mt-4 rounded-2xl border-2 border-brass/50 bg-brass/10 px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">Custom trip request — action needed</p>
            <p className="mt-2 text-sm text-sand/90">
              {booking.guest.name} wants a custom trip
              {booking.customHours ? ` for ${booking.customHours} hour${booking.customHours === 1 ? "" : "s"}` : ""}.
              {booking.customNote ? <> They noted: <span className="italic">"{booking.customNote}"</span></> : ""}
            </p>
            <p className="mt-1 text-xs text-mist">No rate is set yet — contact {booking.guest.name} directly to agree on one before accepting.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => onRespondRequest(booking.id, true)}>
                Accept request
              </button>
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => onRespondRequest(booking.id, false)}>
                Decline
              </button>
            </div>
          </div>
        )}

        {booking.status === "cancel_requested" && (
          <div className="mt-4 rounded-2xl border-2 border-rose/50 bg-rose/10 px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-rose">⚠ Cancellation requested — action needed</p>
            <p className="mt-2 text-sm text-sand/90">
              {booking.guest.name} wants to cancel this booking
              {booking.cancelReason ? <>: <span className="italic">“{booking.cancelReason}”</span></> : "."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => onCancelDecision(booking.id, true)}>
                Approve cancellation
              </button>
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => onCancelDecision(booking.id, false)}>
                Deny — keep booking
              </button>
            </div>
          </div>
        )}

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
        <option value="TAXI">Taxi (Saudi / Iraq / Iran)</option>
        <option value="STAY">Hotels (Saudi / Iraq / Iran)</option>
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
