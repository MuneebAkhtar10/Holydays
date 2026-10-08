"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { BookingReviewForm } from "@/components/ListingReviews";
import { BookingActions, BookingContacts, BookingHero, BookingNotifyStrip, PaymentBlock } from "@/components/BookingBits";
import { MessageComposer, MessageThread } from "@/components/MessageThread";
import { readJson } from "@/lib/readJson";
import type { BookingDTO } from "@/lib/booking-dto";
import { formatDay, minCheckoutIso } from "@/lib/format";
import { PackageSnapshot } from "@/components/PackageSteps";
import { packagePrimaryAmount, type StayPackage } from "@/lib/package-plan";
import { CancelBookingModal } from "@/components/CancelBookingModal";
import { refundHint } from "@/lib/refund-policy";

export default function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDTO | null>(null);
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [modifyTarget, setModifyTarget] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [guests, setGuests] = useState(1);
  const [origin, setOrigin] = useState("");
  const [siblings, setSiblings] = useState<BookingDTO[]>([]);
  const [cancelModal, setCancelModal] = useState<{ ids: string[]; title: string; refund?: string } | null>(null);

  const load = () =>
    fetch(`/api/bookings/${id}`)
      .then((r) => readJson<BookingDTO & { error?: string }>(r))
      .then(async (d) => {
        if (!d || d.error) {
          setBooking(null);
          setReady(true);
          return;
        }
        setBooking(d);
        setModifyTarget(d.id);
        setStart(d.startDate);
        setEnd(d.endDate);
        setGuests(d.guests);
        if ((d.unreadFromHost ?? 0) > 0) {
          void fetch(`/api/bookings/${d.id}/assist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ read: true }),
          }).then(() => setBooking((row) => (row ? { ...row, unreadFromHost: 0 } : row)));
        }
        const packageId = String(d.extra?.packageId ?? "") || d.id;
        try {
          const list = await fetch("/api/bookings").then((r) => readJson<BookingDTO[]>(r));
          const group = Array.isArray(list)
            ? list.filter((b) => (String(b.extra?.packageId ?? "") || b.id) === packageId)
            : [];
          setSiblings(group);
        } catch {
          setSiblings([]);
        }
        setReady(true);
      });

  useEffect(() => {
    setOrigin(window.location.origin);
    setReady(false);
    void load().catch(() => setReady(true));
    const t = window.setInterval(() => void load().catch(() => undefined), 8000);
    return () => window.clearInterval(t);
  }, [id]);

  if (!ready) return <PageLoader label="Opening booking" />;
  if (!booking) return <p className="p-10 text-mist">Booking not found.</p>;

  const live = booking.status !== "cancelled" && booking.bucket !== "completed";
  const isPackage = siblings.length > 1;
  const modifyBooking = siblings.find((b) => b.id === modifyTarget) ?? booking;
  const pendingCancel = booking.status === "cancel_requested";
  const pendingDriver = booking.status === "pending_driver";
  const card = "rounded-2xl border border-brass/25 bg-ink-2/70 p-5";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <Link href="/trips" className="text-sm text-mist hover:text-sand">
        ← My bookings
      </Link>

      <div className="mt-4">
        <BookingHero booking={booking} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <PackageSnapshot
            pack={booking.extra.package as StayPackage | undefined}
            guests={booking.guests}
            stayName={booking.listing.name}
            primaryStay={
              booking.extra.package
                ? {
                    name: booking.listing.name,
                    city: booking.listing.city,
                    checkin: booking.startDate,
                    checkout: booking.endDate,
                    amount: packagePrimaryAmount(booking.total, booking.extra.package as StayPackage),
                  }
                : undefined
            }
            bookingTotal={booking.total}
          />

          {Boolean(booking.extra.reservation) && Boolean(String(booking.extra.requests ?? "").trim()) && (
            <section className={card}>
              <h2 className="font-display text-xl">Your requests</h2>
              <p className="mt-2 text-sm text-sand/90">“{String(booking.extra.requests)}”</p>
            </section>
          )}

          <BookingContacts booking={booking} />

          {live && (
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl">Manage booking</h2>
                  <p className="mt-1 text-sm text-mist">Change your dates or cancel.</p>
                </div>
                {!pendingCancel && !pendingDriver && (
                  <button
                    type="button"
                    className="btn-ghost px-3! py-1.5! text-sm!"
                    onClick={() => {
                      setEditing((v) => !v);
                      setModifyTarget(booking.id);
                      setStart(booking.startDate);
                      setEnd(booking.endDate);
                      setGuests(booking.guests);
                    }}
                  >
                    {editing ? "Close" : "Change dates"}
                  </button>
                )}
              </div>

              {pendingCancel ? (
                <p className="mt-3 rounded-xl bg-rose/10 px-4 py-3 text-sm text-rose">
                  Cancellation requested — awaiting review. You'll be notified by email once it's decided.
                </p>
              ) : pendingDriver ? (
                <p className="mt-3 rounded-xl bg-brass/10 px-4 py-3 text-sm text-brass">
                  Waiting on the driver to confirm this custom trip. You'll be notified as soon as they respond.
                </p>
              ) : (
                <>
                  {editing && (
                    <>
                      {isPackage && (
                        <div className="mt-4">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-mist">Which hotel?</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {siblings.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                className="filter-chip"
                                data-on={modifyTarget === b.id}
                                onClick={() => {
                                  setModifyTarget(b.id);
                                  setStart(b.startDate);
                                  setEnd(b.endDate);
                                  setGuests(b.guests);
                                  setError("");
                                }}
                              >
                                {b.listing.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <form
                        className="mt-4 grid gap-3 sm:grid-cols-3"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setError("");
                          setOverlay("Updating booking");
                          const res = await fetch(`/api/bookings/${modifyTarget}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ startDate: start, endDate: end, guests }),
                          });
                          const data = await readJson<BookingDTO & { error?: string }>(res);
                          setOverlay(null);
                          if (!res.ok || !data) {
                            setError(data?.error || "Could not update");
                            return;
                          }
                          if (modifyTarget === booking.id) setBooking(data);
                          setSiblings((rows) => rows.map((b) => (b.id === modifyTarget ? data : b)));
                          setEditing(false);
                        }}
                      >
                        <label className="auth-label">
                          Arrive
                          <input type="date" className="auth-field" min={minCheckoutIso()} value={start} onChange={(e) => setStart(e.target.value)} />
                        </label>
                        <label className="auth-label">
                          Depart
                          <input
                            type="date"
                            className="auth-field"
                            min={minCheckoutIso(start)}
                            value={end}
                            onChange={(e) => setEnd(e.target.value < minCheckoutIso(start) ? minCheckoutIso(start) : e.target.value)}
                          />
                        </label>
                        <label className="auth-label">
                          Guests
                          <input type="number" min={1} className="auth-field" value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
                        </label>
                        {error && <p className="text-sm text-rose sm:col-span-3">{error}</p>}
                        <button type="submit" className="btn-primary sm:col-span-3">
                          Save changes for {modifyBooking.listing.name}
                        </button>
                      </form>
                    </>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-brass/10 pt-4">
                    <button
                      type="button"
                      className="rounded-xl border border-rose/40 px-3.5 py-2 text-sm text-rose transition-colors hover:bg-rose/10"
                      onClick={() => setCancelModal({ ids: [booking.id], title: `Cancel ${booking.listing.name}?`, refund: refundHint(booking) })}
                    >
                      {isPackage ? "Cancel this hotel" : "Cancel booking"}
                    </button>
                    {isPackage && (
                      <button
                        type="button"
                        className="rounded-xl border border-rose/40 px-3.5 py-2 text-sm text-rose transition-colors hover:bg-rose/10"
                        onClick={() => setCancelModal({ ids: siblings.map((b) => b.id), title: "Cancel the whole package?", refund: refundHint(booking) })}
                      >
                        Cancel whole package
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          <section className={card}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl">Messages</h2>
              {(booking.unreadFromHost ?? 0) > 0 && (
                <span className="rounded-full bg-brass/20 px-2.5 py-0.5 text-[11px] font-semibold text-brass">{booking.unreadFromHost} unread</span>
              )}
            </div>
            <p className="mt-1 text-sm text-mist">Chat with the host about this booking.</p>
            <div className="mt-3 max-h-80 overflow-y-auto rounded-xl bg-ink/30 p-3">
              <MessageThread messages={booking.messages ?? []} viewer="guest" />
            </div>
            <MessageComposer
              label="Send"
              placeholder="Type a message…"
              onSend={async (message) => {
                const res = await fetch(`/api/bookings/${booking.id}/assist`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message }),
                });
                const data = await readJson<{ error?: string }>(res);
                if (!res.ok) throw new Error(data?.error || "Could not send");
                await load();
              }}
            />
          </section>

          {booking.bucket === "completed" && booking.status !== "cancelled" && (
            <section className={card}>
              <h2 className="font-display text-xl">Leave a review</h2>
              {booking.myReview ? (
                <p className="mt-3 text-brass">You rated this stay {booking.myReview.rating}/5.</p>
              ) : (
                <div className="mt-3">
                  <BookingReviewForm listingId={booking.listing.slug} onPosted={() => void load()} />
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <PaymentBlock booking={booking} />
          <BookingActions booking={booking} origin={origin} />
          <BookingNotifyStrip booking={booking} />
          <p className="px-1 text-xs text-mist">Booked {formatDay(booking.createdAt.slice(0, 10))}</p>
        </aside>
      </div>

      <CancelBookingModal
        open={Boolean(cancelModal)}
        bookingIds={cancelModal?.ids ?? []}
        title={cancelModal?.title}
        refundNote={cancelModal?.refund}
        onClose={() => setCancelModal(null)}
        onCancelled={() => void load()}
      />
    </div>
  );
}
