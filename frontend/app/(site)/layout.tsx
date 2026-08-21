import type { Metadata } from "next";
import { Roboto, Playfair_Display } from "next/font/google";
import "../globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";

// Roboto carries everything functional: body copy, navigation, buttons,
// prices and any other number. It is engineered for screen legibility, which
// is what checkout and specs need. Weights are explicit because Roboto is not
// served as a variable font by next/font.
const sans = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Playfair carries personality: hero lines, section headings, product names.
// The heavier weights are loaded so headings can go bold against light Roboto.
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JULES & CO — Wear the Difference",
  description:
    "Curated eyewear, jewellery and bags for the woman who wants to express herself with confidence, sophistication and individuality. Born from loss, created from love.",
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
      "Curated eyewear, jewellery and bags for the woman who wants to express herself with confidence, sophistication and individuality. Born from loss, created from love.",
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
