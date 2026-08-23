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

### 2026-08-22 — Clearing the known defects before Phase 3

Three things carried forward from earlier passes, plus what they turned up.

#### `npm run seed -w backend` was destructive *and* wrong
The documented seed command opened with `deleteMany({})` on products,
categories and sub-categories — against whatever `MONGO_URI` points at, which is
the live Atlas database. It then rebuilt neither: the products it wrote used the
pre-pivot `colors`/`sizes` shape, so they had no `options`/`variants`, no
`attributes` and no `publishStatus`, and their sub-category **labels** no longer
matched the **slugs** the API validates. It also seeded a retired Apparel
category while leaving `AttributeGroup`/`Attribute` untouched, so the
vocabularies would have survived with nothing pointing at them. Running it once
would have destroyed the catalogue and the pivot's configuration.

`seedData.js` is now a **bootstrap, not a wipe**: every write is `$setOnInsert`,
nothing is ever deleted, and it is safe to run against a populated database.
It defines the Eyewear category (nothing else does — it predates the category
model) and then *runs* `seedAttributes.js` and `pivotToJewelleryAndBags.js`
rather than copying their contents, so each vocabulary keeps one definition.
Products are no longer seeded at all: they are real content and belong in the
admin. `--with-examples` adds the four jewellery drafts.

Deleted `seed/toVariants.js` and its 4 tests — it built the pre-pivot variant
shape and the broken seed was its only consumer (`seedJewelleryExamples.js` has
its own, correct, `buildVariants`).

**Verified against a scratch database** (`jules-and-co-seedtest`, dropped
afterwards), never against the live one: a fresh database bootstraps to 3 active
categories, 11 sub-categories, 14 attribute groups and 55 vocabulary options;
a second run reports "No changes"; and a jewellery product created against that
config saves, rolls up stock, passes the publish gate and renders its specs.

#### The storefront search had the same `$text` bug as the admin
Fixed in the admin during Phase 2 and left in place for customers: a shopper
typing "avia" got an empty shop, while "aviator" returned The Aviator. Confirmed
live before changing it. All three search sites — storefront, admin products,
admin orders — now share `backend/src/utils/searchRegex.js`, which escapes
metacharacters (unescaped, `.*` matches everything and looks like it works) and
returns null for a blank term rather than an empty regex that matches all.

The `product_search` text index is now unqueried. Left in place with a comment
saying so, rather than dropping it from Atlas for no gain.

#### The Phase 1 buy-a-product journey, which was never written
`e2e/buy-a-product.spec.ts`: shop → Add to Bag → checkout → order in
`/admin/orders` → status advances → cancel returns the stock. It picks a real
published in-stock product rather than assuming a fixture.

It places a **real order**, so it needed a way to tidy up. Added
`DELETE /api/orders/:id`, which **refuses unless the order is already
cancelled** — cancelling is what returns the stock, so the guard keeps the two
steps in the right order and puts something deliberate between tidying a test
order and losing a real one. Exposed in the admin only on cancelled orders.

**Two test-design faults this exposed, both mine:**
- Cleanup was written as the last *test*. In serial mode a failure skips
  everything after it, so the first failed run **stranded a live order with its
  stock still held**. Cleanup is now `beforeAll`/`afterAll`, scoped to the test
  buyer's email so it can never touch a real order.
- The order-status control is a Radix select, not a native one; `selectOption`
  cannot drive it, and clicking straight through to the option is flaky under
  load. It now waits for the menu.

Also raised the assertion timeout in `admin-product.spec.ts`'s
mark-out-of-stock test: it passed alone and failed in the full suite, where the
refetch competes with Next compiling other routes.

Verified: backend **158 → 160** (+3 delete-guard, +3 storefront search, −4
deleted `toVariants`), `tsc` clean, Playwright **15 → 20**, green twice
consecutively. Catalogue left at 24 products, 0 orders, no residue.

