const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");
const Subcategory = require("../models/Subcategory");
const Category = require("../models/Category");
const Attribute = require("../models/Attribute");
const Order = require("../models/Order");
const Review = require("../models/Review");
const AttributeGroup = require("../models/AttributeGroup");
const { toPublicProduct } = require("../utils/publicProduct");
const { buildCatalogContext } = require("../utils/catalogContext");
const { publishBlockers, describeBlockers } = require("../utils/productReadiness");
const { searchRegex } = require("../utils/searchRegex");

/** Reserved query params that are not attribute filters. */
const NON_ATTRIBUTE_PARAMS = new Set([
  "category",
  "subCategory",
  "minPrice",
  "maxPrice",
  "search",
  "sort",
  "page",
  "limit",
]);

const csv = (v) => String(v).split(",").filter(Boolean);

/**
 * Builds the attribute part of a product query from whatever filterable groups
 * exist. This replaced a hand-written `if (frameShape) … if (fabric) …` block,
 * which meant every new filter was a code change in this file plus four others.
 */
async function buildAttributeFilters(query) {
  const groups = await AttributeGroup.find({ showInFilters: true }, "key").lean();
  const filters = {};

  groups.forEach(({ key }) => {
    const value = query[key];
    if (!value || NON_ATTRIBUTE_PARAMS.has(key)) return;
    // $in matches scalars and array members alike, so multiselect groups
    // (lens options, sizes offered) need no special handling.
    filters[`attributes.${key}`] = { $in: csv(value) };
  });

  return filters;
}

/**
 * Refuses a write that would put an incomplete product on the storefront.
 * Saving as a draft is always allowed — the point is to catch the problem at
 * the moment of publishing, not to stop work in progress being saved.
 */
function assertPublishable(res, product) {
  if (product.publishStatus !== "published") return;

  const blockers = publishBlockers(product);
  if (blockers.length === 0) return;

  res.status(400);
  const error = new Error(describeBlockers(blockers));
  error.blockers = blockers;
  throw error;
}

/**
 * Refuses to put a product on the shop under a category that has been retired.
 *
 * Retiring a category is how a whole line is taken off sale — apparel, here.
 * Nothing enforced it: the products stayed drafts by convention, and publishing
 * one would have put a retired line back on the storefront. Worse, the
 * dashboard's "ready to publish" list was cheerfully offering all seven of them.
 */
async function assertCategoryActive(res, product) {
  if (product.publishStatus !== "published") return;

  const category = await Category.findOne({ slug: product.category }, "name isActive").lean();
  if (category && category.isActive === false) {
    res.status(400);
    throw new Error(
      `${category.name} has been retired, so its products cannot go on the shop. ` +
        `Reactivate the category under Categories, or move this piece to another one.`
    );
  }
}

/**
 * Refuses attribute values that do not belong to the product's category.
 *
 * The admin form only draws the groups bound to a category, so this cannot be
 * reached by using the interface — but nothing stopped a value arriving another
 * way, and once stored it would sit on the product invisibly, count towards a
 * facet, and never be editable from the form that refuses to show it.
 *
 * "Designed For" is the case that prompted it: the house is a women's shop and
 * frames are the one line where a men's cut is meaningful, so the group is
 * bound to eyewear. A jewellery piece carrying it is not a preference, it is a
 * mistake nobody can see.
 */
async function assertAttributesBelong(res, product) {
  const attributes = product.attributes instanceof Map
    ? Object.fromEntries(product.attributes)
    : product.attributes;

  const keys = Object.keys(attributes || {}).filter((k) => {
    const v = attributes[k];
    return Array.isArray(v) ? v.length > 0 : v !== "" && v !== null && v !== undefined;
  });
  if (keys.length === 0) return;

  const groups = await AttributeGroup.find({ key: { $in: keys } }, "key label categories").lean();

  const wrong = groups.filter(
    (g) => g.categories?.length && !g.categories.includes(product.category)
  );

  if (wrong.length > 0) {
    const category = await Category.findOne({ slug: product.category }, "name").lean();
    res.status(400);
    throw new Error(
      `${wrong.map((g) => `"${g.label}"`).join(", ")} ${wrong.length === 1 ? "does" : "do"} not apply to ${category?.name || product.category}. ` +
        `Clear ${wrong.length === 1 ? "it" : "them"} before saving.`
    );
  }
}

