# Admin Dashboard Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 admin dashboard for Aura & Optic — full product/category/inventory management with variant-level stock, color swatches, Cloudinary image uploads, and cookie-based admin auth — as specified in `docs/superpowers/specs/2026-08-17-admin-dashboard-design.md`.

**Architecture:** `/admin` route group inside the existing Next.js app (own root layout, no storefront chrome), guarded by Next middleware reading an httpOnly JWT cookie. Express/Mongoose backend gets a variant-based `Product` schema, a new `Subcategory` collection, Cloudinary signed uploads, and cookie-aware auth, all behind the existing `protect`/`admin` middleware.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui (Radix) + React Query + React Hook Form + Zod, on the frontend. Express + Mongoose + Jest/Supertest/mongodb-memory-server + Cloudinary on the backend.

## Global Constraints

- Stock color-coding: green when `stock > 5`, amber ("low stock") when `1–5`, red at `0`. Defined once, reused everywhere a stock pill renders.
- No CSV import/export or multi-select bulk edit in this phase (explicitly deferred).
- Single `admin` role only — no permission tiers.
- Sub-categories are a managed list (new `Subcategory` collection), never free text.
- Images upload directly from the browser to Cloudinary via a backend-signed request; images never pass through Express.
- Auth uses an httpOnly cookie (`token`) as the primary mechanism for the admin frontend; the `Authorization: Bearer` header path is preserved for non-browser API clients.
- Brand palette is fixed and must be reused (not replaced) for all new UI: obsidian `#121212`, alabaster `#F9F8F6`, gold `#D4AF37` / `#E4C767` / `#B8942B`, sage `#8A9A86` / `#A6B4A2` / `#6E7C6B`.
- This directory (`c:\Users\Robert\.config\Desktop\jules&co`) is not yet a git repository. Every task's commit step should still be written as a normal `git add` + `git commit`, but the first task must include a one-time `git init` (see Task 1) — if the user has already initialized git before execution starts, skip that sub-step.
- Workspace commands use npm workspaces flags: `-w backend` / `-w frontend` from the repo root.

## File Structure Overview

**Backend (`backend/`)**
- `src/app.js` *(new)* — Express app factory (extracted from `server.js` so Supertest can import it without connecting to Mongo or calling `.listen()`).
- `server.js` *(modified)* — now just wires `src/app.js` to `connectDB()` + `.listen()`.
- `src/test/setupTestDb.js` *(new)* — mongodb-memory-server connect/clear/close helpers shared by all controller tests.
- `src/models/Subcategory.js` *(new)*, `src/models/Product.js` *(modified — variant schema)*, `src/models/productStock.js` *(new — pure stock-recompute helpers)*.
- `src/controllers/subcategoryController.js` *(new)*, `categoryController.js` *(modified)*, `productController.js` *(modified)*, `uploadController.js` *(new)*, `authController.js` *(modified)*.
- `src/routes/subcategoryRoutes.js` *(new)*, `uploadRoutes.js` *(new)*; `productRoutes.js`, `categoryRoutes.js`, `authRoutes.js` *(modified)*.
- `src/middleware/authMiddleware.js` *(modified — cookie-aware)*.
- `src/config/cloudinary.js` *(new)*.
- `src/utils/generateToken.js` *(modified — now signs `role`)*.
- `src/seed/toVariants.js` *(new)*, `src/seed/seedData.js` *(modified)*.

**Frontend (`frontend/`)**
- `app/(site)/*` *(moved from `app/*`)* — every existing storefront route, unchanged in behavior, relocated into its own route group.
- `app/admin/layout.tsx` *(new)* — second root layout (own `<html>/<body>`).
- `app/admin/login/page.tsx` *(new)*.
- `app/admin/(dashboard)/layout.tsx` *(new)* — sidebar/topbar shell wrapping the authenticated admin pages.
- `app/admin/(dashboard)/{dashboard,products,products/new,products/[id]/edit,categories,orders,customers,settings}/page.tsx` *(new)*.
- `app/admin/_lib/{api,types,auth,format,QueryProvider}.ts(x)` *(new)* — shared admin-only data/plumbing, colocated under the route group rather than mixed into the storefront's `lib/`.
- `app/admin/_components/{Sidebar,LogoutButton}.tsx` *(new)*, `_components/products/*`, `_components/categories/*`, `_components/dashboard/*` *(new)*.
- `components/admin-ui/*` *(new)* — hand-authored shadcn primitives (button, input, label, badge, separator, table, select, tabs, checkbox), kept in a distinct directory from the storefront's `components/ui/` to avoid Windows case-collisions (`button.tsx` vs `Button.tsx`) and to keep the two design systems decoupled.
- `middleware.ts` *(new, project root)* — Edge-runtime admin route guard.
- `lib/utils.ts` *(modified — `cn()` gains `tailwind-merge`)*.
- `components.json` *(new — shadcn config)*.
- `tailwind.config.ts`, `app/globals.css` *(modified — shadcn semantic tokens mapped onto the existing brand palette)*.
- `e2e/admin-product.spec.ts`, `playwright.config.ts` *(new)*.

---

## Part A — Backend Foundations

### Task 1: Backend test infrastructure (app/server split, Jest, Supertest, mongodb-memory-server)

**Files:**
- Create: `backend/src/app.js`
- Modify: `backend/server.js`
- Create: `backend/jest.config.js`
- Create: `backend/src/test/setupTestDb.js`
- Create: `backend/src/test/setupTestDb.test.js`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `module.exports = app` from `backend/src/app.js` (an Express app with no `.listen()` call and no DB connection triggered on require) — every later controller test imports this.
- Produces: `connectTestDB()`, `clearTestDB()`, `closeTestDB()` from `backend/src/test/setupTestDb.js` — every later controller test imports these.

- [ ] **Step 1: Initialize git (skip if already a repo) and install test dependencies**

```bash
cd "c:/Users/Robert/.config/Desktop/jules&co"
git status || git init
npm install -D jest supertest mongodb-memory-server -w backend
npm install cookie-parser cloudinary -w backend
```

- [ ] **Step 2: Extract the Express app into `backend/src/app.js`**

```js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
```

(`subcategoryRoutes` and `uploadRoutes` are added to this file in Tasks 2 and 8 — don't add them yet, they don't exist until then.)

- [ ] **Step 3: Slim down `backend/server.js` to just bootstrap the app**

```js
const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Aura & Optic API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
```

- [ ] **Step 4: Add Jest config and test script**

`backend/jest.config.js`:

```js
module.exports = {
  testEnvironment: "node",
  testTimeout: 20000,
};
```

In `backend/package.json`, add to `"scripts"`:

```json
"test": "jest --runInBand"
```

- [ ] **Step 5: Create the in-memory DB test helper**

`backend/src/test/setupTestDb.js`:

```js
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

async function connectTestDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

async function closeTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}

module.exports = { connectTestDB, clearTestDB, closeTestDB };
```

- [ ] **Step 6: Write the infra smoke test**

`backend/src/test/setupTestDb.test.js`:

```js
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const { connectTestDB, clearTestDB, closeTestDB } = require("./setupTestDb");

const PingSchema = new mongoose.Schema({ value: String });
const Ping = mongoose.model("Ping", PingSchema);

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

test("health check responds ok", async () => {
  const res = await request(app).get("/api/health");
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("ok");
});

test("can insert and read a document from the in-memory database", async () => {
  await Ping.create({ value: "pong" });
  const found = await Ping.findOne({ value: "pong" });
  expect(found.value).toBe("pong");
});
```

- [ ] **Step 7: Run the tests**

Run: `npm test -w backend`
Expected: 2 passed (first run downloads a local MongoDB binary — needs network access once; it's cached after that).

- [ ] **Step 8: Commit**

```bash
git add backend/src/app.js backend/server.js backend/jest.config.js backend/src/test backend/package.json backend/package-lock.json
git commit -m "test: add backend Jest/Supertest/mongodb-memory-server infrastructure"
```

---

### Task 2: Subcategory model, controller, routes + tests

**Files:**
- Create: `backend/src/models/Subcategory.js`
- Create: `backend/src/controllers/subcategoryController.js`
- Create: `backend/src/controllers/subcategoryController.test.js`
- Create: `backend/src/routes/subcategoryRoutes.js`
- Modify: `backend/src/app.js` (mount `/api/subcategories`)

**Interfaces:**
- Consumes: `app` from `backend/src/app.js`; `connectTestDB/clearTestDB/closeTestDB` from `backend/src/test/setupTestDb.js` (Task 1).
- Produces: `Subcategory` Mongoose model (fields: `name`, `slug`, `categoryType: "eyewear"|"apparel"`, `sortOrder`) — consumed by `productController.js` (Task 5) for validation and by the frontend Categories page (Task 18).
- Produces: `GET/POST /api/subcategories`, `PUT/DELETE /api/subcategories/:id` routes.

- [ ] **Step 1: Write the failing tests**

`backend/src/controllers/subcategoryController.test.js`:

```js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Subcategory = require("../models/Subcategory");
const Product = require("../models/Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
});

async function adminToken() {
  const admin = await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });
  return jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET);
}

test("creates a subcategory as admin", async () => {
  const token = await adminToken();
  const res = await request(app)
    .post("/api/subcategories")
    .set("Cookie", [`token=${token}`])
    .send({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });

  expect(res.status).toBe(201);
  expect(res.body.slug).toBe("sunglasses");
});

test("rejects creation without an admin token", async () => {
  const res = await request(app)
    .post("/api/subcategories")
    .send({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  expect(res.status).toBe(401);
});

test("lists subcategories filtered by categoryType", async () => {
  await Subcategory.create([
    { name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear", sortOrder: 0 },
    { name: "Knitwear", slug: "knitwear", categoryType: "apparel", sortOrder: 0 },
  ]);

  const res = await request(app).get("/api/subcategories?categoryType=eyewear");
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].name).toBe("Sunglasses");
});

test("renames a subcategory", async () => {
  const token = await adminToken();
  const sub = await Subcategory.create({
    name: "Sunglasses",
    slug: "sunglasses",
    categoryType: "eyewear",
  });

  const res = await request(app)
    .put(`/api/subcategories/${sub._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ name: "Shades" });

  expect(res.status).toBe(200);
  expect(res.body.name).toBe("Shades");
});

test("blocks deleting a subcategory still referenced by a product", async () => {
  const token = await adminToken();
  const sub = await Subcategory.create({
    name: "Sunglasses",
    slug: "sunglasses",
    categoryType: "eyewear",
  });
  await Product.create({
    slug: "test-product",
    name: "Test Product",
    category: "eyewear",
    subCategory: "sunglasses",
    price: 100,
    description: "desc",
    images: ["https://example.com/a.jpg"],
    variants: [{ colorId: "black", colorLabel: "Black", stock: 1 }],
  });

  const res = await request(app)
    .delete(`/api/subcategories/${sub._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(409);
});

test("deletes an unreferenced subcategory", async () => {
  const token = await adminToken();
  const sub = await Subcategory.create({
    name: "Sunglasses",
    slug: "sunglasses",
    categoryType: "eyewear",
  });

  const res = await request(app)
    .delete(`/api/subcategories/${sub._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(await Subcategory.findById(sub._id)).toBeNull();
});
```

Note: this test file references `Product.create(...)` with the new `variants` shape — that schema doesn't exist until Task 4. Write Task 2's test file now, but don't run the full suite until Task 4 lands; running just this file will fail on the `Product` import until then, which is expected and fine to leave red across tasks in this Part.

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest subcategoryController -w backend` (or `cd backend && npx jest subcategoryController`)
Expected: FAIL — `Cannot find module '../models/Subcategory'`

- [ ] **Step 3: Create the model**

`backend/src/models/Subcategory.js`:

```js
const mongoose = require("mongoose");

const subcategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    categoryType: { type: String, enum: ["eyewear", "apparel"], required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

subcategorySchema.index({ slug: 1, categoryType: 1 }, { unique: true });

module.exports = mongoose.model("Subcategory", subcategorySchema);
```

- [ ] **Step 4: Create the controller**

`backend/src/controllers/subcategoryController.js`:

```js
const asyncHandler = require("express-async-handler");
const Subcategory = require("../models/Subcategory");
const Product = require("../models/Product");

const getSubcategories = asyncHandler(async (req, res) => {
  const { categoryType } = req.query;
  const query = {};
  if (categoryType) query.categoryType = categoryType;
  const subcategories = await Subcategory.find(query).sort({ sortOrder: 1, name: 1 });
  res.json(subcategories);
});

const createSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await Subcategory.create(req.body);
  res.status(201).json(subcategory);
});

const updateSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await Subcategory.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!subcategory) {
    res.status(404);
    throw new Error("Sub-category not found");
  }
  res.json(subcategory);
});

const deleteSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await Subcategory.findById(req.params.id);
  if (!subcategory) {
    res.status(404);
    throw new Error("Sub-category not found");
  }

  const productCount = await Product.countDocuments({
    subCategory: subcategory.slug,
    category: subcategory.categoryType,
  });
  if (productCount > 0) {
    res.status(409);
    throw new Error(
      `Cannot delete "${subcategory.name}" — ${productCount} product(s) still use it`
    );
  }

  await subcategory.deleteOne();
  res.json({ message: "Sub-category removed" });
});

module.exports = { getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory };
```

- [ ] **Step 5: Create routes and mount them**

`backend/src/routes/subcategoryRoutes.js`:

```js
const express = require("express");
const {
  getSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} = require("../controllers/subcategoryController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getSubcategories).post(protect, admin, createSubcategory);
router
  .route("/:id")
  .put(protect, admin, updateSubcategory)
  .delete(protect, admin, deleteSubcategory);

module.exports = router;
```

In `backend/src/app.js`, add near the other route requires:

```js
const subcategoryRoutes = require("./routes/subcategoryRoutes");
```

and near the other `app.use("/api/...")` lines:

```js
app.use("/api/subcategories", subcategoryRoutes);
```

- [ ] **Step 6: Run tests (expect the two Product-dependent tests still red until Task 4)**

Run: `cd backend && npx jest subcategoryController`
Expected: the first four tests (create/reject/list/rename) PASS now; the two tests using `Product.create` with `variants` will fail until Task 4 lands. That's expected — proceed.

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/Subcategory.js backend/src/controllers/subcategoryController.js backend/src/controllers/subcategoryController.test.js backend/src/routes/subcategoryRoutes.js backend/src/app.js
git commit -m "feat: add Subcategory model and admin CRUD API"
```

---

### Task 3: Category update/delete + tests

**Files:**
- Modify: `backend/src/controllers/categoryController.js`
- Create: `backend/src/controllers/categoryController.test.js`
- Modify: `backend/src/routes/categoryRoutes.js`

**Interfaces:**
- Consumes: `app`, `connectTestDB/clearTestDB/closeTestDB` (Task 1).
- Produces: `PUT/DELETE /api/categories/id/:id` (create/read already existed at `/api/categories` and `/api/categories/:slug`).

- [ ] **Step 1: Write the failing tests**

`backend/src/controllers/categoryController.test.js`:

```js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
});

