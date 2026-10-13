"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { readJson } from "@/lib/readJson";

/**
 * Sign in or create an account without leaving the checkout, so everything the guest chose stays on the page.
 * Google sends the browser away and back, so the caller saves the checkout first (onBeforeGoogle).
 */
export function CheckoutAuth({
  returnTo,
  onBeforeGoogle,
}: {
  /** Path + query of the checkout, used to come back after Google. */
  returnTo: string;
  onBeforeGoogle: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => readJson<{ google?: boolean }>(r))
      .then((d) => setGoogle(Boolean(d?.google)))
      .catch(() => setGoogle(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const emailNorm = email.toLowerCase().trim();
    try {
      if (mode === "signup") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email: emailNorm, password, asOwner: false, ownerKind: "TAXI" }),
        });
        const data = await readJson<{ error?: string; preview?: string }>(res);
        if (!res.ok) {
          setError(data?.error || "Could not create your account.");
          return;
        }
        if (data?.preview) sessionStorage.setItem("serai-verify-preview", data.preview);
      }
      // The page stays where it is; the session updates in place and the confirm button appears.
      const res = await signIn("credentials", { email: emailNorm, password, redirect: false });
      if (res?.error) setError(mode === "signup" ? "Account created, but we could not sign you in. Try signing in." : "Email or password is not right.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brass/30 bg-brass/5 p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-brass">Last step</p>
      <h3 className="font-display mt-1 text-xl">Sign in to confirm your booking</h3>
      <p className="mt-1 text-sm text-mist">Everything you chose stays right here. Sign in or create an account and you can confirm straight away.</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {([
          ["signin", "I have an account"],
          ["signup", "I'm new here"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="filter-chip justify-center"
            data-on={mode === id}
            onClick={() => {
              setMode(id);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <GoogleAuthButton google={google} callbackUrl={`/post-login?next=${encodeURIComponent(returnTo)}`} onBeforeStart={onBeforeGoogle} />
      </div>
      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-mist">
        <span className="h-px flex-1 bg-brass/25" />
        or email
        <span className="h-px flex-1 bg-brass/25" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <label className="auth-label">
            Full name
            <input className="auth-field" required autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label className="auth-label">
          Email
          <input className="auth-field" type="email" required autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="auth-label">
          Password
          <input
            className="auth-field"
            type="password"
            required
            minLength={mode === "signup" ? 6 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-rose">{error}</p>}
        <button type="submit" className="btn-primary w-full py-3.5" disabled={busy}>
          {busy ? "One moment…" : mode === "signup" ? "Create account & continue" : "Sign in & continue"}
        </button>
      </form>
    </div>
  );
}
