import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@julesandco.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin/dashboard");
}

/**
 * The three screens that were stubs saying "coming in Phase 3", and the guards
 * on the one that can lock the shop out of its own dashboard.
 */
test.describe("customers, reviews and administrators", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("customers are built from orders rather than accounts", async ({ page }) => {
    await page.goto("/admin/customers");

    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    await expect(page.getByText(/checkout is guest-only/i)).toBeVisible();
    // Either buyers or the empty state — never the old stub.
    await expect(page.getByText(/coming in Phase/i)).toHaveCount(0);
  });

  test("the review queue explains that nothing publishes itself", async ({ page }) => {
    await page.goto("/admin/reviews");

    await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
    await expect(page.getByText(/until you approve it/i)).toBeVisible();
    await expect(page.getByText(/coming in Phase/i)).toHaveCount(0);
  });

  test("the only administrator cannot be removed", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Administrators" }).click();

    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
    await expect(page.getByText("(you)")).toBeVisible();

    // Removing yourself, or the last admin, locks the shop out with no way
    // back in — so the control is disabled, not merely refused on click.
    await expect(page.getByRole("button", { name: `Remove ${ADMIN_EMAIL}` })).toBeDisabled();
  });

  test("your own password can be changed without the command line", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Administrators" }).click();

    await expect(page.getByLabel("Current password")).toBeVisible();
    await expect(page.getByLabel("New password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Change password" })).toBeDisabled();
  });

  test("delivery settings hold a message, not a price", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: /Delivery/ }).click();

    await expect(page.getByLabel("Message at checkout")).toBeVisible();
    // The threshold-and-flat-rate model was removed: the shop agrees delivery
    // with the customer after confirming an order.
    await expect(page.getByLabel(/Free delivery from/i)).toHaveCount(0);
    await expect(page.getByLabel(/Delivery charge/i)).toHaveCount(0);
  });
});
