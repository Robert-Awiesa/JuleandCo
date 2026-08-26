import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * The cart and the wishlist live in localStorage, which the server cannot read.
 * Anything rendered from them has to agree with the server on the first client
 * render, or React throws the entire page away and re-renders it on the client:
 * server rendering wasted, and a visible flicker.
 *
 * It is invisible unless you have the console open, which is why it survived
 * until someone looked. These pages are checked with a **populated** basket and
 * wishlist, because an empty one matches the server by accident and proves
 * nothing.
 */

/** Collects hydration complaints, which React reports as console errors. */
function watchForHydrationErrors(page: Page): string[] {
  const found: string[] = [];

  page.on("console", (message: ConsoleMessage) => {
    const text = message.text();
    if (
      /hydration|did not match|Expected server HTML/i.test(text) &&
      message.type() === "error"
    ) {
      found.push(text);
    }
  });

  page.on("pageerror", (error) => {
    if (/hydration|did not match/i.test(error.message)) found.push(error.message);
  });

  return found;
}

/** Puts a real product in the bag and on the wishlist, then leaves them there. */
async function fillTheBasket(page: Page) {
  await page.goto("/shop");

  await page.locator("a[href^='/product/']").first().click();
  await page.waitForURL("**/product/**");

  await page.getByRole("button", { name: "Add to Bag" }).click();
  await expect(page.getByText("Your Bag")).toBeVisible();

  // Close the drawer so the next navigation starts from a normal page.
  await page.keyboard.press("Escape");
}

test.describe("pages render the same on the server and the client", () => {
  test("a shopper carrying a basket does not blow away the page", async ({ page }) => {
    await fillTheBasket(page);

    // Only start watching now: the basket is loaded, so every page below
    // renders a cart badge the server knows nothing about.
    const errors = watchForHydrationErrors(page);

    for (const path of ["/", "/shop", "/checkout"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }

    expect(errors, `hydration errors on a page with a full basket:\n${errors.join("\n")}`)
      .toEqual([]);
  });

  test("the cart drawer does not reopen itself on the next page load", async ({ page }) => {
    await page.goto("/shop");
    await page.locator("a[href^='/product/']").first().click();
    await page.getByRole("button", { name: "Add to Bag" }).click();
    await expect(page.getByText("Your Bag")).toBeVisible();

    // The drawer was open when the page unloaded. Remembering that reopened the
    // cart over whatever the shopper navigated to next, and disagreed with the
    // server, which always renders it closed.
    await page.goto("/");

    await expect(page.getByText("Your Bag")).toBeHidden();
  });
});