### 2026-08-23 — Admin dashboard Phase 3: the storefront's own words

Plan: `docs/superpowers/plans/2026-08-22-admin-dashboard-completion.md`. Phase 1
is `2cf4a92`, Phase 2 is `fa6ea9a`.

**The problem:** every word and photograph outside the catalogue was hardcoded.
The hero headlines lived in `Hero.tsx`, the collection tiles and testimonials in
`lib/mockData.ts`, the mega menu in `lib/navigation.ts`, the footer links in
`Footer.tsx`, the ethos copy in its own page, and the site title in the layout's
`metadata`. Changing a client quote meant a code change and a redeploy — the
same trap the catalogue was in before the storefront was wired to the API.

#### One collection, seven slots

`SiteContent` holds one document per slot (`hero.slides`, `home.collections`,
`home.testimonials`, `nav.megaMenu`, `layout.footer`, `page.ethos`, `site.seo`).
Deliberately one collection rather than a model each: the shapes differ but the
operations never do — read one, write one, by key. `data` is `Mixed` with
`minimize: false`, without which Mongoose drops an empty array and clearing
every testimonial would silently leave the old ones in place.

**`utils/contentSlots.js` is the whole design.** Each slot declares its shape as
`fields`, and that single declaration does three jobs: validates what the API
accepts, tells the admin what form to draw, and supplies the storefront's
fallback. Field types are `text | textarea | image | boolean | url | select |
list | group`, and `list`/`group` recurse — which is how the mega menu's columns
of links and the footer's link groups get an editor without one being written.

**The defaults are the exact values that were hardcoded.** So the API answers
for a slot nobody has edited, and a database with no content documents renders
precisely the site that shipped before. Seeding is optional rather than a
migration step someone forgets and ends up with a blank homepage. It also means
"Restore original" is a real feature: deleting the document un-edits the slot.

#### The admin

`/admin/content` renders `FieldEditor` recursively from the API's field specs,
so **no slot has a hand-written form**. Rows carry a generated `id` rather than
using list position as identity — position breaks the moment anything moves —
and reorder/delete work off it. Every row is labelled by its own content
(`itemTitle`), so a collapsed list stays readable. The sidebar marks a slot
"original" until it has been edited.

#### The storefront

`lib/content.ts` reads through the same uncached `getJson` the catalogue uses,
so an edit is live on the next page load. The homepage fetches once and passes
down rather than each section fetching. Layout metadata became
`generateMetadata` — a static `metadata` export cannot await a fetch.

`lib/mockData.ts` is **deleted**. `lib/navigation.ts` keeps only `countForHref`,
which is genuinely logic, not content. `Collection` and `Testimonial` left
`lib/types.ts` — their types travel with the data now. The header's primary nav
is derived from the menu sections, so adding a section in the admin puts it in
the header; New Arrivals and Our Ethos bracket them because one is a sort and
one is a page, neither a category.

#### Two things worth remembering

- **The defaults had to match the live site exactly, and my first drafts did
  not.** The footer columns, the mega menu's column titles ("Shop by Piece", not
  "Shop by Type") and its metal/material slugs, and the whole ethos page were
  written from memory and were wrong. Each was corrected against the file it
  replaced. Verified by asserting seventeen specific strings across `/` and
  `/ethos` render exactly as before.
- **`FieldEditor`'s labels were not bound to their inputs.** Caught by the e2e
  using `getByLabel`, but it was a real accessibility defect, not a test
  problem: clicking a label focused nothing and a screen reader had no
  association. Every control now carries a `useId`-generated id.

#### Test-timing fix that was overdue

`playwright.config.ts` raised the *test* timeout to 90s for Next's per-route
compilation but left assertions at Playwright's 5s default. On a cold dev server
seven pre-existing specs failed at once — an app that looks broken but is only
slow. `expect: { timeout: 15_000 }` fixes the class; the per-assertion timeouts
added earlier stay for the genuinely slow paths.

