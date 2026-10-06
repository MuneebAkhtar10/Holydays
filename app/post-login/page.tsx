"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { PageLoader } from "@/components/PageLoader";

function PostLoginInner() {
  const { data, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (status === "loading") return;
    const next = params.get("next") || "/";
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (status !== "authenticated") {
      router.replace(safe);
      return;
    }
    fetch("/api/account/onboarding", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { needsRole?: boolean }) => {
        if (d?.needsRole) {
          router.replace(`/welcome?next=${encodeURIComponent(safe)}`);
          return;
        }
        if (data?.user?.role === "OWNER") router.replace("/owner");
        else if (data?.user?.role === "ADMIN") router.replace("/admin");
        else router.replace(safe);
      })
      .catch(() => router.replace(safe));
  }, [data?.user?.role, params, router, status]);

  return <PageLoader label="Opening your desk" />;
}

export default function PostLoginPage() {
  return (
    <Suspense fallback={<PageLoader label="Signing you in" />}>
      <PostLoginInner />
    </Suspense>
  );
}