/**
 * Category and sub-category are validated here rather than by a schema enum.
 * The enum was a hard write gate that made adding a category a code change.
 */
async function assertValidCategorisation(categorySlug, subCategorySlug) {
  // Absent is a different problem from wrong, and said "undefined is not a
  // known category" before — which reads as a bug rather than a missing field.
  if (!categorySlug) {
    const error = new Error("Choose a category on the Details tab");
    error.statusCode = 400;
    throw error;
  }

  const category = await Category.findOne({ slug: categorySlug });
  if (!category) {
    const error = new Error(`"${categorySlug}" is not a known category`);
    error.statusCode = 400;
    throw error;
  }

  if (!subCategorySlug) {
    const error = new Error(`Choose a sub-category for ${category.name}`);
    error.statusCode = 400;
    throw error;
  }

  const subcategory = await Subcategory.findOne({
    slug: subCategorySlug,
    categoryType: categorySlug,
  });
  if (!subcategory) {
    const error = new Error(
      `"${subCategorySlug}" is not a valid sub-category for "${category.name}"`
    );
    error.statusCode = 400;
    throw error;
  }
}

// @desc    Get products with optional multi-facet filtering
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const { category, subCategory, minPrice, maxPrice, search, sort } = req.query;

  // Draft products must never reach the storefront, and neither must a line
  // whose category has been retired — belt and braces against data written
  // before the publish gate learned about retirement.
  const activeSlugs = (await Category.find({ isActive: true }, "slug").lean()).map((c) => c.slug);
  const query = { publishStatus: "published", category: { $in: activeSlugs } };

  // Narrowed to the one asked for, but only if it is still on sale — assigning
  // the slug straight over the top would have let a retired line be browsed by
  // typing its name into the URL.
  if (category && category !== "all") {
    query.category = activeSlugs.includes(category) ? category : "__retired__";
  }
  if (subCategory) query.subCategory = { $in: csv(subCategory) };

  // Partial matches, so a shopper typing "avia" sees The Aviator rather than
  // an empty shop. $text could only match whole words.
  const searchRx = searchRegex(search);
  if (searchRx) {
    query.$or = [
      { name: searchRx },
      { tags: searchRx },
      { subCategory: searchRx },
      { description: searchRx },
    ];
  }

  Object.assign(query, await buildAttributeFilters(req.query));

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  let sortOption = { createdAt: -1 };
  if (sort === "price-asc") sortOption = { price: 1 };
  if (sort === "price-desc") sortOption = { price: -1 };
  if (sort === "new") sortOption = { isNewArrival: -1, createdAt: -1 };
  if (sort === "bestseller") sortOption = { isBestSeller: -1, createdAt: -1 };

  const [products, context] = await Promise.all([
    Product.find(query).sort(sortOption),
    buildCatalogContext(),
  ]);

  res.json(products.map((p) => toPublicProduct(p, context.forProduct(p))));
});

// @desc    Get single product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    slug: req.params.slug,
    publishStatus: "published",
  });

  // A retired category is off sale, so its pieces are not reachable by URL
  // either — otherwise an old link would still sell something withdrawn.
  const category = product
    ? await Category.findOne({ slug: product.category }, "isActive").lean()
    : null;

  if (!product || category?.isActive === false) {
    res.status(404);
    throw new Error("Product not found");
  }

  // "Complete the Look" needs whole products, not just ids — and a paired
  // product that has since been unpublished must not surface.
  const [related, context] = await Promise.all([
    Product.find({ _id: { $in: product.pairsWith || [] }, publishStatus: "published" }),
    buildCatalogContext(),
  ]);

  res.json({
    ...toPublicProduct(product, context.forProduct(product)),
    related: related.map((p) => toPublicProduct(p, context.forProduct(p))),
  });
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  try {
    await assertValidCategorisation(req.body.category, req.body.subCategory);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  assertPublishable(res, req.body);
  await assertCategoryActive(res, req.body);
  await assertAttributesBelong(res, req.body);

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
    try {
      await assertValidCategorisation(nextCategory, nextSubCategory);
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
  }

  Object.assign(product, req.body, { category: nextCategory, subCategory: nextSubCategory });

  // Checked after the merge, not against the request body: a patch that only
  // flips publishStatus has to be judged on the product it produces.
  assertPublishable(res, product);
  await assertCategoryActive(res, product);
  await assertAttributesBelong(res, product);

  const updated = await product.save();
  res.json(updated);
});