Also learned: **do not assert on a toast.** Sonner auto-dismisses, so under a
full-suite run the assertion can start after the toast has gone. The content
specs assert the rendered page and the sidebar's "original" badge instead.

Verified: backend **160 → 174** (14 new), `tsc --noEmit` clean, Playwright
**20 → 25**. The acceptance test the plan named passes: a hero headline changed
in the admin appears on the homepage with no code change and no redeploy, and
restoring puts it back. Catalogue left at 24 products, 0 orders, every content
slot back to original.

#### Still outstanding
- Phase 4 (customer accounts, `/admin/customers`, reviews) and Phase 5 (store
  settings) are untouched. `rating`/`reviewCount` remain modelled but unrendered.
- Payment is still a label, not a processor — PayPal deferred by the owner.
- The placeholder Unsplash imagery and stand-in testimonials are now editable in
  the admin, which is where they should be replaced before launch.

### 2026-08-23 — Frontend dev port back to 3000

Reverted at the owner's request. The dynamic port added on 2026-08-22 did stop
the EADDRINUSE crash, but it moved the address on every restart, so bookmarks,
the Playwright base URL and anything holding the API's CORS origin all had to
chase it. That churn was worse than the crash.

`frontend/scripts/dev.js` now pins 3000 and **checks the port before starting**.
That check is the part worth keeping: Next's own behaviour on a busy port is to
drift to 3001 with a one-line notice, and two dev servers then share one `.next`
directory and clobber each other's chunks — which surfaces much later as a
`ChunkLoadError` on a page that was fine. A clash is now reported plainly, with
the `netstat` command to find the offender, and the process exits rather than
starting a second server. `PORT=3005 npm run dev -w frontend` still overrides.

`.next-dev-port` is gone, along with its gitignore entry; `playwright.config.ts`
reads `http://localhost:3000` again, with `E2E_BASE_URL` still winning for a run
against a deployed environment.

### 2026-08-23 — Making the admin tell the truth about current state

Asked for after Phase 3: everything should be up to date — edits, new products,
retired categories. Confirmed with the owner that this means **fresh on the next
load**, not live push to an already-open page. No SSE, no WebSockets; those stay
out until something actually needs them.

**The storefront was already fine.** Every read is `cache: "no-store"`, so
publishing, retiring and content edits show on the next page load. The staleness
was all on the admin side.

#### One line was most of it
`QueryProvider` set `refetchOnWindowFocus: false` with a 30s `staleTime`. So the
admin never re-asked when a tab regained focus: leave it open, take an order on
the storefront or edit in a second tab, come back, and the figures were whatever
they had been when you left. Nothing was broken — the screen was simply never
asked again — but it reads as the dashboard lying, which is worse than a slow
page. Now `refetchOnWindowFocus: true`, `refetchOnReconnect: true`,
`staleTime: 0` for live figures, `retry: 1` so a failure surfaces instead of
being retried three times behind a spinner.

#### Invalidation is declared once
Every mutation hand-picked its own query keys and they had drifted: saving a
product refreshed the list but not the dashboard tiles; creating a sub-category
from the product form refreshed only that dropdown; retiring a category
refreshed the Categories page while the product form kept offering it from a
five-minute cache. The screens that went stale were never the ones you were
looking at.

`frontend/app/admin/_lib/invalidate.ts` declares a change by **what happened**
rather than by which caches to clear — `catalogue()`, `orders()`,
`configuration()`, `content()`, `uploads()`. Callers say what they did. Keys are
invalidated by prefix, so `["admin-products"]` covers the list, the dashboard
tiles and the cross-sell picker without naming each. Every admin mutation now
goes through it; no page hand-picks keys any more.

`useCatalogConfig`'s cache went 5 min → 30s: long enough to save a refetch per
tab switch, short enough that a category retired elsewhere is never offered for
minutes afterwards. Edits made in the same tab do not wait for it at all.

