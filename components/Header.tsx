"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Suspense, useEffect, useRef, useState, type MouseEvent } from "react";
import { useSerai } from "@/lib/store";
import { BrandLogo } from "@/components/BrandLogo";
import { BedIcon, CalendarIcon, CarIcon, ChatIcon, HeartIcon, LandmarkIcon, MoonIcon, PlusIcon, StoreIcon, SunIcon, TableIcon, UserIcon } from "@/components/icons";
import { UnreadBadge } from "@/components/UnreadBadge";
import { DISPLAY_CURRENCIES } from "@/lib/currency";

const ownerHome: Record<string, { desk: string; add: string; market: string; marketHref: string }> = {
  TAXI: { desk: "My taxis", add: "Add a taxi", market: "Taxi marketplace", marketHref: "/taxis" },
  STAY: { desk: "My hotels", add: "Add a hotel", market: "Hotel marketplace", marketHref: "/search" },
  ATTRACTION: { desk: "My ziyarat", add: "Add a ziyarat", market: "Ziyarat marketplace", marketHref: "/attractions" },
  RESTAURANT: { desk: "My food listings", add: "Add food", market: "Food marketplace", marketHref: "/food" },
};

export function Header() {
  return (
    <Suspense fallback={<header className="sticky top-0 z-50 h-14 border-b border-brass/20 bg-ink/95" />}>
      <HeaderBar />
    </Suspense>
  );
}

