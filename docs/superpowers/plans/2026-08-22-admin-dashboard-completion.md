# Admin dashboard completion — everything the storefront shows, managed cleanly

**Date:** 2026-08-22
**Branch:** `category-model-pivot` (or a fresh branch off it)
**Builds on:** the data-driven catalogue from `2026-08-19-catalog-depth-and-storefront-wiring.md` and the jewellery/bags pivot.

---

## Context

The catalogue itself is in good shape. Categories, sub-categories, attribute
groups and vocabularies are all database records, and the storefront renders
from the API — so adding a category or a filter is a form entry, not a release.

The gap is everything *else* the customer sees, plus the workflow around getting
a product live. Audited against the running site:

### What the admin already controls

Products (five-tab form), categories and sub-categories, attribute groups and
their option lists, publish status, stock per variant, cross-sell pairings.

### What the customer sees that the admin cannot touch

| Surface | Where it lives now |
| --- | --- |
| 3 hero slides — image + headline | `components/home/Hero.tsx` |
| 4 homepage collection tiles | `lib/mockData.ts` |
| 4 testimonials + client portraits | `lib/mockData.ts` |
| Mega menu columns and featured tiles | `lib/navigation.ts` |
| Ethos page — 6 values, belief lines, promise | `app/(site)/ethos/page.tsx` |
| Footer link columns and blurb | `components/layout/Footer.tsx` |
| Site title / meta description / OG image | `app/(site)/layout.tsx` |
| Shipping threshold and flat rate | `app/(site)/checkout/page.tsx:34` |

### The blocking finding: no order is ever created

`app/(site)/checkout/page.tsx:42` runs `clear(); setStep("confirmation")`. That
is the whole "purchase". **A customer can complete checkout and nothing is
recorded anywhere.** Consequences:

- `POST /api/orders` exists but nothing calls it.
- It requires `protect`, and `Order.user` is required — yet the storefront has
  **no customer login or registration at all**.
- There is no admin order-listing endpoint; `orderController` only has
  `getMyOrders`, scoped to the requesting user.
- `Order.items` still carries `color` / `size`, the pre-pivot variant shape.
- Order numbers are generated as `AO-######` — *Aura & Optic*, the pre-rebrand name.

An Orders admin page cannot be built on top of that. Phase 1 fixes the pipe
before building the tap.

---

## Principle

**If a customer can see it, an admin can change it — and changing it should
never require a developer.**

The catalogue refactor already proved the pattern: hold the definition as data,
render from it, and the code stops growing per item. The same applies to hero
slides, tiles and testimonials. The rule keeps this from becoming a CMS project:
**structure in code, content in the database.**

---

## Phase 1 — Close the order loop

Nothing else in the admin matters commercially until this works.

**Decision needed first:** guest checkout or customer accounts? Guest checkout
is far less work and matches how the storefront behaves today (no login
anywhere). It means relaxing `Order.user` to optional and carrying the buyer's
contact details on the order.

- `models/Order.js`: make `user` optional; add `customer { name, email, phone }`;
  replace `items[].color/size` with `variantId`, `options` and `selections` to
  match what the cart now carries (`lib/types.ts` `CartLine`); change the order
  number prefix off `AO-`.
- `controllers/orderController.js`: allow guest creation; add `getOrders` for
  admin with status/date/search filters and pagination.
- `routes/orderRoutes.js`: `GET /` behind `protect, admin`.
- **Decrement stock on order creation**, inside a transaction, and reject when a
  variant has gone out of stock between add-to-cart and checkout. Nothing does
  this today, so overselling is currently guaranteed once orders exist.
- `checkout/page.tsx`: actually POST the order; show the real order number;
  handle and display failures rather than always showing success.
- `/admin/orders`: list with status filter, order detail, status transitions
  (pending → processing → shipped → delivered / cancelled), tracking number.
- Dashboard gains order KPIs — today's orders, revenue, average order value,
  unfulfilled count — alongside the existing product tiles.

## Phase 2 — Make getting a product live obvious

The form is complete but does not tell you what is *missing*, and several
routine jobs are slower than they should be.

