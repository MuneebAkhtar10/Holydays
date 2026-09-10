"use client";

import { useEffect, useRef, useState } from "react";
import type { BookingMessage } from "@/lib/booking-view";

export function MessageThread({
  messages,
  viewer,
}: {
  messages: BookingMessage[];
  viewer: "guest" | "owner";
  guestLabel?: string;
  ownerLabel?: string;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.at]);

  if (messages.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-mist">No messages yet. Say hello to start the chat.</p>;
  }
  return (
    <ul className="space-y-2">
      {messages.map((m, i) => {
        const mine = m.from === viewer;
        return (
          <li key={`${m.at}-${i}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`w-fit max-w-[min(18rem,85%)] rounded-2xl px-3 py-2 text-sm ${
                mine ? "rounded-br-sm bg-flame/25 text-sand" : "rounded-bl-sm bg-sand/10 text-sand"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
              <p className={`mt-1 text-[10px] tracking-[0.04em] ${mine ? "text-brass" : "text-mist"}`}>
                {m.at
                  ? new Date(m.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                  : ""}
              </p>
            </div>
          </li>
        );
      })}
      <div ref={end} />
    </ul>
  );
}

export function MessageComposer({
  onSend,
  placeholder,
  label,
}: {
  onSend: (message: string) => Promise<void>;
  placeholder: string;
  label: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setError("");
    setBusy(true);
    try {
      await onSend(message);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    }
    setBusy(false);
  };

  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          className="auth-field min-h-[2.75rem] flex-1 resize-none py-2"
          rows={1}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={busy || !text.trim()}>
          {busy ? "…" : label}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-rose">{error}</p>}
    </form>
  );
}
