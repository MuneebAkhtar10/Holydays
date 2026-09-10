"use client";

import { useSerai } from "@/lib/store";

export function Money({ amount }: { amount: number }) {
  const { money } = useSerai();
  return <>{money(amount)}</>;
}