function HeaderBar() {
  const { t, theme, setTheme, currency, setCurrency, wishlist } = useSerai();
  const path = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, status } = useSession();
  const isOwner = session?.user?.role === "OWNER";
  const isAdmin = session?.user?.role === "ADMIN";
  const kind = session?.user?.ownerKind || "STAY";
  const copy = ownerHome[kind] ?? ownerHome.STAY;
  const tab = params.get("tab");
  const adding = params.get("new") === "1";
  const [inbox, setInbox] = useState({ unread: 0, href: "" });

  useEffect(() => {
    if (status !== "authenticated") return;
    const load = () => {
      fetch("/api/inbox", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setInbox({ unread: Number(d?.unread) || 0, href: String(d?.inbox || "") }))
        .catch(() => setInbox({ unread: 0, href: "" }));
    };
    load();
    const t = window.setInterval(load, 12000);
    return () => window.clearInterval(t);
  }, [status, path]);

  const DeskIcon = kind === "TAXI" ? CarIcon : kind === "ATTRACTION" ? LandmarkIcon : kind === "RESTAURANT" ? TableIcon : BedIcon;
  const ownerNav = [
    { href: "/owner", label: copy.desk, icon: DeskIcon, active: path === "/owner" && !adding && tab !== "messages" && tab !== "bookings" },
    { href: "/owner?tab=messages", label: "Messages", icon: ChatIcon, active: path === "/owner" && tab === "messages" },
    { href: "/owner?tab=bookings", label: "Bookings", icon: CalendarIcon, active: path === "/owner" && tab === "bookings" },
    { href: "/owner?new=1", label: copy.add, icon: PlusIcon, active: path === "/owner" && adding },
    { href: copy.marketHref, label: copy.market, icon: StoreIcon, active: path === copy.marketHref || path.startsWith(`${copy.marketHref}/`) },
  ];

  const go = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    router.push(href);
  };

  const guestNav = [
    { href: "/search", label: t.stays, icon: BedIcon },
    { href: "/attractions", label: t.attractions, icon: LandmarkIcon },
    { href: "/taxis", label: t.taxis, icon: CarIcon },
    { href: "/food", label: t.dining, icon: TableIcon },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-brass/20 bg-ink/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 md:px-5">
        <Link href={isAdmin ? "/admin" : isOwner ? "/owner" : "/"} className="flex min-w-0 shrink items-center gap-2">
          <BrandLogo size="sm" />
          {isAdmin ? (
            <span className="hidden text-[11px] uppercase tracking-[0.2em] text-brass sm:inline">Admin</span>
          ) : isOwner ? (
            <span className="hidden text-[11px] uppercase tracking-[0.2em] text-brass sm:inline">Partner</span>
          ) : null}
        </Link>

        {isAdmin ? (
          <nav className="hidden items-center gap-4 text-sm text-mist md:flex">
            <Link href="/admin" className={path.startsWith("/admin") ? "text-sand" : "hover:text-sand"}>
              Approvals
            </Link>
            <Link href="/" className="hover:text-sand">
              Public site
            </Link>
          </nav>
        ) : isOwner ? (
          <nav className="flex flex-1 items-center justify-center gap-0.5">
            {ownerNav.map((n) => {
              const Icon = n.icon;
              const unread = n.href.includes("tab=messages") ? inbox.unread : 0;
              return (
                <Link key={n.href} href={n.href} scroll={n.href.startsWith("/owner")} onClick={go(n.href)} data-active={n.active} className="header-link relative">
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    <UnreadBadge count={unread} />
                  </span>
                  <span className="hidden sm:block">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          <nav className="flex flex-1 items-center justify-center gap-0.5">
            {guestNav.map((n) => {
              const Icon = n.icon;
              const active = n.href === "/search" ? path.startsWith("/search") || path.startsWith("/stay") : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} data-active={active} className="header-link">
                  <Icon className="h-5 w-5" />
                  <span className="hidden sm:block">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-xl p-2 text-mist hover:bg-brass/10 hover:text-sand"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light" : "Dark"}
          >
            {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
            className="rounded-xl border-0 bg-transparent px-1.5 py-2 text-xs tracking-[0.12em] text-sand/90 hover:bg-brass/10"
            aria-label="Currency"
            title="Display currency"
          >
            {DISPLAY_CURRENCIES.map((c) => (
              <option key={c} value={c} className="bg-ink text-sand">
                {c}
              </option>
            ))}
          </select>
          {!isOwner && !isAdmin && status === "authenticated" && (
            <Link
              href={inbox.unread && inbox.href ? inbox.href : "/trips"}
              className="relative rounded-xl p-2 text-mist hover:bg-brass/10 hover:text-sand"
              aria-label="Messages"
            >
              <ChatIcon className="h-5 w-5" />
              <UnreadBadge count={inbox.unread} />
            </Link>
          )}
          {!isOwner && !isAdmin && (
            <Link href="/trips" className="relative rounded-xl p-2 text-mist hover:bg-brass/10 hover:text-sand" aria-label={t.trips}>
              <HeartIcon className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="absolute right-0.5 top-0.5 h-4 min-w-4 rounded-full bg-rose px-1 text-center text-[10px] leading-4 text-bone">
                  {wishlist.length}
                </span>
              )}
            </Link>
          )}
          <AccountMenu
            authenticated={status === "authenticated"}
            name={session?.user?.name}
            email={session?.user?.email}
            isOwner={isOwner}
            isAdmin={isAdmin}
            signInLabel={t.signIn}
          />
        </div>
      </div>
    </header>
  );
}

function AccountMenu({
  authenticated,
  name,
  email,
  isOwner,
  isAdmin,
  signInLabel,
}: {
  authenticated: boolean;
  name?: string | null;
  email?: string | null;
  isOwner: boolean;
  isAdmin?: boolean;
  signInLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-brass/35 px-2 py-1.5 text-sand hover:border-brass"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
      >
        <UserIcon className="h-5 w-5" />
        <span className="hidden max-w-[7rem] truncate text-sm md:inline">
          {authenticated ? name?.split(" ")[0] ?? "Account" : signInLabel}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-brass/30 bg-ink-2 py-2 shadow-xl">
          {authenticated ? (
            <>
              <p className="px-4 py-2 text-xs text-mist">{email}</p>
              {!isOwner && !isAdmin && (
                <>
                  <Link href="/trips" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                    Your trips
                  </Link>
                  <Link href="/account" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                    Account
                  </Link>
                </>
              )}
              {isAdmin && (
                <>
                  <Link href="/admin" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                    Approvals
                  </Link>
                  <Link href="/account" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                    Account
                  </Link>
                </>
              )}
              {isOwner && (
                <>
                  <Link href="/owner" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                    Partner desk
                  </Link>
                  <Link href="/owner?tab=messages" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                    Messages
                  </Link>
                  <Link href="/owner?tab=bookings" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                    Bookings
                  </Link>
                  <Link href="/account" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                    Account
                  </Link>
                </>
              )}
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm text-sand hover:bg-ink"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <Link href="/register" className="block px-4 py-2 text-sm text-sand hover:bg-ink" onClick={() => setOpen(false)}>
                Create account
              </Link>
              <Link href="/login?as=partner" className="block px-4 py-2 text-sm text-mist hover:bg-ink" onClick={() => setOpen(false)}>
                Partner login
              </Link>
              <Link href="/login?as=admin" className="block px-4 py-2 text-sm text-mist hover:bg-ink" onClick={() => setOpen(false)}>
                Admin login
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