Also: a photo just uploaded now appears in "Reuse a shot" immediately rather
than after its 60s cache window.

#### Two test-writing faults, both mine
- **Sub-category names render inside a rename `<input>`**, so `getByText` could
  never match them whatever the app did. The delete control carries the name as
  its accessible label; assert on that.
- **Headless Chromium keeps every page "visible"**, so `page.bringToFront()`
  never fires the `visibilitychange` event React Query listens for, and the
  focus-refetch test failed against working code. The spec dispatches that event
  on `window` — which is where `@tanstack/query-core` v5 listens, not
  `document`. The app's half of the exchange, going and re-asking, is still what
  is asserted.

#### Process note worth keeping
Two runs were wrecked by me, not by the code: running the backend suite
concurrently with Playwright produced "61 failed" from resource contention (the
same 178 pass alone), and editing backend files mid-run made nodemon restart the
API, which failed a login `beforeEach`. **Run one suite at a time, and do not
edit source while either is running.**

Verified: backend **174 → 178**, `tsc` clean, Playwright **25 → 27**. Catalogue
left at 24 products, 0 orders, sub-categories unchanged, every content slot
still original.

### 2026-08-23 — Professionalising single-product entry

Owner's call between bulk import and polishing one-at-a-time entry: **polish the
form**. Bulk CSV import/export was offered and deliberately not built — revisit
it if a batch of pieces ever needs adding at once.

#### Two refusals that told you nothing
Found by walking the create path against the live API rather than reading it.

- A clashing slug returned **"Duplicate field value entered"** — naming neither
  the field nor the value, so adding a second piece with a similar name was a
  dead end. Mongo puts the collision in `err.keyValue`; the handler now passes
  it on and, for `slug` specifically, says where to change it.
- A missing category returned **`"undefined" is not a known category`**, which
  reads as a bug rather than a missing field. Absent and wrong are now different
  messages, and a missing sub-category names its category by label, not slug.
- Mongoose `ValidationError` reported only the first invalid path. It now lists
  all of them — otherwise you fix one and are refused for the next.

#### SKUs
Every variant row had a blank SKU field, so a real catalogue would have had
none: nothing to search by code, nothing to print on a picking list, nothing to
reconcile physical stock against. Typing them across a twelve-row grid is
exactly the work nobody does.

`_components/products/sku.ts` generates readable codes —
`JC-ANKL-ZURIAN-SS-18IN` is an anklet, Zuri, sterling silver, 18 in — and the
Inventory tab offers **"Generate N SKUs"**, which fills only the blanks. A code
typed by hand is never overwritten; a shop with its own numbering keeps it.

**Caught while testing the scheme:** the product segment was initials, so
"The Aviator" and "The Anklet" both produced `TA`. Two pieces sharing a code
defeats the purpose. It now drops articles and keeps the distinctive words, so
`ZURIST` and `ZURIHO` stay apart. Measurements keep their digits, otherwise
every length in a range collapses to one code.

**Not enforced:** SKUs are not uniquely indexed — they live inside the variants
array. Generated codes are distinctive rather than guaranteed unique, and the
field is editable and visible before saving. Worth an index if the catalogue
grows enough for collisions to be plausible.

#### The rest
- **Margin.** `costPrice` was captured and never used, so judging a price meant
  doing the sum on paper. Margin and per-piece profit now sit beside the two
  numbers, red when a piece sells for less than it costs. Hidden until both
  exist — a margin against a missing cost is unknown, not zero.
- **Save & add another** keeps you on the form and carries category,
  sub-category and tags into the next blank one. `addAnother` is a ref, not
  state: it is read inside the mutation callback, where a state update would not
  have landed.
- **"Unsaved changes" / "All changes saved"** beside the Save button. The
  `beforeunload` dialog only appears once you are already leaving; this says so
  while there is still something to do about it.