// @desc    Copy a product as a new draft
// @route   POST /api/products/:id/duplicate
// @access  Private/Admin
const duplicateProduct = asyncHandler(async (req, res) => {
  const source = await Product.findById(req.params.id).lean();
  if (!source) {
    res.status(404);
    throw new Error("Product not found");
  }

  const { _id, createdAt, updatedAt, __v, ...rest } = source;

  const copy = await Product.create({
    ...rest,
    name: `${source.name} (copy)`,
    slug: await uniqueSlug(source.slug),
    // Always a draft: a copy is a starting point, and publishing it unedited
    // would put a duplicate listing on the storefront.
    publishStatus: "draft",
    // Stock and barcodes belong to the original piece, not to its copy.
    variants: (source.variants || []).map(({ _id, ...v }) => ({ ...v, stock: 0, sku: undefined })),
    options: (source.options || []).map(({ _id, ...o }) => o),
    stock: 0,
    barcode: undefined,
  });

  res.status(201).json(copy);
});

/** Appends -copy, then -copy-2, -copy-3… until the slug is free. */
async function uniqueSlug(base) {
  const candidate = `${base}-copy`;
  if (!(await Product.exists({ slug: candidate }))) return candidate;

  for (let n = 2; n < 100; n += 1) {
    const next = `${candidate}-${n}`;
    if (!(await Product.exists({ slug: next }))) return next;
  }
  return `${candidate}-${Date.now()}`;
}

// @desc    Apply one action to several products at once
// @route   PATCH /api/products/bulk
// @access  Private/Admin
const bulkUpdateProducts = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error("Select at least one product");
  }

  if (action === "unpublish") {
    const { modifiedCount } = await Product.updateMany(
      { _id: { $in: ids } },
      { $set: { publishStatus: "draft" } }
    );
    return res.json({ updated: modifiedCount, skipped: [] });
  }

  if (action === "outOfStock") {
    // Zeroes every variant and the rollup in one pass. $[] is the all-positional
    // operator, so this works whatever axes a product has.
    const { modifiedCount } = await Product.updateMany(
      { _id: { $in: ids } },
      { $set: { "variants.$[].stock": 0, stock: 0 } }
    );
    return res.json({ updated: modifiedCount, skipped: [] });
  }

  if (action === "publish") {
    const products = await Product.find({ _id: { $in: ids } });

    // Publishing in bulk must apply the same rules as publishing one at a time,
    // otherwise select-all becomes a way to put broken cards on the storefront.
    // Retired categories are off sale, so their products cannot be published
    // one at a time or fifty at a time.
    const retired = new Set(
      (await Category.find({ isActive: false }, "slug").lean()).map((c) => c.slug)
    );

    const ready = [];
    const skipped = [];
    for (const product of products) {
      const blockers = publishBlockers(product);
      if (retired.has(product.category)) {
        skipped.push({
          id: String(product._id),
          name: product.name,
          blockers: [{ id: "category", label: "An active category", reason: "Its category is retired" }],
        });
      } else if (blockers.length === 0) ready.push(product._id);
      else skipped.push({ id: String(product._id), name: product.name, blockers });
    }

    const { modifiedCount } = ready.length
      ? await Product.updateMany({ _id: { $in: ready } }, { $set: { publishStatus: "published" } })
      : { modifiedCount: 0 };

    return res.json({ updated: modifiedCount, skipped });
  }

  res.status(400);
  throw new Error(`Unknown bulk action "${action}"`);
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
/**
 * What else in the system points at this product.
 *
 * Three things do — order lines, reviews, and other products' cross-sell lists
 * — and deleting used to ignore all of them. Counting first is what lets the
 * admin be told what they are about to break, instead of finding out later.
 */
async function productUsage(productId) {
  const [orders, reviews, pairedWith] = await Promise.all([
    Order.countDocuments({ "items.product": productId }),
    Review.countDocuments({ product: productId }),
    Product.countDocuments({ pairsWith: productId }),
  ]);
  return { orders, reviews, pairedWith };
}

