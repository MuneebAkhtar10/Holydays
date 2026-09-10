import Link from "next/link";
import { loadBookableStay } from "@/lib/bookable-stay";
import { parseListingMeta } from "@/lib/listing-meta";
import { fetchListingByKey } from "@/lib/listing-query";
import { propertyFacts } from "@/lib/property-details";
import { CANCEL_LABEL } from "@/lib/rooms";
import { stayRooms } from "@/lib/pricing";

export default async function CheckoutPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ stays?: string }>;
}) {
  const q = await searchParams;
  const ids = (q.stays ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = [...new Set(ids)];

  const blocks = [];
  for (const id of unique) {
    const stay = await loadBookableStay(id);
    if (!stay) continue;
    const listing = await fetchListingByKey(id);
    const meta = listing ? parseListingMeta(listing.meta) : null;
    const facts = propertyFacts(stay);
    const policies = meta?.policies?.length ? meta.policies : facts.policies;
    const rooms = stayRooms(stay);
    const rates = rooms.flatMap((r) => r.rates ?? []);
    blocks.push({ stay, facts, policies, rates, cancel: meta?.cancellation ?? stay.rooms[0]?.rates?.[0]?.cancellation ?? "partial" });
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-[11px] uppercase tracking-[0.28em] text-brass">Package policies</p>
      <h1 className="font-display mt-2 text-4xl">Cancellation and hotel policies</h1>
      <p className="mt-2 text-sm text-mist">These rules apply to every hotel in this package. Read them before you confirm.</p>

      <section id="cancellation" className="pane mt-6 scroll-mt-24 p-5">
        <h2 className="font-display text-2xl">Cancellation policy</h2>
        <p className="mt-2 text-sm text-mist">Each hotel rate has its own cancellation term.</p>
        <ul className="mt-4 space-y-3">
          {blocks.map((b) => (
            <li key={`cancel-${b.stay.id}`}>
              <p className="font-medium text-sand">{b.stay.name}</p>
              <p className="text-sm text-mist">Default: {CANCEL_LABEL[b.cancel]}</p>
              <ul className="mt-2 space-y-1 text-sm text-sand">
                {b.rates.map((rate) => (
                  <li key={rate.id}>
                    {rate.name} · {CANCEL_LABEL[rate.cancellation]}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {blocks.length === 0 ? <p className="mt-8 text-mist">No hotel policies found.</p> : null}

      <div id="hotel-policy" className="scroll-mt-24">
      {blocks.map((b) => (
        <section key={b.stay.id} className="pane mt-6 p-5">
          <h2 className="font-display text-2xl">{b.stay.name}</h2>
          <p className="mt-1 text-sm text-mist">
            {b.stay.city} · In {b.facts.checkIn} · out {b.facts.checkOut} · {CANCEL_LABEL[b.cancel]}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-sand">
            {b.rates.map((rate) => (
              <li key={rate.id} className="rounded-xl bg-ink/25 px-3 py-2">
                {rate.name} · {CANCEL_LABEL[rate.cancellation]}
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-[11px] uppercase tracking-[0.16em] text-brass">House rules</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-sand">
            {b.policies.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      ))}
      </div>

      <p className="mt-8 text-sm text-mist">Close this tab to return to checkout.</p>
      {unique[0] ? (
        <Link href={`/stay/${unique[0]}`} className="btn-ghost mt-4 inline-flex">
          Back to hotel
        </Link>
      ) : null}
    </div>
  );
}
