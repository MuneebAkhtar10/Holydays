"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSerai } from "@/lib/store";
import { kindLabel, kindPath, unitLabel, type ListingKind } from "@/lib/marketplace";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { readJson } from "@/lib/readJson";
import { formatDay } from "@/lib/format";
import type { BookingDTO } from "@/lib/booking-dto";

type QueueItem = {
  id: string;
  slug: string;
  kind: ListingKind;
  name: string;
  city: string;
  cover: string;
  description: string;
  price: number;
  priceUnit: string;
  status: string;
  rejectReason: string;
  owner: { name: string; email: string };
};

export default function AdminPage() {
  const { money } = useSerai();
  const { data, status } = useSession();
  const [section, setSection] = useState<"listings" | "cancellations">("listings");
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [cancellations, setCancellations] = useState<BookingDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [overlay, setOverlay] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = async (statusFilter = tab) => {
    setLoadError("");
    try {
      const res = await fetch(`/api/admin/listings?status=${statusFilter}`);
      const d = await readJson<QueueItem[] | { error?: string }>(res);
      if (Array.isArray(d)) {
        setItems(d);
      } else {
        setItems([]);
        setLoadError(d?.error || "Could not load listings.");
      }
    } catch {
      setItems([]);
      setLoadError("Could not load listings.");
    }
    setReady(true);
  };

  const loadCancellations = async () => {
    setLoadError("");
    try {
      const res = await fetch("/api/admin/bookings/cancellations");
      const d = await readJson<BookingDTO[] | { error?: string }>(res);
      if (Array.isArray(d)) {
        setCancellations(d);
      } else {
        setCancellations([]);
        setLoadError(d?.error || "Could not load cancellation requests.");
      }
    } catch {
      setCancellations([]);
      setLoadError("Could not load cancellation requests.");
    }
    setReady(true);
  };

  useEffect(() => {
    if (status !== "authenticated" || data?.user?.role !== "ADMIN") return;
    setReady(false);
    if (section === "listings") void load(tab);
    else void loadCancellations();
  }, [status, tab, section, data?.user?.role]);

  const decide = async (id: string, next: "approved" | "rejected") => {
    setOverlay(next === "approved" ? "Approving listing" : "Rejecting listing");
    await fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, rejectReason: reason[id] || "" }),
    }).then((r) => readJson(r));
    await load(tab);
    setOverlay(null);
  };

  const decideCancellation = async (id: string, approve: boolean) => {
    setOverlay(approve ? "Approving cancellation" : "Denying cancellation");
    await fetch(`/api/admin/bookings/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    }).then((r) => readJson(r));
    await loadCancellations();
    setOverlay(null);
  };

  if (status === "loading" || (status === "authenticated" && data?.user?.role === "ADMIN" && !ready)) {
    return <PageLoader label="Opening admin" />;
  }

  if (data?.user?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20">
        <h1 className="font-display text-4xl">Admin only</h1>
        <p className="mt-3 text-mist">Sign in with the Serai admin account to approve listings.</p>
        <Link href="/login?as=admin" className="btn-primary mt-6 inline-flex">
          Admin sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Admin</p>
      <h1 className="font-display mt-2 text-5xl">{section === "listings" ? "Listing approvals" : "Cancellation requests"}</h1>
      <p className="mt-3 max-w-xl text-mist">
        {section === "listings"
          ? "New and edited owner listings stay off the public site until you approve them."
          : "Guests who requested a cancellation wait here until you approve or deny it."}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["listings", "Listings"],
            ["cancellations", "Cancellations"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className="filter-chip" data-on={section === id} onClick={() => setSection(id)}>
            {label}
            {id === "cancellations" && cancellations.length > 0 && (
              <span className="ml-1.5 rounded-full bg-rose px-1.5 py-0.5 text-[10px] font-semibold text-bone">{cancellations.length}</span>
            )}
          </button>
        ))}
      </div>

      {section === "listings" && (
        <div className="mt-6 flex flex-wrap gap-2">
          {(["pending", "approved", "rejected"] as const).map((id) => (
            <button key={id} type="button" className="filter-chip capitalize" data-on={tab === id} onClick={() => setTab(id)}>
              {id}
            </button>
          ))}
        </div>
      )}

      {section === "listings" && (
      <div className="mt-8 space-y-4">
        {loadError && <p className="text-sm text-rose">{loadError}</p>}
        {items.length === 0 && !loadError && <p className="text-mist">Nothing in this queue.</p>}
        {items.map((l) => (
          <article key={l.id} className="overflow-hidden rounded-2xl border border-brass/30 bg-ink-2 md:grid md:grid-cols-[200px_minmax(0,1fr)]">
            <div className="relative h-40 md:h-full min-h-[160px]">
              <Image src={l.cover || "/images/hero-hunza-dusk.png"} alt="" fill className="object-cover" />
            </div>
            <div className="p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-brass">{kindLabel[l.kind] ?? l.kind}</p>
              <h2 className="font-display mt-1 text-3xl">{l.name}</h2>
              <p className="mt-1 text-sm text-mist">
                {l.city} · {money(l.price)} / {unitLabel[l.priceUnit] ?? l.priceUnit} · {l.owner?.name ?? "Owner"} ({l.owner?.email ?? ""})
              </p>
              <p className="mt-3 line-clamp-3 text-sm text-sand/80">{l.description}</p>
              {l.status === "rejected" && l.rejectReason && <p className="mt-2 text-sm text-rose">{l.rejectReason}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/${kindPath[l.kind]}/${l.slug}`} className="btn-ghost">
                  Preview
                </Link>
                {l.status !== "approved" && (
                  <button type="button" className="btn-primary" onClick={() => decide(l.id, "approved")}>
                    Approve & publish
                  </button>
                )}
                {l.status !== "rejected" && (
                  <button type="button" className="btn-ghost" onClick={() => decide(l.id, "rejected")}>
                    Reject
                  </button>
                )}
              </div>
              {l.status === "pending" && (
                <input
                  className="auth-field mt-3"
                  placeholder="Rejection note (optional)"
                  value={reason[l.id] ?? ""}
                  onChange={(e) => setReason((r) => ({ ...r, [l.id]: e.target.value }))}
                />
              )}
            </div>
          </article>
        ))}
      </div>
      )}

      {section === "cancellations" && (
      <div className="mt-8 space-y-4">
        {loadError && <p className="text-sm text-rose">{loadError}</p>}
        {cancellations.length === 0 && !loadError && <p className="text-mist">No pending cancellation requests.</p>}
        {cancellations.map((b) => (
          <article key={b.id} className="overflow-hidden rounded-2xl border border-brass/30 bg-ink-2 md:grid md:grid-cols-[200px_minmax(0,1fr)]">
            <div className="relative h-40 min-h-[160px] md:h-full">
              <Image src={b.listing.cover || "/images/hero-hunza-dusk.png"} alt="" fill className="object-cover" />
            </div>
            <div className="p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-brass">{b.number}</p>
              <h2 className="font-display mt-1 text-3xl">{b.listing.name}</h2>
              <p className="mt-1 text-sm text-mist">
                {formatDay(b.startDate)} — {formatDay(b.endDate)} · {money(b.total)} · {b.guestName} ({b.guestEmail})
              </p>
              {b.extra?.cancelReason ? (
                <p className="mt-3 rounded-xl bg-rose/10 px-3.5 py-2.5 text-sm text-rose">
                  “{String(b.extra.cancelReason)}”
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/bookings/${b.id}`} className="btn-ghost">
                  Booking details
                </Link>
                <button type="button" className="btn-primary" onClick={() => decideCancellation(b.id, true)}>
                  Approve cancellation
                </button>
                <button type="button" className="btn-ghost" onClick={() => decideCancellation(b.id, false)}>
                  Deny — keep booking
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      )}
    </div>
  );
}
