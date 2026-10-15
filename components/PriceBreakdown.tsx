"use client";

import { useSerai } from "@/lib/store";
import type { PriceQuote } from "@/lib/pricing";

export function PriceBreakdown({
  quote,
  compact,
  onTicket,
  hideTotal,
  totalLabel = "Total",
}: {
  quote: PriceQuote;
  compact?: boolean;
  /** Rendered on a summary ticket, which carries its own themed palette. */
  onTicket?: boolean;
  /** Leave the total out — the caller shows it on its own plate. */
  hideTotal?: boolean;
  totalLabel?: string;
}) {
  const { money } = useSerai();
  const amount = onTicket ? "ticket-strong" : compact ? "text-ink" : "text-sand";
  return (
    <ul className={`space-y-1.5 text-sm ${onTicket ? "" : compact ? "text-ink/80" : "text-mist"}`}>
      {quote.lines.map((l) => (
        <li key={l.id} className="flex justify-between gap-4">
          <span>{l.label}</span>
          <span className={`shrink-0 ${amount}`}>{money(l.amount)}</span>
        </li>
      ))}
      {quote.discounts.map((l) => (
        <li key={l.id} className={`flex justify-between gap-4 ${onTicket ? "ticket-good" : "text-sage"}`}>
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
      {hideTotal ? null : (
        <li
          className={`flex justify-between gap-4 border-t pt-3 ${
            onTicket ? "border-[color:var(--tk-rim)] ticket-strong" : compact ? "border-ink/[0.06] text-ink" : "border-sand/10 text-sand"
          }`}
        >
          <span>{totalLabel}</span>
          <span className="font-display text-xl">{money(quote.grand)}</span>
        </li>
      )}
      {!hideTotal && quote.payLater > 0 && (
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
