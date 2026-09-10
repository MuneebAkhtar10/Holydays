import Image from "next/image";
import { experiences } from "@/lib/experiences";
import { Money } from "@/components/Money";

export default function ExperiencesPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Beyond the bed</p>
      <h1 className="font-display mt-2 text-5xl">Experiences</h1>
      <p className="mt-3 max-w-xl text-mist">Fold these into a stay at checkout, or collect them like stamps.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {experiences.map((e) => (
          <article key={e.id} className="overflow-hidden border border-brass/20">
            <div className="relative h-56">
              <Image src={e.cover} alt={e.title} fill className="object-cover" />
            </div>
            <div className="p-6">
              <p className="text-xs uppercase tracking-widest text-brass">{e.place}</p>
              <h2 className="font-display mt-1 text-3xl">{e.title}</h2>
              <p className="mt-3 text-mist">{e.blurb}</p>
              <p className="mt-4 text-sm">
                {e.hours} · <Money amount={e.price} />
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
