const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const { searchRegex } = require("../utils/searchRegex");

/**
 * Customers, derived from the orders they placed.
 *
 * There is no Customer collection because checkout is guest-only: nobody
 * registers, so the only record of a person is the orders carrying their email.
 * Grouping those is the honest source — it cannot drift from what was actually
 * bought, and it needs no migration if accounts arrive later, at which point
 * this becomes a join rather than a rewrite.
 *
 * Email is the identity. A phone number changes and a name is typed differently
 * each time ("Adjoa M." / "adjoa m"), but the address a receipt goes to is the
 * one field a buyer has to get right.
 */

/** Cancelled orders are history, not custom. They count nothing towards spend. */
const LIVE = { $ne: "cancelled" };

// @desc    Everyone who has ordered, with what they are worth
// @route   GET /api/customers
// @access  Private/Admin
const getCustomers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 25, sort = "spent" } = req.query;

  const match = {};
  const rx = searchRegex(search);
  if (rx) {
    match.$or = [{ "customer.name": rx }, { "customer.email": rx }, { "customer.phone": rx }];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const sortStage =
    sort === "recent"
      ? { lastOrder: -1 }
      : sort === "orders"
        ? { orders: -1, spent: -1 }
        : { spent: -1, lastOrder: -1 };

  const [result] = await Order.aggregate([
    { $match: match },
    // Newest first, so $first below picks the most recent spelling of a name
    // and the address they last used.
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$customer.email",
        name: { $first: "$customer.name" },
        phone: { $first: "$customer.phone" },
        lastCity: { $first: "$shippingAddress.city" },
        lastRegion: { $first: "$shippingAddress.region" },
        orders: { $sum: 1 },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        spent: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$totalPrice"] },
        },
        items: {
          $sum: {
            $cond: [{ $eq: ["$status", "cancelled"] }, 0, { $sum: "$items.quantity" }],
          },
        },
        lastOrder: { $max: "$createdAt" },
        firstOrder: { $min: "$createdAt" },
      },
    },
    {
      $facet: {
        items: [
          { $sort: sortStage },
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
          { $project: { _id: 0, email: "$_id", name: 1, phone: 1, lastCity: 1, lastRegion: 1, orders: 1, cancelled: 1, spent: 1, items: 1, lastOrder: 1, firstOrder: 1 } },
        ],
        total: [{ $count: "n" }],
      },
    },
  ]);

  const total = result?.total?.[0]?.n || 0;

  res.json({
    items: result?.items || [],
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

// @desc    One customer, with every order they placed
// @route   GET /api/customers/:email
// @access  Private/Admin
const getCustomer = asyncHandler(async (req, res) => {
  const email = String(req.params.email || "").toLowerCase();

  const orders = await Order.find({ "customer.email": email }).sort({ createdAt: -1 }).lean();

  if (orders.length === 0) {
    res.status(404);
    throw new Error("No orders found for that email address");
  }

  const live = orders.filter((o) => o.status !== "cancelled");

  res.json({
    email,
    name: orders[0].customer.name,
    phone: orders[0].customer.phone,
    orders,
    summary: {
      orders: orders.length,
      cancelled: orders.length - live.length,
      spent: live.reduce((sum, o) => sum + (o.totalPrice || 0), 0),
      firstOrder: orders[orders.length - 1].createdAt,
      lastOrder: orders[0].createdAt,
    },
  });
});

// @desc    Headline customer figures for the dashboard
// @route   GET /api/customers/stats
// @access  Private/Admin
const getCustomerStats = asyncHandler(async (req, res) => {
  const [result] = await Order.aggregate([
    { $match: { status: LIVE } },
    { $group: { _id: "$customer.email", orders: { $sum: 1 }, spent: { $sum: "$totalPrice" } } },
    {
      $group: {
        _id: null,
        customers: { $sum: 1 },
        // Someone who has bought twice is the number worth watching: it is the
        // difference between a shop with traffic and a shop with custom.
        returning: { $sum: { $cond: [{ $gt: ["$orders", 1] }, 1, 0] } },
        spent: { $sum: "$spent" },
      },
    },
  ]);

  const customers = result?.customers || 0;

  res.json({
    customers,
    returning: result?.returning || 0,
    // Guarded: dividing by zero customers would return NaN and break the tile.
    averageSpend: customers > 0 ? (result?.spent || 0) / customers : 0,
  });
});

module.exports = { getCustomers, getCustomer, getCustomerStats };
