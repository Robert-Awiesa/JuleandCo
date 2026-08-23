import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@julesandco.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const BUYER = {
  name: "Playwright Buyer",
  phone: "0244000111",
  email: "playwright.buyer@example.com",
  address: "12 Oxford Street",
  city: "Accra",
  region: "Greater Accra",
};

/** Set by the purchase test and read by the ones that follow it. */
let orderNumber = "";
let orderId = "";
let boughtSlug = "";
let stockBefore = 0;

async function adminCookie(request: APIRequestContext) {
  const res = await request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (res.headers()["set-cookie"] || "").split(";")[0];
}

async function signIntoAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin/dashboard");
}

/**
 * The whole commercial loop, from the shop to a fulfilled order.
 *
 * Checkout used to end at `clear(); setStep("confirmation")` — it showed an
 * invented order number and recorded nothing. Backend tests cover the pricing
 * and stock rules; this is the part they cannot see: that the storefront
 * actually reaches them, and that what a customer buys turns up in the admin.
 *
 * The order it places is real, so the last test cancels and deletes it and the
 * stock goes back. Serial by necessity — each step depends on the last.
 */
test.describe.configure({ mode: "serial" });

/**
 * Runs whatever happened above: in serial mode a failing test skips the rest,
 * so cleanup cannot itself be a test — that stranded a real order and its
 * stock the first time this suite failed. Scoped to the test buyer's email, so
 * it can never touch a genuine order.
 */
async function removeTestOrders() {
  const api = await playwrightRequest.newContext();
  try {
    const login = await api.post(`${API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!login.ok()) return;
    const cookie = (login.headers()["set-cookie"] || "").split(";")[0];

    const listed = await api.get(`${API}/orders?search=${BUYER.email}&limit=50`, {
      headers: { cookie },
    });
    const { items = [] } = await listed.json();

    for (const order of items) {
      // Cancelling is what returns the stock; delete only removes the record.
      await api.put(`${API}/orders/${order._id}/status`, {
        headers: { cookie },
        data: { status: "cancelled" },
      });
      await api.delete(`${API}/orders/${order._id}`, { headers: { cookie } });
    }
  } finally {
    await api.dispose();
  }
}

test.describe("buying a product", () => {
  test.beforeAll(removeTestOrders);
  test.afterAll(removeTestOrders);

  test("a shopper can put a product in the bag and check out", async ({ page, request }) => {
    // Pick a real published, in-stock product rather than assuming a fixture.
    const products = await (await request.get(`${API}/products`)).json();
    const buyable = products.find(
      (p: { stock: number; slug: string }) => p.stock > 0
    );
    expect(buyable, "no published product with stock to buy").toBeTruthy();

    boughtSlug = buyable.slug;
    stockBefore = buyable.stock;

    await page.goto(`/product/${boughtSlug}`);
    await page.getByRole("button", { name: "Add to Bag" }).click();

    // The drawer opens on add; go from there to checkout.
    await expect(page.getByText("Your Bag")).toBeVisible();
    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    await page.waitForURL("**/checkout");

    await page.getByPlaceholder("Full Name").fill(BUYER.name);
    await page.getByPlaceholder("Phone Number").fill(BUYER.phone);
    await page.getByPlaceholder("Email Address").fill(BUYER.email);
    await page.getByPlaceholder("Street Address").fill(BUYER.address);
    await page.getByPlaceholder("City").fill(BUYER.city);
    await page.getByPlaceholder("Region").fill(BUYER.region);
    await page.getByRole("button", { name: "Continue to Payment" }).click();

    await page.getByPlaceholder("Mobile Money Number").fill(BUYER.phone);
    await page.getByRole("button", { name: "Review Order" }).click();

    await page.getByRole("button", { name: "Place Order" }).click();

    // The number now comes from the API. Nothing was recorded before, so this
    // is the assertion that the loop is actually closed.
    const number = page.getByText(/JC-[A-Z0-9]+/);
    await expect(number).toBeVisible({ timeout: 30000 });
    orderNumber = ((await number.textContent()) || "").match(/JC-[A-Z0-9]+/)![0];
    expect(orderNumber).toMatch(/^JC-/);
  });

  test("the stock the shopper bought is gone from the catalogue", async ({ request }) => {
    const product = await (await request.get(`${API}/products/slug/${boughtSlug}`)).json();
    expect(product.stock).toBe(stockBefore - 1);
  });

  test("the order is waiting in the admin", async ({ page }) => {
    await signIntoAdmin(page);
    await page.goto("/admin/orders");

    await page.getByPlaceholder("Order number, name or email…").fill(orderNumber);

    const row = page.locator("tr", { hasText: orderNumber });
    await expect(row).toBeVisible();
    await expect(row).toContainText(BUYER.name);
    await expect(row).toContainText("pending");
  });

  test("the admin can advance it through fulfilment", async ({ page }) => {
    await signIntoAdmin(page);
    await page.goto("/admin/orders");
    await page.getByPlaceholder("Order number, name or email…").fill(orderNumber);

    const row = page.locator("tr", { hasText: orderNumber });
    await expect(row).toBeVisible();

    // A Radix select, not a native one: open it, wait for the menu to actually
    // be there, then choose. Clicking straight through is flaky under load.
    await row.getByRole("combobox").click();
    const option = page.getByRole("option", { name: "shipped" });
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.locator("tr", { hasText: orderNumber })).toContainText("shipped", {
      timeout: 20000,
    });
  });

  test("cancelling returns the stock to the catalogue", async ({ request }) => {
    const cookie = await adminCookie(request);

    const list = await (
      await request.get(`${API}/orders?search=${orderNumber}`, { headers: { cookie } })
    ).json();
    orderId = list.items[0]._id;

    const cancelled = await request.put(`${API}/orders/${orderId}/status`, {
      headers: { cookie },
      data: { status: "cancelled" },
    });
    expect(cancelled.ok()).toBeTruthy();

    // Stock back where it started — the catalogue is left as it was found.
    const product = await (await request.get(`${API}/products/slug/${boughtSlug}`)).json();
    expect(product.stock).toBe(stockBefore);

    const removed = await request.delete(`${API}/orders/${orderId}`, { headers: { cookie } });
    expect(removed.ok()).toBeTruthy();

    const after = await (
      await request.get(`${API}/orders?search=${orderNumber}`, { headers: { cookie } })
    ).json();
    expect(after.items).toHaveLength(0);
  });
});
