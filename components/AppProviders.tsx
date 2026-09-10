"use client";

import { SessionProvider } from "next-auth/react";
import { Providers } from "@/lib/store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <Providers>{children}</Providers>
    </SessionProvider>
  );
}