Verified: backend **178 → 182**, `tsc` clean, Playwright **27/27** (the SKU
generation is asserted inside the existing create journey). Live: the two
refusals now read as instructions. Catalogue left at 24 products, 0 orders.

### 2026-08-23 — Merge to master, then store settings and the delivery rule

`category-model-pivot` merged into `master` (`8a1b5aa`, 29 commits) and pushed.
Verified green first — one run of 182 showed a single failure and two more were
clean, which was machine contention, not a regression.

#### A money bug found while looking for what was necessary next
The shipping rule existed twice and the copies disagreed: the API used
`>= 1000`, the checkout page `> 1000`. At a subtotal of exactly 1000 the
customer was **shown a 45 delivery charge and then charged 0** — a quoted total
that differed from the charged one.

#### Which the owner then corrected properly
**Delivery is not priced by the system at all.** It varies by where a piece is
going and is agreed with the customer after the admin confirms the order. So the
threshold-and-flat-rate model was removed rather than reconfigured — my
assumption, not their business.

- Orders are created with **`shippingPrice: null`** and a total of the pieces
  alone. **Null and 0 mean different things**: nothing agreed yet, versus agreed
  at no charge. Without the distinction an order cannot say whether the step has
  been done.
- The charge is recorded on the order, in `/admin/orders`, and `totalPrice` is
  recomputed with it via `orderTotal()` — shared by the create path and the
  admin edit so both add up the same way. Negative charges are refused; setting
  one leaves the status alone; clearing it returns the order to "not yet agreed".
- Checkout shows the subtotal as the total with the delivery message beneath.
  Saying nothing there would let the customer assume the figure is final.
- `store.delivery` holds **a message, not a price** — what customers are told at
  checkout, editable by the owner.

Verified live: order at 90 → delivery null, total 90; admin agrees 75 → total
165; cancelled and deleted afterwards.

#### Store settings (Phase 5, partly)
`/admin/settings` was a stub saying settings were "coming in Phase 3". It now
edits the `store.*` slots through the same machinery as Content — declared once
in `contentSlots.js`, validated there, editor generated from the field specs —
on its own screen, because nobody looking for delivery terms would open a page
about hero headlines. Added a **`number` field type**, settled before the text
branch so a blank does not become `""` and a quantity is not stored as a string.

**The footer's social icons linked nowhere** — bare icons that looked clickable.
They are real links now, drawn only where an account is actually configured, and
carry accessible labels. Contact details, WhatsApp and address sit in the same
settings slot.

#### Structural fix Next forced
The shared slot editor was exported from `admin/(dashboard)/content/page.tsx`,
and Next refuses a route module that exports anything beyond the names the
framework recognises. It lives in `_components/content/SlotEditor.tsx` now, which
both Content and Settings import — where it belonged.

Verified: backend **182 → 187**, `tsc` clean, Playwright **27/27**. Catalogue at
24 products, 0 orders.

#### Still outstanding
- **Payment is a label, not a processor.** PayPal, deferred by the owner. This
  is the one thing between the site and taking money.
- Phase 4: customer accounts, `/admin/customers`, and reviews — `rating` and
  `reviewCount` remain modelled but unrendered and uneditable.
- **One administrator, no way to add another from the interface.** The password
  is changed with `npm run set-admin-password -w backend`.
- Real products and photography; the Unsplash imagery and stand-in testimonials
  are placeholders, now editable under `/admin/content`.

### 2026-08-23 — Customers, administrators and reviews (the last three stubs)

Three screens promised "coming in Phase 3" and one pair of fields promised a
feature that did not exist. All four are real now.

#### Customers, derived rather than stored
There is no Customer collection because checkout is guest-only: nobody
registers, so the only record of a person is the orders carrying their email.
Grouping those cannot drift from what was actually bought, and needs no
migration if accounts ever arrive — it becomes a join, not a rewrite.

