const keys = [
  {
    name: "Bronze key",
    ur: "کانسی",
    perk: "A late checkout that is actually late, and tea on the house wherever we keep a kettle.",
  },
  {
    name: "Silver lantern",
    ur: "چاندی",
    perk: "Room upgrades when the valley is quiet, and first look at new serais before they are announced.",
  },
  {
    name: "Gold caravan",
    ur: "سونے کا قافلہ",
    perk: "A composed route once a year, experiences folded in, and a host who already knows how you take your tea.",
  },
];

export default function CirclePage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-20">
      <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Serai Circle</p>
      <h1 className="font-display mt-3 text-6xl">Three keys.</h1>
      <p className="mt-4 max-w-xl text-mist">
        Not a punch card. A small society of people who stay long enough to learn the house. Nights with us unlock the next key.
      </p>
      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {keys.map((k) => (
          <article key={k.name} className="border border-brass/30 p-6">
            <p className="font-urdu text-brass">{k.ur}</p>
            <h2 className="font-display mt-2 text-3xl">{k.name}</h2>
            <p className="mt-4 text-sm leading-relaxed text-mist">{k.perk}</p>
            <div className="mt-8 h-px w-16 bg-brass" />
          </article>
        ))}
      </div>
    </div>
  );
}
