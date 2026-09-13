"use client";

export function FieldHint({ text }: { text: string }) {
  return (
    <span className="group relative ml-2 inline-flex align-middle">
      <span
        tabIndex={0}
        role="note"
        aria-label={text}
        className="inline-flex h-[15px] w-[15px] shrink-0 cursor-help items-center justify-center rounded-full bg-ink/[0.06] text-[10px] font-semibold leading-none text-ink/45 ring-1 ring-inset ring-ink/10 transition-colors hover:bg-ink/10 hover:text-ink/70 focus:bg-ink/10 focus:text-ink/70 focus:outline-none"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-52 max-w-[80vw] -translate-x-1/2 translate-y-1 rounded-lg bg-ink px-3 py-2 text-[12px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-[0_12px_28px_rgba(0,0,0,0.25)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        {text}
        <span className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink" />
      </span>
    </span>
  );
}
