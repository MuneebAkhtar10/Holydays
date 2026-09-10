"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { LoaderOverlay } from "@/components/PageLoader";
import { readJson } from "@/lib/readJson";

function ForgotInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [done, setDone] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setOverlay("Sending reset link");
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await readJson<{ error?: string; preview?: string }>(res);
    setOverlay(null);
    if (!res.ok) {
      setError(data?.error || "Could not send reset email.");
      return;
    }
    setDone(true);
    setPreview(data?.preview || "");
  };

  return (
    <div className="auth-shell">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <h1 className="font-display text-4xl">Forgot password</h1>
      <p className="mt-3 text-sm text-mist">We’ll send a reset link to the email on your account.</p>
      {done ? (
        <div className="mt-6 space-y-3 text-sm text-sand">
          <p>If that email is registered, a reset link is ready.</p>
          {preview && (
            <p className="rounded-xl border border-brass/30 bg-ink px-4 py-3 text-mist">
              Demo (no mail server):{" "}
              <Link href={preview} className="text-sand underline">
                open reset link
              </Link>
            </p>
          )}
          <Link href="/login" className="btn-ghost inline-flex">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <label className="auth-label">
            Email
            <input className="auth-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="text-sm text-rose">{error}</p>}
          <button type="submit" className="auth-btn bg-flame text-ink">
            Send reset link
          </button>
        </form>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotInner />
    </Suspense>
  );
}
