import type { MetadataRoute } from "next";
import { fetchProducts } from "@/lib/api";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Every page worth finding.
 *
 * Products come from the API rather than a hardcoded list, so a piece published
 * in the admin is in the sitemap on the next crawl with nothing to remember.
 * No `lastModified`: the public product payload deliberately does not carry
 * `updatedAt`, and widening it for a crawler hint is not worth it.
 * Only published products are returned by that endpoint, so a draft cannot leak
 * into search results through here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const fixed: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/ethos`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // An unreachable API must not fail the whole sitemap — fetchProducts already
  // falls back to an empty list rather than throwing.
  const products = await fetchProducts({ limit: 500 });

  return [
    ...fixed,
    ...products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
