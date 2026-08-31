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

# create backend/.env with your own values (see the variable list below)

# set up the catalogue configuration: categories, sub-categories, the attribute
# vocabularies and an admin user. Safe to re-run — it never deletes and never
# overwrites, so it is fine against a database that already has products.
# Add --with-examples for a few draft jewellery pieces to look at.
npm run seed -w backend

# run frontend + backend together
# frontend http://localhost:3000, API http://localhost:5000
npm run dev
```

Requires Node 18+ and a running MongoDB instance (local or Atlas — set `MONGO_URI` in `backend/.env`).

There is no committed `.env` template — real values live only in `backend/.env`, which is gitignored.
Create it with:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (5000) |
| `MONGO_URI` | MongoDB connection string |
| `NEXT_PUBLIC_GA_ID` | Optional. Google Analytics 4 measurement ID; unset, nothing is measured (frontend, build-time) |
| `ORDER_EXPIRY_MINUTES` | Optional. How long an unpaid order holds stock (default 60) |
| `RESEND_API_KEY` | Optional. Order emails via Resend; unset, none are sent |
| `MAIL_FROM` | Optional. Sender address; defaults to `onboarding@resend.dev` |
| `JWT_SECRET` | Signs the auth cookie |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `30d`) |
| `CLIENT_URL` | Storefront origin — CORS, and where Paystack returns a customer after paying (`http://localhost:3000`) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Product image uploads |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin account |

`frontend/.env.local` needs `NEXT_PUBLIC_API_URL` and `JWT_SECRET`.

> **`JWT_SECRET` must be identical in `backend/.env` and `frontend/.env.local`.** The backend signs the auth
> cookie with it and `frontend/middleware.ts` verifies that cookie itself, so if the two differ — or the
> frontend value is missing — admin login appears to succeed but every `/admin/*` route redirects straight
> back to `/admin/login`. Restart `next dev` after changing either file; env changes are not hot-reloaded
> into middleware.

## Deployment

One Vercel project serves the whole shop: Next renders the storefront and the
admin, and the Express API runs beside it as a Serverless Function at `/api/*`,
so everything is same-origin and the admin auth cookie simply works.

Configured in [`vercel.json`](vercel.json), with the entry point in
[`api/index.js`](api/index.js). Every environment variable, the cron jobs that
replace the in-process schedules, and the first-deploy steps are in
[docs/deployment-vercel.md](docs/deployment-vercel.md).

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
