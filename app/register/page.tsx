"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { LoaderOverlay } from "@/components/PageLoader";
import { BrandLogo } from "@/components/BrandLogo";
import { readJson } from "@/lib/readJson";

const kinds = [
  { id: "STAY", label: "Hotels (Saudi / Iraq / Iran)" },
  { id: "ATTRACTION", label: "Ziyarat" },
  { id: "TAXI", label: "Taxi (routes & seats)" },
  { id: "RESTAURANT", label: "Food" },
];

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [asOwner, setAsOwner] = useState(false);
  const [ownerKind, setOwnerKind] = useState("TAXI");
  const [error, setError] = useState("");
  const [overlay, setOverlay] = useState<string | null>(null);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => readJson<{ google?: boolean }>(r))
      .then((d) => setGoogle(Boolean(d?.google)))
      .catch(() => setGoogle(false));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setOverlay("Creating your account");
    const emailNorm = email.toLowerCase().trim();
    const dest = asOwner ? "/owner" : callbackUrl;
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: emailNorm, password, asOwner, ownerKind }),
    });
    const data = await readJson<{ error?: string; preview?: string }>(res);
    if (!res.ok) {
      setOverlay(null);
      setError(data?.error || "Could not create your account.");
      return;
    }
    if (data?.preview) sessionStorage.setItem("serai-verify-preview", data.preview);
    setOverlay("Signing you in");
    const signed = await signIn("credentials", {
      email: emailNorm,
      password,
      redirect: false,
      callbackUrl: dest,
    });
    if (signed?.error) {
      setOverlay(null);
      const q = new URLSearchParams({ registered: "1", email: emailNorm });
      if (asOwner) q.set("as", "partner");
      router.push(`/login?${q.toString()}`);
      return;
    }
    router.push(dest);
    router.refresh();
  };

  return (
    <div className="auth-shell">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <BrandLogo size="md" className="mb-4" />
      <h1 className="font-display mt-2 text-4xl tracking-tight md:text-5xl">Register</h1>
      <p className="mt-3 text-sm leading-relaxed text-mist">Travellers book. Partners list hotels, ziyarat, taxis, or food.</p>
      <div className="mt-7">
        <GoogleAuthButton
          google={google}
          callbackUrl={`/post-login?next=${encodeURIComponent(asOwner ? "/owner" : callbackUrl)}`}
        />
      </div>
      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-mist">
        <span className="h-px flex-1 bg-brass/25" />
        or email
        <span className="h-px flex-1 bg-brass/25" />
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="auth-label">
          Full name
          <input className="auth-field" required autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="auth-label">
          Email
          <input className="auth-field" type="email" required autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="auth-label">
          Password
          <input className="auth-field" type="password" required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-brass/20 px-4 py-3 text-sm text-mist">
          <input type="checkbox" checked={asOwner} onChange={(e) => setAsOwner(e.target.checked)} />
          I want to list something on HolyDays
        </label>
        {asOwner && (
          <div className="grid grid-cols-2 gap-2">
            {kinds.map((k) => (
              <label
                key={k.id}
                className={`rounded-xl border px-4 py-3 text-sm ${ownerKind === k.id ? "border-flame bg-flame/10" : "border-brass/25"}`}
              >
                <input type="radio" className="mr-2" checked={ownerKind === k.id} onChange={() => setOwnerKind(k.id)} />
                {k.label}
              </label>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-rose">{error}</p>}
        <button type="submit" className="auth-btn bg-flame text-ink hover:brightness-110">
          Create account
        </button>
      </form>
      <p className="mt-6 text-sm text-mist">
        Already have a key?{" "}
        <Link href="/login" className="text-sand underline decoration-brass/50 underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
