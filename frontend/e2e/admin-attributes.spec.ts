import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@julesandco.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

/**
 * The Attributes tab was half-built: the API had update and delete for groups
 * from the start and nothing in the admin ever called them, so a group created
 * with the wrong role or category was permanent from the interface. These
 * assertions fail if that reachability is ever lost again.
 */
test.describe("managing attribute vocabularies", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin/dashboard");
    await page.goto("/admin/attributes");
  });

  test("a group's settings can be opened and edited", async ({ page }) => {
    const panel = page.locator("section", { hasText: "Frame Shape" }).first();
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: /Edit Frame Shape/i }).click();

    // Every one of these was unreachable: the page could only ever create a
    // group and add options to it.
    await expect(panel.getByLabel("Name")).toBeVisible();
    await expect(panel.getByLabel("Behaves as")).toBeVisible();
    await expect(panel.getByLabel("Entered as")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Save changes" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Delete group" })).toBeVisible();
  });

  test("a group can apply to more than one category", async ({ page }) => {
    const panel = page.locator("section", { hasText: "Frame Shape" }).first();
    await panel.getByRole("button", { name: /Edit Frame Shape/i }).click();

    // Creation only ever allowed one, and nothing could add a second later,
    // though the model has always stored a list.
    const eyewear = panel.getByRole("button", { name: "Eyewear", exact: true });
    await expect(eyewear).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("button", { name: "Jewellery", exact: true })).toBeVisible();
  });

  test("a list group with options cannot be turned into a free field", async ({ page }) => {
    const panel = page.locator("section", { hasText: "Frame Shape" }).first();
    await panel.getByRole("button", { name: /Edit Frame Shape/i }).click();

    // Switching would leave its options in the database, referenced by
    // products and unreachable from every form.
    await expect(panel.getByLabel("Entered as").locator("option", { hasText: "Free text" })).toBeDisabled();
    await expect(panel.getByText(/before making this a free field/i)).toBeVisible();
  });

  test("each option shows how many products use it", async ({ page }) => {
    const panel = page.locator("section", { hasText: "Metal" }).first();

    // Previously you learnt an option was in use only by trying to delete it
    // and being refused.
    await expect(panel.getByTitle(/product\(s\) use this|Not used by any product/).first()).toBeVisible();
  });

  test("options can be reordered", async ({ page }) => {
    const panel = page.locator("section", { hasText: "Ring Size" }).first();
    await expect(panel.getByRole("button", { name: /Move .* down/i }).first()).toBeVisible();
  });

  test("groups can be searched and filtered", async ({ page }) => {
    const counter = page.getByText(/^\d+ of \d+$/);
    await expect(counter).toBeVisible();
    const before = await counter.textContent();

    await page.getByLabel("Search attributes").fill("gemstone");
    await expect(counter).not.toHaveText(before || "");
    await expect(page.locator("section", { hasText: "Gemstone" }).first()).toBeVisible();
  });

  test("retired lines are hidden until asked for", async ({ page }) => {
    // Apparel was retired in the pivot, but its four groups kept rendering as
    // though they were live vocabulary.
    await expect(page.locator("section", { hasText: "Fabric" })).toHaveCount(0);

    const toggle = page.getByText(/Show \d+ from retired lines/);
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(page.locator("section", { hasText: "Fabric" }).first()).toBeVisible();
    await expect(page.getByText("Retired line").first()).toBeVisible();
  });
});
