"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useSerai } from "@/lib/store";
import { kindLabel, kindPath, unitLabel, type ListingKind } from "@/lib/marketplace";
import { LoaderMark, LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { readJson } from "@/lib/readJson";
import { formatDay } from "@/lib/format";
import type { BookingDTO } from "@/lib/booking-dto";
import { RefundDecision } from "@/components/RefundDecision";
import { bookingPackageGrandTotal } from "@/lib/booking-invoice";

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
  ownerId?: string;
  createdAt?: string;
  bookings?: number;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  image: string | null;
  role: string;
  ownerKind: string | null;
  createdAt: string;
  emailVerified: boolean;
  listings: { total: number; approved: number; pending: number; rejected: number };
  bookings: number;
};

type Totals = { owners: number; travellers: number; admins: number; pendingListings: number; cancellations: number };
type Section = "owners" | "listings" | "cancellations";

const KIND_FILTERS: { id: ListingKind; label: string }[] = [
  { id: "STAY", label: "Hotels" },
  { id: "ATTRACTION", label: "Ziyarat" },
  { id: "TAXI", label: "Taxis" },
  { id: "RESTAURANT", label: "Food" },
];

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-500",
  pending: "bg-amber-500/15 text-amber-500",
  rejected: "bg-rose/15 text-rose",
};

const ROLE_LABEL: Record<string, string> = { OWNER: "Partner", TRAVELER: "Traveller", ADMIN: "Admin" };

const joined = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Avatar({ name, image, size = "h-10 w-10" }: { name: string; image?: string | null; size?: string }) {
  const [broken, setBroken] = useState(false);
  const text =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  if (image && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${size} shrink-0 rounded-full border border-brass/30 bg-ink/30 object-cover`}
      />
    );
  }
  return <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-brass/20 text-sm font-semibold text-brass`}>{text}</span>;
}

/** Dims the content and shows the HolyDays loader on top while a filter, tab or search is loading. */
function LoadingVeil({ loading, label, children }: { loading: boolean; label: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-40">
      <div className={`transition-opacity ${loading ? "pointer-events-none opacity-25" : ""}`}>{children}</div>
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-start justify-center pt-10" aria-live="polite" aria-busy>
          <LoaderMark label={label} />
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${STATUS_STYLE[status] ?? STATUS_STYLE.pending}`}>
      {status}
    </span>
  );
}

function ListingRow({
  l,
  money,
  onDecide,
  onOpenOwner,
}: {
  l: QueueItem;
  money: (n: number) => string;
  onDecide: (id: string, next: "approved" | "rejected", note: string) => void;
  onOpenOwner?: (ownerId: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  return (
    <article className="rounded-xl border border-brass/20 bg-ink-2 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-ink/30">
          <Image src={l.cover || "/images/hero-hunza-dusk.png"} alt="" fill sizes="64px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-sand">{l.name}</h3>
            <span className="rounded-full border border-brass/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-brass">
              {kindLabel[l.kind] ?? l.kind}
            </span>
            <StatusPill status={l.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-mist">
            {l.city} · {money(l.price)} / {unitLabel[l.priceUnit] ?? l.priceUnit}
            {onOpenOwner && l.ownerId ? (
              <>
                {" · "}
                <button type="button" className="text-sand underline decoration-brass/40 underline-offset-2 hover:text-brass" onClick={() => onOpenOwner(l.ownerId!)}>
                  {l.owner?.name || l.owner?.email || "Owner"}
                </button>
              </>
            ) : null}
            {typeof l.bookings === "number" ? ` · ${l.bookings} booking${l.bookings === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Link href={`/${kindPath[l.kind]}/${l.slug}`} className="btn-ghost px-3! py-1.5! text-xs!">
            Preview
          </Link>
          {l.status !== "approved" && (
            <button type="button" className="btn-primary px-3! py-1.5! text-xs!" onClick={() => onDecide(l.id, "approved", "")}>
              Approve
            </button>
          )}
          {l.status !== "rejected" && !rejecting && (
            <button type="button" className="btn-subtle px-3! py-1.5! text-xs!" onClick={() => setRejecting(true)}>
              Reject
            </button>
          )}
        </div>
      </div>
      {l.status === "rejected" && l.rejectReason && <p className="mt-1.5 text-xs text-rose">Rejected: {l.rejectReason}</p>}
      {rejecting && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            autoFocus
            className="auth-field mt-0! min-w-48 flex-1 px-3! py-1.5! text-sm!"
            placeholder="Reason for the owner (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="button" className="btn-primary px-3! py-1.5! text-xs!" onClick={() => onDecide(l.id, "rejected", note)}>
            Confirm reject
          </button>
          <button type="button" className="btn-subtle px-3! py-1.5! text-xs!" onClick={() => setRejecting(false)}>
            Cancel
          </button>
        </div>
      )}
    </article>
  );
}

