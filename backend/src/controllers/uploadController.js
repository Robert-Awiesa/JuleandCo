const asyncHandler = require("express-async-handler");
const cloudinary = require("../config/cloudinary");

const DEFAULT_FOLDER = "jules-and-co/products";

/**
 * Where an upload may go.
 *
 * An allow-list rather than accepting whatever the client sends: product shots
 * and site imagery are different libraries, and mixing them means the product
 * form's "Reuse a shot" picker fills up with hero banners. A typo would also
 * scatter stray folders through Cloudinary that nothing ever cleans up.
 */
const FOLDERS = {
  products: "jules-and-co/products",
  content: "jules-and-co/content",
};

function resolveFolder(requested) {
  return FOLDERS[requested] || DEFAULT_FOLDER;
}

const signUpload = asyncHandler(async (req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = resolveFolder(req.body.folder);

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

// @desc    Recently uploaded images, so a shot can be reused rather than
//          uploaded again for every colourway that shares it
// @route   GET /api/uploads/recent
// @access  Private/Admin
const getRecentUploads = asyncHandler(async (req, res) => {
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 30));

  const { resources } = await cloudinary.api.resources({
    type: "upload",
    prefix: resolveFolder(req.query.folder),
    max_results: limit,
    // Newest first — the shot you want is almost always one you just made.
    direction: "desc",
  });

  res.json(
    (resources || []).map((r) => ({
      url: r.secure_url,
      publicId: r.public_id,
      width: r.width,
      height: r.height,
      createdAt: r.created_at,
    }))
  );
});

module.exports = { signUpload, getRecentUploads };
