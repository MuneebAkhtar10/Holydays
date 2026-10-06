"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { readJson } from "@/lib/readJson";

const kinds = [
  { id: "STAY", label: "Hotels (Saudi / Iraq / Iran)" },
  { id: "ATTRACTION", label: "Ziyarat" },
  { id: "TAXI", label: "Taxi (routes & seats)" },
  { id: "RESTAURANT", label: "Food" },
];

function WelcomeInner() {
  const { data, status } = useSession();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [asOwner, setAsOwner] = useState(false);
  const [ownerKind, setOwnerKind] = useState("STAY");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") window.location.replace("/login");
  }, [status]);

  if (status !== "authenticated") return <PageLoader label="Opening your account" />;

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/account/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asOwner, ownerKind }),
    });
    const body = await readJson<{ error?: string }>(res);
    if (!res.ok) {
      setBusy(false);
      if (res.status === 409) {
        window.location.assign(safeNext);
        return;
      }
      setError(body?.error || "Could not save. Try again.");
      return;
    }
    window.location.assign(asOwner ? "/owner" : safeNext);
  };

  return (
    <div className="auth-shell">
      <LoaderOverlay show={busy} label="Setting up your account" />
      <BrandLogo size="md" className="mb-4" />
      <h1 className="font-display mt-2 text-4xl tracking-tight">Welcome{data.user?.name ? `, ${data.user.name.split(" ")[0]}` : ""}</h1>
      <p className="mt-3 text-sm leading-relaxed text-mist">Your account is created. How will you use HolyDays?</p>

      <div className="mt-6 grid gap-2">
        <button
          type="button"
          className={`rounded-xl border px-4 py-3 text-left text-sm ${!asOwner ? "border-flame bg-flame/10" : "border-brass/25"}`}
          onClick={() => setAsOwner(false)}
        >
          <span className="block font-medium text-sand">Traveller</span>
          <span className="block text-mist">Book hotels, taxis, Ziyarat, and food.</span>
        </button>
        <button
          type="button"
          className={`rounded-xl border px-4 py-3 text-left text-sm ${asOwner ? "border-flame bg-flame/10" : "border-brass/25"}`}
          onClick={() => setAsOwner(true)}
        >
          <span className="block font-medium text-sand">Partner</span>
          <span className="block text-mist">List hotels, Ziyarat, taxis, or food.</span>
        </button>
      </div>

      {asOwner && (
        <div className="mt-3 grid grid-cols-2 gap-2">
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

      {error && <p className="mt-4 text-sm text-rose">{error}</p>}
      <button type="button" className="auth-btn mt-6 bg-flame text-ink hover:brightness-110" onClick={submit}>
        Continue
      </button>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<PageLoader label="Opening your account" />}>
      <WelcomeInner />
    </Suspense>
  );
}
