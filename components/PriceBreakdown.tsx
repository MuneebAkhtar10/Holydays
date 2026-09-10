"use client";

import { useSerai } from "@/lib/store";
import type { PriceQuote } from "@/lib/pricing";

export function PriceBreakdown({
  quote,
  compact,
  totalLabel = "Total",
}: {
  quote: PriceQuote;
  compact?: boolean;
  totalLabel?: string;
}) {
  const { money } = useSerai();
  const amount = compact ? "text-ink" : "text-sand";
  return (
    <ul className={`space-y-1.5 ${compact ? "text-sm text-ink/80" : "text-sm text-mist"}`}>
      {quote.lines.map((l) => (
        <li key={l.id} className="flex justify-between gap-4">
          <span>{l.label}</span>
          <span className={`shrink-0 ${amount}`}>{money(l.amount)}</span>
        </li>
      ))}
      {quote.discounts.map((l) => (
        <li key={l.id} className="flex justify-between gap-4 text-sage">
          <span>{l.label}</span>
          <span className="shrink-0">{money(l.amount)}</span>
        </li>
      ))}
      {quote.fees.map((l) => (
        <li key={l.id} className="flex justify-between gap-4">
          <span>{l.label}</span>
          <span className={`shrink-0 ${amount}`}>{money(l.amount)}</span>
        </li>
      ))}
      {quote.extras.map((l) => (
        <li key={l.id} className="flex justify-between gap-4">
          <span>{l.label}</span>
          <span className={`shrink-0 ${amount}`}>{money(l.amount)}</span>
        </li>
      ))}
      {quote.taxes > 0 && (
        <li className="flex justify-between gap-4">
          <span>GST / taxes</span>
          <span className={`shrink-0 ${amount}`}>{money(quote.taxes)}</span>
        </li>
      )}
      <li
        className={`flex justify-between gap-4 border-t pt-3 ${compact ? "border-ink/[0.06] text-ink" : "border-sand/10 text-sand"}`}
      >
        <span>{totalLabel}</span>
        <span className="font-display text-xl">{money(quote.grand)}</span>
      </li>
      {quote.payLater > 0 && (
        <li className="flex justify-between gap-4 text-xs">
          <span>Due at property</span>
          <span>{money(quote.payLater)}</span>
        </li>
      )}
      {quote.dueNow > 0 && quote.payLater > 0 && (
        <li className="flex justify-between gap-4 text-xs">
          <span>Due now</span>
          <span>{money(quote.dueNow)}</span>
        </li>
      )}
    </ul>
  );
}
