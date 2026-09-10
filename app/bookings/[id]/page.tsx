"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { BookingReviewForm } from "@/components/ListingReviews";
import { BookingActions, BookingHero, BookingNotifyStrip, PaymentBlock } from "@/components/BookingBits";
import { MessageComposer, MessageThread } from "@/components/MessageThread";
import { readJson } from "@/lib/readJson";
import type { BookingDTO } from "@/lib/booking-dto";
import { formatDay, nightsBetween } from "@/lib/format";
import { PackageSnapshot } from "@/components/PackageSteps";
import type { StayPackage } from "@/lib/package-plan";

const bucketCopy = {
  upcoming: "Upcoming",
  current: "Current stay",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDTO | null>(null);
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [guests, setGuests] = useState(1);
  const [origin, setOrigin] = useState("");

  const load = () =>
    fetch(`/api/bookings/${id}`)
      .then((r) => readJson<BookingDTO & { error?: string }>(r))
      .then((d) => {
        if (!d || d.error) setBooking(null);
        else {
          setBooking(d);
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

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <Link href="/trips" className="text-sm text-mist hover:text-sand">
        ← My bookings
      </Link>
      <div className="mt-6">
        <span className="rounded-full border border-brass/40 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-brass">
          {bucketCopy[booking.bucket]}
        </span>
      </div>
      <div className="mt-4">
        <BookingHero booking={booking} />
      </div>
      <PackageSnapshot
        pack={booking.extra.package as StayPackage | undefined}
        guests={booking.guests}
        nights={Math.max(1, nightsBetween(booking.startDate, booking.endDate))}
        stayName={booking.listing.name}
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
      </div>

      {live && (
        <div className="mt-8 rounded-2xl border border-brass/25 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Modify booking</h2>
            <button type="button" className="btn-ghost text-sm" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : "Change dates"}
            </button>
          </div>
          {editing && (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setOverlay("Updating booking");
                const res = await fetch(`/api/bookings/${booking.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ startDate: start, endDate: end, guests }),
                });
                const data = await readJson<BookingDTO & { error?: string }>(res);
                setOverlay(null);
                if (!res.ok) {
                  setError(data?.error || "Could not update");
                  return;
                }
                setBooking(data);
                setEditing(false);
              }}
            >
              <label className="auth-label">
                Arrive
                <input type="date" className="auth-field" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="auth-label">
                Depart
                <input type="date" className="auth-field" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
              <label className="auth-label">
                Guests
                <input type="number" min={1} className="auth-field" value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
              </label>
              <button type="submit" className="btn-primary sm:col-span-3">
                Save changes
              </button>
            </form>
          )}
          <button
            type="button"
            className="mt-4 text-sm text-rose"
            onClick={async () => {
              if (!confirm("Cancel this reservation?")) return;
              setOverlay("Cancelling booking");
              await fetch(`/api/bookings/${booking.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "cancelled" }),
              });
              router.push("/trips");
            }}
          >
            Cancel booking
          </button>
        </div>
      )}

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

      {error && <p className="mt-4 text-sm text-rose">{error}</p>}
      <p className="mt-6 text-xs text-mist">Placed {formatDay(booking.createdAt.slice(0, 10))}</p>
    </div>
  );
}
