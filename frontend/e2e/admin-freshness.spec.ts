import { test, expect, request as playwrightRequest, type Page } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:5000/api";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@julesandco.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";

const PROBE_SUB = { name: "Freshness Probe", slug: "freshness-probe" };

async function adminApi() {
  const api = await playwrightRequest.newContext();
  const login = await api.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const cookie = (login.headers()["set-cookie"] || "").split(";")[0];
  return { api, cookie };
}

/**
 * Removes what these tests create, however a run ended. In serial mode a
 * failure skips every test after it, so cleanup cannot itself be a test.
 */
async function cleanUp() {
  const { api, cookie } = await adminApi();
  try {
    const subs = await (
      await api.get(`${API}/subcategories?categoryType=eyewear`, { headers: { cookie } })
    ).json();
    for (const sub of subs.filter((s: { slug: string }) => s.slug === PROBE_SUB.slug)) {
      await api.delete(`${API}/subcategories/${sub._id}`, { headers: { cookie } });
    }

    const { items = [] } = await (
      await api.get(`${API}/products/admin?search=(copy)&limit=50`, { headers: { cookie } })
    ).json();
    for (const product of items) {
      await api.delete(`${API}/products/${product._id}`, { headers: { cookie } });
    }
  } finally {
    await api.dispose();
  }
}

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin/dashboard");
}

/**
 * A change made in one place has to show up in the others.
 *
 * The admin cached for thirty seconds and never refetched when a tab regained
 * focus, so the figures you came back to were whatever they had been when you
 * left. Nothing was broken — the screen was simply never asked again — but it
 * reads as the dashboard lying, which is worse than a slow page.
 */
test.describe.configure({ mode: "serial" });

test.describe("staying up to date", () => {
  test.beforeAll(cleanUp);
  test.afterAll(cleanUp);

  test("a sub-category added under Categories reaches the product form", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/categories");

    // Every category panel renders the same controls, so scope to Eyewear's.
    const eyewear = page.locator("section", {
      has: page.getByRole("heading", { name: "Eyewear", exact: true }),
    });
    await eyewear.getByPlaceholder("Add a sub-category…").fill(PROBE_SUB.name);
    await eyewear.getByRole("button", { name: "Add", exact: true }).click();

    // Sub-category names render inside a rename input, so getByText never sees
    // them; the delete control carries the name as its accessible label.
    await expect(
      eyewear.getByRole("button", { name: `Delete ${PROBE_SUB.name}` })
    ).toBeVisible();

    // The form read a five-minute cache, so a sub-category created a moment
    // earlier was simply missing from the dropdown.
    await page.goto("/admin/products/new");
    await page.locator("#product-category").selectOption("eyewear");
    await expect(page.locator("#product-subcategory")).toContainText(PROBE_SUB.name);
  });

  test("a change made in another tab shows on returning to this one", async ({ page, context }) => {
    await signIn(page);
    await page.goto("/admin/products");
    await expect(page.getByRole("button", { name: "Duplicate" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: /\(copy\)/ })).toHaveCount(0);

    // A second tab stands in for anything changing the data elsewhere: another
    // admin, or a customer checking out.
    const other = await context.newPage();
    await other.goto("/admin/products");
    await other.getByRole("button", { name: "Duplicate" }).first().click();
    await expect(other.getByRole("cell", { name: /\(copy\)/ }).first()).toBeVisible();

    // Focusing the first tab must re-read rather than show what it already had.
    //
    // bringToFront alone is not enough: headless Chromium keeps every page
    // "visible", so the visibilitychange event a real tab switch produces never
    // fires, and that event is what React Query listens for. Dispatching it is
    // the browser's half of the exchange; the assertion below is still the
    // app's half — that it goes and asks again.
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByRole("cell", { name: /\(copy\)/ }).first()).toBeVisible({
      timeout: 20000,
    });

    await other.close();
  });
});