export default function AdminPage() {
  const { money } = useSerai();
  const { data, status } = useSession();
  const isAdmin = status === "authenticated" && data?.user?.role === "ADMIN";

  const [section, setSection] = useState<Section>("owners");
  const [overlay, setOverlay] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [totals, setTotals] = useState<Totals>({ owners: 0, travellers: 0, admins: 0, pendingListings: 0, cancellations: 0 });

  // Owners / users directory
  const [role, setRole] = useState<"OWNER" | "TRAVELER" | "all">("OWNER");
  const [kind, setKind] = useState<"" | ListingKind>("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ user: Omit<UserRow, "listings" | "bookings">; listings: QueueItem[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Approval queue + cancellations
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [cancellations, setCancellations] = useState<BookingDTO[]>([]);
  const [cancelLoading, setCancelLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ role });
      if (kind) params.set("kind", kind);
      if (query.trim()) params.set("q", query.trim());
      const d = await readJson<{ users?: UserRow[]; totals?: Totals; error?: string }>(await fetch(`/api/admin/users?${params}`));
      if (d?.users) {
        setUsers(d.users);
        if (d.totals) setTotals(d.totals);
        setLoadError("");
      } else {
        setUsers([]);
        setLoadError(d?.error || "Could not load users.");
      }
    } catch {
      setUsers([]);
      setLoadError("Could not load users.");
    }
    setUsersLoading(false);
    setBooted(true);
  }, [role, kind, query]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const d = await readJson<{ user?: NonNullable<typeof detail>["user"]; listings?: QueueItem[]; error?: string }>(await fetch(`/api/admin/users/${id}`));
      setDetail(d?.user ? { user: d.user, listings: d.listings ?? [] } : null);
    } catch {
      setDetail(null);
    }
    setDetailLoading(false);
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const d = await readJson<QueueItem[] | { error?: string }>(await fetch(`/api/admin/listings?status=${tab}`));
      if (Array.isArray(d)) {
        setItems(d);
        setLoadError("");
      } else {
        setItems([]);
        setLoadError(d?.error || "Could not load listings.");
      }
    } catch {
      setItems([]);
      setLoadError("Could not load listings.");
    }
    setQueueLoading(false);
  }, [tab]);

  const loadCancellations = useCallback(async () => {
    setCancelLoading(true);
    try {
      const d = await readJson<BookingDTO[] | { error?: string }>(await fetch("/api/admin/bookings/cancellations"));
      if (Array.isArray(d)) {
        setCancellations(d);
        setLoadError("");
      } else {
        setCancellations([]);
        setLoadError(d?.error || "Could not load cancellation requests.");
      }
    } catch {
      setCancellations([]);
      setLoadError("Could not load cancellation requests.");
    }
    setCancelLoading(false);
  }, []);

  // users: search is debounced; the same fetch keeps the header counts fresh
  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => void loadUsers(), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [isAdmin, loadUsers, query]);

  useEffect(() => {
    if (isAdmin && section === "listings") void loadQueue();
  }, [isAdmin, section, loadQueue]);

  useEffect(() => {
    if (isAdmin && section === "cancellations") void loadCancellations();
  }, [isAdmin, section, loadCancellations]);

  useEffect(() => {
    if (isAdmin && selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [isAdmin, selectedId, loadDetail]);

  const decide = async (id: string, next: "approved" | "rejected", note: string) => {
    setOverlay(next === "approved" ? "Approving listing" : "Rejecting listing");
    await fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, rejectReason: note }),
    }).then((r) => readJson(r));
    await Promise.all([section === "listings" ? loadQueue() : Promise.resolve(), selectedId ? loadDetail(selectedId) : Promise.resolve(), loadUsers()]);
    setOverlay(null);
  };

  const decideCancellation = async (id: string, approve: boolean, refundPercent?: number) => {
    setOverlay(approve ? "Approving cancellation" : "Denying cancellation");
    setLoadError("");
    const res = await fetch(`/api/admin/bookings/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve, refundPercent }),
    });
    const data = await readJson<{ error?: string }>(res);
    if (!res.ok) setLoadError(data?.error || "Could not update this cancellation request.");
    await Promise.all([loadCancellations(), loadUsers()]);
    setOverlay(null);
  };

  const openOwner = (ownerId: string) => {
    setRole("all");
    setKind("");
    setQuery("");
    setSelectedId(ownerId);
    setSection("owners");
  };

  if (status === "loading" || (isAdmin && !booted)) return <PageLoader label="Opening admin" />;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20">
        <h1 className="font-display text-4xl">Admin only</h1>
        <p className="mt-3 text-mist">Sign in with the admin account to manage owners and approve listings.</p>
        <Link href="/login?callbackUrl=/admin" className="btn-primary mt-6 inline-flex">
          Admin sign in
        </Link>
      </div>
    );
  }

  const stat = (label: string, value: number, go: () => void, accent = false) => (
    <button
      type="button"
      onClick={go}
      className={`rounded-xl border px-4 py-3 text-left transition-colors hover:border-brass/60 ${accent && value > 0 ? "border-amber-500/50 bg-amber-500/5" : "border-brass/25 bg-ink-2"}`}
    >
      <span className="block text-[11px] uppercase tracking-[0.14em] text-mist">{label}</span>
      <span className="font-display mt-1 block text-3xl leading-none">{value}</span>
    </button>
  );

  const selected = users.find((u) => u.id === selectedId);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Admin</p>
      <h1 className="font-display mt-1 text-3xl">Dashboard</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat("Partners", totals.owners, () => { setSection("owners"); setRole("OWNER"); })}
        {stat("Travellers", totals.travellers, () => { setSection("owners"); setRole("TRAVELER"); })}
        {stat("Pending listings", totals.pendingListings, () => { setSection("listings"); setTab("pending"); }, true)}
        {stat("Cancellation requests", totals.cancellations, () => setSection("cancellations"), true)}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-b border-brass/15 pb-3">
        {(
          [
            ["owners", "Owners & users"],
            ["listings", "Listing approvals"],
            ["cancellations", "Cancellations"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className="filter-chip" data-on={section === id} onClick={() => setSection(id)}>
            {label}
            {id === "listings" && totals.pendingListings > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-ink">{totals.pendingListings}</span>
            )}
            {id === "cancellations" && totals.cancellations > 0 && (
              <span className="ml-1.5 rounded-full bg-rose px-1.5 py-0.5 text-[10px] font-semibold text-bone">{totals.cancellations}</span>
            )}
          </button>
        ))}
      </div>

      {loadError && <p className="mt-4 text-sm text-rose">{loadError}</p>}

      {section === "owners" && (
        <div className={`mt-5 grid gap-5 ${selectedId ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : ""}`}>
          <div className="min-w-0">
            <div className="rounded-2xl border border-brass/25 bg-ink-2/70 p-3">
              <input
                className="w-full rounded-xl bg-ink/30 px-3 py-2 text-sm text-sand outline-none ring-1 ring-sand/[0.08] focus:ring-brass/40"
                placeholder="Search by name, email or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["OWNER", "Partners"],
                    ["TRAVELER", "Travellers"],
                    ["all", "Everyone"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" className="filter-chip" data-on={role === id} onClick={() => setRole(id)}>
                    {label}
                  </button>
                ))}
                {role !== "TRAVELER" && (
                  <>
                    <span className="mx-1 hidden w-px bg-brass/20 sm:block" />
                    <button type="button" className="filter-chip" data-on={kind === ""} onClick={() => setKind("")}>
                      Any type
                    </button>
                    {KIND_FILTERS.map((k) => (
                      <button key={k.id} type="button" className="filter-chip" data-on={kind === k.id} onClick={() => setKind(k.id)}>
                        {k.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <p className="mt-3 text-xs text-mist">
              {usersLoading ? "Loading…" : `${users.length} ${users.length === 1 ? "account" : "accounts"}`}
              {users.length > 0 ? " · click one to see their listings" : ""}
            </p>

            <LoadingVeil loading={usersLoading} label="Loading accounts">
            <div className="space-y-2">
              {!usersLoading && users.length === 0 && !loadError && <p className="text-sm text-mist">No accounts match these filters.</p>}
              {users.map((u) => {
                const on = u.id === selectedId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedId(on ? null : u.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${on ? "border-brass bg-brass/10" : "border-brass/20 bg-ink-2 hover:border-brass/50"}`}
                  >
                    <Avatar name={u.name} image={u.image} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-sand">{u.name}</span>
                        <span className="rounded-full border border-brass/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-brass">
                          {u.role === "OWNER" && u.ownerKind ? `${kindLabel[u.ownerKind as ListingKind] ?? u.ownerKind} partner` : ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-mist">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ""}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-right sm:block">
                      {u.role === "OWNER" ? (
                        <>
                          <span className="block text-sm text-sand">
                            {u.listings.total} listing{u.listings.total === 1 ? "" : "s"}
                          </span>
                          {u.listings.pending > 0 ? (
                            <span className="text-[11px] font-semibold text-amber-500">{u.listings.pending} pending</span>
                          ) : (
                            <span className="text-[11px] text-mist">Joined {joined(u.createdAt)}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="block text-sm text-sand">
                            {u.bookings} booking{u.bookings === 1 ? "" : "s"}
                          </span>
                          <span className="text-[11px] text-mist">Joined {joined(u.createdAt)}</span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            </LoadingVeil>
          </div>

          {selectedId && (
            <aside className="relative min-w-0 self-start rounded-2xl border border-brass/30 bg-ink-2/70 p-4 lg:sticky lg:top-20">
              {detailLoading && detail && (
                <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-ink/60 backdrop-blur-[1px]" aria-busy>
                  <LoaderMark label="Loading owner" />
                </div>
              )}
              {detailLoading && !detail ? (
                <div className="grid min-h-48 place-items-center">
                  <LoaderMark label="Loading owner" />
                </div>
              ) : !detail ? (
                <p className="text-sm text-mist">Could not load this account.</p>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <Avatar name={detail.user.name} image={detail.user.image} size="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display truncate text-2xl leading-tight">{detail.user.name}</h2>
                      <p className="truncate text-sm text-mist">{detail.user.email}</p>
                    </div>
                    <button type="button" className="btn-subtle px-3! py-1.5! text-xs!" onClick={() => setSelectedId(null)}>
                      Close
                    </button>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {[
                      ["Role", detail.user.role === "OWNER" && detail.user.ownerKind ? `${kindLabel[detail.user.ownerKind as ListingKind] ?? detail.user.ownerKind} partner` : ROLE_LABEL[detail.user.role] ?? detail.user.role],
                      ["Phone", detail.user.phone || "—"],
                      ["Joined", joined(detail.user.createdAt)],
                      ["Email", detail.user.emailVerified ? "Verified" : "Not verified"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] uppercase tracking-[0.12em] text-mist">{k}</dt>
                        <dd className="text-sand">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 flex items-center justify-between border-t border-brass/15 pt-3">
                    <h3 className="text-[11px] uppercase tracking-[0.16em] text-brass">Listings ({detail.listings.length})</h3>
                    {selected && selected.listings.pending > 0 && (
                      <span className="text-xs font-semibold text-amber-500">{selected.listings.pending} awaiting approval</span>
                    )}
                  </div>
                  <div className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                    {detail.listings.length === 0 && <p className="text-sm text-mist">This account has no listings.</p>}
                    {detail.listings.map((l) => (
                      <ListingRow key={l.id} l={l} money={money} onDecide={decide} />
                    ))}
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
      )}

      {section === "listings" && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {(["pending", "approved", "rejected"] as const).map((id) => (
                <button key={id} type="button" className="filter-chip capitalize" data-on={tab === id} onClick={() => setTab(id)}>
                  {id}
                </button>
              ))}
            </div>
            <p className="text-xs text-mist">New and edited owner listings stay off the public site until approved.</p>
          </div>
          <div className="mt-3">
            <LoadingVeil loading={queueLoading} label="Loading listings">
              <div className="space-y-2">
                {!queueLoading && items.length === 0 && !loadError && <p className="text-sm text-mist">Nothing in this queue.</p>}
                {items.map((l) => (
                  <ListingRow key={l.id} l={l} money={money} onDecide={decide} onOpenOwner={openOwner} />
                ))}
              </div>
            </LoadingVeil>
          </div>
        </div>
      )}

      {section === "cancellations" && (
        <div className="mt-5 space-y-2">
          <p className="text-xs text-mist">Guests who requested a cancellation wait here until you approve or deny it.</p>
          <LoadingVeil loading={cancelLoading} label="Loading requests">
          <div className="space-y-2">
          {!cancelLoading && cancellations.length === 0 && !loadError && <p className="mt-3 text-sm text-mist">No pending cancellation requests.</p>}
          {cancellations.map((b) => (
            <article key={b.id} className="rounded-xl border border-brass/20 bg-ink-2 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-ink/30">
                  <Image src={b.listing.cover || "/images/hero-hunza-dusk.png"} alt="" fill sizes="64px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-sand">
                    {b.listing.name} <span className="font-normal text-brass">· {b.number}</span>
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-mist">
                    {formatDay(b.startDate)} — {formatDay(b.endDate)} · {money(b.total)} · {b.guestName} ({b.guestEmail})
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Link href={`/bookings/${b.id}`} className="btn-ghost px-3! py-1.5! text-xs!">
                    Details
                  </Link>
                </div>
              </div>
              <div className="mt-2">
                <RefundDecision
                  outlook={b.refundOutlook}
                  paidPkr={bookingPackageGrandTotal(b)}
                  onApprove={(pct) => decideCancellation(b.id, true, pct)}
                  onDeny={() => decideCancellation(b.id, false)}
                />
              </div>
              {b.extra?.cancelReason ? <p className="mt-1.5 rounded-lg bg-rose/10 px-3 py-1.5 text-xs text-rose">“{String(b.extra.cancelReason)}”</p> : null}
            </article>
          ))}
          </div>
          </LoadingVeil>
        </div>
      )}
    </div>
  );
}
