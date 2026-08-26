const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const { buildOrderLines, reserveStock, releaseStock, orderTotal } = require("../utils/orderPricing");
const { searchRegex } = require("../utils/searchRegex");
const { notifyCustomer } = require("../utils/orderEmails");

/** JC for JULES & CO. Was AO-, left over from the Aura & Optic name. */
function generateOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `JC-${stamp}${random}`;
}

// @desc    Place an order
// @route   POST /api/orders
// @access  Public — the storefront has no customer accounts, so checkout is
//          guest-only. `user` is attached when a session happens to exist.
const createOrder = asyncHandler(async (req, res) => {
  const { items, customer, shippingAddress, paymentMethod } = req.body;

  if (!customer?.name || !customer?.email || !customer?.phone) {
    res.status(400);
    throw new Error("Name, email and phone are required to place an order");
  }
  if (!shippingAddress) {
    res.status(400);
    throw new Error("A shipping address is required");
  }

  // Prices come from the database, never from the request body.
  const priced = await buildOrderLines(items);
  if (priced.error) {
    res.status(400);
    throw new Error(priced.error);
  }

  // Hold the stock before writing the order, so a sell-out cannot produce an
  // order that can never be fulfilled.
  const reservation = await reserveStock(priced.lines);
  if (!reservation.ok) {
    res.status(409);
    throw new Error(reservation.error);
  }

  try {
    const order = await Order.create({
      user: req.user?._id,
      customer,
      orderNumber: generateOrderNumber(),
      items: priced.lines,
      shippingAddress,
      paymentMethod,
      itemsPrice: priced.itemsPrice,
      shippingPrice: priced.shippingPrice,
      totalPrice: priced.totalPrice,
    });

    res.status(201).json(order);
  } catch (err) {
    // The write failed after stock was taken; give it back rather than leaking it.
    await releaseStock(priced.lines);
    throw err;
  }
});

// @desc    List orders for the admin
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 25 } = req.query;

  const query = {};
  if (status && status !== "all") query.status = status;
  const rx = searchRegex(search);
  if (rx) {
    query.$or = [{ orderNumber: rx }, { "customer.name": rx }, { "customer.email": rx }];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(query),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

// @desc    Order counts and revenue for the dashboard
// @route   GET /api/orders/stats
// @access  Private/Admin
const getOrderStats = asyncHandler(async (req, res) => {
  // Month boundaries in the server's timezone. A lifetime revenue figure only
  // ever grows and stops telling you anything after the first year, so the
  // dashboard needs a period to compare against.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const live = { status: { $ne: "cancelled" } };
  const revenue = [{ $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } }];

  const [facets] = await Order.aggregate([
    {
      $facet: {
        totals: [{ $match: live }, ...revenue],
        thisMonth: [{ $match: { ...live, createdAt: { $gte: monthStart } } }, ...revenue],
        lastMonth: [
          { $match: { ...live, createdAt: { $gte: previousStart, $lt: monthStart } } },
          ...revenue,
        ],
        unfulfilled: [{ $match: { status: { $in: ["pending", "processing"] } } }, { $count: "n" }],
        /**
         * Orders with no delivery charge agreed yet. Delivery is settled with
         * the customer after confirmation, so this is a real queue — and one
         * nothing surfaced until now.
         */
        awaitingDelivery: [
          { $match: { ...live, shippingPrice: null } },
          { $count: "n" },
        ],
      },
    },
  ]);

  const empty = { orders: 0, revenue: 0 };
  const totals = facets?.totals?.[0] || empty;
  const thisMonth = facets?.thisMonth?.[0] || empty;
  const lastMonth = facets?.lastMonth?.[0] || empty;

  res.json({
    orders: totals.orders,
    revenue: totals.revenue,
    // Guarded: dividing by zero orders would return NaN and break the tile.
    averageOrderValue: totals.orders > 0 ? totals.revenue / totals.orders : 0,
    unfulfilled: facets?.unfulfilled?.[0]?.n || 0,
    awaitingDelivery: facets?.awaitingDelivery?.[0]?.n || 0,
    month: { orders: thisMonth.orders, revenue: thisMonth.revenue },
    lastMonth: { orders: lastMonth.orders, revenue: lastMonth.revenue },
  });
});

// @desc    Get logged-in user's orders
// @route   GET /api/orders/mine
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
});

// @desc    Get order by id
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Guest orders have no user, so ownership is only checkable for account
  // orders; everything else is admin-only.
  const isOwner = order.user && String(order.user._id) === String(req.user._id);
  if (!isOwner && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Not authorized to view this order");
  }

  res.json(order);
});

// @desc    Update order status (fulfilment / tracking)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, trackingNumber, shippingPrice } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Captured before anything changes, so the customer is only told about a
  // status that actually moved. Re-saving an order to set a delivery charge
  // must not re-announce a status it already had.
  const previousStatus = order.status;

  // Cancelling puts the stock back, once. Without the guard, cancelling an
  // already-cancelled order would inflate the catalogue.
  if (status === "cancelled" && order.status !== "cancelled" && !order.stockReleased) {
    await releaseStock(order.items);
    order.stockReleased = true;
  }

  if (status) order.status = status;
  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;

  /**
   * The delivery charge, once it has been agreed with the customer. The system
   * never works it out, so this is the only place it is ever set — and the
   * total has to move with it or the order says one thing and its lines another.
   */
  if (shippingPrice !== undefined) {
    const charge = shippingPrice === null || shippingPrice === "" ? null : Number(shippingPrice);

    if (charge !== null && (!Number.isFinite(charge) || charge < 0)) {
      res.status(400);
      throw new Error("A delivery charge has to be a number, and cannot be negative");
    }

    order.shippingPrice = charge;
    order.totalPrice = orderTotal(order.itemsPrice, charge);
  }

  const updated = await order.save();

  /**
   * The customer hears about it, once, and only when the status really changed.
   *
   * After the save on purpose: the admin's action must succeed whether or not a
   * mail provider is having a good minute, and notifyCustomer never throws.
   */
  if (status && status !== previousStatus) {
    await notifyCustomer(updated, status);
  }

  res.json(updated);
});

// @desc    Delete an order
// @route   DELETE /api/orders/:id
// @access  Private/Admin
const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Only a cancelled order can be removed. An order is a financial record and
  // a fulfilment promise; cancelling first is what returns the stock and leaves
  // a deliberate step between "I meant to tidy a test order" and losing a real
  // one. Test orders and mistakes go: cancel, then delete.
  if (order.status !== "cancelled") {
    res.status(400);
    throw new Error("Cancel this order before deleting it, so its stock is returned");
  }

  await order.deleteOne();
  res.json({ message: "Order removed" });
});

module.exports = {
  createOrder,
  deleteOrder,
  getOrders,
  getOrderStats,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
};