// @desc    What references this product, before deciding to delete it
// @route   GET /api/products/:id/usage
// @access  Private/Admin
const getProductUsage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id, "name publishStatus");
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const usage = await productUsage(product._id);

  res.json({
    ...usage,
    name: product.name,
    // Deleting something that has been sold destroys the link between an order
    // and what it was for. Unpublishing keeps the record and takes it off the
    // shop, which is what is almost always wanted.
    canDelete: usage.orders === 0,
  });
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const usage = await productUsage(product._id);

  /**
   * An ordered product is a business record. The order line snapshots its name
   * and price so a receipt still reads correctly, but deleting severs the link
   * to what was actually sold — and that is not recoverable. Unpublishing takes
   * it off the shop and keeps the history.
   */
  if (usage.orders > 0) {
    res.status(400);
    throw new Error(
      `"${product.name}" appears in ${usage.orders} ${usage.orders === 1 ? "order" : "orders"} and cannot be deleted. ` +
        `Set it to Draft instead — it comes off the shop and the order history stays intact.`
    );
  }

  // Nothing may be left pointing at a product that no longer exists.
  await Promise.all([
    Review.deleteMany({ product: product._id }),
    Product.updateMany({ pairsWith: product._id }, { $pull: { pairsWith: product._id } }),
  ]);

  await product.deleteOne();

  res.json({
    message: "Product removed",
    alsoRemoved: { reviews: usage.reviews, crossSellLinks: usage.pairedWith },
  });
});

// @desc    Catalogue figures and what needs doing about it
// @route   GET /api/products/stats
// @access  Private/Admin
const getProductStats = asyncHandler(async (req, res) => {
  /**
   * Counted by the database rather than by fetching the catalogue and counting
   * in the browser, which is what the dashboard used to do. That worked at two
   * dozen products; past the page limit the totals silently went wrong, and it
   * sent the whole catalogue over the wire to produce four numbers.
   *
   * Live and draft are separated because it is the distinction that matters
   * most: "24 products" reads as a shop with 24 things in it, when 11 of them
   * are invisible to customers.
   */
  const [figures] = await Product.aggregate([
    {
      $facet: {
        counts: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              published: {
                $sum: { $cond: [{ $eq: ["$publishStatus", "published"] }, 1, 0] },
              },
            },
          },
        ],
        // Out of stock matters most for published pieces: those are on the shop
        // right now, visible and unbuyable.
        stock: [
          { $match: { publishStatus: "published" } },
          {
            $group: {
              _id: null,
              outOfStock: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
              lowStock: {
                $sum: {
                  $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", 5] }] }, 1, 0],
                },
              },
            },
          },
        ],
        value: [
          {
            $group: {
              _id: null,
              retail: { $sum: { $multiply: ["$price", "$stock"] } },
              // What the stock actually cost, where a cost price is recorded.
              cost: { $sum: { $multiply: [{ $ifNull: ["$costPrice", 0] }, "$stock"] } },
              withCost: { $sum: { $cond: [{ $gt: ["$costPrice", 0] }, 1, 0] } },
            },
          },
        ],
      },
    },
  ]);

  const counts = figures?.counts?.[0] || { total: 0, published: 0 };
  const stock = figures?.stock?.[0] || { outOfStock: 0, lowStock: 0 };
  const value = figures?.value?.[0] || { retail: 0, cost: 0, withCost: 0 };

  res.json({
    total: counts.total,
    published: counts.published,
    drafts: counts.total - counts.published,
    outOfStock: stock.outOfStock,
    lowStock: stock.lowStock,
    retailValue: Math.round(value.retail * 100) / 100,
    costValue: Math.round(value.cost * 100) / 100,
    // So the admin knows the cost figure only covers part of the catalogue.
    productsWithCost: value.withCost,
  });
});

