"use client";

import { useState } from "react";

export function PoliciesConsent({
  href,
  cancelLabel,
  checked,
  onChange,
}: {
  href: string;
  cancelLabel: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const [tip, setTip] = useState<"cancel" | "hotel" | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="relative" onMouseEnter={() => setTip("cancel")} onMouseLeave={() => setTip(null)}>
          <a
            href={`${href}#cancellation`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-flame/15 px-3 py-1.5 text-sand ring-1 ring-brass/30 hover:bg-flame/25"
          >
            Cancellation policy
          </a>
          {tip === "cancel" ? (
            <span className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-sand/10 bg-ink-2 p-3 text-xs leading-relaxed text-mist shadow-xl">
              Opens the full cancellation terms for every hotel in this package.
              <a href={`${href}#cancellation`} target="_blank" rel="noreferrer" className="mt-2 block text-brass">
                Open cancellation policy →
              </a>
            </span>
          ) : null}
        </span>
        <span className="relative" onMouseEnter={() => setTip("hotel")} onMouseLeave={() => setTip(null)}>
          <a
            href={`${href}#hotel-policy`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-flame/15 px-3 py-1.5 text-sand ring-1 ring-brass/30 hover:bg-flame/25"
          >
            Hotel policy
          </a>
          {tip === "hotel" ? (
            <span className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-sand/10 bg-ink-2 p-3 text-xs leading-relaxed text-mist shadow-xl">
              Opens house rules, check-in, and hotel policies for this package.
              <a href={`${href}#hotel-policy`} target="_blank" rel="noreferrer" className="mt-2 block text-brass">
                Open hotel policy →
              </a>
            </span>
          ) : null}
        </span>
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-ink/30 px-3 py-3 text-sm text-mist">
        <input type="checkbox" className="mt-1 accent-brass" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>
          I accept the{" "}
          <a href={href} target="_blank" rel="noreferrer" className="text-brass underline decoration-brass/40 underline-offset-2 hover:text-sand">
            house rules and cancellation policy ({cancelLabel})
          </a>{" "}
          and payment terms.
        </span>
      </label>
    </div>
  );
}
