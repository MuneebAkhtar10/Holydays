import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBookableStay } from "@/lib/bookable-stay";
import { parseListingMeta } from "@/lib/listing-meta";
import { fetchListingByKey } from "@/lib/listing-query";
import { propertyFacts } from "@/lib/property-details";
import { CANCEL_LABEL } from "@/lib/rooms";
import { stayRooms } from "@/lib/pricing";

export default async function StayPoliciesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stay = await loadBookableStay(id);
  if (!stay) notFound();
  const listing = await fetchListingByKey(id);
  const meta = listing ? parseListingMeta(listing.meta) : null;
  const facts = propertyFacts(stay);
  const policies = meta?.policies?.length ? meta.policies : facts.policies;
  const rooms = stayRooms(stay);
  const rates = rooms.flatMap((r) => r.rates ?? []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-[11px] uppercase tracking-[0.28em] text-brass">Policies</p>
      <h1 className="font-display mt-2 text-4xl">{stay.name}</h1>
      <p className="mt-2 text-sm text-mist">
        {stay.city}
        {stay.region ? `, ${stay.region}` : ""} · In {facts.checkIn} · out {facts.checkOut}
      </p>

      <section id="cancellation" className="pane mt-8 scroll-mt-24 p-5">
        <h2 className="font-display text-2xl">Cancellation policy</h2>
        <p className="mt-2 text-sm text-mist">Hotel default: {CANCEL_LABEL[meta?.cancellation ?? stay.rooms[0]?.rates?.[0]?.cancellation ?? "partial"]}.</p>
        <ul className="mt-4 space-y-2 text-sm text-sand">
          {rates.map((rate) => (
            <li key={rate.id} className="rounded-xl bg-ink/25 px-3 py-2">
              {rate.name} · {CANCEL_LABEL[rate.cancellation]}
            </li>
          ))}
        </ul>
      </section>

      <section id="hotel-policy" className="pane mt-4 scroll-mt-24 p-5">
        <h2 className="font-display text-2xl">Hotel policy</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-sand">
          {policies.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <Link href={`/stay/${id}`} className="btn-ghost mt-8 inline-flex">
        Back to hotel
      </Link>
    </div>
  );
}
