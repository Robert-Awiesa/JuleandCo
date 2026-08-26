import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

/**
 * What search engines may index.
 *
 * The admin is kept out because it is a private dashboard, and checkout is kept
 * out because it is a transient state belonging to one shopper — indexing it
 * puts half-finished baskets and order references into search results. There is
 * no /cart to exclude: the basket is a drawer, not a page.
 *
 * The middleware already refuses /admin without a session, so this is about
 * keeping it out of results rather than access control.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/checkout"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
