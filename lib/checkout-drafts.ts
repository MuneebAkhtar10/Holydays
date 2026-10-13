/** Checkout progress saved on this device. The summary is what "Your trips" shows so the guest can pick up where they left off. */
export const DRAFT_PREFIX = "holydays-checkout-draft:";
export const DRAFT_TTL_MS = 7 * 86400000;

export type DraftSummary = {
  /** Checkout path + query to return to. */
  url: string;
  kind: "hotel" | "ziyarat" | "package";
  title: string;
  city: string;
  cover: string;
  checkin: string;
  checkout: string;
  guests: number;
  /** 0-based step the guest reached, the number of steps, and the step's name. */
  step: number;
  stepCount: number;
  stepLabel: string;
  /** The guest has gone past the first screen or entered details; a merely opened checkout is not listed. */
  started: boolean;
  savedAt: number;
};

export function listDrafts(): DraftSummary[] {
  if (typeof window === "undefined") return [];
  const out: DraftSummary[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(DRAFT_PREFIX)) continue;
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "") as { savedAt?: number; summary?: DraftSummary };
        if (!saved.summary || !saved.savedAt || Date.now() - saved.savedAt > DRAFT_TTL_MS) {
          localStorage.removeItem(key);
          i--;
          continue;
        }
        if (saved.summary.started) out.push({ ...saved.summary, savedAt: saved.savedAt });
      } catch {
        /* skip an unreadable draft */
      }
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function removeDraft(url: string) {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${url}`);
  } catch {
    /* nothing to remove */
  }
}
