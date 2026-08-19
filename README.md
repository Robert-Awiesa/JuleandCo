# JULES & CO

*Wear the Difference.*

An elevated, professional e-commerce platform for curated eyewear and apparel. Minimalist luxury aesthetic, editorial typography, and a robust technical foundation, built around the JULES & CO brand — signature gold-on-black identity, richer product discovery, and a refined visual language.

## 1. Project Vision & Aesthetic Direction

**Vibe & tone:** Minimalist luxury, high-end editorial feel, crisp typography, generous whitespace.

**Color palette**

| Role | Name | Hex |
|---|---|---|
| Primary | Deep Obsidian / Rich Charcoal | `#121212` |
| Secondary | Warm Alabaster / Soft Cream | `#F9F8F6` |
| Accent (gold) | Signature Gold (from logo) | `#CDAD54` |
| Accent (sage) | Muted Sage | `#8A9A86` |

**Typography**

- UI / body: geometric sans-serif — *Plus Jakarta Sans* (with *Inter* as fallback)
- Headers / editorial: high-end serif — *Playfair Display*

Both are wired up via `next/font/google` in [frontend/app/layout.tsx](frontend/app/layout.tsx) and exposed as CSS variables (`--font-sans`, `--font-serif`) consumed by [frontend/tailwind.config.ts](frontend/tailwind.config.ts).

## 2. Functional Feature Matrix

| Feature Area | Reference Standard | Our Elevated Solution | Where it lives |
|---|---|---|---|
| Navigation & Layout | Sidebar toggle, basic text links | Sticky glassmorphism header, mega-menu with image previews, animated transitions | `components/layout/Header.tsx`, `MegaMenu.tsx` |
| Product Discovery | Basic text search + grid | Instant predictive search modal, multi-facet filtering (frame shape, lens color, size, fabric, price) | `components/layout/SearchModal.tsx`, `components/shop/FilterSidebar.tsx` |
| Product Presentation | Static cards, flat prices | Hover image-swap cards, quick-view modal, live stock indicators | `components/shop/ProductCard.tsx` |
| Conversion & Checkout | WhatsApp links, GHS selector | Multi-step checkout drawer, Mobile Money / Card gateways (mocked), order tracking | `app/checkout/page.tsx` |

## 3. Architecture & Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion — `/frontend`
- **Backend:** Node.js + Express REST API — `/backend`
- **Database:** MongoDB via Mongoose (products, categories, orders, users)
- **State management:** Zustand for cart & wishlist (persisted to `localStorage`)

This repo is an **npm workspaces** monorepo: the root `package.json` wires `frontend` and `backend` together so both can be run with one command.

## 4. Project Structure

```
julesandco/
├── frontend/                  Next.js storefront
│   ├── app/                   App Router pages (home, shop, product/[slug], checkout)
│   ├── components/
│   │   ├── layout/            Header, Footer, MegaMenu, CartDrawer, SearchModal
│   │   ├── home/               Hero, CuratedCollections, BrandStory, Testimonials
│   │   ├── shop/               FilterSidebar, ProductGrid, ProductCard, QuickViewModal
│   │   ├── product/            ImageGallery, VariantSelector, CompleteTheLook
│   │   └── ui/                 Button, Badge, PriceTag primitives
│   ├── lib/                    types, mock data, currency/format utils
│   └── store/                  Zustand cart & wishlist stores
├── backend/                   Express API
│   ├── server.js
│   └── src/
│       ├── config/db.js        Mongo connection
│       ├── models/              Product, Category, Order, User
│       ├── controllers/         Route handlers
│       ├── routes/              Express routers
│       ├── middleware/          auth + error handling
│       └── seed/seedData.js     Sample eyewear + apparel catalog
└── package.json                Workspace root (dev/seed scripts)
```

## 5. Getting Started

```bash
# from the repo root
npm install

# copy env templates and fill in values
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# seed MongoDB with sample eyewear + apparel products
npm run seed

# run frontend (http://localhost:3000) + backend (http://localhost:5000) together
npm run dev
```

Requires Node 18+ and a running MongoDB instance (local or Atlas — set `MONGO_URI` in `backend/.env`).

> **`JWT_SECRET` must be identical in `backend/.env` and `frontend/.env.local`.** The backend signs the auth
> cookie with it and `frontend/middleware.ts` verifies that cookie itself, so if the two differ — or the
> frontend value is missing — admin login appears to succeed but every `/admin/*` route redirects straight
> back to `/admin/login`. Restart `next dev` after changing either file; env changes are not hot-reloaded
> into middleware.

The frontend ships with a local mock data layer (`frontend/lib/mockData.ts`) so the UI is fully browsable **before** the backend/database is wired up — see Phase 2 vs. Phase 3 in the roadmap below.

## 6. Key User Flows & Page Modules

**A. Landing page** (`app/page.tsx`) — full-screen editorial hero with dual CTAs ("Shop Eyewear" / "Explore Apparel"), asymmetrical curated-collections grid, brand ethos block, testimonials ticker.

**B. Shop & catalog** (`app/shop/page.tsx`) — collapsible filter sidebar (category, frame shape, lens color, clothing size, fabric, price range), dynamic product cards with hover image-swap and quick-add variant popup.

**C. Product detail page** (`app/product/[slug]/page.tsx`) — sticky zoomable image gallery, interactive color/lens/size swatches with a "Find My Size" helper, "Complete the Look" cross-sell rail.

**D. Cart & checkout** (`store/useCartStore.ts`, `app/checkout/page.tsx`) — slide-in cart drawer, multi-step checkout (shipping → payment → review) with GHS currency formatting and mocked Mobile Money / Card gateways.

## 7. Implementation Roadmap & Milestones

- [x] **Phase 1 — Setup & Design System (Days 1–3):** repo scaffolding, Tailwind theme tokens, typography scale, global layout components.
- [x] **Phase 2 — Core Frontend (Days 4–9):** Home, Shop, PDP built against the mock data layer; responsive layouts; cart/search drawers.
- [ ] **Phase 3 — Backend & Database (Days 10–14):** point `frontend/lib` fetchers at the live Express API instead of `mockData.ts`; connect MongoDB via Atlas or local instance; flesh out admin CRUD.
- [ ] **Phase 4 — Cart, Checkout & Polish (Days 15–18):** wire a real payment provider (Paystack/Flutterwave for Mobile Money + Cards), order-tracking notifications, error boundaries, performance pass.

Phases 1–2 are scaffolded in this repo. Phases 3–4 have their API surface and schemas in place (`backend/src`) but need a real database connection, payment integration, and auth wiring to go live.