// @desc    The products actually needing work, with the reason
// @route   GET /api/products/attention
// @access  Private/Admin
const getProductsNeedingAttention = asyncHandler(async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 6));
  // category is needed to tell whether a draft belongs to a retired line.
  const fields = "name slug stock images publishStatus category subCategory options variants price";

  const [soldOut, running, drafts, live] = await Promise.all([
    Product.find({ publishStatus: "published", stock: { $lte: 0 } }, fields).limit(limit).lean(),
    Product.find({ publishStatus: "published", stock: { $gt: 0, $lte: 5 } }, fields)
      .sort({ stock: 1 })
      .limit(limit)
      .lean(),
    // Bounded: readiness is JS logic, so a handful of candidates are judged
    // rather than the whole catalogue.
    Product.find({ publishStatus: "draft" }, fields).sort({ updatedAt: -1 }).limit(50).lean(),
    Product.find({ publishStatus: "published" }, fields).sort({ updatedAt: -1 }).limit(50).lean(),
  ]);

  const items = [];

  soldOut.forEach((p) =>
    items.push({ ...p, reason: "outOfStock", detail: "On the shop but sold out" })
  );
  running.forEach((p) =>
    items.push({ ...p, reason: "lowStock", detail: `Only ${p.stock} left` })
  );

  // A draft with nothing blocking it is a piece that could be earning — unless
  // its category has been retired, in which case offering it invites relisting
  // a line that was deliberately taken off sale.
  const retiredSlugs = new Set(
    (await Category.find({ isActive: false }, "slug").lean()).map((c) => c.slug)
  );

  drafts
    .filter((p) => !retiredSlugs.has(p.category) && publishBlockers(p).length === 0)
    .slice(0, limit)
    .forEach((p) => items.push({ ...p, reason: "readyToPublish", detail: "Ready to go live" }));

  // Should not happen — the publish gate refuses it — but data predating the
  // gate, or written directly, would show here rather than break a shop page.
  live
    .map((p) => ({ product: p, blockers: publishBlockers(p) }))
    .filter(({ blockers }) => blockers.length > 0)
    .slice(0, limit)
    .forEach(({ product, blockers }) =>
      items.push({
        ...product,
        reason: "incomplete",
        detail: `Live but missing ${blockers.map((b) => b.label.toLowerCase()).join(", ")}`,
      })
    );

  res.json(items);
});

// @desc    Get paginated/filterable product list for the admin dashboard
// @route   GET /api/products/admin
// @access  Private/Admin
const getAdminProducts = asyncHandler(async (req, res) => {
  const {
    category,
    subCategory,
    stockStatus,
    publishStatus,
    search,
    sort = "newest",
    page = 1,
    limit = 20,
  } = req.query;
  const query = {};

  if (category && category !== "all") query.category = category;
  if (subCategory) query.subCategory = subCategory;
  if (publishStatus && publishStatus !== "all") query.publishStatus = publishStatus;
  const rx = searchRegex(search);
  if (rx) {
    query.$or = [{ name: rx }, { slug: rx }, { tags: rx }, { barcode: rx }, { "variants.sku": rx }];
  }
  if (stockStatus === "out") query.stock = 0;
  if (stockStatus === "low") query.stock = { $gt: 0, $lte: 5 };
  if (stockStatus === "in") query.stock = { $gt: 5 };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));

  // Newest-first was hardcoded, so "what is running lowest" or "what is my
  // dearest piece" meant reading the list a page at a time.
  const SORTS = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name: { name: 1 },
    "price-asc": { price: 1 },
    "price-desc": { price: -1 },
    "stock-asc": { stock: 1 },
    "stock-desc": { stock: -1 },
  };

  const [found, total] = await Promise.all([
    Product.find(query)
      .sort(SORTS[sort] || SORTS.newest)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(query),
  ]);

  // What is stopping each one going live, so a draft row can say why rather
  // than making someone open it to find out.
  const items = found.map((product) => ({
    ...product,
    blockers: publishBlockers(product).map((b) => b.label),
  }));

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

