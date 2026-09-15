"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { formatMoney, isDisplayCurrency, type DisplayCurrency } from "./currency";
import { clampCheckoutIso, defaultDates } from "./format";
import { copy, type Lang } from "./i18n";
import type { Reservation } from "./types";

export type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function readTheme(): Theme {
  const stored = localStorage.getItem("serai-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export type Search = {
  q: string;
  country: string;
  city: string;
  checkin: string;
  checkout: string;
  guests: number;
  rooms: number;
  adults: number;
  children: number;
  childAges: number[];
  vibe: string;
  landmark: string;
  airport: string;
  mapX: number | null;
  mapY: number | null;
  mapBounds: { x0: number; y0: number; x1: number; y1: number } | null;
};

function persistCurrency(c: DisplayCurrency) {
  localStorage.setItem("serai-currency", c);
  document.cookie = `serai-currency=${c}; path=/; max-age=31536000; SameSite=Lax`;
}

type Store = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (typeof copy)[Lang];
  theme: Theme;
  setTheme: (t: Theme) => void;
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  money: (amountPkr: number) => string;
  user: string | null;
  setUser: (n: string | null) => void;
  wishlist: string[];
  toggleWish: (id: string) => void;
  search: Search;
  setSearch: (s: Partial<Search>) => void;
  reservation: Reservation | null;
  setReservation: (r: Reservation | null) => void;
};

const Ctx = createContext<Store | null>(null);

const dates = defaultDates();

export function Providers({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [currency, setCurrencyState] = useState<DisplayCurrency>("USD");
  const [user, setUser] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [search, setSearchState] = useState<Search>({
    q: "",
    country: "",
    city: "",
    checkin: dates.checkin,
    checkout: dates.checkout,
    guests: 2,
    vibe: "",
    rooms: 1,
    adults: 2,
    children: 0,
    childAges: [],
    landmark: "",
    airport: "",
    mapX: null,
    mapY: null,
    mapBounds: null,
  });

  useEffect(() => {
    const w = localStorage.getItem("serai-wish");
    const r = localStorage.getItem("serai-res");
    const u = localStorage.getItem("serai-user");
    const l = localStorage.getItem("serai-lang");
    const c = localStorage.getItem("serai-currency");
    const nextTheme = readTheme();
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    if (w) setWishlist(JSON.parse(w));
    if (r) setReservation(JSON.parse(r));
    if (u) setUser(u);
    if (l === "ur" || l === "en") setLang(l);
    if (isDisplayCurrency(c)) {
      setCurrencyState(c);
      persistCurrency(c);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("serai-wish", JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    if (reservation) localStorage.setItem("serai-res", JSON.stringify(reservation));
  }, [reservation]);

  const setSearch = useCallback((s: Partial<Search>) => {
    setSearchState((p) => {
      const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as Partial<Search>;
      const next: Search = { ...p, ...clean };
      next.checkin = next.checkin || p.checkin || dates.checkin;
      next.checkout = clampCheckoutIso(next.checkout || p.checkout || dates.checkout, next.checkin);
      next.q = next.q ?? "";
      next.city = next.city ?? "";
      if (next.country && next.country !== "IQ" && next.country !== "IR" && next.country !== "SA") {
        next.country = "IQ";
      }
      next.rooms = next.rooms || 1;
      next.adults = next.adults || 1;
      next.children = next.children || 0;
      next.childAges = Array.isArray(next.childAges) ? next.childAges : [];
      if (s.adults !== undefined || s.children !== undefined) {
        next.guests = Math.max(1, next.adults + next.children);
      }
      if (s.children !== undefined) {
        next.childAges = Array.from({ length: next.children }, (_, i) => next.childAges[i] ?? 8);
      }
      if (s.guests !== undefined && s.adults === undefined && s.children === undefined) {
        next.adults = Math.max(1, s.guests);
        next.children = 0;
        next.childAges = [];
        next.guests = next.adults;
      }
      return next;
    });
  }, []);

  const value = useMemo<Store>(
    () => ({
      lang,
      setLang: (l) => {
        setLang(l);
        localStorage.setItem("serai-lang", l);
      },
      theme,
      setTheme: (next) => {
        setThemeState(next);
        localStorage.setItem("serai-theme", next);
        applyTheme(next);
      },
      currency,
      setCurrency: (next) => {
        setCurrencyState(next);
        persistCurrency(next);
      },
      money: (amountPkr) => formatMoney(amountPkr, currency),
      t: copy[lang],
      user,
      setUser: (n) => {
        setUser(n);
        if (n) localStorage.setItem("serai-user", n);
        else localStorage.removeItem("serai-user");
      },
      wishlist,
      toggleWish: (id) =>
        setWishlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
      search,
      setSearch,
      reservation,
      setReservation,
    }),
    [lang, theme, currency, user, wishlist, search, reservation, setSearch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSerai() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSerai outside Providers");
  return ctx;
}