**Email is the identity.** A phone changes and a name is typed differently each
time ("Adjoa M." / "adjoa m"), but the address a receipt goes to is the one
field a buyer has to get right. Cancelled orders count in the order history and
for nothing in spend. The dashboard gained **Customers** and **Returning** —
the second being what separates a shop with traffic from one with custom.

`/api/customers` rather than `/api/orders/customers`: if accounts arrive the URL
still fits.

#### Administrators
One admin existed, made by the seed, and its password could only be changed by a
script on the server. Fine for one person setting a shop up; wrong the moment
anyone else needs access or someone leaves.

Two guards matter more than the feature, and are **disabled controls rather than
refusals on click**: the last administrator cannot be removed, and nobody can
remove themselves. Either locks the shop out of its own dashboard with no
recovery from the interface.

- Removing **demotes rather than deletes** — an admin who placed an order would
  otherwise orphan it.
- An existing customer with that email is **promoted, not duplicated**, so their
  history does not split.
- Changing your own password asks for the current one even though the session
  proves identity: it is what stops an unattended logged-in screen becoming a
  permanent takeover.

`npm run set-admin-password -w backend` still exists as the way back in if
nobody can sign in at all.

#### Reviews, and honest star ratings
`rating` and `reviewCount` sat on Product from the start, were serialised to the
storefront, and were rendered nowhere — numbers promising a feature that did not
exist. The plan called leaving them the worst of the three options.

They are now computed by `refreshProductRating()`, the only place either is ever
written, called after anything that changes which reviews are approved. Writing
one straight to a product would let the two drift.

- Reviews arrive **pending and appear nowhere until approved**. An open review
  box on a small shop is a spam target, and nobody should learn what is on their
  own product page by reading it.
- **No reviews means no rating, not a rating of nought** — `rating` is null, not
  0. A product with nothing yet would otherwise show 0/5, which slanders stock
  nobody has judged.
- **Verified purchase** is checked against non-cancelled orders for that email,
  and recorded when the review is written: an order cancelled later does not
  retract what was true then.
- Emails are never published. One review per email per product, enforced by a
  compound unique index.
- Submitting deliberately does **not** echo the review back — it is not public
  yet, and showing it would suggest otherwise.

#### Verified live
- Two orders from one buyer → one customer row, 2 orders, GHS 180; cancelling
  one leaves 2 orders and drops spend to 90.
- Removing yourself and removing the last administrator both refused; a second
  admin added, demoted and the account cleaned up afterwards.
- A review submitted → invisible publicly → queued → approved → visible with the
  product rating 4 from 1 review → deleted → rating back to none.

Verified: backend **187 → 225**, `tsc` clean, Playwright **27 → 32**.

#### What is left
- **Payment is a label, not a processor** — deferred by the owner for PayPal.
  The one thing between the site and taking money.
- Real products, photography, and real testimonials. The stand-in quotes are
  attributed to named people who did not say them — fine as placeholders,
  **not fine to launch with**. They are editable under `/admin/content`.
- `render.yaml` and the deployment docs exist but have never been exercised;
  `next build` has not been run in production mode.
- SKUs are distinctive but **not uniquely indexed** — they live inside the
  variants array.

### 2026-08-23 — Production build and a deployment dry run

`next build` had never been run in this session, and `render.yaml` had never
been exercised. Both were unknowns that would have surfaced at the worst moment.

#### The build was passing while hiding something
It succeeded, but printed **38 lines of `[storefront] … failed: Dynamic server
usage`**. Those were not failures: Next signals "this route cannot be static" by
throwing from its patched `fetch` when it sees `cache: "no-store"`, and
`lib/api.ts`'s catch was swallowing that signal and logging it as an error.

That is control flow, not a fault, and swallowing it is wrong twice over — it
buried the one place a genuine API outage during a build would have shown, and
it interferes with a mechanism Next relies on. `getJson` now re-throws anything
carrying `digest === "DYNAMIC_SERVER_USAGE"`.

