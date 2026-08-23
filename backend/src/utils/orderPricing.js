const Product = require("../models/Product");

/**
 * Order pricing and stock reservation.
 *
 * Prices are recomputed here from live product records. The previous version
 * stored whatever itemsPrice/shippingPrice/totalPrice the client posted, so a
 * buyer could have named their own total.
 *
 * **Delivery is not priced here, and not by the system at all.** It varies by
 * where a piece is going and is agreed with the customer once the order has
 * been confirmed. An order is therefore created with no delivery charge —
 * `shippingPrice: null`, meaning "not yet agreed", which is a different thing
 * from an agreed charge of zero — and the admin records what was settled.
 * Quoting a figure the shop had not agreed to would be worse than quoting
 * nothing.
 */

/**
 * What an order comes to once a delivery charge has been agreed. Kept here so
 * the create path and the admin's later edit compute the total the same way.
 */
function orderTotal(itemsPrice, shippingPrice) {
  return round(Number(itemsPrice) + Number(shippingPrice || 0));
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

  return {
    lines,
    itemsPrice,
    // Null rather than 0: nothing has been agreed yet.
    shippingPrice: null,
    totalPrice: itemsPrice,
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
  orderTotal,
};
