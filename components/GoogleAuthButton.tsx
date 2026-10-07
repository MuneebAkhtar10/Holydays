"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { LoaderOverlay } from "@/components/PageLoader";

export function GoogleAuthButton({ callbackUrl, google }: { callbackUrl: string; google: boolean }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Coming back with the browser's Back button must not leave the loader stuck on.
  useEffect(() => {
    const reset = () => setLoading(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const start = async () => {
    if (!google) {
      setError("Google sign-in is not set up yet. Add a real GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env and restart.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setLoading(false);
      setError("Could not reach Google. Check your connection and try again.");
    }
  };

  return (
    <div>
      <LoaderOverlay show={loading} label="Connecting to Google" />
      <button
        type="button"
        onClick={() => void start()}
        disabled={loading}
        className="auth-btn border border-brass/35 text-sand hover:border-brass disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && <p className="mt-2 text-sm text-rose">{error}</p>}
    </div>
  );
}