Also narrowed `frontend/middleware.ts` to `jose/jwt/verify`. The package root
pulls in JWE encryption, whose compression uses `CompressionStream` — a Node API
the Edge runtime lacks — which Next reported as a warning on every build.
Middleware only ever verifies a signed token.

**Build is now clean: zero warnings, zero errors**, and the storefront routes are
still correctly marked dynamic.

#### The dry run itself
Both services started in production mode and the whole architecture was
exercised, not just the pages:

- API health `200`, Mongo connected, `trust proxy` set, cookie `Secure` only
  when `NODE_ENV=production`.
- `next start` served `/`, `/shop`, `/ethos`, `/checkout`, `/admin/login`.
- **The `/api` rewrite works**, which is the part that makes admin auth possible
  once the two services sit on different hosts: login through the storefront
  origin set the cookie (`HttpOnly, Secure, SameSite=Lax`), `/admin/dashboard`
  stayed signed in, and without the cookie it correctly `307`s to login.

**A false alarm of my own:** I first reported the `/api` rewrite missing from the
build. My check read `routes-manifest.json` expecting the
`beforeFiles/afterFiles/fallback` shape; Next stores a plain **array** when no
phase buckets are used. The rewrite was there all along.

**Worth remembering:** `rewrites()` is evaluated at *build* time, so `API_ORIGIN`
must be present during the build, not only at runtime. `render.yaml` sets it as
a service env var, which Render supplies to both.

#### A real defect, in the documentation
`docs/deployment-render.md` still ended with **"Do not run `npm run seed -w
backend`"** — stale since the seed was rewritten as a safe idempotent bootstrap.
Following it, an operator would have avoided the one command that does the whole
job and run two others instead. The first-deploy steps now say to run the seed,
and point at Settings → Administrators for password changes rather than only the
CLI.

Verified: `render.yaml` covers every variable the code reads, `/api/health`
exists, and both `start` scripts are correct.

### 2026-08-23 — Dashboard rebuilt for production

Reviewed tab by tab at the owner's request, starting here. The Dashboard was the
least finished screen in the admin: built before Orders, Reviews, Customers and
publish-gating existed, and never caught up. It reported; it routed nowhere.

- **Live and draft are now separate figures.** It said "Total Products 24" while
  the shop showed 13. That is the distinction all of Phase 2's publish-gating was
  built around, and the headline tile ignored it.
- **Per-tile loading.** `isLoading` came from the products query alone, so
  Revenue rendered `GH₵0.00` while its own request was in flight — a wrong number
  presented as fact rather than a loading state.
- **The database counts now.** `GET /products/stats` and `/products/attention`
  replaced `limit=1000`: **31 KB of catalogue became 123 bytes**, and the totals
  stay correct past the page limit instead of silently understating.
- **Every figure links** to the screen that acts on it.
- **"Needs attention" knows more than stock**: sold-out live pieces, low stock,
  **drafts with nothing blocking them** (judged by the same `publishBlockers`
  the API gates on), and live products missing something, each with the reason.
- **Revenue has a period** — this month against last. A lifetime figure only
  grows and stops meaning anything.
- **Stock value at retail and cost**, and it says when no cost prices exist
  rather than showing a misleading zero.

**A queue the delivery change created and nothing surfaced:** orders with no
delivery charge agreed. `/orders/stats` now returns `awaitingDelivery` and the
dashboard shows it as a banner.

Every mutation that moves a figure invalidates it — publishing, stock, order
status, cancellation, review moderation, category changes — so with
refetch-on-focus the dashboard cannot sit on stale numbers.

An existing test failed and was right to: it asserted the exact `/orders/stats`
shape, and fields were added. The assertion now checks the guard it cared about
(an average over no orders is 0, not NaN).

Verified: backend **225 → 238**, `tsc` clean, Playwright **32/32**. Live:
13 published / 11 drafts, 1 sold out, 5 low, 12 attention items.
