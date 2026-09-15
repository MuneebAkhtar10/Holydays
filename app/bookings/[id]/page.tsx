"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { BookingReviewForm } from "@/components/ListingReviews";
import { BookingActions, BookingHero, BookingNotifyStrip, PaymentBlock } from "@/components/BookingBits";
import { MessageComposer, MessageThread } from "@/components/MessageThread";
import { readJson } from "@/lib/readJson";
import type { BookingDTO } from "@/lib/booking-dto";
import { formatDay, minCheckoutIso } from "@/lib/format";
import { PackageSnapshot } from "@/components/PackageSteps";
import { packagePrimaryAmount, type StayPackage } from "@/lib/package-plan";
import { CancelBookingModal } from "@/components/CancelBookingModal";

const bucketCopy = {
  upcoming: "Upcoming",
  current: "Current stay",
  completed: "Completed",
  cancelled: "Cancelled",
};

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
  const [cancelModal, setCancelModal] = useState<{ ids: string[]; title: string } | null>(null);

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
  const tel = booking.listing.phone.replace(/\s/g, "");
  const isPackage = siblings.length > 1;
  const modifyBooking = siblings.find((b) => b.id === modifyTarget) ?? booking;
  const pendingCancel = booking.status === "cancel_requested";
  const pendingDriver = booking.status === "pending_driver";
  const declined = booking.status === "declined";

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <Link href="/trips" className="text-sm text-mist hover:text-sand">
        ← My bookings
      </Link>
      <div className="mt-6">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] ${
            booking.status === "cancelled" || declined
              ? "bg-sand/10 text-mist"
              : pendingCancel
                ? "bg-rose/15 text-rose"
                : pendingDriver
                  ? "bg-brass/15 text-brass"
                  : booking.bucket === "completed"
                    ? "bg-brass/15 text-brass"
                    : "bg-sage/15 text-sage"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              booking.status === "cancelled" || declined
                ? "bg-mist"
                : pendingCancel
                  ? "bg-rose"
                  : pendingDriver
                    ? "bg-brass"
                    : booking.bucket === "completed"
                      ? "bg-brass"
                      : "bg-sage"
            }`}
          />
          {declined
            ? "Declined"
            : pendingCancel
              ? "Cancellation requested"
              : pendingDriver
                ? "Awaiting driver response"
                : bucketCopy[booking.bucket]}
        </span>
      </div>
      <div className="mt-4">
        <BookingHero booking={booking} />
      </div>
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
      <div className="mt-6">
        <BookingActions booking={booking} origin={origin} />
      </div>
      <div className="mt-6">
        <BookingNotifyStrip booking={booking} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <PaymentBlock booking={booking} />
        <div className="rounded-2xl border border-brass/25 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Contact property</p>
          <p className="mt-3 text-sand">{booking.listing.phone || "No phone listed"}</p>
          <p className="text-sm text-mist">{booking.listing.email || "No email listed"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {tel && (
              <a className="btn-ghost text-sm" href={`tel:${tel}`}>
                Call
              </a>
            )}
            {booking.listing.email && (
              <a className="btn-ghost text-sm" href={`mailto:${booking.listing.email}?subject=${encodeURIComponent(`HolyDays ${booking.number}`)}`}>
                Email
              </a>
            )}
            <Link className="btn-ghost text-sm" href={booking.listing.path}>
              Property page
            </Link>
          </div>
        </div>
        {booking.listing.hostName && (
          <div className="rounded-2xl border border-brass/25 p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Host · {booking.listing.hostName}</p>
            {booking.listing.hostContactRevealed ? (
              <>
                <p className="mt-3 text-sand">{booking.listing.hostPhone || "No phone listed"}</p>
                <p className="text-sm text-mist">{booking.listing.hostEmail || "No email listed"}</p>
                {booking.listing.hostContactHours && (
                  <p className="mt-1 text-sm text-mist">Best time to contact: {booking.listing.hostContactHours}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {booking.listing.hostPhone && (
                    <a className="btn-ghost text-sm" href={`tel:${booking.listing.hostPhone.replace(/\s/g, "")}`}>
                      Call host
                    </a>
                  )}
                  {booking.listing.hostEmail && (
                    <a
                      className="btn-ghost text-sm"
                      href={`mailto:${booking.listing.hostEmail}?subject=${encodeURIComponent(`HolyDays ${booking.number}`)}`}
                    >
                      Email host
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-mist">Full host contact details unlock once your booking is confirmed.</p>
            )}
          </div>
        )}
      </div>

      {live && (
        <div className="mt-8 rounded-2xl border border-brass/25 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Modify booking</h2>
            {!pendingCancel && !pendingDriver && (
              <button
                type="button"
                className="btn-ghost text-sm"
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
            <p className="mt-3 text-sm text-mist">
              Cancellation requested — awaiting review. You'll be notified once it's decided.
            </p>
          ) : pendingDriver ? (
            <p className="mt-3 text-sm text-mist">
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
                      <input type="date" className="auth-field" min={minCheckoutIso(start)} value={end} onChange={(e) => setEnd(e.target.value < minCheckoutIso(start) ? minCheckoutIso(start) : e.target.value)} />
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
              <div className="mt-4 flex flex-wrap gap-4">
                <button
                  type="button"
                  className="text-sm text-rose"
                  onClick={() => setCancelModal({ ids: [booking.id], title: `Cancel ${booking.listing.name}?` })}
                >
                  {isPackage ? "Cancel this hotel" : "Cancel booking"}
                </button>
                {isPackage && (
                  <button
                    type="button"
                    className="text-sm text-rose"
                    onClick={() => setCancelModal({ ids: siblings.map((b) => b.id), title: "Cancel the whole package?" })}
                  >
                    Cancel whole package
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <CancelBookingModal
        open={Boolean(cancelModal)}
        bookingIds={cancelModal?.ids ?? []}
        title={cancelModal?.title}
        onClose={() => setCancelModal(null)}
        onCancelled={() => void load()}
      />

      <div className="mt-8 rounded-2xl border border-brass/25 p-5">
        <h2 className="font-display text-2xl">Talk to the property</h2>
        <p className="mt-2 text-sm text-mist">
          Chat with the host. New replies show as unread until you open this page.
          {(booking.unreadFromHost ?? 0) > 0 ? ` ${booking.unreadFromHost} unread.` : ""}
        </p>
        <div className="mt-4 max-h-80 overflow-y-auto rounded-xl bg-ink/30 p-3">
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
      </div>

      {booking.bucket === "completed" && booking.status !== "cancelled" && (
        <div className="mt-8">
          <h2 className="font-display text-2xl">Leave a review</h2>
          {booking.myReview ? (
            <p className="mt-3 text-brass">You rated this stay {booking.myReview.rating}/5.</p>
          ) : (
            <BookingReviewForm listingId={booking.listing.slug} onPosted={() => void load()} />
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-mist">Placed {formatDay(booking.createdAt.slice(0, 10))}</p>
    </div>
  );
}
