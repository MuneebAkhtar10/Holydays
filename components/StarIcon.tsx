type IconProps = { className?: string };

export function StarIcon({ className, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4"} aria-hidden>
      <path
        d="M12 3.6 14.6 9l5.9.7-4.3 4 1.1 5.8L12 16.8 6.7 19.5 7.8 13.7 3.5 9.7 9.4 9 12 3.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