- **Readiness panel on the product form.** One checklist driven by the same
  rules the storefront relies on: at least one image, a sub-category, a price,
  at least one stocked variant, the category's spec attributes filled, SEO set.
  Publishing is the moment things go wrong silently, so surface it there.
- **Publish blockers instead of silent drafts.** The Visibility select currently
  lets a product be published with no images, which renders a broken card.
- **Duplicate product.** The fastest way to add the tenth necklace in a line.
- **Bulk actions + pagination.** The list is capped at `limit=50` with no paging
  and no multi-select. Add select-all, bulk publish/unpublish, bulk out-of-stock.
- **Gallery drag-to-reorder.** The first image is the storefront thumbnail, and
  today reordering means removing and re-uploading.
- **Reuse recent uploads** rather than re-uploading the same shot per colourway.
- **Create a sub-category inline** from the product form; today you must leave,
  create it under Categories, and come back.
- **Better search.** `$text` matches whole words, so "avia" finds nothing.

## Phase 3 — Content the storefront renders

One collection, `SiteContent`, keyed by slot, each entry typed by its slot's
schema. This avoids six bespoke models while keeping the storefront's rendering
code unchanged in shape.

| Slot | Fields |
| --- | --- |
| `hero.slides` | image, headline, optional emoji, focal point, order, active |
| `home.collections` | title, subtitle, image, href, span |
| `home.testimonials` | quote, author, role, optional portrait, order |
| `nav.megaMenu` | per category: column titles, curated links, featured tile |
| `page.ethos` | intro, values[], belief lines[], promise, image |
| `layout.footer` | columns of links, blurb |
| `site.seo` | default title, description, OG image |

- `/admin/content` with one editor per slot, reusing `ImageUploader` and the
  ordering controls from Phase 2.
- The storefront reads these through `lib/api.ts` exactly as it reads products,
  keeping `cache: "no-store"` so an edit is live immediately.
- `mockData.ts` and the hardcoded arrays in `Hero.tsx`, `navigation.ts` and
  `ethos/page.tsx` are deleted as each slot lands.
- **Seed from the current hardcoded values** so the site looks identical the
  moment this ships — the migration should be invisible to customers.

## Phase 4 — Customers and reviews

- Customer accounts on the storefront: register, login, order history, saved
  addresses. `User` and the auth endpoints already exist; only the UI is missing.
- `/admin/customers`: list, order history per customer, lifetime value.
- Reviews: `rating` and `reviewCount` are on `Product` but unrendered and
  uneditable. Either build submission plus admin moderation, or remove the
  fields. Leaving modelled-but-fake numbers is the worst of the three.

## Phase 5 — Store settings

Everything currently hardcoded that a shop owner would expect to change:

- Shipping: free-delivery threshold and flat rate. Note these live in **two
  places that can already drift** — `checkout/page.tsx:34` computes it, and
  `ProductDetailView.tsx:135` states "over GH₵1,000" as prose.
- Returns window, warranty text, contact details, social links, currency.
- Admin user management and password change.

---

## Sequencing

Phase 1 first — it is the only phase the business genuinely cannot trade
without. Phase 2 next, because it compounds: every product added afterwards is
faster. Phase 3 can be done slot by slot, each independently shippable, and is
the right place to stop if effort has to be capped. Phases 4 and 5 are
lower-urgency polish.

## Verification

- Backend suite stays green (116 at time of writing); new tests for guest order
  creation, stock decrement under concurrency, and the admin order listing.
- `tsc --noEmit` clean; Playwright extended with a **buy-a-product** journey:
  add to cart → checkout → order appears in `/admin/orders` → status advances.
- For Phase 3, the acceptance test is the same one that proved the catalogue
  refactor: **change a hero headline in the admin and see it on the homepage
  with no code change and no redeploy.**
- After the Phase 3 seed, diff the rendered homepage against the current one —
  it should be identical.

## Explicitly out of scope

Payment gateway integration (Mobile Money/card are labels today, not
processors), multi-currency, discount codes, inventory across locations, and
email notifications. Each is a project in its own right; Phase 1 should leave
clean seams for payments in particular.
