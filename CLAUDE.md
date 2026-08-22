# JULES & CO — CLAUDE.md

Guidance for Claude Code sessions working in this repo. See [README.md](README.md) for product vision, architecture, and setup instructions.

## Working conventions

- This is an **npm workspaces** monorepo (`frontend`, `backend`). Install/build/test from the repo root using `-w frontend` / `-w backend` flags, not inside the subfolders.
- **There is no committed env template.** `backend/.env.example` was deliberately removed on 2026-08-19 — do not recreate it. All configuration lives in `backend/.env` (gitignored), and the required variables are documented in [README.md](README.md#5-getting-started). Never commit real secrets; `.env*` files other than the documented list stay out of git.
- Large feature work happens on a dedicated branch in a git worktree under `.claude/worktrees/<name>/`, driven by a plan file in `docs/superpowers/plans/`. Check `.claude/worktrees/` for in-progress work before starting something that might duplicate it.
- Plans under `docs/superpowers/plans/` use TDD, task-by-task commits via the `subagent-driven-development` or `executing-plans` skill.

## Build log

Every build/feature pass done in this repo should get a dated entry here — a few lines: what changed, where, and any decision worth remembering (not a full changelog, git history covers that).

### 2026-08-17 — Env credential cleanup + admin dashboard continuation
- Found real MongoDB Atlas credentials had been pasted into the tracked `backend/.env.example`. Moved them to `backend/.env` (gitignored) using the `MONGO_URI` variable name the code actually reads (`backend/src/config/db.js`); restored `.env.example` to placeholders. Verified the Atlas connection live.
- Admin dashboard (Phase 3 of the roadmap) is being built in worktree `.claude/worktrees/admin-dashboard-phase-1` on branch `worktree-admin-dashboard-phase-1`, driven by `docs/superpowers/plans/2026-08-17-admin-dashboard-phase-1.md` (25 tasks), using the `subagent-driven-development` skill. Its own progress ledger lives at `.claude/worktrees/admin-dashboard-phase-1/.superpowers/sdd/2026-08-17-admin-dashboard-phase-1/progress.md` — check there for task-by-task detail before re-deriving status from scratch.
- Tasks 1–18 committed (through the categories admin page). Paused after Task 18 on an account-level session usage limit hit during subagent dispatch — remaining tasks 19–25 (product list/form tabs, inventory matrix, cross-sell wiring, Playwright e2e) not yet started.

### 2026-08-17 — Full rebrand: Aura & Optic → JULES & CO
- User supplied the real business logo (gold sunglasses mark + wordmark on black, tagline "Wear the Difference"), previously mis-saved as `frontend/public/images/products/jc0015.jpg` (looked like a product photo). Extracted it into proper web assets under `frontend/public/images/brand/`: transparent-bg header/footer lockups (`logo-header.png`, `logo-footer.png`), a glyph-only mark (`logo-mark.png`), favicons at 16/32/192/512px, an `apple-icon.png`, and an OG share image (`og-image.jpg`). Original raw file kept as `logo-source-original.jpg` in the same folder; nothing left in `products/`.
- Sampled the logo's actual gold (`#CDAD54`) and updated `frontend/tailwind.config.ts`'s `gold.DEFAULT`/`gold.dark` tokens to match — the existing obsidian/alabaster/gold palette was already close in spirit, so this was a tune, not a redesign.
- Renamed every "Aura & Optic" occurrence across root/frontend/backend `package.json` names, `backend/server.js` boot log, all page metadata (title/description/OG, favicon links added — none existed before), Header/Footer (now render the actual logo image instead of a text wordmark), Hero eyebrow (now "Wear the Difference"), BrandStory origin copy (rewritten, not just swapped), footer tagline, copyright line, and the testimonial fixture in `mockData.ts`.
- Renamed the Zustand persist localStorage keys (`aura-optic-cart` → `jules-and-co-cart`, `aura-optic-wishlist` → `jules-and-co-wishlist`) — safe since the site is pre-launch with no real user data to migrate.
- **Also still pending:** the repo root folder itself is still named `jules&co` on disk (contains a literal `&`, which is unrelated to this branding pass — see the earlier root-folder-rename conversation). That rename still requires closing the session/editor first; see prior guidance in this file's history if picked back up. Confirmed directly: the `&` breaks npm's Windows `.bin` shims (`next build`, `tsc`, `jest` all fail via the normal npm script path) because `cmd.exe` parses `&` as a command separator — `npm run dev` will not work until the folder is renamed.

### 2026-08-17 — Admin dashboard rebrand (worktree catch-up) + logo watermark
- The `admin-dashboard-phase-1` worktree forked before the public-site rebrand commit, so it still had its own full set of "Aura & Optic" copies. Brought it in line: copied the same `frontend/public/images/brand/` assets in, applied the identical text/metadata/package-name/storage-key swaps made on `master`, and fixed the same stale `gold.DEFAULT` (`#D4AF37` → `#CDAD54`) in the worktree's own `tailwind.config.ts` (which also carries extra shadcn/ui HSL tokens `master` doesn't have — left those untouched).
- Admin-specific: `Sidebar.tsx` and the login page (`admin/login/page.tsx`) now render the real logo image instead of a text wordmark. Added a new **watermark** — a large, ~6%-opacity cutout of just the sunglasses glyph (`frontend/public/images/brand/watermark-mark.png`, generated from the source logo) — placed behind the login card and behind the dashboard content area (`admin/(dashboard)/layout.tsx`). This watermark is admin-only; the public site has no watermark, only the Header/Footer logo lockups.
- Also caught two backend spots the earlier pass missed on `master` too (worth checking there): the Cloudinary upload folder default (`aura-optic/products` → `jules-and-co/products` in `uploadController.js` + its test), and the seed script's fallback `ADMIN_EMAIL` domain (`auraandoptic.com` → `julesandco.com`).
- `npm install --prefix <worktree>` (used to regenerate the worktree's lockfile without `cd`-ing through the `&` path) left a spurious self-referencing `"jules-and-co": "file:"` entry in the worktree's root `package.json` — this is a known npm quirk with `--prefix` against a workspace root run from outside it. Removed it and re-ran `npm install` from inside the worktree dir instead, which regenerated the lockfile cleanly.
- Verified with `tsc --noEmit` (zero errors) and the `uploadController.test.js` suite (2/2 passing) — both run by invoking the binaries directly via `node <path>`, since the normal npm-script path is still blocked by the `&` in the folder name.
- Left `docs/superpowers/plans/2026-08-17-admin-dashboard-phase-1.md` and the matching spec file un-renamed — planning artifacts/historical record, same call as the earlier pass made for `master`'s docs.
- Committed to `worktree-admin-dashboard-phase-1` (commit `1b7fd59`), not merged to `master`.

### 2026-08-19 — `isNew` → `isNewArrival` (Mongoose reserved-path fix) + admin console warnings
- The Product schema declared a path named `isNew`, which shadows Mongoose's built-in `Document.isNew` flag — source of the `[MONGOOSE] Warning: 'isNew' is a reserved schema pathname` on every boot. Nothing read it as the Mongoose flag yet, so this was latent rather than broken, but renamed the field to `isNewArrival` across all 17 call sites: `backend/src/models/Product.js`, the `sort=new` branch in `productController.js` (public `?sort=new` API param unchanged), `seedData.js`, `frontend/lib/types.ts` + `mockData.ts`, `frontend/app/admin/_lib/types.ts`, and the three shop/product components. Chose the rename over the `suppressReservedKeysWarning: true` escape hatch since the site is pre-launch.
- Added `backend/src/scripts/renameIsNewField.js` (npm script `migrate:is-new-arrival`) and ran it against Atlas — `$rename`d the field on all 20 existing products. Script is idempotent and handles the both-keys-present case.
- Also renamed `isNew` in `docs/superpowers/plans/2026-08-17-admin-dashboard-phase-1.md` and the matching spec. Unlike the earlier rebrand pass, these were **not** left as historical record: tasks 19–25 (product form) are still unexecuted and their code snippets would have reintroduced the reserved-path collision.
- Admin console cleanup: added `priority` to the `watermark-mark.png` `<Image>` in both `admin/login/page.tsx` and `admin/(dashboard)/layout.tsx` (Next flagged it as the LCP element), and `suppressHydrationWarning` on `<body>` in `admin/layout.tsx` — the "Extra attributes from the server: data-new-gr-c-s-check-loaded" hydration warning is Grammarly's browser extension injecting attributes, not our markup.
- Verified: `tsc --noEmit` clean, backend jest 38/38 passing, API boots with no Mongoose warning, `GET /api/products?sort=new` returns 20 products with `isNewArrival` populated.
- Renamed the Atlas database `aura-optic` → `jules-and-co` (the name `.env.example` already advertised). MongoDB has no in-place database rename, so this was a copy: added `backend/src/scripts/copyDatabase.js` (`--from`/`--to`, refuses a non-empty target without `--force`) which re-inserts every document preserving `_id` — so `pairsWith` refs and the admin user's id survive — then recreates each non-`_id_` index. Copied all 5 collections / 30 docs and verified doc counts + index names match on both sides.
- **`aura-optic` was deliberately left in place on the cluster as a rollback point** — nothing was dropped. Drop it from Atlas once you're satisfied. `backend/.env`'s `MONGO_URI` now points at `jules-and-co`; only that line changed.
- Gotcha worth remembering: the `.env` backup taken before that edit (`.env.bak-dbrename`) was **not** covered by the gitignore's `.env` rule, so it sat in the tree as an untracked file full of live Atlas/Cloudinary credentials. Deleted it. If a `.env` backup is ever needed again, put it outside the repo or widen the ignore rule to `.env*`.
- Left the `aura-optic/products` Cloudinary strings in `docs/superpowers/plans/2026-08-17-admin-dashboard-phase-1.md` (lines ~1476/1479/1524) alone — unlike the `isNew` snippets, that task is already implemented and `backend/src/controllers/uploadController.js` on `master` correctly reads `jules-and-co/products`, so those plan lines are historical record.

### 2026-08-19 — Admin login bounced back to /admin/login (missing frontend JWT_SECRET)
- Symptom: admin sign-in appeared to work but never reached the dashboard. Root cause was **not** auth logic — `frontend/.env.local` had never been created (only `.env.local.example` existed). `frontend/middleware.ts` verifies the auth cookie itself with `jose`, so `process.env.JWT_SECRET` was `undefined` → `new TextEncoder().encode(undefined)` → a **zero-length key** → `jwtVerify` throws `Zero-length key is not supported` → the bare `catch` redirects to `/admin/login`. Every `/admin/*` request, forever. Proved it both ways against a real login token: empty key throws, real secret verifies with `role: admin`.
- Backend was fine throughout — `POST /api/auth/login` returns 200 with an HS256 cookie, and CORS in `app.js` already allows `CLIENT_URL` with `credentials: true`.
- Fix: created `frontend/.env.local` (gitignored via the existing `.env.local` rule) with `NEXT_PUBLIC_API_URL` and `JWT_SECRET` copied from `backend/.env`. **The two JWT_SECRET values must stay identical** — backend signs, frontend middleware verifies.
- Why it was missing at all: `README.md`'s Getting Started only said `cp backend/.env.example backend/.env` and never mentioned the frontend template, so nobody following the README could ever have had a working admin dashboard. Added the second `cp` line plus a callout about the shared secret.
- Hardened `frontend/middleware.ts`: it now logs an explicit "JWT_SECRET is not set" error naming the fix, instead of silently redirecting — a missing secret was indistinguishable from a wrong password.
- **Next 14 does not hot-reload env changes into middleware** — the frontend dev server must be restarted before the fix takes effect. Verified the running server still 307s until that restart.

### 2026-08-19 — Admin dashboard Phase 1 finished (Tasks 19–25: the whole Products section)
- Picked up the plan where the August 17 pass stopped. Tasks 1–18 were already merged to `master`; 19–25 had never been started, which is why the Sidebar's "Products" link and `/admin/products/<id>/edit` both 404'd — the routes simply did not exist.
- Built, in plan order: the product list with category/stock/search filters and inline "Mark out of stock"/Delete (`(dashboard)/products/page.tsx`); the five-tab product form under `_components/products/` — `schema.ts`, `ProductForm.tsx`, `DetailsTab`, `AttributesTab`, `ColorsImagesTab` + `ImageUploader`, `InventoryTab` + `variantMatrix.ts`, `CrossSellTab`; and the `new` / `[id]/edit` routes.
- New deps: `react-hook-form`, `zod`, `@hookform/resolvers`, `react-colorful`, `@playwright/test` (dev) — all via `npm install -w frontend` from the repo root.
- **Two deviations from the plan, both deliberate:**
  - The plan's schema used bare `z.coerce.number()` for `compareAtPrice`. On zod v4 an emptied number input arrives as `""`, coerces to `0`, and fails `.positive()` — so leaving the optional compare-at price blank would have silently blocked every save with no visible field error. Wrapped it in a `z.preprocess` that maps blank/NaN to `undefined`.
  - zod v4 makes a coerced schema's **input and output types differ** (`price` is a string while typing, a number after parse), which `useForm<ProductFormValues>` cannot express — it produced a `Resolver` type error. The form is now `useForm<ProductFormInput, unknown, ProductFormValues>`, with `schema.ts` exporting both `z.input` and `z.output` types; every tab types its `useFormContext` with `ProductFormInput`. **If you add a tab, use `ProductFormInput`, not `ProductFormValues`.**
- Also added an `onInvalid` handler to the form's submit: Zod errors on a tab the user isn't looking at were invisible, so clicking Save just did nothing. It now toasts which fields need attention.
- `frontend/e2e/` holds the Playwright smoke test (`npm run test:e2e -w frontend`) plus a 160-byte 1×1 JPEG fixture generated in-repo. **2/2 passing** against the live stack — real login, real Cloudinary upload, create, list, stock mutation. Fixed the plan's stale `admin@auraandoptic.com` fallback to `admin@julesandco.com`.
- The test creates a product named "E2E Test Frame" in whatever database `MONGO_URI` points at. Deleted it after the run; catalog is back to 20. **Re-running the suite will recreate it** — delete it again, or point the e2e run at a scratch database.
- Verified: `tsc --noEmit` clean, backend jest 38/38, all three new routes render behind the auth middleware.
- Orders / Customers / Settings remain honest Phase 2–3 stubs with explanatory copy — not broken, just out of Phase 1 scope.
- Debugging note for next time: a blanket "This page could not be found" substring check against Next **dev** HTML is a false positive — that string ships inside the dev bundle on every page. Assert on `<title>` (the real 404 page titles itself `404: …`) or on page-specific content instead.

### 2026-08-19 — Catalog depth + storefront wiring (Phase 2)
Plan: `docs/superpowers/plans/2026-08-19-catalog-depth-and-storefront-wiring.md`. Prompted by an audit of the public site against the admin.

**The finding that reframed everything: the storefront never read the database.** Every public page imported `frontend/lib/mockData.ts`; there were zero API calls in `app/(site)` or `components/`. The admin managed Atlas, the shop rendered a hardcoded file, and the two never met.

- **Backend.** New `Attribute` model — admin-managed vocabularies (`frameShape`, `lensType`, `frameMaterial`, `fabric`, `clothingSize`, `fit`, `gender`) with a unique `(group, value)` index and delete-blocking when products still reference an option. `Product` gained `publishStatus`, `lensOptions`, `frameMaterial`, `measurements`, `composition`, `fit`, `gender`, `careInstructions`, `costPrice`, `barcode`, `weightGrams`, `seo`.
- **Public serialization** (`utils/publicProduct.js`): collapses flat `variants[]` into the `colors[]`/`sizes[]` (with `inStock`) the storefront expects, maps `_id`→`id`, drops admin-only commerce fields, and emits a pre-resolved `specs[]` array. New `GET /api/products/facets` returns only options in use, labelled. Backend suite 38 → **81 tests**.
- **Products store Attribute `value` slugs, never labels** — so renaming "Cat-Eye" in the admin updates the whole catalogue without a data migration. Labels are resolved server-side per request via `utils/labelMap.js`; the storefront never sees the vocabulary.
- **Admin.** New `/admin/attributes` page. Attributes tab is now category-aware dropdowns (was free text — which fragmented the public filter facets, since `FilterSidebar` derives checkboxes from distinct values, so "Aviator" and "aviator" became two boxes). Added: lens multi-select, measurements, publish status, SEO, cost/barcode/weight, per-variant SKU, and a **tags input** — `tags` was rendered publicly and sat in the save payload from day one but had no field, so every save wrote `[]`.
- **Colour fixes.** New swatches seeded `#121212`, so a colour named "Red" stayed black unless someone opened the picker. `colorNames.ts` resolves ~70 fashion/eyewear names to hex, warns when a name doesn't resolve, and stops overwriting once a hex is set by hand. Admin now says "Frame colours" for eyewear, matching what `VariantSelector.tsx` already told customers.
- **Storefront.** `lib/api.ts` server data layer; shop/product/search/wishlist all read the API. Filtering and sorting moved into Mongo, with filter state in the URL (shareable/bookmarkable). `mockData.ts` cut 541 → 78 lines, now editorial content only (collection tiles, testimonials). `filterProducts.ts` deleted.

**Two real bugs found by the work, both invisible until now:**
1. **`res.cloudinary.com` was not in `next.config.js` `remotePatterns`.** Every product photo uploaded through the admin would make `next/image` throw and take the whole page down. Hidden because all 20 seeded products use `picsum.photos`. Caught by the new storefront e2e test.
2. **`seedAttributes.js` first pass silently no-opped the publish backfill.** Mongoose applies the schema default (`"draft"`) to hydrated documents, so `if (!product.publishStatus)` on a `find()` result is always false even when the field is absent in Mongo — the whole catalogue would have been unpublished and the shop empty. Backfill now goes through `Product.collection.updateMany` on the raw driver. **Remember this whenever back-filling a field that has a schema default.**

- **Storefront reads are `cache: "no-store"`.** A revalidate window meant publishing in the admin didn't show up on the shop, which is indistinguishable from a bug. Trade-off is a query per render; if traffic justifies caching later, use `next: { revalidate, tags: ["catalog"] }` plus `revalidateTag` on the admin save path.
- `npm run seed:attributes -w backend` (`backend/src/scripts/seedAttributes.js`) seeds 54 vocabulary options and migrates legacy free-text values to slugs. Idempotent — re-running creates 0 duplicates.
- Playwright is now **4 tests**, covering admin→storefront round-trip: create+publish, appears on the shop, set to draft, disappears. Config raised to a 90s timeout (Next dev route compilation blew the old 30s on a cold server) and pinned to serial, since the specs share one fixture product which is now cleaned up in `beforeAll`/`afterAll`.
- Verified: backend 81/81, `tsc --noEmit` clean, e2e 4/4, catalogue left at 20 published products with no test residue.
- **Still open:** `rating`/`reviewCount` remain modelled but unrendered and uneditable, pending a real review system. Orders/Customers/Settings are still Phase 2–3 stubs.

### 2026-08-19 — Removed the committed env template
- Deleted `backend/.env.example` at the user's request. It had been deleted twice by the user and restored twice by me during the commit prep, on the assumption it was accidental — it was not. **Do not recreate it.**
- Nothing ever read it at runtime: `backend/src/app.js` and the seed/migration scripts all load `backend/.env` directly. Its only consumer was an error string in `backend/src/config/db.js` telling you to copy it, now reworded to point at the README.
- Because the template was the only record of which variables the app needs, that list moved into `README.md`'s Getting Started as a table. The `cp backend/.env.example backend/.env` step is gone — it would now fail.
- The `frontend/.env.local.example` template is still present, still tracked, and still referenced by the README's shared-`JWT_SECRET` callout. Left in place deliberately — the instruction named `env.example`, and removing the frontend one too was not asked for.

### 2026-08-19 — Apparel → Jewellery/Bags pivot (all four phases complete)

**Branch: `category-model-pivot`. Not merged.** All four phases are complete and the stack is green: backend 112/112, `tsc` clean, Playwright 7/7.

Plan: `docs/superpowers/plans/2026-08-19-catalog-depth-and-storefront-wiring.md` covered the previous pass; this pivot's plan lives at `C:\Users\Robert\.claude\plans\so-we-will-not-peaceful-beacon.md`.

#### Why
Apparel is being dropped entirely for jewellery and bags, with room for more item types. The catalogue hardcoded exactly two categories across ~30 sites. Three were structural: `Product.category` was a Mongoose enum (a hard write gate), `AttributesTab` was a binary ternary whose `else` branch *was* apparel (so a third category silently rendered clothing fields), and `InventoryTab` sourced the second variant axis only when `category === "apparel"` (so a ring with sizes was impossible). All 7 apparel products used that second axis and zero eyewear products did, so retiring apparel would have deleted the only code path jewellery needs.

#### Decisions (confirmed with the user)
- Categories are **admin-managed data**, not a code enum.
- Apparel products get **set to draft and kept**, never deleted.
- Variants must cover metal/finish, one-size-colour-only, and axes not yet known.
- I write placeholder storefront copy, flagged for their refinement.

#### Phase 1 — backend (commit `6830b0d`, done)
- `Category` is now the source of truth: it owns its variant axis labels (`optionDefaults`) and composed spec lines (`combinedSpecs`, e.g. eyewear `52-18-145 mm`, bags `30 × 20 × 12 cm`). Enums dropped from `Product`/`Subcategory`/`Attribute` in favour of controller validation.
- New `AttributeGroup` collection defines each vocabulary — which categories it applies to, `inputType`, and `role` (`spec` | `selection` | `variantAxis` | `internal`). **`selection` is how lens type is modelled**: customers choose one, but it carries no stock, so it does not multiply the inventory grid.
- Product attribute values live in an `attributes` Map keyed by group. This is what removed the ~10-sites-per-attribute code tax.
- Variants adopt the standard `options[]`/`variants[]` shape — any number of axes, colour no longer mandatory.
- Filter queries and the facets aggregation are built from group records; facets also return `groupMeta` so the storefront can render a facet nobody coded.
- `scripts/migrateToCategoryModel.js` — **works entirely through the raw driver on purpose**: the legacy fields are no longer on the schema, so a Mongoose read silently drops them and copies nothing (same trap as the `publishStatus` backfill). Verified live: 20 products migrated, total stock 126 before and after, zero legacy variants, second run a no-op. Backup in `backend/backups/` (gitignored).
- Backend tests **81 → 112**.

#### Phase 2 — admin (done, uncommitted at time of writing)
- `AttributesTab` ternary **deleted**; fields render from the category's groups by `inputType`. Verified in a browser: eyewear shows Frame Shape/Material, and `#attr-fabric` is absent.
- `InventoryTab` columns come from the product's options; `buildVariantMatrix` does an N-axis cartesian product preserving stock/SKU by id.
- `ColorsImagesTab` → `OptionsImagesTab`: edits the axes themselves. Vocabulary-backed axes pick from their group; free-form axes keep the colour-name→hex resolution.
- `/admin/categories` manages categories + sub-categories, with retire/reactivate. `/admin/attributes` renders from `AttributeGroup` and can create new groups. Both previously had hardcoded two-category panels.
- New `_lib/useCatalogConfig.ts` (categories, groups, attributes). Deleted `_lib/useAttributes.ts` and `ColorsImagesTab.tsx`.
- New e2e `admin-generic-form.spec.ts` — **3/3 passing**, asserts the fields are data-driven and fails if the ternary returns.

#### Phase 3 — storefront (done)
Phase 1 changed the API shape and `/shop` was returning **500** until this landed: `QuickViewModal` renders inside every product card and read `product.colors[0]`, which no longer exists. The API now returns `options`, `variants`, `selections`, `specs` and `attributes`, and no longer returns `colors`, `sizes` or `lensOptions`.
- `lib/types.ts`: `ProductCategory` is a plain string; `FacetResponse.groups` is an open record plus `groupMeta`.
- New `components/product/useVariantSelection.ts` — resolves chosen option values to a variant, picks the per-value image, and reports availability. Shared by the product page and quick view, which each previously kept their own `color`/`size` state.
- `VariantSelector` renders one control per `product.options` entry (swatches when values carry a hex, buttons otherwise) plus `product.selections`. No category branching left.
- `FilterSidebar` renders from `facets.groupMeta`, replacing a hardcoded category list, reset patch, counter and one JSX block per group. `shop/page.tsx` forwards any non-reserved query param straight through, so **a filter added in the admin works with no frontend edit**.
- **Cart lines are keyed by variant id**, not `productId__color__size` — that key assumed every product varied by exactly those two things. `CartLine` now carries `variantId`, `options` and `selections`; `describeCartLine`/`cartLineKey` in `lib/utils.ts` render them. The persisted store is `version: 2` with a migrate that **empties old carts** — an old line cannot be re-keyed reliably, and silently mispricing someone's basket is worse than asking them to re-add.
- Verified: `/`, `/shop`, `/product/:slug`, `/account/wishlist` all 200; `?frameShape=aviator` narrows 20 → 1 and the sidebar renders that section from data.

#### Phase 4 — the pivot itself (done)
`backend/src/scripts/pivotToJewelleryAndBags.js` (idempotent; second run reports "No changes"):
- Backs up all apparel products + sub-categories to `backend/backups/apparel-<timestamp>.json` **before touching anything**, then sets the 7 products to draft and marks the Apparel category `isActive: false`. **Nothing is deleted** — the products stay editable and republish by reactivating the category.
- Seeds **Jewellery** (necklaces, anklets, bracelets, rings, earrings) and **Bags** (totes, shoulder, crossbody, clutches) plus 14 attribute groups and 55 vocabulary options: metal, purity, gemstone, chain length, ring size, clasp, bag material, closure, strap type, strap drop, H/W/D, and a shared occasion.
- Bag dimensions render through the category's `combinedSpecs` template `{heightCm} × {widthCm} × {depthCm} cm`, so the three numbers are one spec row rather than three.
- Uses `$setOnInsert` throughout, so re-running never clobbers later hand-edits in the admin.
- Backfills `isActive` on categories via the raw driver — the field post-dates those documents and Mongoose fills the default on read, so a raw query would have missed them (same trap as the `publishStatus` backfill).

**Bug this surfaced:** `fetchCategories()` sent `?active=true` but `categoryController` reads `activeOnly`. The param was silently ignored, so the retired Apparel category would still have been offered as a shop filter with nothing behind it. Fixed in `lib/api.ts`.

Copy rewritten with `TODO(copy)` markers for refinement: `lib/navigation.ts` (mega menu now Eyewear/Jewellery/Bags with metal and material columns), `ShopView` heading, Hero, Footer, site metadata, search placeholder, and the homepage collection tiles.

**Acceptance test passed** — created a jewellery anklet with *two* stocked axes (Metal × Length, 4 variants, stock 10), specs resolving to "Purity=925 Sterling Silver, Gemstone=None, Occasion=Everyday", rendering on its product page. **No code was written for jewellery** — it is all category data.

Final state: backend **112/112**, `tsc --noEmit` clean, Playwright **7/7**, 13 published (eyewear) + 7 draft (apparel).

#### Still to do
- Add the real jewellery and bag products — the structure, vocabularies and sub-categories are in place, the catalogue is not.
- **`npm run seed -w backend` is still broken**: `seedData.js` and `seed/toVariants.js` write the pre-pivot variant shape and would create products with no variants. Rewrite before running it.
- Orders/Customers/Settings remain Phase 2–3 stubs; reviews (`rating`/`reviewCount`) still modelled but unrendered.

#### Gotchas worth keeping
- A raw NUL byte got written into `publicProduct.js` as a sentinel character. It worked and passed tests, but made git treat the source as binary. Rewritten without a sentinel; check `git diff --stat` for `Bin` markers.
- `.claude/settings.local.json` picked up an auto-added `Bash(node -e ' *)` permission. Deliberately left uncommitted — it is a policy loosening, not part of this work.

### 2026-08-20 — Warm-dark re-theme + Playfair/Roboto typography

Two related passes on `category-model-pivot`.

#### Typography (commit `dd3ca27`)
Plus Jakarta Sans → **Roboto**; Playfair Display was already the serif. Roles: Playfair for hero lines, section headings and product names (bold for headings, medium for product names); Roboto for body, navigation, buttons and every figure. Headings get progressively looser leading as they scale (1.14 at h1 → 1.3 at h3/h4) — Playfair's serifs collide at display sizes when leading sits at a UI-typical 1.1. New `.numeric` utility pins figures to Roboto with **tabular** lining figures, and `PriceTag` uses it: a price inside a serif block otherwise inherits Playfair, whose figures are decorative and slow to read. Tabular also aligns price columns and the inventory grid.

#### Colour
The logo is **gold ink with no dark ink in any asset**, but the site rendered it on `alabaster #F9F8F6`. Gold on that measured **2.04:1** — a real WCAG failure, not just an aesthetic mismatch. On the new surface it is **8.69:1**. The storefront is now warm espresso-black (`#14110F`, warm rather than a cold `#000`, which reads as tech rather than aged material), warm ivory text, gold accent — **no third colour**; `sage` survives only in `Badge`.

- **Semantic tokens over literal ones.** `obsidian`/`alabaster` mean "that near-black"/"that near-white", so redefining their *values* would make every name lie. Added `surface{,-raised,-overlay,-tile}`, `ink{,-muted,-subtle}` and `line{,-strong}` as CSS variables in `globals.css`, mapped in `tailwind.config.ts`. `:root` is the storefront (dark); **`.theme-admin` on the admin `<body>` re-declares the same names as light values**, so the admin keeps its appearance and its 16 files of `bg-white` panels, `text-red-600` validation and status badges were **not touched at all**. Only `app/admin/layout.tsx` changed, for the one class.
- **Named text levels replace arbitrary opacity.** ~163 `text-obsidian/40../70` collapsed onto three levels. Light-on-dark needs *less* opacity reduction than dark-on-light to read as equally muted, so a mechanical swap would have produced muddy text.
- **Gold marks the customer's choices only** — selected swatch, chosen option, active filter, wishlisted item. Not decoration. Buttons fill ivory and reward with gold on hover, so the accent never becomes every button's default state.
- **Sections that used `bg-obsidian` to stand out from a light page** (Hero, BrandStory, Footer) now *lift* instead of sink, via `surface-raised` and hairlines. Hero's local button overrides existed only to invert against a light page and are gone.
- **Product images sit on a light `surface-tile` well.** Real photography will have white backgrounds; bleeding a white cutout onto a dark page punches a glaring rectangle. Floating card controls became `bg-surface/80` + backdrop blur so they read against the light tile.
- Elevation is theme-dependent: `shadow-soft`/`shadow-card` are now variables, because a dark surface cannot be lifted by a darker drop shadow — it needs a light top edge plus depth.
- Fixed en route: pre-rebrand gold `#D4AF37` in the wishlist heart (`ProductCard`, `ProductDetailView`) — the brand gold is `#CDAD54`, so those were off-brand already; and the `border` token baked its alpha (`hsl(var(--border) / 0.1)`) so it could never be opaque.

**Plan assumption that proved wrong:** `apple-icon.png` has no alpha channel, and the plan assumed it would therefore show a *light* baked background. Decoded it — the bake is `#121212`, already dark and correct for the new theme. No regeneration, no image dependency added.

Verified: contrast audit passes on every ink/surface pairing (ink 16.7:1, muted 10.7, subtle 6.1, gold 8.7 on `surface`); `tsc` clean; Playwright **7/7**, the admin specs confirming the admin theme did not move.

**Note:** `tsc --noEmit` now needs `node --max-old-space-size=4096` on this machine — it OOMs at the default heap.

### 2026-08-22 — Admin dashboard Phase 2: publish readiness, duplicate, bulk actions

Plan: `docs/superpowers/plans/2026-08-22-admin-dashboard-completion.md`. Phase 1
(the order loop) is commit `2cf4a92`.

**The framing problem:** the product form was complete but *silent*. It never
said what was missing, and the Visibility select would happily publish a product
with no images — which renders an empty card on the shop. Every other item in
this phase is a job that was slower than it needed to be.

- **One definition of "ready to publish".** `backend/src/utils/productReadiness.js`
  holds four rules: an image, a sub-category, a price above zero, and a variant
  for every option. `assertPublishable` gates create *and* update, judging the
  **merged** product rather than the request body — otherwise a two-field patch
  that only flips `publishStatus` would sail past. Saving a draft is never
  gated; the point is to catch the problem at publish time, not to block work in
  progress.
- The admin mirrors those four rules in
  `frontend/app/admin/_components/products/readiness.ts`, plus four advisory
  warnings (stock, spec coverage, a second image, SEO) that need the category's
  attribute groups. **The ids match deliberately** — the backend copy is the
  gate, the frontend copy is the explanation. Keep them in step.
- `ReadinessPanel` sits **outside** the tab set, because what is missing is
  almost always on a tab you are not looking at. The Published option is
  `disabled` until the checklist clears, so the failure is visible before the
  save rather than as a 400 afterwards.
- **A blank form reads 1/4, not 0/4.** "A variant for every option" is satisfied
  while there are no options — that is how a single-item product publishes. The
  first draft of the e2e asserted 0/4 and was wrong, not the code.
- **Duplicate** (`POST /products/:id/duplicate`) copies everything, appends
  `-copy` to the slug (then `-copy-2`, `-copy-3`), and forces the copy to
  **draft with zero stock and no SKUs** — stock and barcodes belong to the
  original piece, and an unedited copy going live would double-list.
- **Bulk actions** (`PATCH /products/bulk`): publish, unpublish, mark out of
  stock, over a select-all with pagination (25/page). Bulk publish runs the same
  blockers per product and **reports what it skipped and why** — otherwise
  select-all becomes a way to put broken cards on the storefront. `outOfStock`
  uses the all-positional `variants.$[].stock` so it works whatever axes a
  product has.
- **Admin search was `$text`**, which only matches whole words — typing "avia"
  found nothing, so the box was useless as you type. Now a case-insensitive
  regex across name, slug, tags, barcode and variant SKU, with metacharacters
  escaped (unescaped, `.*` matches everything and looks like it works).
- New **publishStatus filter** on the admin list: finding your drafts is the
  main reason to open it.
- **Sub-categories can be created inline** from the product form and are
  selected on creation. Previously you left for Categories and came back, losing
  everything typed.
- **Gallery drag-to-reorder** in `ImageUploader` (HTML5 DnD, no new dependency);
  the first image is the shop thumbnail and reordering meant delete-and-reupload.
  Added **"Reuse a shot"**, backed by a new `GET /uploads/recent` over the
  Cloudinary Admin API — the same photograph is often wanted on several
  colourways, and re-uploading made a duplicate asset for nothing.

**The gate immediately caught a real ordering bug in the existing e2e:**
`admin-product.spec.ts` set Published *before* uploading the image. It passed
only because publishing was unchecked. Moved to after the image, colour and
stock — which is the order a person actually works in, and now doubles as proof
the gate opens once a product is complete.

Verified: backend **135 → 158**, `tsc --noEmit` clean, Playwright **15/15**
(7 new). Live against the running stack: `?search=avia` returns The Aviator;
publishing an image-less product returns 400 and leaves it untouched;
a duplicate came back as a zero-stock draft; bulk publish took the ready one and
skipped the image-less one by name. Verification copy deleted afterwards —
catalogue back to 24 with no residue.

**Still outstanding from Phase 1:** the plan's buy-a-product Playwright journey
(add to cart → checkout → order in `/admin/orders` → status advances) was never
written. The order pipeline is covered by 19 backend tests and was verified live,
but not from the browser.
