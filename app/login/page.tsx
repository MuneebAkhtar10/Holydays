"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { LoaderOverlay } from "@/components/PageLoader";
import { BrandLogo } from "@/components/BrandLogo";
import { readJson } from "@/lib/readJson";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get("registered") === "1";
  const registeredEmail = params.get("email") || "";
  const [email, setEmail] = useState(registeredEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [google, setGoogle] = useState(false);
  const [overlay, setOverlay] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => readJson<{ google?: boolean }>(r))
      .then((d) => setGoogle(Boolean(d?.google)))
      .catch(() => setGoogle(false));
  }, []);

  const finish = async (fallback: string) => {
    const session = await getSession();
    if (session?.user?.role === "ADMIN") {
      router.push("/admin");
    } else if (session?.user?.role === "OWNER") {
      router.push("/owner");
    } else {
      router.push(fallback);
    }
    router.refresh();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setOverlay("Signing you in");
    const callbackUrl = params.get("callbackUrl") || "/";
    const res = await signIn("credentials", { email, password, remember: remember ? "true" : "false", redirect: false, callbackUrl });
    if (res?.error) {
      setOverlay(null);
      setError("Email or password is not right.");
      return;
    }
    await finish(callbackUrl);
  };

  return (
    <div className="auth-shell">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <BrandLogo size="md" className="mb-5" />
      <h1 className="font-display mt-2 text-4xl tracking-tight md:text-5xl">Sign in</h1>

      {justRegistered && (
        <p className="mt-4 rounded-xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-sand">
          Account created. Sign in with the email and password you just set.
        </p>
      )}

      <p className="mt-4 text-sm leading-relaxed text-mist">
        Sign in with your email and password. Travellers, partners, and admins all sign in here.
      </p>

      <div className="mt-7">
        <GoogleAuthButton
          google={google}
          callbackUrl={`/post-login?next=${encodeURIComponent(params.get("callbackUrl") || "/")}`}
        />
      </div>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-mist">
        <span className="h-px flex-1 bg-brass/25" />
        or email
        <span className="h-px flex-1 bg-brass/25" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="auth-label">
          Email
          <input
            className="auth-field"
            type="email"
            required
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="auth-label">
          Password
          <input
            className="auth-field"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-3 text-sm text-mist">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me for 30 days
        </label>
        {error && <p className="text-sm text-rose">{error}</p>}
        <button type="submit" className="auth-btn bg-flame text-ink hover:brightness-110">
          Sign in
        </button>
      </form>

      <p className="mt-6 text-sm text-mist">
        <Link href="/forgot-password" className="text-sand underline decoration-brass/50 underline-offset-4">
          Forgot password
        </Link>
        {" · "}
        New here?{" "}
        <Link href="/register" className="text-sand underline decoration-brass/50 underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
