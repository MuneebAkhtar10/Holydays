"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Suspense, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useSerai } from "@/lib/store";
import { BrandLogo } from "@/components/BrandLogo";
import { BedIcon, CalendarIcon, CarIcon, ChatIcon, HeartIcon, LandmarkIcon, MoonIcon, PlusIcon, StoreIcon, SunIcon, TableIcon, UserIcon } from "@/components/icons";
import { UnreadBadge } from "@/components/UnreadBadge";
import { DISPLAY_CURRENCIES } from "@/lib/currency";

const ownerHome: Record<string, { desk: string; add: string; market: string; marketHref: string }> = {
  TAXI: { desk: "My taxis", add: "Add a taxi", market: "Taxi marketplace", marketHref: "/taxis" },
  STAY: { desk: "My hotels", add: "Add a hotel", market: "Hotel marketplace", marketHref: "/search" },
  ATTRACTION: { desk: "My Ziyarah", add: "Add a Ziyarah", market: "Ziyarah marketplace", marketHref: "/attractions" },
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

  const go = (href: string) => (e: ReactMouseEvent<HTMLAnchorElement>) => {
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

  const mobileNav = isAdmin ? [] : isOwner ? ownerNav : guestNav;

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-brass/25 bg-ink/95 shadow-[0_1px_0_rgba(197,164,106,0.08),0_6px_24px_rgba(8,20,40,0.18)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-1 px-3 py-1.5 sm:gap-4 sm:px-4 sm:py-2 md:px-5">
        <Link href={isAdmin ? "/admin" : isOwner ? "/owner" : "/"} className="flex shrink-0 items-center gap-2">
          <BrandLogo size="sm" />
          {isAdmin ? (
            <span className="hidden text-[11px] uppercase tracking-[0.2em] text-brass sm:inline">Admin</span>
          ) : isOwner ? (
            <span className="hidden text-[11px] uppercase tracking-[0.2em] text-brass sm:inline">Partner</span>
          ) : null}
        </Link>

        {isAdmin ? (
          <nav className="hidden items-center gap-5 text-sm font-semibold text-mist md:flex">
            <Link href="/admin" className={path.startsWith("/admin") ? "text-sand" : "hover:text-sand"}>
              Approvals
            </Link>
            <Link href="/" className="hover:text-sand">
              Public site
            </Link>
          </nav>
        ) : isOwner ? (
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 sm:flex">
            {ownerNav.map((n) => {
              const Icon = n.icon;
              const unread = n.href.includes("tab=messages") ? inbox.unread : 0;
              return (
                <Link key={n.href} href={n.href} scroll={n.href.startsWith("/owner")} onClick={go(n.href)} data-active={n.active} className="header-link relative">
                  <span className="relative">
                    <Icon className="h-[1.15rem] w-[1.15rem]" />
                    <UnreadBadge count={unread} />
                  </span>
                  <span className="hidden sm:block">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 sm:flex">
            {guestNav.map((n) => {
              const Icon = n.icon;
              const active = n.href === "/search" ? path.startsWith("/search") || path.startsWith("/stay") : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} data-active={active} className="header-link">
                  <Icon className="h-[1.15rem] w-[1.15rem]" />
                  <span className="hidden sm:block">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="header-tools shrink-0">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="header-tool"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light" : "Dark"}
          >
            {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
            data-compact="true"
            className="h-[1.9rem] cursor-pointer rounded-full border-0 bg-transparent pl-1.5 text-[11px] font-semibold tracking-normal text-sand/90 transition-colors hover:bg-brass/15 sm:pl-2 sm:text-xs sm:tracking-[0.1em]"
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
              className="header-tool"
              aria-label="Messages"
            >
              <ChatIcon className="h-5 w-5" />
              <UnreadBadge count={inbox.unread} />
            </Link>
          )}
          {!isOwner && !isAdmin && (
            <Link href="/trips" className="header-tool" aria-label={t.trips}>
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

    {/* Phones: the four marketplaces live in a thumb-reachable bar so the header keeps the logo and account. */}
    {mobileNav.length > 0 && (
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-brass/25 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch">
          {mobileNav.map((n) => {
            const Icon = n.icon;
            const active =
              "active" in n
                ? Boolean(n.active)
                : n.href === "/search"
                  ? path.startsWith("/search") || path.startsWith("/stay")
                  : path.startsWith(n.href);
            const unread = n.href.includes("tab=messages") ? inbox.unread : 0;
            return (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  scroll={isOwner ? n.href.startsWith("/owner") : true}
                  onClick={isOwner ? go(n.href) : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold leading-tight ${
                    active ? "text-brass" : "text-mist"
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {unread > 0 ? <UnreadBadge count={unread} /> : null}
                  </span>
                  <span className="w-full truncate text-center">{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    )}
    </>
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
    const onDoc = (e: globalThis.MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 p-0.5 text-sand transition-colors hover:border-brass hover:bg-brass/20 md:pr-3"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brass/25 text-brass">
          <UserIcon className="h-3.5 w-3.5" />
        </span>
        <span className="hidden max-w-[7rem] truncate text-sm font-semibold md:inline">
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
