"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function GoogleAuthButton({ callbackUrl, google }: { callbackUrl: string; google: boolean }) {
  const [error, setError] = useState("");
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          google ? signIn("google", { callbackUrl }) : setError("Google sign-in is not set up yet. Add a real GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env and restart.")
        }
        className="auth-btn border border-brass/35 text-sand hover:border-brass"
      >
        Continue with Google
      </button>
      {error && <p className="mt-2 text-sm text-rose">{error}</p>}
    </div>
  );
}
