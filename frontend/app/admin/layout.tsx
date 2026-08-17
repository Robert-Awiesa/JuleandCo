import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import "../globals.css";
import { QueryProvider } from "./_lib/QueryProvider";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Admin — Aura & Optic",
  description: "Store management dashboard for Aura & Optic.",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans bg-alabaster text-obsidian antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