async function adminToken() {
  const admin = await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });
  return jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET);
}

test("updates a category's description", async () => {
  const token = await adminToken();
  const category = await Category.create({
    name: "Eyewear",
    slug: "eyewear",
    type: "eyewear",
  });

  const res = await request(app)
    .put(`/api/categories/id/${category._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ description: "Updated description" });

  expect(res.status).toBe(200);
  expect(res.body.description).toBe("Updated description");
});

test("blocks deleting a category still referenced by a product", async () => {
  const token = await adminToken();
  const category = await Category.create({ name: "Eyewear", slug: "eyewear", type: "eyewear" });
  await Product.create({
    slug: "test-product",
    name: "Test Product",
    category: "eyewear",
    subCategory: "sunglasses",
    price: 100,
    description: "desc",
    images: ["https://example.com/a.jpg"],
    variants: [{ colorId: "black", colorLabel: "Black", stock: 1 }],
  });

  const res = await request(app)
    .delete(`/api/categories/id/${category._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(409);
});

test("deletes an unreferenced category", async () => {
  const token = await adminToken();
  const category = await Category.create({ name: "Eyewear", slug: "eyewear", type: "eyewear" });

  const res = await request(app)
    .delete(`/api/categories/id/${category._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(await Category.findById(category._id)).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest categoryController`
Expected: FAIL — `PUT`/`DELETE` return 404 (no such routes yet, caught by `notFound`).

- [ ] **Step 3: Add controllers**

Append to `backend/src/controllers/categoryController.js`, and add `Product` to the requires at the top:

```js
const Product = require("../models/Product");
```

```js
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  res.json(category);
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const productCount = await Product.countDocuments({ category: category.type });
  if (productCount > 0) {
    res.status(409);
    throw new Error(`Cannot delete "${category.name}" — ${productCount} product(s) still use it`);
  }

  await category.deleteOne();
  res.json({ message: "Category removed" });
});
```

Update the `module.exports` line to:

```js
module.exports = {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
};
```

- [ ] **Step 4: Wire routes**

In `backend/src/routes/categoryRoutes.js`, update the imports and the `/:id` route:

```js
const {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
```

```js
router.route("/").get(getCategories).post(protect, admin, createCategory);
router.get("/:slug", getCategoryBySlug);
```

Add a new block below the `/:slug` line (categories are looked up by slug for reads but by Mongo `_id` for admin writes, so this needs its own path segment to avoid ambiguity):

```js
router
  .route("/id/:id")
  .put(protect, admin, updateCategory)
  .delete(protect, admin, deleteCategory);
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest categoryController`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/categoryController.js backend/src/controllers/categoryController.test.js backend/src/routes/categoryRoutes.js
git commit -m "feat: add category update/delete with in-use protection"
```

---

### Task 4: Product model variant restructure + stock recomputation + tests

**Files:**
- Create: `backend/src/models/productStock.js`
- Modify: `backend/src/models/Product.js`
- Create: `backend/src/models/Product.test.js`

**Interfaces:**
- Produces: `deriveVariantId(colorId, sizeId)` and `computeTotalStock(variants)` from `backend/src/models/productStock.js` — pure functions, no DB needed, reused by `productController.js` (Task 5/7) if targeted stock math is needed outside the model.
- Produces: `Product` model with `variants: [{ id, colorId, colorLabel, colorHex, colorImage, sizeId, sizeLabel, stock, sku }]` and a derived `stock: Number` that is recomputed on every `.save()`. `colors`/`sizes` top-level fields are removed.

- [ ] **Step 1: Write the failing tests**

`backend/src/models/Product.test.js`:

```js
const { deriveVariantId, computeTotalStock } = require("./productStock");
const Product = require("./Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

describe("productStock helpers", () => {
  test("deriveVariantId combines color and size when size present", () => {
    expect(deriveVariantId("black", "m")).toBe("black--m");
  });

  test("deriveVariantId returns just the color id when there is no size", () => {
    expect(deriveVariantId("black", undefined)).toBe("black");
  });

  test("computeTotalStock sums stock across all variants", () => {
    expect(computeTotalStock([{ stock: 3 }, { stock: 5 }, { stock: 0 }])).toBe(8);
  });

  test("computeTotalStock returns 0 for an empty variant list", () => {
    expect(computeTotalStock([])).toBe(0);
  });
});

describe("Product model stock recomputation", () => {
  beforeAll(async () => {
    await connectTestDB();
  });
  afterEach(async () => {
    await clearTestDB();
  });
  afterAll(async () => {
    await closeTestDB();
  });

  test("recomputes total stock and variant ids on save", async () => {
    const product = await Product.create({
      slug: "test-frame",
      name: "Test Frame",
      category: "eyewear",
      subCategory: "sunglasses",
      price: 100,
      description: "A test product",
      images: ["https://example.com/a.jpg"],
      variants: [
        { colorId: "black", colorLabel: "Black", colorHex: "#000000", stock: 4 },
        { colorId: "tortoise", colorLabel: "Tortoise", colorHex: "#6B4226", stock: 2 },
      ],
    });

    expect(product.stock).toBe(6);
    expect(product.variants[0].id).toBe("black");
    expect(product.variants[1].id).toBe("tortoise");
  });

  test("derives a combined id for color+size variants", async () => {
    const product = await Product.create({
      slug: "test-shirt",
      name: "Test Shirt",
      category: "apparel",
      subCategory: "shirting",
      price: 100,
      description: "A test product",
      images: ["https://example.com/a.jpg"],
      variants: [
        { colorId: "black", colorLabel: "Black", sizeId: "m", sizeLabel: "M", stock: 3 },
      ],
    });

    expect(product.variants[0].id).toBe("black--m");
  });

  test("ignores a client-supplied stock value and recomputes it from variants", async () => {
    const product = await Product.create({
      slug: "test-frame-2",
      name: "Test Frame 2",
      category: "eyewear",
      subCategory: "sunglasses",
      price: 100,
      description: "A test product",
      images: ["https://example.com/a.jpg"],
      stock: 999,
      variants: [{ colorId: "black", colorLabel: "Black", stock: 3 }],
    });

    expect(product.stock).toBe(3);
  });

  test("recomputes stock again when an existing product is re-saved after a variant change", async () => {
    const product = await Product.create({
      slug: "test-frame-3",
      name: "Test Frame 3",
      category: "eyewear",
      subCategory: "sunglasses",
      price: 100,
      description: "A test product",
      images: ["https://example.com/a.jpg"],
      variants: [{ colorId: "black", colorLabel: "Black", stock: 3 }],
    });

    product.variants[0].stock = 10;
    await product.save();

    expect(product.stock).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest src/models/Product.test.js`
Expected: FAIL — `Cannot find module './productStock'`

- [ ] **Step 3: Create the pure stock helpers**

`backend/src/models/productStock.js`:

```js
function deriveVariantId(colorId, sizeId) {
  return sizeId ? `${colorId}--${sizeId}` : colorId;
}

function computeTotalStock(variants) {
  return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
}

module.exports = { deriveVariantId, computeTotalStock };
```

- [ ] **Step 4: Restructure the Product model**

Replace the full contents of `backend/src/models/Product.js`:

```js
const mongoose = require("mongoose");
const { deriveVariantId, computeTotalStock } = require("./productStock");

const variantSchema = new mongoose.Schema(
  {
    id: String,
    colorId: { type: String, required: true },
    colorLabel: { type: String, required: true },
    colorHex: String,
    colorImage: String,
    sizeId: String,
    sizeLabel: String,
    stock: { type: Number, required: true, min: 0, default: 0 },
    sku: String,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, enum: ["eyewear", "apparel"], required: true },
    subCategory: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    description: { type: String, required: true },
    images: { type: [String], required: true },
    frameShape: String,
    lensColor: String,
    clothingSize: [String],
    fabric: String,
    variants: { type: [variantSchema], default: [] },
    stock: { type: Number, default: 0 },
    isNewArrival: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    pairsWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    tags: [String],
  },
  { timestamps: true }
);

productSchema.index({ name: "text", subCategory: "text", fabric: "text", frameShape: "text" });

productSchema.pre("save", function recomputeStock(next) {
  this.variants.forEach((variant) => {
    variant.id = deriveVariantId(variant.colorId, variant.sizeId);
  });
  this.stock = computeTotalStock(this.variants);
  next();
});

module.exports = mongoose.model("Product", productSchema);
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest src/models/Product.test.js`
Expected: 8 passed.

- [ ] **Step 6: Run the full suite so far**

Run: `npm test -w backend`
Expected: all tests pass now, including the two Product-dependent tests in `subcategoryController.test.js` and `categoryController.test.js` that were red since Task 2/3.

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/Product.js backend/src/models/productStock.js backend/src/models/Product.test.js
git commit -m "feat: restructure Product schema around per-variant stock"
```

---

### Task 5: Product controller — create/update with sub-category validation + variant recompute + tests

**Files:**
- Modify: `backend/src/controllers/productController.js`
- Create: `backend/src/controllers/productController.test.js`
- Modify: `backend/src/routes/productRoutes.js`

**Interfaces:**
- Consumes: `Subcategory` model (Task 2), `Product` model (Task 4).
- Produces: `createProduct`/`updateProduct` now validate `subCategory` against `Subcategory` and always persist server-recomputed `stock`/variant ids (client-sent `stock` is ignored).

- [ ] **Step 1: Write the failing tests**

`backend/src/controllers/productController.test.js`:

```js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Product = require("../models/Product");
const Subcategory = require("../models/Subcategory");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
});

async function adminToken() {
  const admin = await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });
  return jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET);
}

const basePayload = {
  slug: "test-frame",
  name: "Test Frame",
  category: "eyewear",
  subCategory: "sunglasses",
  price: 100,
  description: "A test product",
  images: ["https://example.com/a.jpg"],
  variants: [{ colorId: "black", colorLabel: "Black", stock: 4 }],
};

test("rejects creating a product with an unknown sub-category", async () => {
  const token = await adminToken();
  const res = await request(app)
    .post("/api/products")
    .set("Cookie", [`token=${token}`])
    .send(basePayload);

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/not a valid sub-category/);
});

test("creates a product once its sub-category exists", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });

  const res = await request(app)
    .post("/api/products")
    .set("Cookie", [`token=${token}`])
    .send(basePayload);

  expect(res.status).toBe(201);
  expect(res.body.stock).toBe(4);
});

test("recomputes stock on update and ignores a client-sent stock value", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  const created = await Product.create(basePayload);

  const res = await request(app)
    .put(`/api/products/${created._id}`)
    .set("Cookie", [`token=${token}`])
    .send({
      stock: 999,
      variants: [{ colorId: "black", colorLabel: "Black", stock: 7 }],
    });

  expect(res.status).toBe(200);
  expect(res.body.stock).toBe(7);
});

test("rejects updating to a sub-category that doesn't match the product's category", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  await Subcategory.create({ name: "Knitwear", slug: "knitwear", categoryType: "apparel" });
  const created = await Product.create(basePayload);

  const res = await request(app)
    .put(`/api/products/${created._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ category: "eyewear", subCategory: "knitwear" });

  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest src/controllers/productController.test.js`
Expected: FAIL — creating currently succeeds without sub-category validation (first test expects 400 but gets 201), and update still uses `findByIdAndUpdate` so the stock-recompute test fails.

- [ ] **Step 3: Update the controller**

Replace `backend/src/controllers/productController.js`'s `createProduct`/`updateProduct`, and add the `Subcategory` require at the top:

```js
const Subcategory = require("../models/Subcategory");
```

```js
// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  const validSubcategory = await Subcategory.findOne({
    slug: req.body.subCategory,
    categoryType: req.body.category,
  });
  if (!validSubcategory) {
    res.status(400);
    throw new Error(
      `"${req.body.subCategory}" is not a valid sub-category for "${req.body.category}"`
    );
  }

  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const nextCategory = req.body.category || product.category;
  const nextSubCategory = req.body.subCategory || product.subCategory;
  if (req.body.category || req.body.subCategory) {
    const validSubcategory = await Subcategory.findOne({
      slug: nextSubCategory,
      categoryType: nextCategory,
    });
    if (!validSubcategory) {
      res.status(400);
      throw new Error(`"${nextSubCategory}" is not a valid sub-category for "${nextCategory}"`);
    }
  }

  Object.assign(product, req.body);
  const updated = await product.save();
  res.json(updated);
});
```

Note: `findByIdAndUpdate` does not trigger the `pre("save")` hook from Task 4 — switching to `findById` + `Object.assign` + `.save()` is what makes the stock recompute actually run on every update, not just on create.

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest src/controllers/productController.test.js`
Expected: 4 passed.

- [ ] **Step 5: Run the full backend suite**

Run: `npm test -w backend`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/productController.js backend/src/controllers/productController.test.js
git commit -m "feat: validate sub-category and recompute stock server-side on product writes"
```

---

### Task 6: Product controller — admin list (paginated/filterable) + get-by-id + tests

**Files:**
- Modify: `backend/src/controllers/productController.js`
- Modify: `backend/src/controllers/productController.test.js`
- Modify: `backend/src/routes/productRoutes.js`

**Interfaces:**
- Produces: `GET /api/products/admin?category=&subCategory=&stockStatus=&search=&page=&limit=` → `{ items, total, page, pages }` (admin-only, paginated — distinct from the public `GET /api/products`, which stays a bare array for the storefront).
- Produces: `GET /api/products/id/:id` (admin-only lookup by Mongo `_id` — the public route only supports lookup by `:slug`, but the admin edit page needs to fetch by the id it got from the list).

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/controllers/productController.test.js`:

```js
test("admin list paginates and filters by stock status", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  await Product.create({ ...basePayload, slug: "in-stock", variants: [{ colorId: "black", colorLabel: "Black", stock: 10 }] });
  await Product.create({ ...basePayload, slug: "out-of-stock", variants: [{ colorId: "black", colorLabel: "Black", stock: 0 }] });

  const res = await request(app)
    .get("/api/products/admin?stockStatus=out")
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(res.body.total).toBe(1);
  expect(res.body.items[0].slug).toBe("out-of-stock");
});

test("admin list rejects unauthenticated requests", async () => {
  const res = await request(app).get("/api/products/admin");
  expect(res.status).toBe(401);
});

test("fetches a single product by id for admin editing", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  const created = await Product.create(basePayload);

  const res = await request(app)
    .get(`/api/products/id/${created._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(res.body.name).toBe("Test Frame");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest src/controllers/productController.test.js`
Expected: FAIL — `/api/products/admin` and `/api/products/id/:id` don't exist yet (404 from `notFound`).

- [ ] **Step 3: Add the controllers**

Append to `backend/src/controllers/productController.js`:

```js
// @desc    Get paginated/filterable product list for the admin dashboard
// @route   GET /api/products/admin
// @access  Private/Admin
const getAdminProducts = asyncHandler(async (req, res) => {
  const { category, subCategory, stockStatus, search, page = 1, limit = 20 } = req.query;
  const query = {};

  if (category && category !== "all") query.category = category;
  if (subCategory) query.subCategory = subCategory;
  if (search) query.$text = { $search: search };
  if (stockStatus === "out") query.stock = 0;
  if (stockStatus === "low") query.stock = { $gt: 0, $lte: 5 };
  if (stockStatus === "in") query.stock = { $gt: 5 };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));

  const [items, total] = await Promise.all([
    Product.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(query),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

// @desc    Get a single product by Mongo id (admin editing — the public route only supports slug)
// @route   GET /api/products/id/:id
// @access  Private/Admin
const getAdminProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json(product);
});
```

Update the `module.exports` at the bottom of the file to include the two new functions:

```js
module.exports = {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminProducts,
  getAdminProductById,
};
```

- [ ] **Step 4: Wire routes (ordering matters)**

Replace the full contents of `backend/src/routes/productRoutes.js`:

```js
const express = require("express");
const {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminProducts,
  getAdminProductById,
} = require("../controllers/productController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getProducts).post(protect, admin, createProduct);

router.get("/admin", protect, admin, getAdminProducts);
router.get("/id/:id", protect, admin, getAdminProductById);
router.get("/slug/:slug", getProductBySlug);

router.route("/:id").put(protect, admin, updateProduct).delete(protect, admin, deleteProduct);

module.exports = router;
```

The literal paths (`/admin`, `/id/:id`, `/slug/:slug`) must be declared before the generic `/:id` route — otherwise Express would match `GET /api/products/admin` against `/:id` first and treat `"admin"` as an id.

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest src/controllers/productController.test.js`
Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/productController.js backend/src/controllers/productController.test.js backend/src/routes/productRoutes.js
git commit -m "feat: add paginated admin product list and get-by-id endpoints"
```

---

### Task 7: Product controller — targeted variant stock-patch endpoint + tests

**Files:**
- Modify: `backend/src/controllers/productController.js`
- Modify: `backend/src/controllers/productController.test.js`
- Modify: `backend/src/routes/productRoutes.js`

**Interfaces:**
- Produces: `PATCH /api/products/:id/stock` body `{ variants: [{ id, stock }] }` — updates only the listed variant ids by their derived `id` (Task 4's `deriveVariantId`), recomputes the total, and saves. Used by the frontend's "mark out of stock" quick action and by the Inventory tab's per-cell edits (Task 23).

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/controllers/productController.test.js`:

```js
test("patches stock for specific variants and recomputes the total", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  const created = await Product.create({
    ...basePayload,
    variants: [
      { colorId: "black", colorLabel: "Black", stock: 4 },
      { colorId: "tortoise", colorLabel: "Tortoise", stock: 2 },
    ],
  });

  const res = await request(app)
    .patch(`/api/products/${created._id}/stock`)
    .set("Cookie", [`token=${token}`])
    .send({ variants: [{ id: "black", stock: 0 }] });

  expect(res.status).toBe(200);
  const blackVariant = res.body.variants.find((v) => v.id === "black");
  expect(blackVariant.stock).toBe(0);
  expect(res.body.stock).toBe(2);
});

test("stock patch rejects a missing or empty variants array", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  const created = await Product.create(basePayload);

  const res = await request(app)
    .patch(`/api/products/${created._id}/stock`)
    .set("Cookie", [`token=${token}`])
    .send({});

  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest src/controllers/productController.test.js`
Expected: FAIL — no `PATCH /:id/stock` route yet.

- [ ] **Step 3: Add the controller**

Append to `backend/src/controllers/productController.js`:

```js
// @desc    Update stock for specific variants without resending the whole product
// @route   PATCH /api/products/:id/stock
// @access  Private/Admin
const updateProductStock = asyncHandler(async (req, res) => {
  const { variants } = req.body;
  if (!Array.isArray(variants) || variants.length === 0) {
    res.status(400);
    throw new Error("variants array is required");
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const updates = new Map(variants.map((v) => [v.id, v.stock]));
  product.variants.forEach((variant) => {
    if (updates.has(variant.id)) {
      variant.stock = Math.max(0, Number(updates.get(variant.id)) || 0);
    }
  });

  const updated = await product.save();
  res.json(updated);
});
```

Add `updateProductStock` to the `module.exports` object.

- [ ] **Step 4: Wire the route**

In `backend/src/routes/productRoutes.js`, add below the `/:id` block:

```js
router.patch("/:id/stock", protect, admin, updateProductStock);
```

And add `updateProductStock` to the destructured import at the top of the file.

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest src/controllers/productController.test.js`
Expected: 9 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/productController.js backend/src/controllers/productController.test.js backend/src/routes/productRoutes.js
git commit -m "feat: add targeted variant stock-patch endpoint"
```

---

### Task 8: Cloudinary config + signed upload endpoint + tests

**Files:**
- Create: `backend/src/config/cloudinary.js`
- Create: `backend/src/controllers/uploadController.js`
- Create: `backend/src/controllers/uploadController.test.js`
- Create: `backend/src/routes/uploadRoutes.js`
- Modify: `backend/src/app.js` (mount `/api/uploads`)
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: `POST /api/uploads/sign` (admin-only) → `{ timestamp, signature, folder, apiKey, cloudName }`. The frontend's `ImageUploader` (Task 22) uses this to upload directly to Cloudinary without the file passing through Express.

- [ ] **Step 1: Document the required env vars**

Append to `backend/.env.example`:

```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

(Sign up for a free Cloudinary account and paste the values from its dashboard into `backend/.env`.)

- [ ] **Step 2: Write the failing tests**

`backend/src/controllers/uploadController.test.js`:

```js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const cloudinary = require("../config/cloudinary");
const app = require("../app");
const User = require("../models/User");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-api-secret";
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
});

async function adminToken() {
  const admin = await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });
  return jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET);
}

test("returns a valid Cloudinary upload signature", async () => {
  const token = await adminToken();

  const res = await request(app)
    .post("/api/uploads/sign")
    .set("Cookie", [`token=${token}`])
    .send({ folder: "aura-optic/test" });

  expect(res.status).toBe(200);
  expect(res.body.folder).toBe("aura-optic/test");
  expect(res.body.cloudName).toBe("test-cloud");

  const expectedSignature = cloudinary.utils.api_sign_request(
    { timestamp: res.body.timestamp, folder: res.body.folder },
    process.env.CLOUDINARY_API_SECRET
  );
  expect(res.body.signature).toBe(expectedSignature);
});

test("rejects unauthenticated requests", async () => {
  const res = await request(app).post("/api/uploads/sign").send({});
  expect(res.status).toBe(401);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && npx jest uploadController`
Expected: FAIL — `Cannot find module '../config/cloudinary'`

- [ ] **Step 4: Create the Cloudinary config, controller, and routes**

`backend/src/config/cloudinary.js`:

```js
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
```

`backend/src/controllers/uploadController.js`:

```js
const asyncHandler = require("express-async-handler");
const cloudinary = require("../config/cloudinary");

const signUpload = asyncHandler(async (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = req.body.folder || "aura-optic/products";

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET
  );

  res.json({
    timestamp,
    signature,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
});

module.exports = { signUpload };
```

`backend/src/routes/uploadRoutes.js`:

```js
const express = require("express");
const { signUpload } = require("../controllers/uploadController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/sign", protect, admin, signUpload);

module.exports = router;
```

In `backend/src/app.js`, add the require near the other routes:

```js
const uploadRoutes = require("./routes/uploadRoutes");
```

and mount it:

```js
app.use("/api/uploads", uploadRoutes);
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest uploadController`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/cloudinary.js backend/src/controllers/uploadController.js backend/src/controllers/uploadController.test.js backend/src/routes/uploadRoutes.js backend/src/app.js backend/.env.example
git commit -m "feat: add Cloudinary signed upload endpoint"
```

---

### Task 9: Auth — JWT role claim + httpOnly cookie login/logout + cookie-aware protect middleware + tests

**Note: the `authMiddleware.js` cookie-fallback change below has already landed.** Task 2's implementer discovered its own admin-authenticated tests required cookie-based `protect` support (every backend task's tests authenticate via `.set("Cookie", ...)`), and added it early — byte-for-byte the same change specified here. Human-adjudicated ruling: keep it. **Skip Step 6 below** (the `authMiddleware.js` edit) — read the file first to confirm it already matches, note that in your report, and don't re-apply it. Everything else in this task (generateToken's role claim, login/logout cookie-setting, the auth controller tests) has NOT been done yet and is still this task's job.

**Files:**
- Modify: `backend/src/utils/generateToken.js`
- Modify: `backend/src/controllers/authController.js`
- Create: `backend/src/controllers/authController.test.js`
- Modify: `backend/src/routes/authRoutes.js`
- ~~Modify: `backend/src/middleware/authMiddleware.js`~~ (already done in Task 2 — verify only, don't re-edit)

**Interfaces:**
- Produces: `generateToken(userId, role)` (signature change — previously `generateToken(userId)`). The JWT payload now includes `role`, so it can be checked from Next.js Edge middleware (Task 15) without a database round trip.
- Produces: `POST /api/auth/logout`; `POST /api/auth/login` and `POST /api/auth/register` now also set an httpOnly `token` cookie (in addition to returning the token in the JSON body for non-browser clients).
- Produces: `protect` middleware now accepts the token from either the `Authorization: Bearer` header or the `token` cookie. (Already true as of Task 2 — this task adds the role claim and cookie-setting around it.)

- [ ] **Step 1: Write the failing tests**

`backend/src/controllers/authController.test.js`:

```js
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
});

test("login sets an httpOnly cookie and returns the role", async () => {
  await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@test.com", password: "password123" });

  expect(res.status).toBe(200);
  expect(res.body.role).toBe("admin");
  const setCookie = res.headers["set-cookie"][0];
  expect(setCookie).toMatch(/token=/);
  expect(setCookie).toMatch(/HttpOnly/i);
});

test("protect middleware accepts a token from a cookie", async () => {
  await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@test.com", password: "password123" });
  const cookie = loginRes.headers["set-cookie"][0].split(";")[0];

  const meRes = await request(app).get("/api/auth/me").set("Cookie", [cookie]);
  expect(meRes.status).toBe(200);
  expect(meRes.body.email).toBe("admin@test.com");
});

test("logout clears the cookie", async () => {
  const res = await request(app).post("/api/auth/logout");
  expect(res.status).toBe(200);
  expect(res.headers["set-cookie"][0]).toMatch(/token=;/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest authController`
Expected: FAIL — no cookie is set today, and `/api/auth/logout` 404s.

- [ ] **Step 3: Update `generateToken`**

Replace `backend/src/utils/generateToken.js`:

```js
const jwt = require("jsonwebtoken");

function generateToken(userId, role) {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
}

module.exports = generateToken;
```

- [ ] **Step 4: Update the auth controller**

Replace the full contents of `backend/src/controllers/authController.js`:

```js
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("An account with that email already exists");
  }

  const user = await User.create({ name, email, password, phone });
  const token = generateToken(user._id, user.role);
  setAuthCookie(res, token);

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token,
  });
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user._id, user.role);
  setAuthCookie(res, token);

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token,
  });
});

// @desc    Log out — clears the auth cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

module.exports = { registerUser, loginUser, logoutUser, getMe };
```

- [ ] **Step 5: Add the logout route**

In `backend/src/routes/authRoutes.js`:

```js
const { registerUser, loginUser, logoutUser, getMe } = require("../controllers/authController");
```

```js
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/me", protect, getMe);
```

- [ ] **Step 6: Make `protect` cookie-aware**

In `backend/src/middleware/authMiddleware.js`, replace the `protect` function:

```js
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;

  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized — no token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      res.status(401);
      throw new Error("Not authorized — user no longer exists");
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized — invalid token");
  }
});
```

(This relies on `cookie-parser` already being wired into `app.js` from Task 1.)

- [ ] **Step 7: Run tests**

Run: `cd backend && npx jest authController`
Expected: 3 passed.

- [ ] **Step 8: Run the full backend suite**

Run: `npm test -w backend`
Expected: all green. This is the last backend task before the seed migration — a fully green suite here means the API surface for Phase 1 is complete and correct.

- [ ] **Step 9: Commit**

```bash
git add backend/src/utils/generateToken.js backend/src/controllers/authController.js backend/src/controllers/authController.test.js backend/src/routes/authRoutes.js backend/src/middleware/authMiddleware.js
git commit -m "feat: cookie-based admin auth with role claim in the JWT"
```

---

### Task 10: Seed migration helper (`toVariants`) + tests

**Files:**
- Create: `backend/src/seed/toVariants.js`
- Create: `backend/src/seed/toVariants.test.js`

**Interfaces:**
- Produces: `buildVariants({ colors, sizes, stock })` from `backend/src/seed/toVariants.js` — a pure function converting the old seed-data shape (colors/sizes with boolean `inStock` + a single total `stock`) into the new `variants[]` array. Consumed by `seedData.js` in Task 11.

- [ ] **Step 1: Write the failing tests**

`backend/src/seed/toVariants.test.js`:

```js
const { buildVariants } = require("./toVariants");

describe("buildVariants", () => {
  test("distributes stock evenly across in-stock colors when there are no sizes", () => {
    const variants = buildVariants({
      stock: 6,
      colors: [
        { id: "tortoise", label: "Tortoise", hex: "#6B4226", inStock: true },
        { id: "black", label: "Black", hex: "#121212", inStock: true },
        { id: "champagne", label: "Champagne", hex: "#D4AF37", inStock: false },
      ],
    });

    expect(variants).toHaveLength(3);
    expect(variants.find((v) => v.colorId === "tortoise").stock).toBe(3);
    expect(variants.find((v) => v.colorId === "black").stock).toBe(3);
    expect(variants.find((v) => v.colorId === "champagne").stock).toBe(0);
  });

  test("distributes stock across color x size combinations", () => {
    const variants = buildVariants({
      stock: 8,
      colors: [{ id: "obsidian", label: "Obsidian", hex: "#121212", inStock: true }],
      sizes: [
        { id: "s", label: "S", inStock: true },
        { id: "m", label: "M", inStock: true },
        { id: "l", label: "L", inStock: false },
      ],
    });

    expect(variants).toHaveLength(3);
    expect(variants.find((v) => v.sizeId === "s").stock).toBe(4);
    expect(variants.find((v) => v.sizeId === "m").stock).toBe(4);
    expect(variants.find((v) => v.sizeId === "l").stock).toBe(0);
  });

  test("falls back to a single default variant when a product has no colors defined", () => {
    const variants = buildVariants({ stock: 2, colors: [] });
    expect(variants).toEqual([{ colorId: "default", colorLabel: "Default", stock: 2 }]);
  });

  test("zeroes stock for every cell when no colors are in stock", () => {
    const variants = buildVariants({
      stock: 5,
      colors: [{ id: "black", label: "Black", hex: "#121212", inStock: false }],
    });
    expect(variants[0].stock).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest toVariants`
Expected: FAIL — `Cannot find module './toVariants'`

- [ ] **Step 3: Implement the helper**

`backend/src/seed/toVariants.js`:

```js
function slugifyId(label) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildVariants(product) {
  const colors = product.colors || [];
  const sizes = product.sizes || [];
  const totalStock = product.stock || 0;

  if (colors.length === 0) {
    return [{ colorId: "default", colorLabel: "Default", stock: totalStock }];
  }

  const inStockColors = colors.filter((c) => c.inStock);
  const perColorStock =
    inStockColors.length > 0 ? Math.floor(totalStock / inStockColors.length) : 0;

  if (sizes.length === 0) {
    return colors.map((color) => ({
      colorId: color.id || slugifyId(color.label),
      colorLabel: color.label,
      colorHex: color.hex,
      stock: color.inStock ? perColorStock : 0,
    }));
  }

  const inStockSizes = sizes.filter((s) => s.inStock);
  const perCellStock =
    inStockSizes.length > 0 ? Math.floor(perColorStock / inStockSizes.length) : 0;

  const variants = [];
  colors.forEach((color) => {
    sizes.forEach((size) => {
      variants.push({
        colorId: color.id || slugifyId(color.label),
        colorLabel: color.label,
        colorHex: color.hex,
        sizeId: size.id || slugifyId(size.label),
        sizeLabel: size.label,
        stock: color.inStock && size.inStock ? perCellStock : 0,
      });
    });
  });
  return variants;
}

module.exports = { buildVariants };
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest toVariants`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/seed/toVariants.js backend/src/seed/toVariants.test.js
git commit -m "feat: add seed-data migration helper for the variant schema"
```

---

### Task 11: Update seed data — subcategories, variant conversion, admin user bootstrap

**Files:**
- Modify: `backend/src/seed/seedData.js`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `buildVariants` (Task 10), `Subcategory` model (Task 2), `User` model (existing).
- Produces: running `npm run seed -w backend` populates `Product` (with `variants`), `Category`, `Subcategory`, and ensures an admin `User` exists — this is the data every later frontend task is built and manually verified against.

- [ ] **Step 1: Document admin bootstrap env vars**

Append to `backend/.env.example`:

```
ADMIN_EMAIL=admin@auraandoptic.com
ADMIN_PASSWORD=changeme123
```

- [ ] **Step 2: Add requires and helper functions to `seedData.js`**

Near the top of `backend/src/seed/seedData.js`, alongside the existing `connectDB`/`Product`/`Category` requires, add:

```js
const Subcategory = require("../models/Subcategory");
const User = require("../models/User");
const { buildVariants } = require("./toVariants");
```

Directly above `async function seed() {`, add:

```js
function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function deriveSubcategories(productList) {
  const seen = new Map();
  productList.forEach((p) => {
    const key = `${p.category}:${p.subCategory}`;
    if (!seen.has(key)) {
      seen.set(key, {
        name: p.subCategory,
        slug: slugify(p.subCategory),
        categoryType: p.category,
        sortOrder: seen.size,
      });
    }
  });
  return Array.from(seen.values());
}
```

- [ ] **Step 3: Rewrite the `seed()` function**

Replace the existing `async function seed() { ... }` body with:

```js
async function seed() {
  await connectDB();

  console.log("Clearing existing catalog...");
  await Product.deleteMany({});
  await Category.deleteMany({});
  await Subcategory.deleteMany({});

  console.log("Inserting categories...");
  await Category.insertMany(categories);

  console.log("Inserting sub-categories...");
  const subcategories = deriveSubcategories(products);
  await Subcategory.insertMany(subcategories);

  console.log("Inserting products...");
  const inserted = await Product.insertMany(
    products.map(({ pairsWithSlugs, colors, sizes, stock, ...rest }) => ({
      ...rest,
      subCategory: slugify(rest.subCategory),
      variants: buildVariants({ colors, sizes, stock }),
    }))
  );

  const slugToId = new Map(inserted.map((p) => [p.slug, p._id]));

  console.log("Linking cross-sell relationships...");
  await Promise.all(
    products.map((p, i) => {
      const pairsWith = (p.pairsWithSlugs || [])
        .map((slug) => slugToId.get(slug))
        .filter(Boolean);
      return Product.findByIdAndUpdate(inserted[i]._id, { pairsWith });
    })
  );

  console.log("Ensuring an admin user exists...");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@auraandoptic.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme123";
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: "Store Admin",
      email: adminEmail,
      password: adminPassword,
      role: "admin",
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  console.log(
    `Seeded ${inserted.length} products, ${categories.length} categories, and ${subcategories.length} sub-categories.`
  );
  process.exit(0);
}
```

Everything above `seed()` — the `categories` array, the `products` array, and the `img()` helper — stays exactly as it is today; `buildVariants` consumes the existing `colors`/`sizes`/`stock` shape directly.

- [ ] **Step 4: Verify by running the seed script against a real MongoDB**

This is a script with a `process.exit(0)` at the end, so it isn't run under Jest — verify manually. This step requires a MongoDB instance (local or Atlas) reachable at `backend/.env`'s `MONGO_URI`; if none is running yet, start one locally or point at an Atlas connection string before proceeding.

Run:

```bash
npm run seed -w backend
```

Expected console output ends with something like:
`Seeded 17 products, 2 categories, and 9 sub-categories.` followed by `Created admin user: admin@auraandoptic.com` (or `Admin user already exists` on a re-run).

Then, with the backend running (`npm run dev:backend`), spot-check:

```bash
curl http://localhost:5000/api/subcategories
```

Expected: a JSON array with entries like `{"name":"Sunglasses","slug":"sunglasses","categoryType":"eyewear",...}`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/seed/seedData.js backend/.env.example
git commit -m "feat: migrate seed data to the variant schema and bootstrap an admin user"
```

---

## Part B — Frontend Foundations

### Task 12: Route-group restructure — `app/(site)` + `app/admin` skeleton

Next.js supports multiple "root layouts" (each with its own `<html>/<body>`) by giving each top-level route group its own `layout.tsx` and removing the single shared `app/layout.tsx`. This task moves the existing storefront under `app/(site)/` and stands up a bare-bones `app/admin/` tree so the two can render independently — no admin styling or auth yet, just the routing/layout structure.

**Files:**
- Create: `frontend/app/(site)/` (moved from `frontend/app/`)
- Delete: `frontend/app/layout.tsx` (replaced by two group-level root layouts)
- Create: `frontend/app/admin/layout.tsx`
- Create: `frontend/app/admin/login/page.tsx` (placeholder)
- Create: `frontend/app/admin/(dashboard)/layout.tsx` (placeholder)
- Create: `frontend/app/admin/(dashboard)/dashboard/page.tsx` (placeholder)

**Interfaces:**
- Produces: the `app/admin/(dashboard)/` route group, which Task 16 fills in with the real sidebar shell, and `app/admin/login/`, which Task 15 fills in with the real login form. Nothing here is consumed by earlier tasks; this is purely structural.

- [ ] **Step 1: Move the existing storefront routes into `(site)`**

```bash
cd "c:/Users/Robert/.config/Desktop/jules&co/frontend"
mkdir -p "app/(site)"
mv app/page.tsx "app/(site)/page.tsx"
mv app/layout.tsx "app/(site)/layout.tsx"
mv app/account "app/(site)/account"
mv app/cart "app/(site)/cart"
mv app/checkout "app/(site)/checkout"
mv app/product "app/(site)/product"
mv app/shop "app/(site)/shop"
```

- [ ] **Step 2: Fix the relative `globals.css` import in the moved layout**

In `frontend/app/(site)/layout.tsx`, the file moved one directory deeper, so its relative import needs updating:

```diff
-import "./globals.css";
+import "../globals.css";
```

Everything else in that file (Header/Footer/CartDrawer imports, fonts, metadata) uses `@/`-prefixed absolute imports and is unaffected by the move — leave it as-is.

- [ ] **Step 3: Create the admin root layout**

`frontend/app/admin/layout.tsx`:

```tsx
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

(This gets fonts, the brand palette, and `QueryProvider` added in Task 14 — kept minimal here so this task's only job is proving the route structure works.)

- [ ] **Step 4: Create placeholder login and dashboard-group pages**

`frontend/app/admin/login/page.tsx`:

```tsx
export default function AdminLoginPlaceholder() {
  return <p>Admin login — replaced in a later task.</p>;
}
```

`frontend/app/admin/(dashboard)/layout.tsx`:

```tsx
export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
```

`frontend/app/admin/(dashboard)/dashboard/page.tsx`:

```tsx
export default function AdminDashboardPlaceholder() {
  return <p>Admin dashboard — replaced in a later task.</p>;
}
```

- [ ] **Step 5: Verify with a production build and a manual check**

Run:

```bash
npm run build -w frontend
```

Expected: the build succeeds and its route summary lists both storefront routes (`/`, `/shop`, `/product/[slug]`, `/cart`, `/checkout`, `/account/wishlist`) and the new admin routes (`/admin/login`, `/admin/dashboard`).

Then run `npm run dev:frontend` and check manually:
- `http://localhost:3000/` — loads exactly as before (storefront header/footer/hero).
- `http://localhost:3000/admin/login` — renders the plain placeholder text with no storefront header/footer/cart drawer.
- `http://localhost:3000/admin/dashboard` — renders its own placeholder text, also with no storefront chrome.

- [ ] **Step 6: Commit**

```bash
git add frontend/app
git commit -m "refactor: split the Next.js app into (site) and admin route groups"
```

---

### Task 13: shadcn/ui foundation — design tokens + primitive components

**Files:**
- Modify: `frontend/lib/utils.ts` (`cn()` gains `tailwind-merge`)
- Create: `frontend/components.json`
- Modify: `frontend/app/globals.css` (shadcn CSS variables mapped to the brand palette)
- Modify: `frontend/tailwind.config.ts` (semantic color tokens + radius)
- Create: `frontend/components/admin-ui/{button,input,label,badge,separator,table,select,tabs,checkbox}.tsx`

**Interfaces:**
- Produces: `cn()` from `@/lib/utils` (upgraded, storefront-compatible — `twMerge` only dedupes conflicting Tailwind classes, it doesn't change behavior for non-conflicting ones).
- Produces: `Button`, `Input`, `Label`, `Badge`, `Separator`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Checkbox` — all importable from `@/components/admin-ui/*`. These are intentionally kept out of `@/components/ui/` (the storefront's existing hand-rolled `Button.tsx`/`Badge.tsx`) both to avoid a Windows filename case-collision (`button.tsx` vs `Button.tsx` in the same folder) and to keep the two design systems independent.

- [ ] **Step 1: Install dependencies**

```bash
npm install class-variance-authority tailwind-merge @radix-ui/react-label @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-checkbox -w frontend
```

- [ ] **Step 2: Upgrade `cn()`**

Replace the top of `frontend/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

(Leave `formatCurrency` and `stockLabel` below it untouched.)

- [ ] **Step 3: Add `components.json`**

`frontend/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components/admin-ui",
    "utils": "@/lib/utils",
    "ui": "@/components/admin-ui"
  }
}
```

- [ ] **Step 4: Add shadcn CSS variables mapped to the brand palette**

Append a new block to `frontend/app/globals.css` (after the existing `@layer components` block):

```css
@layer base {
  :root {
    --background: 40 20% 98%;
    --foreground: 0 0% 7%;
    --card: 40 20% 98%;
    --card-foreground: 0 0% 7%;
    --primary: 0 0% 7%;
    --primary-foreground: 40 20% 98%;
    --secondary: 100 8% 58%;
    --secondary-foreground: 0 0% 7%;
    --muted: 40 10% 92%;
    --muted-foreground: 0 0% 40%;
    --accent: 45 58% 53%;
    --accent-foreground: 0 0% 7%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 40 20% 98%;
    --border: 0 0% 7%;
    --ring: 45 58% 53%;
    --radius: 0.5rem;
  }
}
```

These HSL triplets are the existing brand colors expressed as `H S% L%` (shadcn's expected token format): `--foreground`/`--primary` = obsidian `#121212`, `--background` = alabaster `#F9F8F6`, `--accent`/`--ring` = gold `#D4AF37`, `--secondary` = sage `#8A9A86`.

- [ ] **Step 5: Extend the Tailwind config with the semantic tokens**

In `frontend/tailwind.config.ts`, inside `theme.extend.colors`, add (alongside the existing `obsidian`/`alabaster`/`gold`/`sage` entries — don't remove those):

```ts
background: "hsl(var(--background))",
foreground: "hsl(var(--foreground))",
card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
border: "hsl(var(--border) / 0.1)",
ring: "hsl(var(--ring))",
```

And inside `theme.extend`, add a `borderRadius` block:

```ts
borderRadius: {
  lg: "var(--radius)",
  md: "calc(var(--radius) - 2px)",
  sm: "calc(var(--radius) - 4px)",
},
```

- [ ] **Step 6: Author the primitive components**

`frontend/components/admin-ui/button.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded text-xs uppercase tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-obsidian text-alabaster hover:bg-gold hover:text-obsidian",
        outline: "border border-obsidian/20 text-obsidian hover:border-obsidian",
        ghost: "text-obsidian/70 hover:text-obsidian",
        destructive: "text-red-600 hover:text-red-700",
      },
      size: {
        sm: "px-3 py-1.5",
        md: "px-5 py-2.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
```

`frontend/components/admin-ui/input.tsx`:

```tsx
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian outline-none transition-colors focus:border-obsidian/40 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
```

`frontend/components/admin-ui/label.tsx`:

```tsx
"use client";
import * as LabelPrimitive from "@radix-ui/react-label";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/utils";

export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-xs uppercase tracking-widest2 text-obsidian/60", className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
```

`frontend/components/admin-ui/badge.tsx`:

```tsx
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "in" | "low" | "out" | "neutral";

const toneClass: Record<Tone, string> = {
  in: "bg-green-100 text-green-700",
  low: "bg-amber-100 text-amber-700",
  out: "bg-red-100 text-red-700",
  neutral: "bg-obsidian/5 text-obsidian/70",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("rounded-full px-2.5 py-1 text-xs font-medium", toneClass[tone], className)}
      {...props}
    />
  );
}
```

`frontend/components/admin-ui/separator.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-obsidian/10", className)} />;
}
```

`frontend/components/admin-ui/table.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  )
);
Table.displayName = "Table";

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("border-b border-obsidian/10 bg-obsidian/[0.02]", className)} {...props} />
  )
);
TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("divide-y divide-obsidian/10", className)} {...props} />
  )
);
TableBody.displayName = "TableBody";

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("transition-colors hover:bg-obsidian/[0.02]", className)} {...props} />
  )
);
TableRow.displayName = "TableRow";

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn("px-5 py-3 text-left text-xs uppercase tracking-wide text-obsidian/50", className)}
      {...props}
    />
  )
);
TableHead.displayName = "TableHead";

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-5 py-3 align-middle", className)} {...props} />
  )
);
TableCell.displayName = "TableCell";
```

`frontend/components/admin-ui/select.tsx`:

```tsx
"use client";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between rounded border border-obsidian/15 bg-white px-3 py-2 text-sm text-obsidian outline-none focus:border-obsidian/40",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn("z-50 overflow-hidden rounded-md border border-obsidian/10 bg-white shadow-card", className)}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm text-obsidian outline-none data-[highlighted]:bg-obsidian/5",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-3">
      <Check className="h-4 w-4" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
```

`frontend/components/admin-ui/tabs.tsx`:

```tsx
"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn("flex gap-1 border-b border-obsidian/10", className)} {...props} />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "px-4 py-2.5 text-sm text-obsidian/60 data-[state=active]:border-b-2 data-[state=active]:border-obsidian data-[state=active]:text-obsidian",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("py-6", className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
```

`frontend/components/admin-ui/checkbox.tsx`:

```tsx
"use client";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "h-4 w-4 shrink-0 rounded-sm border border-obsidian/30 data-[state=checked]:bg-obsidian data-[state=checked]:text-alabaster",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
```

- [ ] **Step 7: Verify**

Run:

```bash
npm run build -w frontend
```

Expected: build still succeeds (nothing imports these new files yet, so this just confirms no syntax/type errors in the new components and that the Tailwind config changes didn't break the existing storefront build).

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/utils.ts frontend/components.json frontend/app/globals.css frontend/tailwind.config.ts frontend/components/admin-ui frontend/package.json frontend/package-lock.json
git commit -m "feat: add shadcn/ui foundation themed to the Aura & Optic palette"
```

---

### Task 14: Admin API client, types, and React Query provider

**Files:**
- Create: `frontend/.env.local.example`
- Create: `frontend/app/admin/_lib/types.ts`
- Create: `frontend/app/admin/_lib/api.ts`
- Create: `frontend/app/admin/_lib/format.ts`
- Create: `frontend/app/admin/_lib/QueryProvider.tsx`
- Modify: `frontend/app/admin/layout.tsx`

**Interfaces:**
- Produces: `Variant`, `AdminProduct`, `Subcategory`, `Category`, `PaginatedResult<T>` from `frontend/app/admin/_lib/types.ts` — every later admin component imports these.
- Produces: `api.get/post/put/patch/del<T>(path, body?)` and `ApiError` from `frontend/app/admin/_lib/api.ts` — every later admin component/hook uses this instead of raw `fetch`.
- Produces: `formatCurrency(amount)` and `stockTone(stock)` from `frontend/app/admin/_lib/format.ts`.
- Produces: `<QueryProvider>` from `frontend/app/admin/_lib/QueryProvider.tsx`, wrapping `{children}` in `app/admin/layout.tsx` from this task onward.

- [ ] **Step 1: Install dependencies**

```bash
npm install @tanstack/react-query sonner -w frontend
```

- [ ] **Step 2: Document the API base URL env var**

`frontend/.env.local.example`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
JWT_SECRET=replace-with-the-exact-same-value-as-backend/.env
```

(`JWT_SECRET` here must be byte-for-byte identical to the backend's — Task 15's Next middleware verifies the cookie's JWT signature itself, without calling the API, so both sides need the same secret. It's intentionally not prefixed `NEXT_PUBLIC_` — middleware runs server/edge-side, so it must never ship to the browser bundle.)

- [ ] **Step 3: Add shared admin types**

`frontend/app/admin/_lib/types.ts`:

```ts
export type ProductCategory = "eyewear" | "apparel";

export interface Variant {
  id: string;
  colorId: string;
  colorLabel: string;
  colorHex?: string;
  colorImage?: string;
  sizeId?: string;
  sizeLabel?: string;
  stock: number;
  sku?: string;
}

export interface AdminProduct {
  _id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  subCategory: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  images: string[];
  frameShape?: string;
  lensColor?: string;
  fabric?: string;
  clothingSize?: string[];
  variants: Variant[];
  stock: number;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  tags?: string[];
  pairsWith?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Subcategory {
  _id: string;
  name: string;
  slug: string;
  categoryType: ProductCategory;
  sortOrder: number;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  type: ProductCategory;
  description?: string;
  heroImage?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
```

- [ ] **Step 4: Add the fetch wrapper**

`frontend/app/admin/_lib/api.ts`:

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
```

`credentials: "include"` is what makes the browser attach the httpOnly `token` cookie on cross-port requests from `localhost:3000` to `localhost:5000` — both are `http://localhost`, so they count as same-site for cookie purposes even though they're cross-origin (different port), and the backend's `cors({ credentials: true })` (Task 1) already allows it.

- [ ] **Step 5: Add formatting helpers**

`frontend/app/admin/_lib/format.ts`:

```ts
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  })
    .format(amount)
    .replace("GHS", "GH₵");
}

export function stockTone(stock: number): "in" | "low" | "out" {
  if (stock <= 0) return "out";
  if (stock <= 5) return "low";
  return "in";
}
```

- [ ] **Step 6: Add the React Query provider and wire it into the admin root layout**

`frontend/app/admin/_lib/QueryProvider.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
```

Replace `frontend/app/admin/layout.tsx` (from the Task 12 placeholder):

```tsx
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import "../globals.css";
import { QueryProvider } from "./_lib/QueryProvider";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Admin — Aura & Optic",
  description: "Store management dashboard for Aura & Optic.",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans bg-alabaster text-obsidian antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify**

Run: `npm run build -w frontend`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/.env.local.example frontend/app/admin/_lib frontend/app/admin/layout.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add admin API client, shared types, and React Query provider"
```

---

### Task 15: Admin auth — middleware route guard, login page, logout

**Files:**
- Create: `frontend/middleware.ts`
- Modify: `frontend/app/admin/login/page.tsx` (replaces the Task 12 placeholder)
- Create: `frontend/app/admin/_lib/auth.ts`
- Create: `frontend/app/admin/_components/LogoutButton.tsx`

**Interfaces:**
- Consumes: `api.post` from `_lib/api.ts` (Task 14).
- Produces: `loginAdmin(email, password)`, `logoutAdmin()`, `AdminSession` type from `_lib/auth.ts` — used by the login page here and by `LogoutButton` (used in Task 16's shell).
- Produces: `<LogoutButton />` component, consumed by Task 16's `(dashboard)/layout.tsx`.

- [ ] **Step 1: Install `jose`**

```bash
npm install jose -w frontend
```

(`jose` is used instead of `jsonwebtoken` because Next.js middleware runs on the Edge runtime, which doesn't support Node's `crypto` module that `jsonwebtoken` depends on.)

- [ ] **Step 2: Add the route guard**

`frontend/middleware.ts` (project root, sibling to `app/`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

This is a UX gate, not the security boundary — every admin API route is still independently protected by the backend's `protect`/`admin` middleware (Task 9), which is what actually enforces authorization.

- [ ] **Step 3: Add the auth helper**

`frontend/app/admin/_lib/auth.ts`:

```ts
import { api } from "./api";

export interface AdminSession {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export function loginAdmin(email: string, password: string) {
  return api.post<AdminSession>("/auth/login", { email, password });
}

export function logoutAdmin() {
  return api.post<{ message: string }>("/auth/logout", {});
}
```

- [ ] **Step 4: Build the real login page**

Replace `frontend/app/admin/login/page.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "../_lib/auth";
import { ApiError } from "../_lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await loginAdmin(email, password);
      if (session.role !== "admin") {
        setError("This account does not have admin access.");
        return;
      }
      router.push("/admin/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-alabaster px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-obsidian/10 bg-white p-8"
      >
        <div>
          <h1 className="font-serif text-2xl text-obsidian">Aura & Optic</h1>
          <p className="mt-1 text-xs uppercase tracking-widest2 text-obsidian/50">Admin sign in</p>
        </div>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="space-y-1">
          <label htmlFor="email" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-obsidian px-5 py-3 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
```

`htmlFor`/`id` pairing on both fields matters beyond accessibility here — Task 25's Playwright test locates these with `page.getByLabel("Email")`/`page.getByLabel("Password")`, which requires a real label association to work.

- [ ] **Step 5: Add the logout button**

`frontend/app/admin/_components/LogoutButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutAdmin } from "../_lib/auth";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logoutAdmin();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-obsidian/70 hover:text-obsidian">
      <LogOut size={16} />
      Log out
    </button>
  );
}
```

- [ ] **Step 6: Verify manually**

Prerequisite: `backend/.env` and `frontend/.env.local` must have the identical `JWT_SECRET` value (copy `.env.local.example` to `.env.local` and paste the same secret from `backend/.env`), and `npm run seed -w backend` must have run (Task 11) so an admin user exists.

Run `npm run dev` from the repo root (starts both frontend and backend), then:
1. Visit `http://localhost:3000/admin/dashboard` directly — expect an immediate redirect to `/admin/login` (no cookie yet).
2. Sign in with the seeded admin credentials (`ADMIN_EMAIL`/`ADMIN_PASSWORD` from `backend/.env`, defaulting to `admin@auraandoptic.com` / `changeme123`) — expect a redirect to `/admin/dashboard`, rendering the Task 12 placeholder text (no crash).
3. Refresh the page — expect to stay on `/admin/dashboard` (cookie persists, middleware lets the request through).

- [ ] **Step 7: Commit**

```bash
git add frontend/middleware.ts frontend/app/admin/login/page.tsx frontend/app/admin/_lib/auth.ts frontend/app/admin/_components/LogoutButton.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add admin login, logout, and middleware route guard"
```

---

### Task 16: Admin shell — Sidebar/Topbar + stub Orders/Customers/Settings pages

**Files:**
- Create: `frontend/app/admin/_components/Sidebar.tsx`
- Modify: `frontend/app/admin/(dashboard)/layout.tsx` (replaces the Task 12 placeholder)
- Create: `frontend/app/admin/(dashboard)/orders/page.tsx`
- Create: `frontend/app/admin/(dashboard)/customers/page.tsx`
- Create: `frontend/app/admin/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: `<LogoutButton />` (Task 15).
- Produces: the `(dashboard)/layout.tsx` shell that every page created in Tasks 17–24 renders inside.

- [ ] **Step 1: Build the sidebar**

`frontend/app/admin/_components/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Tags, ShoppingBag, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-obsidian/10 bg-alabaster">
      <div className="px-6 py-8">
        <span className="font-serif text-xl tracking-tight text-obsidian">Aura & Optic</span>
        <span className="mt-1 block text-xs uppercase tracking-widest2 text-obsidian/50">Admin</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-obsidian text-alabaster"
                  : "text-obsidian/70 hover:bg-obsidian/5 hover:text-obsidian"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Replace the dashboard-group layout**

Replace `frontend/app/admin/(dashboard)/layout.tsx`:

```tsx
import { Sidebar } from "../_components/Sidebar";
import { LogoutButton } from "../_components/LogoutButton";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-obsidian/10 bg-alabaster px-8 py-4">
          <span className="text-sm uppercase tracking-widest2 text-obsidian/50">Store Management</span>
          <LogoutButton />
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the three stub pages**

`frontend/app/admin/(dashboard)/orders/page.tsx`:

```tsx
export default function OrdersPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl text-obsidian">Orders</h1>
      <p className="mt-2 max-w-xl text-sm text-obsidian/60">
        Order management is coming in Phase 2. Orders already placed through the storefront
        checkout are recorded — this view will list and let you update their fulfillment status.
      </p>
    </div>
  );
}
```

`frontend/app/admin/(dashboard)/customers/page.tsx`:

```tsx
export default function CustomersPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl text-obsidian">Customers</h1>
      <p className="mt-2 max-w-xl text-sm text-obsidian/60">
        Customer management is coming in Phase 3.
      </p>
    </div>
  );
}
```

`frontend/app/admin/(dashboard)/settings/page.tsx`:

```tsx
export default function SettingsPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl text-obsidian">Settings</h1>
      <p className="mt-2 max-w-xl text-sm text-obsidian/60">
        Admin user management and store settings are coming in Phase 3.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify manually**

With `npm run dev` running and signed in as admin: click through Dashboard, Products, Categories, Orders, Customers, Settings in the sidebar. Expect each link to highlight when active and every page (including the still-placeholder Dashboard/Products/Categories from earlier tasks) to render inside the same sidebar/topbar shell without a full page reload.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/admin/_components/Sidebar.tsx" "frontend/app/admin/(dashboard)"
git commit -m "feat: add admin sidebar shell and Orders/Customers/Settings stub pages"
```

---

### Task 17: Dashboard home page

**Files:**
- Modify: `frontend/app/admin/(dashboard)/dashboard/page.tsx` (replaces the Task 12 placeholder)

**Interfaces:**
- Consumes: `GET /api/products/admin` (Task 6), `api.get` (Task 14), `AdminProduct`/`PaginatedResult` types (Task 14), `stockTone`/`formatCurrency` (Task 14).

- [ ] **Step 1: Build the dashboard**

Replace `frontend/app/admin/(dashboard)/dashboard/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../_lib/api";
import { formatCurrency } from "../../_lib/format";
import type { AdminProduct, PaginatedResult } from "../../_lib/types";

async function fetchAllProducts() {
  return api.get<PaginatedResult<AdminProduct>>("/products/admin?limit=1000");
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", "dashboard"],
    queryFn: fetchAllProducts,
  });

  const products = data?.items ?? [];
  const outOfStock = products.filter((p) => p.stock === 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const catalogValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

  const tiles = [
    { label: "Total Products", value: String(products.length) },
    { label: "Low Stock", value: String(lowStock.length) },
    { label: "Out of Stock", value: String(outOfStock.length) },
    { label: "Catalog Value", value: formatCurrency(catalogValue) },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl text-obsidian">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-obsidian/10 bg-white p-5">
            <p className="text-xs uppercase tracking-widest2 text-obsidian/50">{tile.label}</p>
            <p className="mt-2 font-serif text-2xl text-obsidian">{isLoading ? "…" : tile.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-obsidian/10 bg-white">
        <div className="border-b border-obsidian/10 px-5 py-4">
          <h2 className="text-sm font-medium text-obsidian">Needs attention</h2>
        </div>
        <div className="divide-y divide-obsidian/10">
          {[...outOfStock, ...lowStock].slice(0, 8).map((product) => (
            <Link
              key={product._id}
              href={`/admin/products/${product._id}/edit`}
              className="flex items-center justify-between px-5 py-3 text-sm hover:bg-obsidian/5"
            >
              <span className="text-obsidian">{product.name}</span>
              <span className={product.stock === 0 ? "text-red-600" : "text-amber-600"}>
                {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
              </span>
            </Link>
          ))}
          {!isLoading && outOfStock.length === 0 && lowStock.length === 0 && (
            <p className="px-5 py-6 text-sm text-obsidian/50">Everything is well stocked.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

The "needs attention" rows link to `/admin/products/[id]/edit`, which doesn't exist until Task 24 — that's expected; clicking through will 404 until then.

- [ ] **Step 2: Verify manually**

With the backend seeded (Task 11) and running, sign in and visit `/admin/dashboard`. Expect the four KPI tiles to show real numbers matching the seeded catalog (e.g. total product count matches `curl http://localhost:5000/api/products/admin?limit=1000 -H "Cookie: token=<your cookie>"`), and the "Needs attention" list to show the seeded products that have `stock <= 5` (several seed products, like `the-editor` at `stock: 0` and `the-voyager` at `stock: 2`, should appear).

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/admin/(dashboard)/dashboard/page.tsx"
git commit -m "feat: build the admin dashboard home page with stock KPIs"
```

---

## Part C — Categories

### Task 18: Categories & sub-categories admin page

**Files:**
- Modify: `frontend/app/admin/(dashboard)/categories/page.tsx` (replaces nothing — this route had no page before; create it)

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/subcategories` (Task 2), `api` (Task 14), `Subcategory` type (Task 14).
- Produces: nothing consumed elsewhere — this is a self-contained management surface. (Drag-to-reorder via `sortOrder` is intentionally deferred; rename/add/delete cover the core ask.)

- [ ] **Step 1: Build the page**

`frontend/app/admin/(dashboard)/categories/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../_lib/api";
import type { Subcategory } from "../../_lib/types";

type CategoryType = "eyewear" | "apparel";

function useSubcategories(categoryType: CategoryType) {
  return useQuery({
    queryKey: ["subcategories", categoryType],
    queryFn: () => api.get<Subcategory[]>(`/subcategories?categoryType=${categoryType}`),
  });
}

function CategoryPanel({ categoryType, title }: { categoryType: CategoryType; title: string }) {
  const queryClient = useQueryClient();
  const { data: subcategories = [], isLoading } = useSubcategories(categoryType);
  const [newName, setNewName] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["subcategories", categoryType] });
  }

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.post<Subcategory>("/subcategories", {
        name,
        slug: name.toLowerCase().trim().replace(/\s+/g, "-"),
        categoryType,
        sortOrder: subcategories.length,
      }),
    onSuccess: () => {
      toast.success("Sub-category added");
      setNewName("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put<Subcategory>(`/subcategories/${id}`, { name }),
    onSuccess: () => {
      toast.success("Sub-category renamed");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/subcategories/${id}`),
    onSuccess: () => {
      toast.success("Sub-category deleted");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="rounded-lg border border-obsidian/10 bg-white">
      <div className="border-b border-obsidian/10 px-5 py-4">
        <h2 className="text-sm font-medium text-obsidian">{title}</h2>
      </div>
      <ul className="divide-y divide-obsidian/10">
        {isLoading && <li className="px-5 py-4 text-sm text-obsidian/50">Loading…</li>}
        {subcategories.map((sub) => (
          <li key={sub._id} className="flex items-center justify-between px-5 py-3">
            <input
              defaultValue={sub.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== sub.name) {
                  renameMutation.mutate({ id: sub._id, name: e.target.value.trim() });
                }
              }}
              className="w-full bg-transparent text-sm text-obsidian outline-none focus:underline"
            />
            <button
              onClick={() => {
                if (confirm(`Delete "${sub.name}"?`)) deleteMutation.mutate(sub._id);
              }}
              className="ml-4 text-xs uppercase tracking-wide text-obsidian/40 hover:text-red-600"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) createMutation.mutate(newName.trim());
        }}
        className="flex gap-2 border-t border-obsidian/10 px-5 py-3"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New sub-category name"
          className="flex-1 rounded border border-obsidian/15 px-3 py-1.5 text-sm outline-none focus:border-obsidian/40"
        />
        <button
          type="submit"
          className="rounded bg-obsidian px-4 py-1.5 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian"
        >
          Add
        </button>
      </form>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl text-obsidian">Categories</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <CategoryPanel categoryType="eyewear" title="Eyewear" />
        <CategoryPanel categoryType="apparel" title="Apparel" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

Visit `/admin/categories`. Expect two panels (Eyewear, Apparel) each pre-populated with the sub-categories Task 11's seed derived (e.g. Eyewear: Sunglasses, Optical; Apparel: Knitwear, Outerwear, Shirting, Bottoms, Dresses). Add a new sub-category in one panel, confirm it appears immediately (no manual refresh needed — React Query's `invalidateQueries` refetches). Rename one by editing its text and clicking elsewhere (blur). Try deleting one that's in use by a seeded product — expect a toast error and the item to remain (409 from Task 2's block). Delete one that's unused (e.g. the one you just added) — expect it to disappear.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/admin/(dashboard)/categories/page.tsx"
git commit -m "feat: add categories and sub-categories admin page"
```

---

## Part D — Products

### Task 19: Product list page

**Files:**
- Modify: `frontend/app/admin/(dashboard)/products/page.tsx` (create — no page existed for this route before)

**Interfaces:**
- Consumes: `GET /api/products/admin` (Task 6), `PATCH /api/products/:id/stock` (Task 7), `DELETE /api/products/:id` (existing), `Table*`/`Select*`/`Badge`/`Button`/`Input` (Task 13), `api`/`AdminProduct`/`PaginatedResult`/`stockTone`/`formatCurrency` (Task 14).
- Produces: links to `/admin/products/new` and `/admin/products/[id]/edit`, which don't exist until Tasks 20–24 — expected to 404 until then.

- [ ] **Step 1: Build the page**

`frontend/app/admin/(dashboard)/products/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/admin-ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/admin-ui/select";
import { Badge } from "@/components/admin-ui/badge";
import { Button } from "@/components/admin-ui/button";
import { Input } from "@/components/admin-ui/input";
import { api } from "../../_lib/api";
import { formatCurrency, stockTone } from "../../_lib/format";
import type { AdminProduct, PaginatedResult } from "../../_lib/types";

interface Filters {
  category: string;
  stockStatus: string;
  search: string;
}

function useAdminProducts(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.stockStatus !== "all") params.set("stockStatus", filters.stockStatus);
  if (filters.search) params.set("search", filters.search);
  params.set("limit", "50");

  return useQuery({
    queryKey: ["admin-products", filters],
    queryFn: () => api.get<PaginatedResult<AdminProduct>>(`/products/admin?${params}`),
  });
}

export default function ProductsPage() {
  const [filters, setFilters] = useState<Filters>({ category: "all", stockStatus: "all", search: "" });
  const { data, isLoading } = useAdminProducts(filters);
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }

  const markOutOfStock = useMutation({
    mutationFn: (product: AdminProduct) =>
      api.patch(`/products/${product._id}/stock`, {
        variants: product.variants.map((v) => ({ id: v.id, stock: 0 })),
      }),
    onSuccess: () => {
      toast.success("Marked out of stock");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.del(`/products/${id}`),
    onSuccess: () => {
      toast.success("Product deleted");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const products = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-obsidian">Products</h1>
        <Link href="/admin/products/new">
          <Button>New Product</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search by name…"
          className="max-w-xs"
        />
        <Select value={filters.category} onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="eyewear">Eyewear</SelectItem>
            <SelectItem value="apparel">Apparel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.stockStatus} onValueChange={(v) => setFilters((f) => ({ ...f, stockStatus: v }))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock levels</SelectItem>
            <SelectItem value="in">In stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-obsidian/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-obsidian/50">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && products.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-obsidian/50">
                  No products match these filters.
                </TableCell>
              </TableRow>
            )}
            {products.map((product) => {
              const tone = stockTone(product.stock);
              return (
                <TableRow key={product._id}>
                  <TableCell className="flex items-center gap-3">
                    {product.images[0] && (
                      <img src={product.images[0]} alt="" className="h-10 w-10 rounded object-cover" />
                    )}
                    <span className="text-obsidian">{product.name}</span>
                  </TableCell>
                  <TableCell className="text-obsidian/70">
                    {product.category} / {product.subCategory}
                  </TableCell>
                  <TableCell className="text-obsidian/70">{formatCurrency(product.price)}</TableCell>
                  <TableCell>
                    <Badge tone={tone}>{product.stock} in stock</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-3 text-xs uppercase tracking-wide">
                      <Link href={`/admin/products/${product._id}/edit`} className="text-obsidian/70 hover:text-obsidian">
                        Edit
                      </Link>
                      {product.stock > 0 && (
                        <button
                          onClick={() => markOutOfStock.mutate(product)}
                          className="text-obsidian/70 hover:text-obsidian"
                        >
                          Mark out of stock
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${product.name}"?`)) deleteProduct.mutate(product._id);
                        }}
                        className="text-obsidian/70 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

Visit `/admin/products`. Expect the seeded catalog (17 products) listed with thumbnails, correct category/subcategory text, formatted GHS prices, and stock badges colored per the Task 4/6 thresholds (green >5, amber 1–5, red 0 — e.g. `the-editor` should show a red "0 in stock" badge, `the-voyager` amber "2 in stock"). Filter by category and by stock status and confirm the list narrows correctly; search by a product name substring. Click "Mark out of stock" on an in-stock product and confirm its badge flips to red "0 in stock" without a page reload.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/admin/(dashboard)/products/page.tsx"
git commit -m "feat: add admin product list with filters and quick stock actions"
```

---

### Task 20: Product form shell + Details tab

This task builds the form's skeleton — Zod schema, React Hook Form wiring, the five-tab layout, the save mutation, and the unsaved-changes guard — plus the one tab (Details) that's fully real. The other four tabs are stubbed with trivial placeholder components that Tasks 21–24 each replace in place, so `ProductForm.tsx`'s imports never change after this task.

**Files:**
- Create: `frontend/app/admin/_components/products/schema.ts`
- Create: `frontend/app/admin/_components/products/ProductForm.tsx`
- Create: `frontend/app/admin/_components/products/DetailsTab.tsx`
- Create: `frontend/app/admin/_components/products/AttributesTab.tsx` (placeholder — real version in Task 21)
- Create: `frontend/app/admin/_components/products/ColorsImagesTab.tsx` (placeholder — real version in Task 22)
- Create: `frontend/app/admin/_components/products/InventoryTab.tsx` (placeholder — real version in Task 23)
- Create: `frontend/app/admin/_components/products/CrossSellTab.tsx` (placeholder — real version in Task 24)
- Create: `frontend/app/admin/(dashboard)/products/new/page.tsx`

**Interfaces:**
- Consumes: `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (Task 13), `api`/`AdminProduct` (Task 14), `Subcategory` type (Task 14).
- Produces: `productFormSchema`/`ProductFormValues`/`variantSchema`/`colorSchema` from `schema.ts` — consumed by every tab component in Tasks 21–23.
- Produces: `<ProductForm product?: AdminProduct />` — consumed by `products/new/page.tsx` (this task) and `products/[id]/edit/page.tsx` (Task 24).
- Produces: `AttributesTab()`, `ColorsImagesTab()`, `InventoryTab()`, `CrossSellTab({ currentProductId }: { currentProductId?: string })` — these exact names and signatures are what Tasks 21–24 must preserve when replacing the placeholder bodies.

- [ ] **Step 1: Install dependencies**

```bash
npm install react-hook-form @hookform/resolvers zod -w frontend
```

- [ ] **Step 2: Write the Zod schema**

`frontend/app/admin/_components/products/schema.ts`:

```ts
import { z } from "zod";

export const variantSchema = z.object({
  id: z.string(),
  colorId: z.string(),
  colorLabel: z.string(),
  colorHex: z.string().optional(),
  colorImage: z.string().optional(),
  sizeId: z.string().optional(),
  sizeLabel: z.string().optional(),
  stock: z.coerce.number().min(0),
});

export const colorSchema = z.object({
  colorId: z.string().min(1),
  colorLabel: z.string().min(1, "Color name is required"),
  colorHex: z.string().optional(),
  colorImage: z.string().optional(),
});

export const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  category: z.enum(["eyewear", "apparel"]),
  subCategory: z.string().min(1, "Sub-category is required"),
  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  compareAtPrice: z.coerce.number().positive().optional(),
  images: z.array(z.string()).min(1, "At least one image is required"),
  frameShape: z.string().optional(),
  lensColor: z.string().optional(),
  fabric: z.string().optional(),
  clothingSize: z.array(z.string()).optional(),
  isNewArrival: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  colors: z.array(colorSchema).min(1, "Add at least one color"),
  variants: z.array(variantSchema),
  pairsWith: z.array(z.string()).optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
```

- [ ] **Step 3: Write the Details tab**

`frontend/app/admin/_components/products/DetailsTab.tsx`:

```tsx
"use client";

import { useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../_lib/api";
import type { Subcategory } from "../../_lib/types";
import type { ProductFormValues } from "./schema";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function DetailsTab() {
  const { register, watch, setValue, formState } = useFormContext<ProductFormValues>();
  const category = watch("category");

  const { data: subcategories = [] } = useQuery({
    queryKey: ["subcategories", category],
    queryFn: () => api.get<Subcategory[]>(`/subcategories?categoryType=${category}`),
  });

  return (
    <div className="grid max-w-3xl gap-5">
      <div>
        <label htmlFor="product-name" className="text-xs uppercase tracking-widest2 text-obsidian/60">
          Name
        </label>
        <input
          id="product-name"
          {...register("name", {
            onChange: (e) => setValue("slug", slugify(e.target.value), { shouldDirty: true }),
          })}
          className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
        />
        {formState.errors.name && <p className="mt-1 text-xs text-red-600">{formState.errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="product-slug" className="text-xs uppercase tracking-widest2 text-obsidian/60">
          Slug
        </label>
        <input
          id="product-slug"
          {...register("slug")}
          className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label htmlFor="product-category" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Category
          </label>
          <select
            id="product-category"
            {...register("category", { onChange: () => setValue("subCategory", "", { shouldDirty: true }) })}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          >
            <option value="eyewear">Eyewear</option>
            <option value="apparel">Apparel</option>
          </select>
        </div>

        <div>
          <label htmlFor="product-subcategory" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Sub-category
          </label>
          <select
            id="product-subcategory"
            {...register("subCategory")}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {subcategories.map((sub) => (
              <option key={sub._id} value={sub.slug}>
                {sub.name}
              </option>
            ))}
          </select>
          {formState.errors.subCategory && (
            <p className="mt-1 text-xs text-red-600">{formState.errors.subCategory.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="product-description" className="text-xs uppercase tracking-widest2 text-obsidian/60">
          Description
        </label>
        <textarea
          id="product-description"
          {...register("description")}
          rows={4}
          className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
        />
        {formState.errors.description && (
          <p className="mt-1 text-xs text-red-600">{formState.errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label htmlFor="product-price" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Price (GHS)
          </label>
          <input
            id="product-price"
            type="number"
            step="0.01"
            {...register("price")}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
          {formState.errors.price && <p className="mt-1 text-xs text-red-600">{formState.errors.price.message}</p>}
        </div>
        <div>
          <label htmlFor="product-compare-price" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Compare-at price
          </label>
          <input
            id="product-compare-price"
            type="number"
            step="0.01"
            {...register("compareAtPrice")}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-obsidian">
          <input type="checkbox" {...register("isNewArrival")} /> New arrival
        </label>
        <label className="flex items-center gap-2 text-sm text-obsidian">
          <input type="checkbox" {...register("isBestSeller")} /> Best seller
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the four placeholder tabs**

`frontend/app/admin/_components/products/AttributesTab.tsx`:

```tsx
export function AttributesTab() {
  return <p className="text-sm text-obsidian/50">Coming in a later task.</p>;
}
```

`frontend/app/admin/_components/products/ColorsImagesTab.tsx`:

```tsx
export function ColorsImagesTab() {
  return <p className="text-sm text-obsidian/50">Coming in a later task.</p>;
}
```

`frontend/app/admin/_components/products/InventoryTab.tsx`:

```tsx
export function InventoryTab() {
  return <p className="text-sm text-obsidian/50">Coming in a later task.</p>;
}
```

`frontend/app/admin/_components/products/CrossSellTab.tsx`:

```tsx
export function CrossSellTab({ currentProductId }: { currentProductId?: string }) {
  void currentProductId;
  return <p className="text-sm text-obsidian/50">Coming in a later task.</p>;
}
```

- [ ] **Step 5: Build the form shell**

`frontend/app/admin/_components/products/ProductForm.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/admin-ui/tabs";
import { api } from "../../_lib/api";
import type { AdminProduct } from "../../_lib/types";
import { productFormSchema, type ProductFormValues } from "./schema";
import { DetailsTab } from "./DetailsTab";
import { AttributesTab } from "./AttributesTab";
import { ColorsImagesTab } from "./ColorsImagesTab";
import { InventoryTab } from "./InventoryTab";
import { CrossSellTab } from "./CrossSellTab";

function toFormValues(product?: AdminProduct): ProductFormValues {
  if (!product) {
    return {
      name: "",
      slug: "",
      category: "eyewear",
      subCategory: "",
      description: "",
      price: 0,
      images: [],
      clothingSize: [],
      tags: [],
      colors: [],
      variants: [],
      pairsWith: [],
    };
  }

  const colorMap = new Map<
    string,
    { colorId: string; colorLabel: string; colorHex?: string; colorImage?: string }
  >();
  product.variants.forEach((v) => {
    if (!colorMap.has(v.colorId)) {
      colorMap.set(v.colorId, {
        colorId: v.colorId,
        colorLabel: v.colorLabel,
        colorHex: v.colorHex,
        colorImage: v.colorImage,
      });
    }
  });

  return {
    name: product.name,
    slug: product.slug,
    category: product.category,
    subCategory: product.subCategory,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    images: product.images,
    frameShape: product.frameShape,
    lensColor: product.lensColor,
    fabric: product.fabric,
    clothingSize: product.clothingSize ?? [],
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    tags: product.tags ?? [],
    colors: Array.from(colorMap.values()),
    variants: product.variants,
    pairsWith: product.pairsWith ?? [],
  };
}

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(product);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: toFormValues(product),
  });

  useEffect(() => {
    function warnOnUnload(e: BeforeUnloadEvent) {
      if (form.formState.isDirty) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", warnOnUnload);
    return () => window.removeEventListener("beforeunload", warnOnUnload);
  }, [form.formState.isDirty]);

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const { colors, ...payload } = values;
      void colors;
      return isEditing
        ? api.put<AdminProduct>(`/products/${product!._id}`, payload)
        : api.post<AdminProduct>("/products", payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? "Product updated" : "Product created");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      router.push("/admin/products");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl text-obsidian">
            {isEditing ? `Edit ${product!.name}` : "New Product"}
          </h1>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded bg-obsidian px-6 py-2.5 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving…" : "Save product"}
          </button>
        </div>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="attributes">Attributes</TabsTrigger>
            <TabsTrigger value="colors">Colors & Images</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="cross-sell">Cross-sell</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <DetailsTab />
          </TabsContent>
          <TabsContent value="attributes">
            <AttributesTab />
          </TabsContent>
          <TabsContent value="colors">
            <ColorsImagesTab />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryTab />
          </TabsContent>
          <TabsContent value="cross-sell">
            <CrossSellTab currentProductId={product?._id} />
          </TabsContent>
        </Tabs>
      </form>
    </FormProvider>
  );
}
```

The payload strips the frontend-only `colors` field before sending — the backend's `Product` schema (Task 4) only has `variants`, which already carries each variant's `colorLabel`/`colorHex`/`colorImage` inline.

- [ ] **Step 6: Wire the "new product" route**

`frontend/app/admin/(dashboard)/products/new/page.tsx`:

```tsx
import { ProductForm } from "../../../_components/products/ProductForm";

export default function NewProductPage() {
  return <ProductForm />;
}
```

- [ ] **Step 7: Verify manually**

Visit `/admin/products/new`. Expect five tabs; only "Details" has real fields, the rest show "Coming in a later task." Fill in Name (confirm Slug auto-fills), pick a category (confirm Sub-category options change and reset), Description, Price. Try clicking "Save product" — expect it to fail validation (colors/images are required by the schema but their tabs are still placeholders) and show the relevant toast/error; this is expected until Tasks 21–24 land. Confirm navigating away after typing triggers the browser's "leave site?" prompt (unsaved-changes guard).

- [ ] **Step 8: Commit**

```bash
git add "frontend/app/admin/_components/products" "frontend/app/admin/(dashboard)/products/new" frontend/package.json frontend/package-lock.json
git commit -m "feat: add product form shell with Details tab and save wiring"
```

---

### Task 21: Product form — Attributes tab

**Files:**
- Modify: `frontend/app/admin/_components/products/AttributesTab.tsx` (replaces the Task 20 placeholder — same export name/signature, `ProductForm.tsx` needs no changes)

**Interfaces:**
- Consumes: `ProductFormValues` (Task 20).

- [ ] **Step 1: Replace the placeholder with the real tab**

`frontend/app/admin/_components/products/AttributesTab.tsx`:

```tsx
"use client";

import { useFormContext } from "react-hook-form";
import type { ProductFormValues } from "./schema";

const AVAILABLE_SIZES = ["XS", "S", "M", "L", "XL"];

export function AttributesTab() {
  const { register, watch, setValue } = useFormContext<ProductFormValues>();
  const category = watch("category");
  const selectedSizes = watch("clothingSize") ?? [];

  function toggleSize(size: string) {
    const next = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    setValue("clothingSize", next, { shouldDirty: true });
  }

  if (category === "eyewear") {
    return (
      <div className="grid max-w-3xl grid-cols-2 gap-5">
        <div>
          <label htmlFor="frame-shape" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Frame shape
          </label>
          <input
            id="frame-shape"
            {...register("frameShape")}
            placeholder="e.g. Aviator, Round, Square"
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
        </div>
        <div>
          <label htmlFor="lens-color" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Lens color
          </label>
          <input
            id="lens-color"
            {...register("lensColor")}
            placeholder="e.g. Gold Mirror, Smoke"
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <label htmlFor="fabric" className="text-xs uppercase tracking-widest2 text-obsidian/60">
          Fabric
        </label>
        <input
          id="fabric"
          {...register("fabric")}
          placeholder="e.g. 100% Cashmere"
          className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
        />
      </div>
      <div>
        <span className="text-xs uppercase tracking-widest2 text-obsidian/60">Sizes offered</span>
        <div className="mt-2 flex gap-2">
          {AVAILABLE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={
                selectedSizes.includes(size)
                  ? "rounded border border-obsidian bg-obsidian px-3 py-1.5 text-sm text-alabaster"
                  : "rounded border border-obsidian/20 px-3 py-1.5 text-sm text-obsidian/70"
              }
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

On `/admin/products/new`, switch the Details tab's Category between Eyewear and Apparel, then check the Attributes tab: Eyewear shows Frame shape / Lens color inputs; Apparel shows Fabric and a row of toggleable size chips (XS–XL). Selecting sizes should visually toggle (filled vs outlined) and persist when switching tabs away and back.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/admin/_components/products/AttributesTab.tsx"
git commit -m "feat: implement product form Attributes tab"
```

---

### Task 22: Product form — Colors & Images tab + ImageUploader

**Files:**
- Create: `frontend/app/admin/_components/products/ImageUploader.tsx`
- Modify: `frontend/app/admin/_components/products/ColorsImagesTab.tsx` (replaces the Task 20 placeholder)

**Interfaces:**
- Consumes: `POST /api/uploads/sign` (Task 8), `api.post` (Task 14), `ProductFormValues` (Task 20).
- Produces: `<ImageUploader images={string[]} onChange={(next: string[]) => void} multiple?: boolean />` — reused twice inside `ColorsImagesTab` (once for the main gallery, once per color's optional swatch image).

- [ ] **Step 1: Build the direct-to-Cloudinary uploader**

`frontend/app/admin/_components/products/ImageUploader.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import { api } from "../../_lib/api";

interface SignResponse {
  timestamp: number;
  signature: string;
  folder: string;
  apiKey: string;
  cloudName: string;
}

async function uploadToCloudinary(file: File): Promise<string> {
  const sign = await api.post<SignResponse>("/uploads/sign", {});

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sign.apiKey);
  formData.append("timestamp", String(sign.timestamp));
  formData.append("signature", sign.signature);
  formData.append("folder", sign.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Image upload failed");
  }

  const data = await res.json();
  return data.secure_url as string;
}

export function ImageUploader({
  images,
  onChange,
  multiple = true,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(Array.from(files).map(uploadToCloudinary));
      onChange(multiple ? [...images, ...urls] : urls);
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((src, i) => (
          <div key={src} className="group relative h-24 w-24 overflow-hidden rounded border border-obsidian/10">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 rounded-full bg-obsidian/70 p-1 text-alabaster opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X size={12} />
            </button>
            {i === 0 && (
              <span className="absolute bottom-0 w-full bg-obsidian/70 py-0.5 text-center text-[10px] uppercase text-alabaster">
                Primary
              </span>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded border border-dashed border-obsidian/25 text-obsidian/50 hover:border-obsidian/50 hover:text-obsidian disabled:opacity-50"
        >
          <Upload size={18} />
          <span className="text-[10px] uppercase">{uploading ? "Uploading…" : "Add image"}</span>
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
```

The first image in the array is always treated as primary/storefront thumbnail — reordering is done by removing and re-adding in the desired order (drag-to-reorder is deferred to keep this task scoped).

- [ ] **Step 2: Build the real Colors & Images tab**

```bash
npm install react-colorful -w frontend
```

Replace `frontend/app/admin/_components/products/ColorsImagesTab.tsx`:

```tsx
"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { HexColorPicker } from "react-colorful";
import { useState } from "react";
import { X } from "lucide-react";
import { ImageUploader } from "./ImageUploader";
import type { ProductFormValues } from "./schema";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function ColorsImagesTab() {
  const { register, control, watch, setValue, formState } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "colors" });
  const images = watch("images");
  const [openPicker, setOpenPicker] = useState<number | null>(null);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <span className="text-xs uppercase tracking-widest2 text-obsidian/60">Product gallery</span>
        <div className="mt-2">
          <ImageUploader images={images} onChange={(next) => setValue("images", next, { shouldDirty: true })} />
        </div>
        {formState.errors.images && <p className="mt-1 text-xs text-red-600">{formState.errors.images.message}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest2 text-obsidian/60">Colors</span>
          <button
            type="button"
            onClick={() => append({ colorId: `color-${Date.now()}`, colorLabel: "", colorHex: "#121212" })}
            className="text-xs uppercase tracking-wide text-obsidian/70 hover:text-obsidian"
          >
            + Add color
          </button>
        </div>

        <div className="mt-3 space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-4 rounded border border-obsidian/10 p-4">
              <button
                type="button"
                onClick={() => setOpenPicker(openPicker === index ? null : index)}
                className="mt-1 h-8 w-8 shrink-0 rounded-full border border-obsidian/20"
                style={{ backgroundColor: watch(`colors.${index}.colorHex`) || "#121212" }}
              />
              <div className="flex-1 space-y-3">
                <input
                  {...register(`colors.${index}.colorLabel`, {
                    onChange: (e) =>
                      setValue(`colors.${index}.colorId`, slugify(e.target.value), { shouldDirty: true }),
                  })}
                  placeholder="Color name, e.g. Tortoise"
                  className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
                />
                {openPicker === index && (
                  <HexColorPicker
                    color={watch(`colors.${index}.colorHex`) || "#121212"}
                    onChange={(hex) => setValue(`colors.${index}.colorHex`, hex, { shouldDirty: true })}
                  />
                )}
                <ImageUploader
                  images={watch(`colors.${index}.colorImage`) ? [watch(`colors.${index}.colorImage`)!] : []}
                  onChange={(next) => setValue(`colors.${index}.colorImage`, next[0], { shouldDirty: true })}
                  multiple={false}
                />
              </div>
              <button type="button" onClick={() => remove(index)} className="text-obsidian/40 hover:text-red-600">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        {formState.errors.colors && (
          <p className="mt-2 text-xs text-red-600">{formState.errors.colors.message as string}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

Prerequisite: `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` must be set in `backend/.env` with real values from a Cloudinary account.

On `/admin/products/new`, go to Colors & Images: upload 2–3 gallery images (drag a couple of files onto "Add image" or click it and pick files) and confirm thumbnails appear with the first one labeled "Primary". Click "+ Add color", type a name, click the swatch circle to open the color picker and pick a hex value, and upload a single image for that color. Add a second color. Remove one gallery image and one color and confirm both disappear immediately.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/admin/_components/products/ImageUploader.tsx" "frontend/app/admin/_components/products/ColorsImagesTab.tsx" frontend/package.json frontend/package-lock.json
git commit -m "feat: implement product form Colors & Images tab with Cloudinary uploads"
```

---

### Task 23: Product form — Inventory tab (variant matrix)

**Files:**
- Create: `frontend/app/admin/_components/products/variantMatrix.ts`
- Modify: `frontend/app/admin/_components/products/InventoryTab.tsx` (replaces the Task 20 placeholder)

**Interfaces:**
- Produces: `buildVariantMatrix(colors, sizes, existing)` from `variantMatrix.ts` — pure function, reconciles the color/size selections made in Tasks 21–22 against any already-entered stock numbers, generating the grid `InventoryTab` renders.

- [ ] **Step 1: Write the matrix-building helper**

`frontend/app/admin/_components/products/variantMatrix.ts`:

```ts
import type { Variant } from "../../_lib/types";

export interface ColorInput {
  colorId: string;
  colorLabel: string;
  colorHex?: string;
  colorImage?: string;
}

export function deriveVariantId(colorId: string, sizeId?: string) {
  return sizeId ? `${colorId}--${sizeId}` : colorId;
}

export function buildVariantMatrix(
  colors: ColorInput[],
  sizes: string[],
  existing: Variant[]
): Variant[] {
  const existingById = new Map(existing.map((v) => [v.id, v]));
  const rows: Variant[] = [];

  colors.forEach((color) => {
    const sizeList = sizes.length > 0 ? sizes : [undefined];
    sizeList.forEach((sizeLabel) => {
      const sizeId = sizeLabel ? sizeLabel.toLowerCase() : undefined;
      const id = deriveVariantId(color.colorId, sizeId);
      const prior = existingById.get(id);
      rows.push({
        id,
        colorId: color.colorId,
        colorLabel: color.colorLabel,
        colorHex: color.colorHex,
        colorImage: color.colorImage,
        sizeId,
        sizeLabel,
        stock: prior?.stock ?? 0,
      });
    });
  });

  return rows;
}
```

This mirrors the backend's `deriveVariantId` (Task 4's `productStock.js`) so ids generated on the frontend match what the server recomputes on save.

- [ ] **Step 2: Build the real Inventory tab**

Replace `frontend/app/admin/_components/products/InventoryTab.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { buildVariantMatrix } from "./variantMatrix";
import type { ProductFormValues } from "./schema";

export function InventoryTab() {
  const { control, register, watch, setValue } = useFormContext<ProductFormValues>();
  const colors = useWatch({ control, name: "colors" });
  const clothingSize = useWatch({ control, name: "clothingSize" }) ?? [];
  const category = useWatch({ control, name: "category" });
  const variants = watch("variants");

  useEffect(() => {
    const validColors = colors.filter((c) => c.colorLabel.trim().length > 0);
    const sizes = category === "apparel" ? clothingSize : [];
    const next = buildVariantMatrix(validColors, sizes, variants);
    setValue("variants", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(colors), JSON.stringify(clothingSize), category]);

  const total = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  function setAll(value: number) {
    variants.forEach((_, i) => setValue(`variants.${i}.stock`, value));
  }

  if (variants.length === 0) {
    return (
      <p className="max-w-3xl text-sm text-obsidian/50">
        Add at least one color on the Colors & Images tab to build the inventory grid.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-obsidian">
          Total stock: <span className="font-medium">{total}</span>
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-obsidian/50">Set all to</span>
          <input
            type="number"
            min={0}
            className="w-16 rounded border border-obsidian/15 px-2 py-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setAll(Number((e.target as HTMLInputElement).value) || 0);
              }
            }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-obsidian/10">
        <table className="w-full text-sm">
          <thead className="border-b border-obsidian/10 bg-obsidian/[0.02] text-left text-xs uppercase tracking-wide text-obsidian/50">
            <tr>
              <th className="px-4 py-2">Color</th>
              {category === "apparel" && <th className="px-4 py-2">Size</th>}
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-obsidian/10">
            {variants.map((variant, index) => (
              <tr key={variant.id}>
                <td className="px-4 py-2 text-obsidian">{variant.colorLabel}</td>
                {category === "apparel" && <td className="px-4 py-2 text-obsidian/70">{variant.sizeLabel}</td>}
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    {...register(`variants.${index}.stock`)}
                    className="w-20 rounded border border-obsidian/15 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-2">
                  {Number(variant.stock) > 0 ? (
                    <span className="text-green-700">In stock</span>
                  ) : (
                    <span className="text-red-600">Out of stock</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

On `/admin/products/new`, go to Colors & Images and add two colors; if Category is Apparel, also select a couple of sizes on Attributes. Switch to Inventory — expect one row per color (eyewear) or per color×size (apparel), each with a numeric stock input defaulting to 0 and an "Out of stock" status. Type stock values into a few cells and confirm "Total stock" at the top updates live and each cell's status flips to "In stock" once its value is above 0. Go back to Colors & Images, add a third color, return to Inventory — confirm the new color's rows appear with stock 0 while the earlier rows keep the values you typed (reconciliation, not a reset).

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/admin/_components/products/variantMatrix.ts" "frontend/app/admin/_components/products/InventoryTab.tsx"
git commit -m "feat: implement product form Inventory tab with live variant matrix"
```

---

### Task 24: Product form — Cross-sell tab + edit route + final wiring

**Files:**
- Modify: `frontend/app/admin/_components/products/CrossSellTab.tsx` (replaces the Task 20 placeholder)
- Create: `frontend/app/admin/(dashboard)/products/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `GET /api/products/id/:id` (Task 6), `GET /api/products/admin` (Task 6), `ProductForm` (Task 20).
- This is the task where the full create AND edit flow becomes exercisable end-to-end for the first time.

- [ ] **Step 1: Build the real Cross-sell tab**

Replace `frontend/app/admin/_components/products/CrossSellTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormContext } from "react-hook-form";
import { api } from "../../_lib/api";
import type { AdminProduct, PaginatedResult } from "../../_lib/types";
import type { ProductFormValues } from "./schema";

export function CrossSellTab({ currentProductId }: { currentProductId?: string }) {
  const { watch, setValue } = useFormContext<ProductFormValues>();
  const [search, setSearch] = useState("");
  const selected = watch("pairsWith") ?? [];

  const { data } = useQuery({
    queryKey: ["admin-products", "cross-sell", search],
    queryFn: () => api.get<PaginatedResult<AdminProduct>>(`/products/admin?search=${search}&limit=20`),
  });

  const options = (data?.items ?? []).filter((p) => p._id !== currentProductId);

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    setValue("pairsWith", next, { shouldDirty: true });
  }

  return (
    <div className="max-w-3xl space-y-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products to pair with…"
        className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
      />
      <div className="divide-y divide-obsidian/10 rounded border border-obsidian/10">
        {options.map((product) => (
          <label
            key={product._id}
            className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-obsidian/[0.02]"
          >
            <input type="checkbox" checked={selected.includes(product._id)} onChange={() => toggle(product._id)} />
            {product.name}
          </label>
        ))}
        {options.length === 0 && <p className="px-4 py-3 text-sm text-obsidian/50">No products found.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the edit route**

`frontend/app/admin/(dashboard)/products/[id]/edit/page.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../_lib/api";
import type { AdminProduct } from "../../../../_lib/types";
import { ProductForm } from "../../../../_components/products/ProductForm";

export default function EditProductPage({ params }: { params: { id: string } }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-product", params.id],
    queryFn: () => api.get<AdminProduct>(`/products/id/${params.id}`),
  });

  if (isLoading) return <p className="text-sm text-obsidian/50">Loading…</p>;
  if (!data) return <p className="text-sm text-red-600">Product not found.</p>;

  return <ProductForm product={data} />;
}
```

- [ ] **Step 3: Verify the full flow manually**

Create flow: on `/admin/products/new`, fill in every tab (Details, Attributes, Colors & Images with at least one color and one gallery image, Inventory with some stock), leave Cross-sell as-is or pick a product, and click "Save product". Expect a success toast and a redirect to `/admin/products`, with the new product visible in the list showing the correct stock badge.

Edit flow: from the product list, click "Edit" on a seeded product (e.g. "The Aviator"). Expect all five tabs to be pre-populated with its existing data — its 3 colors on Colors & Images, its per-color stock split across the Inventory grid, its existing gallery images. Change a stock number, save, and confirm the list's stock badge/total updates to match.

Dashboard link: from `/admin/dashboard`'s "Needs attention" list, click a low/out-of-stock product — expect it to land on this same edit page with its Inventory tab data pre-filled.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/admin/_components/products/CrossSellTab.tsx" "frontend/app/admin/(dashboard)/products/[id]"
git commit -m "feat: implement product form Cross-sell tab and wire the edit route"
```

---

## Part E — Verification

### Task 25: Playwright end-to-end smoke test

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/admin-product.spec.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: the full running stack — backend on port 5000 (seeded per Task 11), frontend on port 3000. This is the plan's final task; it exercises everything built in Tasks 1–24 together.

- [ ] **Step 1: Install Playwright and its browser binary**

```bash
npm install -D @playwright/test -w frontend
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Add the config**

`frontend/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
});
```

Add to `frontend/package.json`'s `"scripts"`:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 3: Add a tiny fixture image**

`productFormSchema.images` (Task 20) requires at least one gallery image, so the create test needs to drive a real Cloudinary upload through `ImageUploader`'s file input. Place any small JPG (a few KB is fine — a solid-color square works) at `frontend/e2e/fixtures/test-product.jpg`.

- [ ] **Step 4: Write the smoke test**

`frontend/e2e/admin-product.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("admin product management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL || "admin@auraandoptic.com");
    await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD || "changeme123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/admin/dashboard");
  });

  test("creates a product with an image, a color, and stock, then it appears in the list", async ({ page }) => {
    await page.goto("/admin/products/new");

    await page.locator("#product-name").fill("E2E Test Frame");
    await page.locator("#product-subcategory").selectOption({ index: 1 });
    await page.locator("#product-description").fill("Created by the Playwright smoke test.");
    await page.locator("#product-price").fill("199");

    await page.getByRole("tab", { name: "Colors & Images" }).click();
    await page.setInputFiles('input[type="file"]', "e2e/fixtures/test-product.jpg");
    await expect(page.getByText("Primary")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "+ Add color" }).click();
    await page.getByPlaceholder("Color name, e.g. Tortoise").fill("Test Black");

    await page.getByRole("tab", { name: "Inventory" }).click();
    await page.locator('input[name="variants.0.stock"]').fill("5");

    await page.getByRole("button", { name: "Save product" }).click();
    await page.waitForURL("**/admin/products");

    await expect(page.getByText("E2E Test Frame")).toBeVisible();
  });

  test("marks a product out of stock from the list", async ({ page }) => {
    await page.goto("/admin/products");
    const row = page.locator("tr", { hasText: "E2E Test Frame" });
    await row.getByRole("button", { name: "Mark out of stock" }).click();
    await expect(row.getByText("0 in stock")).toBeVisible();
  });
});
```

- [ ] **Step 5: Run the test**

Prerequisites, in order:
1. `npm run seed -w backend` (Task 11) — ensures the admin user and sub-categories exist.
2. `npm run dev` from the repo root — starts both frontend (3000) and backend (5000).
3. `backend/.env` has real `CLOUDINARY_*` values (Task 8) — this test performs a real image upload.

Run: `npm run test:e2e -w frontend`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/playwright.config.ts frontend/e2e frontend/package.json frontend/package-lock.json
git commit -m "test: add Playwright smoke test for admin product create and stock actions"
```

---

## Plan Self-Review

**Spec coverage:** every Phase 1 item from the design spec maps to a task — admin shell/auth (12, 15, 16), Product CRUD (5, 20–24), Category CRUD (3, 18), Subcategory CRUD (2, 18), variant/stock restructure (4, 6, 7, 23), Cloudinary upload (8, 22), product list with filters (19), seed migration (10, 11), dashboard KPIs (17), testing strategy (1–11's Jest suite, 25's Playwright test).

**Type consistency check:** `Variant`/`AdminProduct`/`Subcategory`/`Category`/`PaginatedResult` (Task 14) are used with matching shapes in Tasks 17–24. `deriveVariantId` is implemented once server-side (Task 4, `productStock.js`) and mirrored client-side (Task 23, `variantMatrix.ts`) with the same `colorId--sizeId` format, so ids generated in the browser match what the server recomputes on save. `AttributesTab`/`ColorsImagesTab`/`InventoryTab`/`CrossSellTab({ currentProductId })` signatures are fixed in Task 20 and preserved exactly through Tasks 21–24.

**Known scope trims, called out explicitly rather than left as silent gaps:** no drag-to-reorder for gallery images or sub-category `sortOrder` (first-uploaded/first-added order stands in); native `confirm()` for delete confirmations instead of a Radix `AlertDialog`; no `DropdownMenu`/`Dialog` primitives (row actions are plain buttons/links); Task 25's test requires a real Cloudinary account (Task 8) and a locally-supplied fixture image (`frontend/e2e/fixtures/test-product.jpg`, not tracked by this plan) — both are one-time manual setup, not code gaps.

