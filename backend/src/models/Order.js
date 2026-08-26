const mongoose = require("mongoose");

/**
 * A line as it was bought. Deliberately a snapshot: name, image and price are
 * copied rather than referenced, so an order still reads correctly after the
 * product is renamed, re-shot, repriced or deleted.
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    image: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },

    // Identifies the exact stocked combination, matching Product.variants[].id.
    // Replaces the old colour/size pair, which assumed every product varied by
    // exactly those two things — untrue since jewellery and bags arrived.
    variantId: String,
    // Human-readable choices, e.g. { "Metal": "Rose Gold", "Length": "18 in" }.
    options: { type: Map, of: String, default: () => new Map() },
    // Non-stocked choices, e.g. { "Lens": "Polarised" }.
    selections: { type: Map, of: String, default: () => new Map() },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    region: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Optional: the storefront has no customer accounts, so orders are placed
    // as a guest. Kept as a reference for when accounts arrive, at which point
    // existing guest orders stay valid.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // How to reach the buyer. Required whether or not an account exists.
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true },
    },

    orderNumber: { type: String, required: true, unique: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: { type: String, enum: ["mobile_money", "card", "paystack"], default: "paystack" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },

    /**
     * Paystack's reference for the transaction that paid for this order — the
     * order number, so a payment in the Paystack dashboard can always be traced
     * back to an order here and vice versa.
     */
    paymentReference: { type: String },
    paidAt: { type: Date },

    // Always recomputed server-side from live product prices — never taken from
    // the client, which would let a buyer name their own total.
    itemsPrice: { type: Number, required: true },
    /**
     * The delivery charge agreed with the customer after the order is
     * confirmed. Null until then — the system never sets it, because what
     * delivery costs depends on where the piece is going. Null and 0 mean
     * different things: nothing agreed yet, versus agreed at no charge.
     */
    shippingPrice: { type: Number, default: null },
    totalPrice: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    trackingNumber: String,

    // Set when stock was decremented, so cancelling can return it exactly once.
    stockReleased: { type: Boolean, default: false },

    /**
     * Which emails this customer has already had. A double-click, a corrected
     * status, or a webhook retry must not tell someone twice that their order
     * has shipped — that reads as a shop that has lost track of itself.
     */
    notifications: {
      type: [
        {
          _id: false,
          event: { type: String, required: true },
          sentAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// The admin list sorts by recency and filters by status.
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "customer.email": 1 });

module.exports = mongoose.model("Order", orderSchema);
