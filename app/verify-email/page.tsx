"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { readJson } from "@/lib/readJson";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"work" | "ok" | "bad">("work");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setState("bad");
      return;
    }
    fetch("/api/account/email/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => readJson<{ email?: string }>(r).then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        setEmail(d?.email || "");
        setState(ok ? "ok" : "bad");
      })
      .catch(() => setState("bad"));
  }, [token]);

  if (state === "work") return <PageLoader label="Verifying email" />;

  return (
    <div className="auth-shell">
      <h1 className="font-display text-4xl">{state === "ok" ? "Email verified" : "Link expired"}</h1>
      <p className="mt-3 text-sm text-mist">
        {state === "ok" ? `${email} is confirmed on your HolyDays account.` : "Ask for a new verification email from your account page."}
      </p>
      <Link href={state === "ok" ? "/account" : "/login"} className="btn-primary mt-6 inline-flex">
        {state === "ok" ? "Open account" : "Sign in"}
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<PageLoader label="Verifying email" />}>
      <VerifyInner />
    </Suspense>
  );
}
