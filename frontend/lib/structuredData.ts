import type { Product } from "@/lib/types";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Schema.org descriptions of the shop, for search engines.
 *
 * This is what puts a price, a stock status and a star rating into a Google
 * result instead of a plain blue link. Every field it needs was already stored;
 * nothing here invents anything.
 *
 * Two rules the generators keep, because getting either wrong is worse than
 * omitting the markup:
 *
 *   - Every URL is absolute. A relative one is silently ignored.
 *   - A rating is emitted only when reviews actually exist. Claiming an
 *     aggregate rating with no reviews behind it is exactly what Google's
 *     structured-data policies treat as spam, and it can cost the whole site
 *     its rich results.
 */

const BRAND = "JULES & CO";

/** Relative product images live in /public; Cloudinary ones are already absolute. */
function absolute(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${siteUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function organizationSchema(seo: { description?: string }) {
  const base = siteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND,
    url: base,
    logo: absolute("/images/brand/logo-header.png"),
    description: seo.description,
  };
}

/**
 * Tells Google the site has a search, so it can offer one directly in results.
 * The shop's search is a query parameter, which is exactly what this expects.
 */
export function websiteSchema() {
  const base = siteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND,
    url: base,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/shop?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  const base = siteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: `${base}${step.path}`,
    })),
  };
}

export function productSchema(product: Product) {
  const base = siteUrl();
  const url = `${base}/product/${product.slug}`;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url,
    image: (product.images ?? []).map(absolute),
    brand: { "@type": "Brand", name: BRAND },
    category: product.category,

    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "GHS",
      price: product.price,
      // Availability is the part shoppers see in the result, so it has to
      // follow the real rollup rather than assume anything is in stock.
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: BRAND },
    },
  };

  /**
   * Only when reviews exist.
   *
   * `rating` is deliberately null until a product has an approved review — a
   * piece nobody has judged shows no rating rather than nought out of five —
   * and that distinction has to survive into the markup.
   */
  if (product.rating && product.reviewCount && product.reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}
