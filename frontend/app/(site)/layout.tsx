import type { Metadata } from "next";
import { Roboto, Playfair_Display } from "next/font/google";
import "../globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { fetchFacets } from "@/lib/api";
import { fetchSiteContent } from "@/lib/content";
import { siteUrlObject } from "@/lib/siteUrl";

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

/**
 * Title, description and share image come from the admin, so they can be tuned
 * without a deploy. generateMetadata rather than a static export because that
 * is the only form that can await a fetch.
 */
export async function generateMetadata(): Promise<Metadata> {
  const content = await fetchSiteContent();
  const seo = content["site.seo"];

  return {
    /**
     * Makes every relative URL in this metadata absolute.
     *
     * Without it the share image stays a relative path, and WhatsApp, Facebook
     * and X all require an absolute og:image — so a shared link previewed with
     * no picture at all.
     */
    metadataBase: siteUrlObject(),
    title: seo.title,
    description: seo.description,
    icons: {
      icon: [
        { url: "/images/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/images/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/images/brand/apple-icon.png",
    },
    openGraph: {
      type: "website",
      siteName: "JULES & CO",
      title: seo.title,
      description: seo.description,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetched here rather than in the Header so the counts are server-rendered:
  // no request from the browser, and no flash of numberless links. Content
  // comes along for the ride — the menu and the footer both need it.
  const [facets, content] = await Promise.all([fetchFacets(), fetchSiteContent()]);

  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      {/*
        Browser extensions (Grammarly and similar) add attributes to <body>
        before React hydrates, which React reports as a server/client mismatch.
        It is not our markup. Suppression is one level deep, so genuine
        hydration bugs inside the tree still surface.
      */}
      <body className="font-sans" suppressHydrationWarning>
        <Header
          counts={facets.counts}
          countsByCategory={facets.countsByCategory}
          menu={content["nav.megaMenu"]}
        />
        <main className="pt-20">{children}</main>
        <Footer content={content["layout.footer"]} contact={content["store.contact"]} />
        <CartDrawer />
        <WhatsAppButton contact={content["store.contact"]} />
      </body>
    </html>
  );
}
