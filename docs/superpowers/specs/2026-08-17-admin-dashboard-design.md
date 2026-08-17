# Admin Dashboard — Design Spec

**Date:** 2026-08-17
**Status:** Approved for implementation planning
**Scope of this spec:** Full information architecture for the admin dashboard, with **Catalog & Inventory management built first** (Phase 1). Orders, Customers, and Analytics/Settings are scaffolded as stub routes now and fleshed out in later phases.

## 1. Goals

Give the Aura & Optic admin a single, integrated dashboard to fully manage the storefront catalog: create/edit/remove products by category and sub-category, set prices and sale prices, manage per-variant (color × size) stock down to exact quantities, mark products in/out of stock, manage color swatches (label, hex, per-color image), upload and reorder product images, and manage the category/sub-category taxonomy — without touching the database directly.

## 2. Non-goals (v1)

- CSV import/export and multi-select bulk edit — deferred to a fast-follow phase.
- Multiple admin permission tiers (e.g. staff vs. super-admin) — single `admin` role is sufficient for now.
- Full Orders/Customers/Analytics functionality — routes exist in the nav and shell, but only Catalog & Inventory ship working in Phase 1.

## 3. Architecture

The dashboard lives **inside the existing Next.js app** as an `frontend/app/admin/` route group with its own layout (sidebar nav + topbar, no storefront header/footer/cart drawer). This shares the app's deploy, Tailwind theme tokens, and `lib/types.ts` rather than standing up a second app in the workspace.

- **Route protection:** Next.js middleware (`frontend/middleware.ts`) inspects an httpOnly session cookie on every `/admin/*` request (except `/admin/login`), verifies the JWT, and redirects to `/admin/login` if missing/invalid/non-admin. This mirrors the `protect`/`admin` Express middleware already guarding the API — the frontend gate is a UX convenience, the API remains the real authorization boundary.
- **UI components:** shadcn/ui (Radix-based) added to the frontend, themed with the existing palette (`#121212` obsidian, `#F9F8F6` alabaster, `#D4AF37` champagne gold, `#8A9A86` sage) and font tokens already wired in `tailwind.config.ts`. Used for data table, dialog, dropdown menu, toast, tabs, and form primitives.
- **Image hosting:** Cloudinary. Browser uploads directly to Cloudinary via a short-lived signed payload from the backend (`POST /api/uploads/sign`) — images never pass through our Express server. Returned secure URLs are stored on the product/variant.

## 4. Data Model Changes

### 4.1 Product schema restructure (`backend/src/models/Product.js`)

Replace the flat `stock: Number` + boolean-only `colors`/`sizes` arrays with a true variant matrix:

```js
variantSchema = {
  colorId: String,       // required
  colorLabel: String,    // required
  colorHex: String,
  colorImage: String,    // optional Cloudinary URL, swap-on-hover source
  sizeId: String,        // omitted entirely for eyewear (no sizes)
  sizeLabel: String,
  stock: { type: Number, required: true, min: 0, default: 0 },
  sku: String,           // optional
}

product.variants: [variantSchema]   // one row per color (eyewear) or color×size (apparel)
product.stock: Number                // DERIVED — sum of variants[].stock, recomputed server-side on every save
```

