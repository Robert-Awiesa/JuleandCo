# Catalog Depth + Storefront Wiring — Phase 2

**Date:** 2026-08-19
**Branch:** master (worked in the main checkout, not a worktree — the user is testing against the live dev server)
**Supersedes nothing.** Builds on `2026-08-17-admin-dashboard-phase-1.md` (Tasks 1–25, complete).

## Why

An audit of the public site against the admin found three structural problems:

1. **The storefront never reads the database.** Every public page imports `frontend/lib/mockData.ts`.
   Zero API calls exist in `app/(site)` or `components/`. Admin edits reach no customer.
2. **Free-text attributes feed derived public facets.** `FilterSidebar` builds Frame Shape / Lens
   Color / Fabric checkboxes from distinct values across products, while the admin lets you type
   them free-hand — so "Aviator" and "aviator" become two facets.
3. **Orphaned fields.** `tags` is rendered publicly and included in the save payload but has no
   input (always saves `[]`). `rating`/`reviewCount` are modelled but never rendered or edited.
   Variant `sku` is in Mongo with no UI. There is no publish/draft status anywhere — nothing can
   be hidden from the storefront.

## Decisions (confirmed with the user, 2026-08-19)

- **Storefront gets wired to the API.** mockData is retired as the data source.
- **Lens = selectable options, spec-only stock.** A product carries a list of available lens types;
  customers see and choose one. Stock stays tracked per frame colour only — no frame×lens matrix.
  Rationale: frame colour is what's physically stocked; lens type is what's offered.
- **Attribute vocabularies are admin-managed**, in a new collection, surfaced as dropdowns in the
  product form and as the source of truth for public filter facets.

## Domain notes

- For eyewear, `variants[].colorLabel` is the **frame/body colour** — never the lens. The storefront
  already labels it "Frame Color" (`VariantSelector.tsx:39`); the admin did not.
- Public `Product.colors[]` / `Product.sizes[]` (with `inStock`) have no direct backend equivalent —
  they must be **derived from `variants[]`** when serving the public API.

## Tasks

### Part A — Backend

- Task 1: `Attribute` model + controller + routes + tests. Groups: `frameShape`, `lensType`,
  `frameMaterial`, `fabric`, `clothingSize`, `fit`, `gender`. Fields: `group`, `value`, `label`,
  `hex?`, `categoryType?`, `sortOrder`.
- Task 2: `Product` model additions — `publishStatus` (`draft`|`published`), `lensOptions: [String]`,
  `frameMaterial`, `measurements {lensWidthMm, bridgeWidthMm, templeLengthMm}`, `gender`, `fit`,
  `careInstructions`, `composition`, `seo {title, description}`, `costPrice`, `barcode`,
  `weightGrams`. Keep `lensColor` as the primary/hero lens for back-compat.
- Task 3: Public product serialization — derive `colors[]`/`sizes[]` with `inStock` from `variants`,
  and filter public list endpoints to `publishStatus: "published"`.
- Task 4: `GET /api/products/facets` — distinct attribute values actually in use, for the shop filters.
- Task 5: Seed the attribute vocabularies and backfill existing products.

### Part B — Admin

- Task 6: Attributes admin page (`/admin/attributes`) + sidebar entry.
- Task 7: Details tab — tags input, publish status, SEO fields, cost price / barcode.
- Task 8: Attributes tab — category-aware dropdowns sourced from the vocabulary, lens-option
  multi-select, measurements, material, gender/fit, care/composition.
- Task 9: Colors tab — label as "Frame Colour" for eyewear, colour-name→hex resolution so a new
  swatch is never wrongly black, picker seeded from the typed name.
- Task 10: Inventory tab — per-variant SKU.

### Part C — Storefront

- Task 11: Public data layer (`lib/api.ts`) + swap shop/product/search/collections/wishlist off mockData.
- Task 12: Render the new fields — lens option selector, specs block (material, measurements,
  composition, care), tags.
- Task 13: Filters driven by the facets endpoint instead of mockData constants.

## Out of scope

Reviews (rating/reviewCount stay unrendered pending a real review system), multi-currency,
prescription lens ordering flow.
