const mongoose = require("mongoose");

/**
 * Editorial content the storefront renders, one document per slot.
 *
 * Deliberately one collection rather than a model per block. The shapes differ
 * (a list of slides, a footer object, a nested menu), but the operations never
 * do — read one, write one, all by slot key. Six bespoke models would have been
 * six controllers, six routes and six admin pages for what is one CRUD.
 *
 * `data` is Mixed because each slot's shape is declared in
 * utils/contentSlots.js, which validates every write. Putting the shape in a
 * schema instead would mean a code change and a deploy to add a field to the
 * footer — the same trap the category enum was.
 */
const siteContentSchema = new mongoose.Schema(
  {
    slot: { type: String, required: true, unique: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    // Who last touched it, for the "last edited" line in the admin.
    updatedBy: { type: String },
  },
  {
    timestamps: true,
    // Without this Mongoose strips empty objects and arrays before saving, so
    // clearing every testimonial would leave the previous list in place.
    minimize: false,
  }
);

module.exports = mongoose.model("SiteContent", siteContentSchema);
