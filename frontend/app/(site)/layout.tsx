import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import "../globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JULES & CO — Wear the Difference",
  description:
    "Curated eyewear and apparel with a signature gold edge — JULES & CO is designed for those who wear the difference.",
  icons: {
    icon: [
      { url: "/images/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/images/brand/apple-icon.png",
  },
  openGraph: {
    title: "JULES & CO — Wear the Difference",
    description:
      "Curated eyewear and apparel with a signature gold edge — JULES & CO is designed for those who wear the difference.",
    images: ["/images/brand/og-image.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans">
        <Header />
        <main className="pt-20">{children}</main>
        <Footer />
        <CartDrawer />
      </body>
    </html>
  );
}