- `inStock` at the color/size level is no longer a hand-set boolean anywhere — it's computed as `stock > 0` wherever it's displayed (storefront swatches, admin table). This removes the class of bug where `stock: 0` but a color is still flagged `inStock: true` (present in today's seed data).
- The top-level `stock` field is kept (not removed) so existing storefront sort/filter/read paths don't need to change in this phase — it's just recomputed from `variants` instead of hand-maintained.
- `colors`/`sizes` arrays as separate top-level fields are removed once `variants` covers both; `frameShape`, `lensColor`, `fabric`, `clothingSize` (offered sizes for the size picker), `tags`, `pairsWith` etc. are unchanged.

### 4.2 New `Subcategory` model (`backend/src/models/Subcategory.js`)

```js
{
  name: String,             // required, e.g. "Sunglasses"
  slug: String,             // required, unique per categoryType
  categoryType: { type: String, enum: ["eyewear", "apparel"], required: true },
  sortOrder: { type: Number, default: 0 },
}
```

`Product.subCategory` becomes a slug reference validated against this collection at create/update time (server-side), instead of a free-text string. Admin manages this list from `/admin/categories`, including an inline "+ add new" affordance from within the product form so the flow never dead-ends.

### 4.3 `Category` model

No schema change. Gains `updateCategory`/`deleteCategory` controllers + routes (only `create`/`list`/`get-by-slug` exist today).

### 4.4 Migration of existing data

`backend/src/seed/seedData.js` and any live documents need one-time conversion from the old `colors[].inStock` + top-level `stock` shape to the new `variants[]` shape. Approach: for each product, distribute the existing total `stock` evenly across the colors (and sizes, if present) that were previously marked `inStock: true`; colors previously marked `inStock: false` get `stock: 0`. This is a scripted, reviewable one-time migration, not a live-traffic concern (pre-launch catalog).

### 4.5 Cloudinary config

`backend/.env` gains `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. `backend/.env.example` updated to document them.

## 5. Information Architecture

```
/admin/login              — email/password, POST /api/auth/login, sets httpOnly cookie
/admin/dashboard          — KPI tiles (product count, low-stock count, total catalog value),
                              low-stock/out-of-stock alert list, recent orders (Phase 1: minimal —
                              richer analytics in a later phase)
/admin/products           — list: search, filter (category, subcategory, stock status), table
/admin/products/new       — tabbed create form
/admin/products/[id]/edit — tabbed edit form
/admin/categories         — manage Eyewear/Apparel sub-categories (add/rename/reorder/delete)
/admin/orders             — Phase 2: nav entry + route scaffolded, minimal read-only list for now
/admin/customers          — Phase 3: nav entry + route scaffolded, not functional yet
/admin/settings           — Phase 3: nav entry + route scaffolded, not functional yet
```

Sidebar nav shows all sections now (so the shell reads as a complete dashboard); Orders/Customers/Settings are visibly present but simple/read-only until their phase lands.

## 6. UX Flows

### 6.1 Product list (`/admin/products`)

shadcn `DataTable` with: thumbnail, name, category/subcategory, price (strikethrough `compareAtPrice` when set), total stock (color-coded pill — green when stock > 5, amber when 1–5 ["low stock"], red at 0; threshold is a single constant, easy to tune later), `New`/`Best Seller` badges, and row actions (Edit, Duplicate, Delete-with-confirm). Toolbar: text search (name/tag), category filter, subcategory filter, stock-status filter (In Stock / Low Stock / Out of Stock). Row-level "Mark out of stock" zeroes every variant in one click for fast triage; "Restock" opens the edit form directly to the Inventory tab. There is no separate "out of stock" flag to toggle — a product's stock state is always exactly what its variant quantities say.

### 6.2 Product form (`/admin/products/new`, `/admin/products/[id]/edit`)

Tabbed, Zod-validated (shadcn form pattern), inline field errors, unsaved-changes navigation guard, optimistic save with toast feedback:

1. **Details** — name, auto-generated editable slug, category (Eyewear/Apparel — drives tabs 2–4), subcategory (dropdown from `Subcategory` list + inline "add new"), description, tags, price, compare-at price, `isNew`/`isBestSeller` flags.
2. **Attributes** — conditionally rendered by category: eyewear → frame shape, lens color; apparel → fabric, offered clothing sizes.
3. **Colors & Images** — add/remove color rows (label, hex color picker, optional per-color Cloudinary image); main gallery with drag-to-reorder, first image = primary/storefront thumbnail.
4. **Inventory** — variant matrix auto-generated from the colors (× sizes, for apparel) defined in tab 3: a grid of numeric stock inputs per cell, live-computed in/out badge per cell, a "set all to…" bulk-fill helper, and a live total-stock sum at the top.
5. **Cross-sell** — searchable multi-select `pairsWith` picker (existing "Complete the Look" feature).

### 6.3 Categories & sub-categories (`/admin/categories`)

Two panels (Eyewear / Apparel), each listing its sub-categories with inline rename, drag-to-reorder (`sortOrder`), add, and delete (blocked with a clear error if products still reference it).

### 6.4 Dashboard home (`/admin/dashboard`, Phase 1 minimal)

KPI tiles (product count, low/out-of-stock count, total catalog value) + a low-stock/out-of-stock table linking straight into the product edit form. No charts/trends yet — that's part of the later Analytics phase.

## 7. API Surface (new/changed)

| Method & Path | Purpose |
|---|---|
| `GET /api/products?admin=true&page=&limit=` | Admin product list — all products (no storefront-only filtering), paginated |
| `PATCH /api/products/:id/stock` | Targeted variant-stock update (used by quick mark-out-of-stock/restock actions) |
| `POST /api/products` / `PUT /api/products/:id` | Existing routes — controller updated to recompute `stock`/variant `inStock` server-side, validate `subCategory` against `Subcategory` collection |
| `GET/POST /api/subcategories` | List / create |
| `PUT/DELETE /api/subcategories/:id` | Rename/reorder / delete (blocked if referenced by a product) |
| `PUT/DELETE /api/categories/:id` | New — categories were create/read-only before |
| `POST /api/uploads/sign` | Returns a signed Cloudinary upload payload (admin-only) |
| `POST /api/auth/logout` | Clears the httpOnly session cookie |
| `POST /api/auth/login` | Existing — response changes from body-only token to httpOnly cookie (body token retained for non-browser API clients) |

## 8. Validation & Error Handling

- Server is the source of truth for derived fields (`stock`, per-variant `inStock`) — client-submitted values for these are ignored/recomputed, never trusted.
- `subCategory` and `category` are validated server-side against the `Subcategory` collection on every create/update; mismatches return a 400 with a field-level error the form can surface inline.
- Deleting a `Category` or `Subcategory` that's still referenced by a product is rejected with a 409 and a message naming the count of affected products.
- All admin mutation routes remain behind `protect` + `admin` Express middleware; the Next middleware gate is UX-only, not a security boundary.

## 9. Testing Strategy

- Backend: controller/unit tests for the stock-recompute logic (the one place a bug silently corrupts inventory data) and for subcategory/category validation and delete-blocking.
- Frontend: Playwright smoke test covering product-create → variant matrix fill → save → appears correctly in list, and the mark-out-of-stock quick action.

## 10. Phasing

- **Phase 1 (this spec's build target):** Admin shell, auth/login, Product/Category/Subcategory CRUD, variant/stock matrix, Cloudinary image upload, product list with filters, seed-data migration.
- **Phase 2:** Orders management (status updates, tracking, fulfillment view) built out from the existing `Order` model/controller.
- **Phase 3:** Customers view, Settings (admin users, store info), richer Dashboard analytics (sales trends, top products).
- **Phase 4 (explicitly deferred, not scheduled):** CSV import/export, multi-select bulk edit.
