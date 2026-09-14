"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { StarIcon } from "@/components/StarIcon";
import { catalogGuestReviews, fillGuestReviews } from "@/lib/catalog-reviews";
import { readJson } from "@/lib/readJson";

export type ReviewItem = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  name: string;
};

type ScoreFloor = 0 | 7 | 8 | 9;
type ReviewSort = "newest" | "highest" | "lowest";

const PREVIEW = 4;
const BATCH = 10;
const SCORE_CHIPS: { id: ScoreFloor; label: string }[] = [
  { id: 0, label: "All" },
  { id: 9, label: "9+" },
  { id: 8, label: "8+" },
  { id: 7, label: "7+" },
];

function score10(rating: number) {
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  return rating > 5 ? rating : rating * 2;
}

function formatScore(rating: number) {
  const ten = score10(rating);
  return Number.isInteger(ten) ? String(ten) : ten.toFixed(1);
}

function filterReviews(reviews: ReviewItem[], min: ScoreFloor, sort: ReviewSort, query: string) {
  const needle = query.trim().toLowerCase();
  let out = reviews.filter((r) => {
    if (min && score10(r.rating) < min) return false;
    if (needle && !`${r.name} ${r.body}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  if (sort === "newest") {
    out = [...out].sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0));
  } else if (sort === "highest") {
    out = [...out].sort((a, b) => score10(b.rating) - score10(a.rating) || +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0));
  } else {
    out = [...out].sort((a, b) => score10(a.rating) - score10(b.rating) || +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0));
  }
  return out;
}

function Stars({ value, onPick, size = "h-4 w-4" }: { value: number; onPick?: (n: number) => void; size?: string }) {
  return (
    <div className="flex gap-0.5 text-brass">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.45;
        return (
          <button
            key={n}
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(n)}
            className={onPick ? "hover:scale-110" : "cursor-default"}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <span className={`relative inline-block ${size}`}>
              <StarIcon className={`${size} opacity-35`} filled={false} />
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: filled ? "100%" : half ? "50%" : "0%" }}>
                <StarIcon className={size} filled />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const ten = score10(review.rating);
  return (
    <li className="rounded-xl border border-brass/18 bg-ink/40 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sand">{review.name}</p>
          {review.createdAt ? (
            <p className="mt-0.5 text-[11px] text-mist">
              {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Stars value={ten / 2} />
          <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-brass/15 px-2 text-sm font-semibold tabular-nums text-brass">
            {formatScore(review.rating)}
          </span>
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-mist">{review.body}</p>
    </li>
  );
}

function ReviewFilters({
  min,
  sort,
  query,
  onMin,
  onSort,
  onQuery,
  className = "",
}: {
  min: ScoreFloor;
  sort: ReviewSort;
  query: string;
  onMin: (v: ScoreFloor) => void;
  onSort: (v: ReviewSort) => void;
  onQuery: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex flex-wrap gap-1.5">
        {SCORE_CHIPS.map((chip) => (
          <button key={chip.id} type="button" className="filter-chip !px-3 !py-1.5" data-on={min === chip.id} onClick={() => onMin(chip.id)}>
            {chip.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
        <label className="min-w-0">
          <span className="sr-only">Search reviews</span>
          <input
            className="auth-field"
            placeholder="Search comments"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Sort reviews</span>
          <select className="auth-field" value={sort} onChange={(e) => onSort(e.target.value as ReviewSort)}>
            <option value="newest">Newest</option>
            <option value="highest">Highest score</option>
            <option value="lowest">Lowest score</option>
          </select>
        </label>
      </div>
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
  externalRating,
}: {
  listingId: string;
  reviews: ReviewItem[];
  avg: number;
  count: number;
  canReview: boolean;
  onPosted: () => void;
  externalRating?: { source: string; score: number; count: number; url?: string } | null;
}) {
  const { status } = useSession();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [min, setMin] = useState<ScoreFloor>(0);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(BATCH);
  const [openAll, setOpenAll] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);

  const filled = useMemo(
    () => fillGuestReviews(listingId, reviews, avg, count),
    [listingId, reviews, avg, count],
  );
  const filtered = useMemo(() => filterReviews(filled, min, sort, query), [filled, min, sort, query]);
  const preview = filtered.slice(0, PREVIEW);
  const visible = filtered.slice(0, shown);
  const bookingCount = externalRating?.count || 0;
  const hasMore = shown < filtered.length;

  useEffect(() => {
    setShown(BATCH);
  }, [min, sort, query, listingId, openAll]);

  useEffect(() => {
    if (!openAll) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenAll(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [openAll]);

  useEffect(() => {
    if (!openAll || !hasMore) return;
    const root = listRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown((n) => Math.min(n + BATCH, filtered.length));
        }
      },
      { root, rootMargin: "160px", threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [openAll, hasMore, shown, filtered.length]);

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
    <section className="mt-12 max-w-2xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl">Reviews</h2>
        {count > 0 ? (
          <p className="flex items-center gap-2 text-sm text-mist">
            <StarIcon className="h-4 w-4 text-brass" />
            {avg} · {Number(count).toLocaleString("en-GB")} review{count === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-sm text-mist">No reviews yet</p>
        )}
      </div>

      {externalRating?.source && bookingCount > 0 ? (
        <p className="mt-2 text-sm text-mist">
          Rated {externalRating.score} on {externalRating.source} ({bookingCount.toLocaleString("en-GB")} reviews)
        </p>
      ) : null}

      {filled.length > 0 ? (
        <ReviewFilters className="mt-4" min={min} sort={sort} query={query} onMin={setMin} onSort={setSort} onQuery={setQuery} />
      ) : null}

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

      {filtered.length === 0 && filled.length > 0 ? (
        <p className="mt-6 text-sm text-mist">No reviews match these filters.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {preview.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </ul>
      )}

      {filled.length > PREVIEW ? (
        <button type="button" className="btn-ghost mt-5 rounded-full" onClick={() => setOpenAll(true)}>
          Show more reviews
        </button>
      ) : null}

      {openAll ? (
        <div className="fixed inset-0 z-[80]">
          <button type="button" className="absolute inset-0 bg-ink/80 backdrop-blur-[2px]" aria-label="Close reviews" onClick={() => setOpenAll(false)} />
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-y-auto px-4 pb-8 pt-24 md:px-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="all-reviews-title"
              className="pointer-events-auto mb-6 flex max-h-[calc(100vh-7.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-brass/35 bg-ink shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-brass/20 px-5 py-4">
                <div>
                  <h3 id="all-reviews-title" className="font-display text-2xl leading-none">
                    All reviews
                  </h3>
                  <p className="mt-2 text-sm text-mist">
                    Showing {visible.length.toLocaleString("en-GB")} of {filtered.length.toLocaleString("en-GB")}
                  </p>
                </div>
                <button type="button" className="btn-ghost h-9 shrink-0 rounded-full px-3 text-sm" onClick={() => setOpenAll(false)}>
                  Close
                </button>
              </div>
              <div className="shrink-0 border-b border-brass/15 px-5 py-3">
                <ReviewFilters min={min} sort={sort} query={query} onMin={setMin} onSort={setSort} onQuery={setQuery} />
              </div>
              <ul ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {filtered.length === 0 ? (
                  <li className="py-10 text-center text-sm text-mist">No reviews match these filters.</li>
                ) : (
                  <>
                    {visible.map((r) => (
                      <ReviewCard key={r.id} review={r} />
                    ))}
                    {hasMore ? (
                      <li ref={sentinelRef} className="py-3 text-center text-xs text-mist">
                        Loading more reviews…
                      </li>
                    ) : (
                      <li className="py-3 text-center text-xs text-mist">End of reviews</li>
                    )}
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
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

export function ListingReviewsLoader({
  slug,
  externalRating,
}: {
  slug: string;
  externalRating?: { source: string; score: number; count: number; url?: string } | null;
}) {
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
        const merged = live.length ? live : catalog.reviews;
        const count = live.length ? liveCount : catalog.count;
        const avg = live.length ? liveAvg : catalog.avg;
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
      externalRating={externalRating}
    />
  );
}
