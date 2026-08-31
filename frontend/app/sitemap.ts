import type { MetadataRoute } from "next";
import { fetchProducts } from "@/lib/api";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Every page worth finding.
 *
 * Products come from the API rather than a hardcoded list, so a piece published
 * in the admin is in the sitemap on the next crawl with nothing to remember.
 * Only published products are returned by that endpoint, so a draft cannot leak
 * into search results through here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const fixed: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/ethos`, changeFrequency: "monthly", priority: 0.5 },
    // Low priority but worth indexing: people search for a shop's returns
    // policy by name, and finding it is part of deciding to buy.
    { url: `${base}/returns`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // An unreachable API must not fail the whole sitemap — fetchProducts already
  // falls back to an empty list rather than throwing.
  const products = await fetchProducts({ limit: 500 });

  return [
    ...fixed,
    ...products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
