import { test, expect } from "@playwright/test";

/**
 * The shop had no privacy notice, no returns policy and no terms — and its
 * footer advertised five pages that did not exist (/contact, /shipping,
 * /size-guide, /careers, /account/orders), so the two links a worried customer
 * is most likely to click both returned a 404.
 */
test.describe("policies and the footer", () => {
  const pages = [
    { path: "/privacy", heading: /Privacy Notice/i },
    { path: "/returns", heading: /Returns & Refunds/i },
    { path: "/terms", heading: /Terms of Sale/i },
  ];

  for (const { path, heading } of pages) {
    test(`${path} renders its policy`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      // Sections come from the admin, so an empty page means the content layer
      // fell back rather than reading the slot.
      expect(await page.getByRole("heading", { level: 2 }).count()).toBeGreaterThan(2);
    });
  }

  test("every link in the footer goes somewhere real", async ({ page, request }) => {
    await page.goto("/");

    const hrefs = await page
      .locator("footer a[href^='/']")
      .evaluateAll((links) => Array.from(new Set(links.map((l) => l.getAttribute("href") || ""))));

    expect(hrefs.length).toBeGreaterThan(4);

    const dead: string[] = [];
    for (const href of hrefs) {
      const res = await request.get(href);
      if (res.status() >= 400) dead.push(`${href} -> ${res.status()}`);
    }

    expect(dead, `dead links in the footer:\n${dead.join("\n")}`).toEqual([]);
  });

  test("the policy pages are reachable from the footer", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");

    for (const { path } of pages) {
      await expect(footer.locator(`a[href="${path}"]`)).toHaveCount(1);
    }
  });
});

test.describe("the mailing list", () => {
  test("a signup is actually sent to the shop, not swallowed", async ({ page }) => {
    await page.goto("/");

    /**
     * The form used to set a flag, answer "Thanks!" and discard the address.
     * Asserting on the request is the only way to tell the difference — the
     * confirmation message looked identical either way.
     */
    let posted: { email?: string; source?: string } | undefined;
    await page.route("**/subscribers", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ message: "You are on the list" }),
      });
    });

    const address = `e2e-${Date.now()}@example.com`;
    await page.getByLabel("Email address").fill(address);
    await page.getByRole("button", { name: "Join" }).click();

    await expect.poll(() => posted).toBeTruthy();
    expect(posted!.email).toBe(address);
    expect(posted!.source).toBe("footer");

    await expect(page.getByText(/You are on the list/i)).toBeVisible();
  });
});
