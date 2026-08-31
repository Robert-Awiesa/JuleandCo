import { test, expect, type Page } from "@playwright/test";

// The API is a separate origin in development, so it cannot be reached through
// the page's baseURL — requests to /api on :3000 simply 404 and every test that
// needed a product silently skipped.
const API = process.env.E2E_API_URL || "http://localhost:5000/api";

/**
 * Structured data and canonicals fail silently — a broken schema does not throw,
 * it just quietly stops producing rich results, and nobody notices for months.
 * These assert the shape a crawler actually reads.
 */

async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) => nodes.map((n) => n.textContent || ""));

  return blocks.map((b) => JSON.parse(b));
}

const typesIn = (schemas: Record<string, unknown>[]) => schemas.map((s) => s["@type"]);

test.describe("what search engines are told", () => {
  test("every page identifies the shop and its search", async ({ page }) => {
    await page.goto("/");
    const types = typesIn(await jsonLd(page));

    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
  });

  test("a product carries a price, a stock status and a breadcrumb", async ({ page, request }) => {
    const products = await (await request.get(`${API}/products?limit=1`)).json().catch(() => null);
    const slug = products?.[0]?.slug;
    test.skip(!slug, "no published product to check");

    await page.goto(`/product/${slug}`);
    const schemas = await jsonLd(page);
    const product = schemas.find((s) => s["@type"] === "Product") as
      | Record<string, unknown>
      | undefined;

    expect(product, "no Product schema on the product page").toBeTruthy();

    const offers = product!.offers as Record<string, unknown>;
    expect(offers.priceCurrency).toBe("GHS");
    expect(typeof offers.price).toBe("number");
    expect(String(offers.availability)).toMatch(/InStock|OutOfStock/);

    // Relative URLs are silently ignored by every consumer of this markup.
    expect(String(product!.url)).toMatch(/^https?:\/\//);
    expect((product!.image as string[]).every((i) => /^https?:\/\//.test(i))).toBe(true);

    expect(typesIn(schemas)).toContain("BreadcrumbList");
  });

  test("a rating is claimed only when reviews exist", async ({ page, request }) => {
    const products = await (await request.get(`${API}/products?limit=20`)).json().catch(() => []);
    const unreviewed = (products || []).find(
      (p: { reviewCount?: number }) => !p.reviewCount
    );
    test.skip(!unreviewed, "every product has reviews");

    await page.goto(`/product/${unreviewed.slug}`);
    const product = (await jsonLd(page)).find((s) => s["@type"] === "Product");

    // Claiming an aggregate rating with nothing behind it is what Google's
    // policies treat as spam, and it can cost the whole site its rich results.
    expect(product!.aggregateRating).toBeUndefined();
  });
});

test.describe("which pages a crawler should index", () => {
  const canonical = (page: Page) =>
    page.locator('link[rel="canonical"]').first().getAttribute("href");

  /**
   * Read from the DOM rather than through a locator: `getAttribute` on a
   * locator that matches nothing waits for the full timeout before failing, and
   * "there is no robots meta" is the expected answer on an indexable page.
   */
  const robots = (page: Page) =>
    page.evaluate(
      () => document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null
    );

  test("the unfiltered shop is canonical to itself and indexable", async ({ page }) => {
    await page.goto("/shop");

    expect(await canonical(page)).toMatch(/\/shop$/);
    expect((await robots(page)) ?? "").not.toContain("noindex");
  });

  test("a category is its own page", async ({ page }) => {
    await page.goto("/shop?category=eyewear");
    expect(await canonical(page)).toMatch(/\/shop\?category=eyewear$/);
  });

  test("a filtered view points at the category and asks not to be indexed", async ({ page }) => {
    await page.goto("/shop?category=eyewear&frameShape=aviator");

    /**
     * The shop forwards any unrecognised parameter to the API, so the set of
     * valid URLs is effectively unbounded — 26 attribute groups and 109 options
     * in any combination. Left indexable, a crawler spends its budget on
     * permutations of the same pieces.
     */
    expect(await canonical(page)).toMatch(/\/shop\?category=eyewear$/);
    expect(await robots(page)).toContain("noindex");
    // follow is kept: the product links on those pages are still worth crawling.
    expect(await robots(page)).toContain("follow");
  });

  test("a product has one address", async ({ page, request }) => {
    const products = await (await request.get(`${API}/products?limit=1`)).json().catch(() => null);
    const slug = products?.[0]?.slug;
    test.skip(!slug, "no published product to check");

    await page.goto(`/product/${slug}`);
    expect(await canonical(page)).toMatch(new RegExp(`/product/${slug}$`));
  });

  test("the sitemap lists products with their dates", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();

    expect(xml).toContain("/shop");
    expect(xml).toContain("/returns");
    expect(xml).toContain("/product/");
    // Without lastmod a crawler re-fetches on its own guess.
    expect(xml).toContain("<lastmod>");
  });
});
