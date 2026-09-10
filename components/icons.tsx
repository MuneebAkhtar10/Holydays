import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function BedIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 18h18" />
      <path d="M7 10V7a2 2 0 0 1 2-2h2" />
      <path d="M3 14h18" />
    </Svg>
  );
}

export function LandmarkIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 21h18" />
      <path d="M5 21V10l7-5 7 5v11" />
      <path d="M9 21v-6h6v6" />
    </Svg>
  );
}

export function CarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 16h14l1-5-3-4H7L4 11l1 5Z" />
      <path d="M7 16v2" />
      <path d="M17 16v2" />
      <circle cx="7.5" cy="16" r="1.2" />
      <circle cx="16.5" cy="16" r="1.2" />
    </Svg>
  );
}

export function TableIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10h16" />
      <path d="M6 10v8" />
      <path d="M18 10v8" />
      <path d="M4 14h16" />
      <path d="M12 10v8" />
    </Svg>
  );
}

export function HeartIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z" />
    </Svg>
  );
}

export function BellIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 9a6 6 0 1 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9Z" />
      <path d="M10 20h4" />
    </Svg>
  );
}

export function UserIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19c1.4-3 4-4.5 7-4.5S17.6 16 19 19" />
    </Svg>
  );
}

export function PinIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </Svg>
  );
}

export function ChevronIcon({ className, open }: IconProps & { open?: boolean }) {
  return (
    <Svg className={className}>
      <path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </Svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
      <path d="M3.5 10h17" />
    </Svg>
  );
}

export function GuestsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.8-3 2.8-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 14.5c2 .4 3.4 1.7 4 4.5" />
    </Svg>
  );
}

export function FilterIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </Svg>
  );
}

export function SunIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.6M12 19.4V21M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M3 12h1.6M19.4 12H21M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1" />
    </Svg>
  );
}

export function MoonIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16.5 13.5A7 7 0 0 1 10 5a7 7 0 1 0 8.5 10.2 5.5 5.5 0 0 1-2-1.7Z" />
    </Svg>
  );
}

export function LocateIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21" />
    </Svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChatIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9.2L5 21v-3.5H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

export function StoreIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10.5h16V19H4z" />
      <path d="M4 10.5 5.6 6h12.8L20 10.5" />
      <path d="M9 19v-5h6v5" />
    </Svg>
  );
}

export function MinusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12.3l2.4 2.4 5.2-5.4" />
    </Svg>
  );
}

export function WalletIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2" />
      <path d="M3.5 10h17" />
      <circle cx="16.2" cy="14.2" r="1" />
    </Svg>
  );
}
