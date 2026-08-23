import { getJson } from "./api";

/**
 * Editorial content the storefront renders — hero slides, homepage tiles,
 * testimonials, the mega menu, the footer, the ethos page and the site's SEO.
 *
 * All of it used to be hardcoded in `lib/mockData.ts`, `Hero.tsx` and
 * `lib/navigation.ts`, so changing a headline meant a code change and a
 * redeploy. It now comes from the API, uncached like the catalogue, so an edit
 * in the admin is live on the next page load.
 *
 * The API answers with its built-in defaults for any slot nobody has edited,
 * and `getJson` degrades to the fallback if the API is unreachable — so this
 * layer never leaves a page without content to render.
 */

export interface HeroSlide {
  id: string;
  image: string;
  alt: string;
  headline: string;
  emoji?: string;
  objectPosition: string;
  active: boolean;
}

export interface CollectionTile {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
  span?: "wide" | "tall" | "default";
}

export interface ClientTestimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  image?: string;
}

export interface ContentLink {
  id: string;
  label: string;
  href: string;
}

export interface ContentColumn {
  id: string;
  title: string;
  links: ContentLink[];
}

export interface MegaMenuSection {
  id: string;
  key: string;
  label: string;
  href: string;
  columns: ContentColumn[];
  featured: { title: string; subtitle: string; image: string; href: string };
}

export interface FooterContent {
  blurb: string;
  tagline: string;
  columns: ContentColumn[];
}

export interface EthosContent {
  headline: string;
  intro: string;
  image?: string;
  valuesHeading: string;
  values: { id: string; title: string; body: string }[];
  beliefs: { id: string; text: string }[];
  founderQuote?: string;
  promise: string;
  promiseBody?: string;
}

export interface DeliverySettings {
  /**
   * What customers are told about delivery at checkout. There is no price:
   * delivery depends on where an order is going and is agreed with the customer
   * once the order is confirmed.
   */
  checkoutNote: string;
}

export interface ContactSettings {
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
}

export interface SeoContent {
  title: string;
  description: string;
  ogImage?: string;
}

export interface SiteContent {
  "hero.slides": HeroSlide[];
  "home.collections": CollectionTile[];
  "home.testimonials": ClientTestimonial[];
  "nav.megaMenu": MegaMenuSection[];
  "layout.footer": FooterContent;
  "page.ethos": EthosContent;
  "site.seo": SeoContent;
  "store.delivery": DeliverySettings;
  "store.contact": ContactSettings;
}

/**
 * Last-resort content, used only when the API cannot be reached at all. Kept
 * deliberately thin: the API already serves full defaults for unedited slots,
 * so this exists to keep a page rendering during an outage, not to duplicate
 * the content in two places.
 */
const OFFLINE_FALLBACK: SiteContent = {
  "hero.slides": [],
  "home.collections": [],
  "home.testimonials": [],
  "nav.megaMenu": [],
  "layout.footer": { blurb: "", tagline: "", columns: [] },
  "page.ethos": {
    headline: "Born from loss, created from love.",
    intro: "",
    valuesHeading: "",
    values: [],
    beliefs: [],
    promise: "",
  },
  "site.seo": {
    title: "JULES & CO — Wear the Difference",
    description:
      "Curated eyewear, jewellery and bags for the woman who wants to express herself with confidence, sophistication and individuality.",
  },
  "store.delivery": {
    checkoutNote: "Delivery is arranged with you once your order is confirmed.",
  },
  "store.contact": {},
};

/** Every slot in one request. Layouts need several, so this beats N calls. */
export async function fetchSiteContent(): Promise<SiteContent> {
  return getJson<SiteContent>("/content", OFFLINE_FALLBACK);
}

/** One slot, for a page that needs only its own block. */
export async function fetchContentSlot<K extends keyof SiteContent>(
  slot: K
): Promise<SiteContent[K]> {
  const res = await getJson<{ slot: string; data: SiteContent[K] } | null>(
    `/content/${slot}`,
    null
  );
  return res?.data ?? OFFLINE_FALLBACK[slot];
}
