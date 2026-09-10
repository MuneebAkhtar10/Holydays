import type { Metadata } from "next";
import { Manrope, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-nastaliq",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — hotels for ziyarat`,
  description: APP_TAGLINE,
};

const themeBoot = `(function(){try{var t=localStorage.getItem("serai-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${nastaliq.variable} ${manrope.className}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-screen bg-ink text-sand antialiased">
        <AppProviders>
          <Header />
          <main className="relative z-0">{children}</main>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
