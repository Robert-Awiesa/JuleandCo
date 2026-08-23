import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@julesandco.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

/**
 * The path from an empty form to a live product.
 *
 * The form was complete but silent: nothing told you what was missing, and the
 * Visibility select happily published a product with no images, which renders
 * an empty card on the shop. These assertions fail if either regresses.
 */
test.describe("publishing a product", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin/dashboard");
  });

  test("the checklist says what is still missing", async ({ page }) => {
    await page.goto("/admin/products/new");

    const panel = page.getByRole("complementary");
    await expect(panel.getByText("Ready to publish")).toBeVisible();

    // 1/4 on a blank form, not 0/4: "a variant for every option" is satisfied
    // while there are no options, which is how a single-item product publishes.
    await expect(panel.getByText("1/4")).toBeVisible();
    await expect(panel.getByText("At least one image")).toBeVisible();
    await expect(panel.getByText("A sub-category")).toBeVisible();
  });

  test("the checklist responds to what you type", async ({ page }) => {
    await page.goto("/admin/products/new");

    await page.locator("#product-name").fill("Readiness Probe");
    await page.locator("#product-price").fill("250");

    // Price is one of the four blockers; filling it must move the counter.
    await expect(page.getByRole("complementary").getByText("2/4")).toBeVisible();

    await page.locator("#product-category").selectOption("eyewear");
    await page.locator("#product-subcategory").selectOption("sunglasses");
    await expect(page.getByRole("complementary").getByText("3/4")).toBeVisible();

    // Only the image is outstanding, so publishing is still refused.
    await expect(page.locator("#publish-status option[value='published']")).toBeDisabled();
  });

  test("Published cannot be chosen while anything is missing", async ({ page }) => {
    await page.goto("/admin/products/new");

    const published = page.locator("#publish-status option[value='published']");
    await expect(published).toBeDisabled();
    await expect(page.getByText(/Cannot be published yet/)).toBeVisible();
  });

  test("a sub-category can be created without leaving the form", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.locator("#product-category").selectOption("eyewear");

    // The button only exists once a category is chosen — a sub-category has to
    // belong to something.
    await expect(page.getByRole("button", { name: "+ New" })).toBeVisible();
  });
});

/**
 * The list is where a catalogue is actually managed, so the slow jobs live
 * here: finding a product, copying one, and changing many at once.
 */
test.describe("the product list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin/dashboard");
    await page.goto("/admin/products");
  });

  test("search matches a partial word", async ({ page }) => {
    // $text could only match whole words, so this found nothing before.
    await page.getByPlaceholder("Name, tag or SKU…").fill("avia");
    await expect(page.getByRole("cell", { name: /Aviator/ }).first()).toBeVisible();
  });

  test("selecting rows reveals the bulk actions", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);

    // Wait for rows: clicking select-all mid-load selects an empty list, and
    // the checkbox stays unchecked.
    await expect(page.getByRole("button", { name: "Duplicate" }).first()).toBeVisible();
    await page.getByLabel("Select all on this page").check();

    await expect(page.getByText(/\d+ selected/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Move to draft" })).toBeVisible();
  });

  test("every row offers Duplicate", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Duplicate" }).first()).toBeVisible();
  });

  test("drafts can be filtered from published stock", async ({ page }) => {
    await expect(page.getByRole("cell", { name: "Live" }).first()).toBeVisible();
  });
});
