import type { Metadata } from "next";
import { Roboto, Playfair_Display } from "next/font/google";
import "../globals.css";
import { QueryProvider } from "./_lib/QueryProvider";

const sans = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin — JULES & CO",
  description: "Store management dashboard for JULES & CO.",
  icons: {
    icon: [
      { url: "/images/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/images/brand/apple-icon.png",
  },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      {/*
        theme-admin re-declares the colour variables as light values, so the
        admin keeps its current appearance while the storefront runs warm-dark
        from the same token names. The literal bg-alabaster/text-obsidian stay
        because every admin panel already uses them directly.
      */}
      <body
        className="theme-admin bg-alabaster font-sans text-obsidian antialiased"
        suppressHydrationWarning
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
