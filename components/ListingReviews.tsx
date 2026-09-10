"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { StarIcon } from "@/components/StarIcon";
import { catalogGuestReviews } from "@/lib/catalog-reviews";
import { readJson } from "@/lib/readJson";

export type ReviewItem = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  name: string;
};

function Stars({ value, onPick, size = "h-5 w-5" }: { value: number; onPick?: (n: number) => void; size?: string }) {
  return (
    <div className="flex gap-0.5 text-brass">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(n)}
          className={onPick ? "hover:scale-110" : "cursor-default"}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <StarIcon className={size} filled={n <= value} />
        </button>
      ))}
    </div>
  );
}

export function ListingReviews({
  listingId,
  reviews,
  avg,
  count,
  canReview,
  onPosted,
}: {
  listingId: string;
  reviews: ReviewItem[];
  avg: number;
  count: number;
  canReview: boolean;
  onPosted: () => void;
}) {
  const { status } = useSession();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, rating, body }),
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error || "Could not post review");
      return;
    }
    setBody("");
    onPosted();
  };

  return (
    <section className="mt-12 max-w-xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl">Reviews</h2>
        {count > 0 ? (
          <p className="flex items-center gap-2 text-sm text-mist">
            <StarIcon className="h-4 w-4 text-brass" />
            {avg} · {count} review{count === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-sm text-mist">No reviews yet</p>
        )}
      </div>

      {canReview && (
        <form
          className="mt-5 space-y-3 rounded-2xl border border-brass/30 bg-ink-2 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-sm text-sand">Leave a review</p>
          <Stars value={rating} onPick={setRating} />
          <textarea
            className="auth-field min-h-24"
            placeholder="How was this stay, taxi, or table?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          {error && <p className="text-sm text-rose">{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Posting…" : "Post review"}
          </button>
        </form>
      )}

        {status === "authenticated" && !canReview && count === 0 && (
        <p className="mt-4 text-sm text-mist">
          Reviews appear after a booking’s last day. Sign in as a guest, then leave one from this page or Your trips → Past.
        </p>
      )}

      <ul className="mt-6 max-h-[42rem] space-y-4 overflow-auto pr-1">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-2xl border border-brass/20 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-sand">{r.name}</p>
              <Stars value={r.rating > 5 ? Math.round(r.rating / 2) : r.rating} />
            </div>
            {r.createdAt && (
              <p className="mt-1 text-[11px] text-mist">
                {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
            <p className="mt-2 text-sm leading-relaxed text-mist">{r.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BookingReviewForm({ listingId, onPosted }: { listingId: string; onPosted: () => void }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-4 space-y-3 rounded-2xl border border-brass/25 bg-ink p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          const res = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listingId, rating, body }),
          });
          const text = await res.text();
          const data = text ? JSON.parse(text) : {};
          if (!res.ok) {
            setError(data.error || "Could not post review");
            setBusy(false);
            return;
          }
          setBody("");
          onPosted();
        } catch {
          setError("Could not post review");
        }
        setBusy(false);
      }}
    >
      <p className="text-sm text-sand">How was it?</p>
      <Stars value={rating} onPick={setRating} />
      <textarea
        className="auth-field min-h-20"
        placeholder="Leave a review of this past booking"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
      />
      {error && <p className="text-sm text-rose">{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}

export function ListingReviewsLoader({ slug }: { slug: string }) {
  const [pack, setPack] = useState<{
    reviews: ReviewItem[];
    avg: number;
    count: number;
    canReview: boolean;
  } | null>(null);

  const load = () => {
    if (!slug) return;
    const catalog = catalogGuestReviews(slug);
    fetch(`/api/listings/${slug}?t=${Date.now()}`, { cache: "no-store" })
      .then(async (r) => {
        const text = await r.text();
        return text ? JSON.parse(text) : { error: "Empty" };
      })
      .then((d) => {
        const live: ReviewItem[] = Array.isArray(d.reviews) ? d.reviews : [];
        const liveCount = Number(d.reviewCount ?? live.length) || 0;
        const liveAvg = Number(d.reviewAvg ?? 0) || 0;
        const merged = [...live, ...catalog.reviews.filter((r) => !live.some((x: ReviewItem) => x.body === r.body))];
        const count = Math.max(liveCount, catalog.count, merged.length);
        const avg = liveCount > 0 && !catalog.count ? liveAvg : catalog.avg || liveAvg;
        setPack({
          reviews: merged,
          avg,
          count,
          canReview: Boolean(d.canReview),
        });
      })
      .catch(() =>
        setPack({
          reviews: catalog.reviews,
          avg: catalog.avg,
          count: catalog.count,
          canReview: false,
        }),
      );
  };

  useEffect(() => {
    void load();
  }, [slug]);

  if (!pack) return null;
  return (
    <ListingReviews
      listingId={slug}
      reviews={pack.reviews}
      avg={pack.avg}
      count={pack.count}
      canReview={pack.canReview}
      onPosted={() => void load()}
    />
  );
}
