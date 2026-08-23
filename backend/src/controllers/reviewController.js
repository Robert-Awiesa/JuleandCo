const asyncHandler = require("express-async-handler");
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { searchRegex } = require("../utils/searchRegex");

/**
 * Recomputes a product's rating from its approved reviews.
 *
 * The only place rating and reviewCount are ever written. They were previously
 * settable fields that nothing set, which is how a product could have claimed a
 * score nobody gave it. Called after anything that changes which reviews are
 * approved — writing one straight to the product would let the two drift.
 */
async function refreshProductRating(productId) {
  const [summary] = await Review.aggregate([
    { $match: { product: productId, status: "approved" } },
    { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } },
  ]);

  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        reviewCount: summary?.count || 0,
        // Unset rather than zero when nothing is approved: no reviews is not a
        // rating of nought, and a storefront showing 0/5 would be a slander.
        rating: summary ? Math.round(summary.average * 10) / 10 : null,
      },
    }
  );
}

// @desc    Approved reviews for a product
// @route   GET /api/products/:id/reviews
// @access  Public
const getProductReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find(
    { product: req.params.id, status: "approved" },
    // Email is never published.
    "author rating title body verifiedPurchase createdAt"
  )
    .sort({ createdAt: -1 })
    .lean();

  res.json(reviews);
});

// @desc    Leave a review
// @route   POST /api/products/:id/reviews
// @access  Public
const createReview = asyncHandler(async (req, res) => {
  const { author, email, rating, title, body } = req.body;

  const product = await Product.findById(req.params.id);
  if (!product || product.publishStatus !== "published") {
    res.status(404);
    throw new Error("Product not found");
  }

  if (!author || !email || !body) {
    res.status(400);
    throw new Error("A name, email address and review are all required");
  }

  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    res.status(400);
    throw new Error("Choose a rating between 1 and 5 stars");
  }

  const normalisedEmail = String(email).toLowerCase().trim();

  const already = await Review.findOne({ product: product._id, email: normalisedEmail });
  if (already) {
    res.status(400);
    throw new Error("You have already reviewed this piece");
  }

  // Verified against orders that were not cancelled, so a returned piece does
  // not carry the weight of a completed purchase.
  const bought = await Order.exists({
    "customer.email": normalisedEmail,
    "items.product": product._id,
    status: { $ne: "cancelled" },
  });

  await Review.create({
    product: product._id,
    author,
    email: normalisedEmail,
    rating: score,
    title,
    body,
    verifiedPurchase: Boolean(bought),
  });

  // Deliberately does not return the review: it is not public yet, and echoing
  // it back would suggest it is already on the page.
  res.status(201).json({
    message: "Thank you — your review will appear once it has been read.",
  });
});

// @desc    Reviews for moderation
// @route   GET /api/reviews
// @access  Private/Admin
const getReviews = asyncHandler(async (req, res) => {
  const { status = "pending", search, page = 1, limit = 25 } = req.query;

  const query = {};
  if (status && status !== "all") query.status = status;

  const rx = searchRegex(search);
  if (rx) query.$or = [{ author: rx }, { email: rx }, { title: rx }, { body: rx }];

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [items, total, pending] = await Promise.all([
    Review.find(query)
      // Pending oldest first — the one kept waiting longest. Everything else
      // newest first, which is how you read history.
      .sort(status === "pending" ? { createdAt: 1 } : { createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate("product", "name slug images")
      .lean(),
    Review.countDocuments(query),
    Review.countDocuments({ status: "pending" }),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / limitNum)),
    pending,
  });
});

// @desc    Approve or reject a review
// @route   PATCH /api/reviews/:id
// @access  Private/Admin
const moderateReview = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["approved", "rejected", "pending"].includes(status)) {
    res.status(400);
    throw new Error(`"${status}" is not a review status`);
  }

  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  review.status = status;
  await review.save();

  // Whatever just changed, the product's score follows from it.
  await refreshProductRating(review.product);

  res.json(review);
});

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private/Admin
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  const productId = review.product;
  await review.deleteOne();
  await refreshProductRating(productId);

  res.json({ message: "Review removed" });
});

module.exports = {
  getProductReviews,
  createReview,
  getReviews,
  moderateReview,
  deleteReview,
  refreshProductRating,
};
