"use client";

import { useState } from "react";
import { readJson } from "@/lib/readJson";

export function CancelBookingModal({
  open,
  bookingIds,
  title,
  onClose,
  onCancelled,
}: {
  open: boolean;
  bookingIds: string[];
  title?: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async () => {
    if (!reason.trim()) {
      setError("Please tell us why you're cancelling.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const results = await Promise.all(
        bookingIds.map(async (id) => {
          const res = await fetch(`/api/bookings/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancel_requested", reason }),
          });
          const data = await readJson<{ error?: string }>(res);
          return { ok: res.ok, data };
        }),
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        setError(failed.data?.error || "Could not submit cancellation request");
        return;
      }
      setReason("");
      onCancelled();
      onClose();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div className="paper w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Request cancellation</p>
        <h2 className="font-display mt-1 text-2xl">{title || (bookingIds.length > 1 ? "Cancel this package?" : "Cancel this booking?")}</h2>
        <p className="mt-2 text-sm text-mist">
          This isn't cancelled right away — we send your request to our team, and you'll be notified once it's reviewed.
        </p>
        <textarea
          className="paper-field mt-4 min-h-24 w-full"
          placeholder="Why are you cancelling? (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-rose">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit cancellation request"}
          </button>
          <button type="button" className="btn-subtle" disabled={busy} onClick={onClose}>
            Never mind
          </button>
        </div>
      </div>
    </div>
  );
}
