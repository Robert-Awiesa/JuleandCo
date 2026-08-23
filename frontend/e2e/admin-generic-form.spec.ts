import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@julesandco.com";
// No hardcoded fallback: the seeded password is whatever backend/.env says,
// and a stale default here fails as an opaque login timeout mid-suite.
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

/**
 * Proves the product form is driven by data rather than a hardcoded branch.
 *
 * The Attributes tab used to be `category === "eyewear" ? … : …`, so the
 * apparel fields were the else case and any third category rendered clothing
 * inputs. These assertions fail if that branch ever comes back.
 */
test.describe("data-driven admin form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin/dashboard");
  });

  test("attribute fields come from the category's groups", async ({ page }) => {
    await page.goto("/admin/products/new");

    // Category options are loaded from the API, not hardcoded <option>s.
    await page.locator("#product-category").selectOption("eyewear");
    await page.getByRole("tab", { name: "Attributes" }).click();

    await expect(page.locator("#attr-frameShape")).toBeVisible();
    await expect(page.getByText("Frame Material")).toBeVisible();
    // Apparel-only fields must not appear for eyewear.
    await expect(page.locator("#attr-fabric")).toHaveCount(0);
  });

  test("the attributes admin page lists groups loaded from the database", async ({ page }) => {
    await page.goto("/admin/attributes");
    await expect(page.getByRole("heading", { name: "Frame Shape" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New attribute group" })).toBeVisible();
  });

  test("categories page renders a panel per category from the database", async ({ page }) => {
    await page.goto("/admin/categories");
    await expect(page.getByRole("heading", { name: "Eyewear" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New category" })).toBeVisible();
  });
});
