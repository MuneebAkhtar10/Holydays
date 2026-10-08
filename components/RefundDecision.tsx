"use client";

import { useState } from "react";
import { useSerai } from "@/lib/store";
import type { RefundOutlook } from "@/lib/refund-policy";

/**
 * Approve / deny a cancellation. When the guest paid by card, the approver also picks how much to refund
 * (pre-filled from the booking's cancellation policy) and the refund is sent to the guest's card on approval.
 */
export function RefundDecision({
  outlook,
  paidPkr,
  busy,
  onApprove,
  onDeny,
  denyLabel = "Deny",
  approveClass = "btn-primary px-3! py-1.5! text-xs!",
  denyClass = "btn-subtle px-3! py-1.5! text-xs!",
}: {
  outlook: RefundOutlook;
  /** Total the guest paid, in PKR, to show the refund amount. */
  paidPkr?: number;
  busy?: boolean;
  onApprove: (refundPercent: number | undefined) => void;
  onDeny: () => void;
  denyLabel?: string;
  approveClass?: string;
  denyClass?: string;
}) {
  const { money } = useSerai();
  const [percent, setPercent] = useState(outlook.percent);
  const steps = Array.from(new Set([0, 25, 50, 75, 100, outlook.percent])).sort((a, b) => a - b);
  const amount = paidPkr ? Math.round((paidPkr * percent) / 100) : 0;

  return (
    <div className="space-y-2">
      {outlook.paid && (
        <div className="rounded-lg border border-brass/25 bg-ink/30 px-3 py-2 text-xs text-sand">
          <p className="font-semibold text-brass">Guest paid by card · refund on approval</p>
          <p className="mt-0.5 text-mist">{outlook.note}.</p>
          <label className="mt-1.5 flex flex-wrap items-center gap-2 text-mist">
            Refund
            <select
              className="auth-field w-auto! px-2! py-1! text-xs!"
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              disabled={busy}
            >
              {steps.map((p) => (
                <option key={p} value={p}>
                  {p}%{p === outlook.percent ? " (policy)" : ""}
                </option>
              ))}
            </select>
            {paidPkr ? <span className="font-semibold text-sand">{percent > 0 ? `${money(amount)} back to the card` : "No refund"}</span> : null}
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={approveClass} disabled={busy} onClick={() => onApprove(outlook.paid ? percent : undefined)}>
          {outlook.paid ? (percent > 0 ? "Approve & refund" : "Approve, no refund") : "Approve"}
        </button>
        <button type="button" className={denyClass} disabled={busy} onClick={onDeny}>
          {denyLabel}
        </button>
      </div>
    </div>
  );
}