// @desc    Filter facets actually present in the published catalogue
// @route   GET /api/products/facets
// @access  Public
const getProductFacets = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const match = { publishStatus: "published" };
  if (category && category !== "all") match.category = category;

  // Which groups to aggregate is now read from the data, so a new facet needs
  // no aggregation edit here.
  const filterGroups = await AttributeGroup.find({ showInFilters: true }).lean();
  const applicable = filterGroups.filter(
    (g) => !category || category === "all" || !g.categories?.length || g.categories.includes(category)
  );

  /**
   * One sub-pipeline per group, so every option comes back with how many
   * products carry it. $addToSet alone gave distinct values but no counts,
   * which is what the navigation needs to show "Aviator (3)".
   *
   * $unwind handles both shapes a value can take: multiselect groups store an
   * array, single-select groups store a scalar, and Mongo treats a non-array
   * as a one-element array here. Documents missing the field drop out, which
   * is what we want.
   */
  const facetStage = {
    subCategory: [{ $group: { _id: "$subCategory", n: { $sum: 1 } } }],
    priceBounds: [{ $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }],
  };
  applicable.forEach((group) => {
    facetStage[group.key] = [
      { $unwind: `$attributes.${group.key}` },
      { $group: { _id: `$attributes.${group.key}`, n: { $sum: 1 } } },
    ];
  });

  const [raw = {}] = await Product.aggregate([{ $match: match }, { $facet: facetStage }]);

  // Drops the nulls left by products that never set the attribute.
  const buckets = (key) =>
    (raw[key] || []).filter((b) => b._id !== null && b._id !== undefined && b._id !== "");

  const usedValues = applicable.flatMap((g) => buckets(g.key).map((b) => b._id));
  const attributes = usedValues.length
    ? await Attribute.find({ value: { $in: usedValues } }).lean()
    : [];

  // Callers read groups.<key>, so an empty catalogue must still return every key.
  const groups = Object.fromEntries(applicable.map((g) => [g.key, []]));
  const counts = {};

  applicable.forEach((group) => {
    const rows = buckets(group.key);
    counts[group.key] = Object.fromEntries(rows.map((b) => [b._id, b.n]));

    groups[group.key] = rows
      .map((b) => {
        const attr = attributes.find((a) => a.group === group.key && a.value === b._id);
        return {
          value: b._id,
          label: attr ? attr.label : String(b._id),
          hex: attr ? attr.hex : undefined,
          count: b.n,
          sortOrder: attr ? attr.sortOrder : 0,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  });

  const subCategoryRows = buckets("subCategory");
  counts.subCategory = Object.fromEntries(subCategoryRows.map((b) => [b._id, b.n]));

  const price = (raw.priceBounds || [])[0] || {};

  /**
   * The same counts again, split by category.
   *
   * The mega menu's links are category-scoped — "Eyewear › Men" filters to
   * eyewear *and* men's — but the count beside them read the global figure. A
   * men's jewellery piece therefore rendered "Men (1)" under Eyewear and gave
   * an empty shop when clicked: the number promised something the link could
   * not deliver.
   *
   * Skipped when the caller already asked for one category, since `counts` is
   * then scoped to it anyway.
   */
  let countsByCategory;
  if (!category || category === "all") {
    const perCategory = await Product.aggregate([
      { $match: { publishStatus: "published" } },
      {
        $facet: {
          // Sub-category belongs here too. Leaving it out made every
          // sub-category link in the menu read zero while returning products,
          // because the lookup found no table for it and fell back to a zero.
          subCategory: [
            {
              $group: {
                _id: { category: "$category", value: "$subCategory" },
                n: { $sum: 1 },
              },
            },
          ],
          ...Object.fromEntries(
            applicable.map((group) => [
              group.key,
              [
                { $unwind: `$attributes.${group.key}` },
                {
                  $group: {
                    _id: { category: "$category", value: `$attributes.${group.key}` },
                    n: { $sum: 1 },
                  },
                },
              ],
            ])
          ),
        },
      },
    ]);

    countsByCategory = {};
    [{ key: "subCategory" }, ...applicable].forEach((group) => {
      ((perCategory[0] || {})[group.key] || []).forEach(({ _id, n }) => {
        if (_id?.value === null || _id?.value === undefined || _id?.value === "") return;
        countsByCategory[_id.category] ||= {};
        countsByCategory[_id.category][group.key] ||= {};
        countsByCategory[_id.category][group.key][_id.value] = n;
      });
    });
  }

  res.json({
    groups,
    // Lets the storefront render a facet it has never heard of, with the right
    // title and control style, without a matching JSX block being added.
    groupMeta: applicable
      .map(({ key, label, filterStyle, sortOrder }) => ({ key, label, filterStyle, sortOrder }))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    subCategories: subCategoryRows.map((b) => b._id).sort(),
    // value -> product count, keyed by group. Consumed by the navigation, which
    // needs a number per link without re-deriving it from `groups`.
    counts,
    // counts, narrowed by category, so a category-scoped link can show the
    // number it will actually deliver.
    countsByCategory,
    priceBounds: [price.min ?? 0, price.max ?? 0],
  });
});

module.exports = {
  getProducts,
  getProductFacets,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  bulkUpdateProducts,
  getAdminProducts,
  getProductUsage,
  getProductStats,
  getProductsNeedingAttention,
  getAdminProductById,
  updateProductStock,
};
