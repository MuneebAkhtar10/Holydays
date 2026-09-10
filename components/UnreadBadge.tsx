export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[9px] font-semibold leading-none text-bone">
      {count > 9 ? "9+" : count}
    </span>
  );
}
