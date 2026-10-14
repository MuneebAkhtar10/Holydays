import { APP_TAGLINE } from "@/lib/brand";
import { BrandLogo } from "@/components/BrandLogo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-brass/20 px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-10 sm:px-5 sm:py-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <BrandLogo size="lg" />
          <p className="mt-3 max-w-sm text-sm text-mist">{APP_TAGLINE}</p>
        </div>
        <p className="text-xs text-mist">Saudi Arabia · Iraq · Iran</p>
      </div>
    </footer>
  );
}
