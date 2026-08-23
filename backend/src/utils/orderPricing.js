const Product = require("../models/Product");

/**
 * Order pricing and stock reservation.
 *
 * Prices are recomputed here from live product records. The previous version
 * stored whatever itemsPrice/shippingPrice/totalPrice the client posted, so a
 * buyer could have named their own total.
 *
 * TODO(settings): these two constants are duplicated in the storefront's
 * checkout page. Phase 5 moves them into store settings so there is one source.
 */
const FREE_SHIPPING_THRESHOLD = 1000;
const FLAT_SHIPPING_RATE = 45;

function calculateShipping(itemsPrice) {
  if (itemsPrice <= 0) return 0;
  return itemsPrice >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_RATE;
}

/** Money is stored in major units, so round to cents to avoid float drift. */
const round = (n) => Math.round(n * 100) / 100;

/**
 * Turns the cart the browser posted into priced order lines, using the server's
 * copy of each product. Rejects anything unbuyable rather than silently
 * dropping it — a customer should never be charged for a subset of their cart.
 */
async function buildOrderLines(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return { error: "No order items provided" };
  }

  const ids = [...new Set(cartItems.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = [];

  for (const item of cartItems) {
    const product = byId.get(String(item.productId));
    if (!product) return { error: "A product in your cart is no longer available" };

    if (product.publishStatus !== "published") {
      return { error: `"${product.name}" is no longer available` };
    }

    const quantity = Math.floor(Number(item.quantity) || 0);
    if (quantity < 1) return { error: `Invalid quantity for "${product.name}"` };

    // A product with no options still has a single "default" variant.
    const variantId = item.variantId || "default";
    const variant = (product.variants || []).find((v) => v.id === variantId);
    if (!variant) return { error: `That option of "${product.name}" is no longer available` };

    if ((variant.stock || 0) < quantity) {
      return {
        error:
          (variant.stock || 0) === 0
            ? `"${product.name}" has just sold out`
            : `Only ${variant.stock} of "${product.name}" left`,
      };
    }

    lines.push({
      product: product._id,
      name: product.name,
      // Snapshot the price from the database, not from the browser.
      price: product.price,
      image: (product.images || [])[0],
      quantity,
      variantId,
      options: item.options || {},
      selections: item.selections || {},
    });
  }

  const itemsPrice = round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
  const shippingPrice = calculateShipping(itemsPrice);

  return {
    lines,
    itemsPrice,
    shippingPrice,
    totalPrice: round(itemsPrice + shippingPrice),
  };
}

/**
 * Decrements stock one product at a time.
 *
 * Each update is a single atomic document write guarded by `stock: { $gte }`,
 * so two shoppers racing for the last piece cannot both win — no transaction
 * needed, which matters because the test suite runs on a standalone mongod that
 * does not support them.
 *
 * A guard failing part-way means the earlier decrements must be undone, or the
 * catalogue silently loses stock for an order that was never placed.
 */
async function reserveStock(lines) {
  const applied = [];

  for (const line of lines) {
    const result = await Product.updateOne(
      {
        _id: line.product,
        variants: { $elemMatch: { id: line.variantId, stock: { $gte: line.quantity } } },
      },
      {
        $inc: {
          "variants.$[v].stock": -line.quantity,
          // Product.stock is normally recomputed by a pre-save hook, which does
          // not run on updateOne, so the rollup is adjusted in the same write.
          stock: -line.quantity,
        },
      },
      { arrayFilters: [{ "v.id": line.variantId }] }
    );

    if (result.modifiedCount !== 1) {
      await releaseStock(applied);
      return { ok: false, error: `"${line.name}" sold out while you were checking out` };
    }

    applied.push(line);
  }

  return { ok: true };
}

/** Returns stock to the catalogue — used to roll back and to cancel an order. */
async function releaseStock(lines) {
  for (const line of lines) {
    await Product.updateOne(
      { _id: line.product, "variants.id": line.variantId },
      {
        $inc: {
          "variants.$[v].stock": line.quantity,
          stock: line.quantity,
        },
      },
      { arrayFilters: [{ "v.id": line.variantId }] }
    );
  }
}

module.exports = {
  buildOrderLines,
  reserveStock,
  releaseStock,
  calculateShipping,
  FREE_SHIPPING_THRESHOLD,
  FLAT_SHIPPING_RATE,
};
