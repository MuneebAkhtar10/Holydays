import Image from "next/image";
import { APP_LOGO, APP_LOGO_DARK, APP_MOTTO, APP_NAME } from "@/lib/brand";

const sizes = {
  sm: "h-8 w-auto sm:h-9 md:h-10",
  md: "h-12 w-auto sm:h-14",
  lg: "h-16 w-auto md:h-[4.75rem]",
} as const;

/** The tagline sits under the wordmark. Sized in CSS so the global type scale leaves it alone. */
const motto = {
  sm: "brand-motto-sm",
  md: "brand-motto-md",
  lg: "brand-motto-lg",
} as const;

export function BrandLogo({
  size = "md",
  className = "",
  /** "dark" for surfaces that stay navy whatever the theme — the print band, the email header. */
  tone = "auto",
}: {
  size?: keyof typeof sizes;
  className?: string;
  tone?: "auto" | "dark";
}) {
  const shared = `${sizes[size]} max-w-[min(100%,22rem)] object-contain object-left`;
  const img = (src: string, extra: string) => (
    <Image src={src} alt={APP_NAME} width={1000} height={286} priority={size !== "sm"} className={`${shared} ${extra}`} />
  );

  return (
    <span className={`brand-lockup inline-flex flex-col items-end ${className}`}>
      {tone === "dark" ? (
        img(APP_LOGO_DARK, "brand-logo-dark")
      ) : (
        <>
          {img(APP_LOGO, "brand-logo brand-logo-light")}
          {img(APP_LOGO_DARK, "brand-logo-dark brand-logo-themed")}
        </>
      )}
      <span className={`brand-motto ${motto[size]}`}>{APP_MOTTO}</span>
    </span>
  );
}
