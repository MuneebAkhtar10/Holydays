"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { LoaderOverlay } from "@/components/PageLoader";
import { readJson } from "@/lib/readJson";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [overlay, setOverlay] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setOverlay("Saving new password");
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await readJson<{ error?: string }>(res);
    setOverlay(null);
    if (!res.ok) {
      setError(data?.error || "Could not reset password.");
      return;
    }
    router.push("/login");
  };

  return (
    <div className="auth-shell">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <h1 className="font-display text-4xl">New password</h1>
      {!token ? (
        <p className="mt-4 text-sm text-rose">
          Missing reset token. Request a new link from{" "}
          <Link href="/forgot-password" className="underline">
            forgot password
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <label className="auth-label">
            New password
            <input className="auth-field" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="text-sm text-rose">{error}</p>}
          <button type="submit" className="auth-btn bg-flame text-ink">
            Save password
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
