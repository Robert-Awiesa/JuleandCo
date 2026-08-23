import { test, expect, request as playwrightRequest } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:5000/api";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@julesandco.com";
// No hardcoded fallback: the seeded password is whatever backend/.env says,
// and a stale default here fails as an opaque login timeout mid-suite.
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
const FIXTURE_NAME = "E2E Test Frame";

/**
 * The create test writes a product with a unique slug, so a fixture left behind
 * by an earlier run makes every subsequent run fail on a duplicate slug. Clear
 * it up front, and again at the end so the catalogue is left as we found it.
 */
async function removeFixtureProduct() {
  const api = await playwrightRequest.newContext();
  const login = await api.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const { token } = await login.json();

  const listed = await api.get(`${API}/products/admin?limit=100`, {
    headers: { cookie: `token=${token}` },
  });
  const { items } = await listed.json();

  for (const product of items.filter((p: { name: string }) => p.name === FIXTURE_NAME)) {
    await api.delete(`${API}/products/${product._id}`, { headers: { cookie: `token=${token}` } });
  }
  await api.dispose();
}

test.describe.configure({ mode: "serial" });

test.describe("admin product management", () => {
  test.beforeAll(removeFixtureProduct);
  test.afterAll(removeFixtureProduct);

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin/dashboard");
  });

  test("creates a product with an image, a color, and stock, then it appears in the list", async ({ page }) => {
    await page.goto("/admin/products/new");

    await page.locator("#product-name").fill(FIXTURE_NAME);
    // Category no longer defaults — it is a list loaded from the database, so
    // one has to be chosen before its sub-categories and attributes exist.
    await page.locator("#product-category").selectOption("eyewear");
    await page.locator("#product-subcategory").selectOption({ index: 1 });
    await page.locator("#product-description").fill("Created by the Playwright smoke test.");
    await page.locator("#product-price").fill("199");

    await page.getByRole("tab", { name: "Options & Images" }).click();
    await page.setInputFiles('input[type="file"]', "e2e/fixtures/test-product.jpg");
    await expect(page.getByText("Primary")).toBeVisible({ timeout: 15000 });

    // The "Frame Colour" axis is seeded from the category's optionDefaults, so
    // only a value needs adding.
    await page.getByRole("button", { name: "+ Add value" }).click();
    await page.getByPlaceholder("e.g. Tortoise").fill("Test Black");

    await page.getByRole("tab", { name: "Inventory" }).click();
    await page.locator('input[name="variants.0.stock"]').fill("5");

    // SKUs were a blank field on every row, so a real catalogue had none.
    // Generated codes read as what they refer to: JC, the sub-category, the
    // piece, then the colourway.
    await page.getByRole("button", { name: /Generate 1 SKU/i }).click();
    await expect(page.locator('input[name="variants.0.sku"]')).toHaveValue(/^JC-SUNG-E2ETES/);

    // Published last, and only now: the option is disabled until the product
    // has everything the storefront needs, so this doubles as proof the gate
    // opens once it does.
    await page.getByRole("tab", { name: "Details" }).click();
    await page.locator("#publish-status").selectOption("published");

    await page.getByRole("button", { name: "Save product" }).click();
    await page.waitForURL("**/admin/products");

    await expect(page.getByText(FIXTURE_NAME)).toBeVisible();
  });

  test("a published product reaches the public storefront", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByText(FIXTURE_NAME)).toBeVisible();
  });

  test("setting a product back to draft removes it from the storefront", async ({ page }) => {
    await page.goto("/admin/products");
    await page.locator("tr", { hasText: FIXTURE_NAME }).getByRole("link", { name: "Edit" }).click();
    await page.waitForURL("**/edit");

    await page.locator("#publish-status").selectOption("draft");
    await page.getByRole("button", { name: "Save product" }).click();
    await page.waitForURL("**/admin/products");

    await page.goto("/shop");
    await expect(page.getByText(FIXTURE_NAME)).toHaveCount(0);
  });

  test("marks a product out of stock from the list", async ({ page }) => {
    await page.goto("/admin/products");
    const row = page.locator("tr", { hasText: FIXTURE_NAME });
    await row.getByRole("button", { name: "Mark out of stock" }).click();

    // The row re-renders from a refetch, which under a full-suite run competes
    // with Next compiling other routes. The default 5s is not always enough.
    await expect(row.getByText("0 in stock")).toBeVisible({ timeout: 20000 });
  });
});
