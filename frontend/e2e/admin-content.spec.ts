import { test, expect, request as playwrightRequest } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:5000/api";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@julesandco.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

const EDITED_HEADLINE = "E2E Content Headline";

/**
 * Restores every slot to its built-in content.
 *
 * These specs edit the live site, so anything they leave behind is visible to
 * customers. Deleting the document is what "un-edits" a slot — the API then
 * serves the default again.
 */
async function resetContent() {
  const api = await playwrightRequest.newContext();
  try {
    const login = await api.post(`${API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!login.ok()) return;
    const cookie = (login.headers()["set-cookie"] || "").split(";")[0];

    for (const slot of ["hero.slides", "home.testimonials", "site.seo"]) {
      await api.delete(`${API}/content/${slot}`, { headers: { cookie } });
    }
  } finally {
    await api.dispose();
  }
}

test.describe.configure({ mode: "serial" });

test.describe("editing site content", () => {
  test.beforeAll(resetContent);
  test.afterAll(resetContent);

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin/dashboard");
  });

  test("every content block is listed", async ({ page }) => {
    await page.goto("/admin/content");

    await expect(page.getByRole("button", { name: /Hero slides/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Homepage collection tiles/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /What our clients say/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ethos page/ })).toBeVisible();
  });

  test("the editor is built from the slot's own fields", async ({ page }) => {
    await page.goto("/admin/content");
    await page.getByRole("button", { name: /What our clients say/ }).click();

    /**
     * The slot ships empty — no shop should launch with quotes nobody said —
     * so a row has to be added before there are any fields to look at. That is
     * the stronger assertion anyway: the row is generated from the API's field
     * specs, not coded into a bespoke form.
     */
    const add = page.getByRole("button", { name: /Add testimonial/i });
    await expect(add).toBeVisible();
    await add.click();

    await expect(page.getByText("Client name").first()).toBeVisible();
    await expect(page.getByText("Location or role").first()).toBeVisible();
    await expect(page.getByText("Quote").first()).toBeVisible();
  });

  test("a hero headline edited in the admin appears on the homepage", async ({ page }) => {
    await page.goto("/admin/content");
    await page.getByRole("button", { name: /Hero slides/ }).click();

    const headline = page.getByLabel("Headline").first();
    await expect(headline).toBeVisible();
    await headline.fill(EDITED_HEADLINE);

    await page.getByRole("button", { name: "Save changes" }).click();

    // Wait for the save to land before navigating — leaving the page mid-request
    // aborts it, and the homepage then renders the content that was never
    // replaced. The sidebar stops marking the slot "original" once it is edited,
    // which is durable state rather than a toast that auto-dismisses.
    await expect(page.getByRole("button", { name: /Hero slides.*original/i })).toHaveCount(0);

    // The claim being made: no code change, no deploy.
    await page.goto("/");
    await expect(page.getByText(EDITED_HEADLINE)).toBeVisible({ timeout: 20000 });
  });

  test("restoring the original puts the site back", async ({ page }) => {
    await page.goto("/admin/content");
    await page.getByRole("button", { name: /Hero slides/ }).click();

    // Only offered once a slot has been edited, and the previous test edited it.
    const restore = page.getByRole("button", { name: "Restore original" });
    await expect(restore).toBeVisible({ timeout: 20000 });

    page.once("dialog", (dialog) => dialog.accept());
    await restore.click();

    // The sidebar marks an un-edited slot "original" — durable, unlike a toast.
    await expect(page.getByRole("button", { name: /Hero slides.*original/i })).toBeVisible({
      timeout: 20000,
    });

    await page.goto("/");
    await expect(page.getByText("Thank you for visiting Jules and Co!")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(EDITED_HEADLINE)).toHaveCount(0);
  });

  test("a required field is refused, naming what is missing", async ({ page }) => {
    await page.goto("/admin/content");
    await page.getByRole("button", { name: /What our clients say/ }).click();

    // A new row with nothing in it: the API must reject rather than store a
    // blank card on the homepage.
    await page.getByRole("button", { name: /Add testimonial/i }).click();
    await page.getByRole("button", { name: "Save changes" }).click();

    // The refusal only surfaces as a toast, so this one has to catch it.
    await expect(page.getByText(/required/i).first()).toBeVisible({ timeout: 15000 });
  });
});
