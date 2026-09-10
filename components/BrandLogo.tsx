import Image from "next/image";
import { APP_LOGO, APP_NAME } from "@/lib/brand";

const sizes = {
  sm: "h-10 w-auto sm:h-11 md:h-12",
  md: "h-12 w-auto sm:h-14",
  lg: "h-16 w-auto md:h-[4.75rem]",
} as const;

export function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <Image
      src={APP_LOGO}
      alt={APP_NAME}
      width={1000}
      height={286}
      priority={size !== "sm"}
      className={`brand-logo ${sizes[size]} max-w-[min(100%,22rem)] object-contain object-left ${className}`}
    />
  );
}
