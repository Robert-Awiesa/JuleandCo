/**
 * Builds a case-insensitive regex from a term someone typed into a search box.
 *
 * Search used to be a $text query, which matches whole words only — typing
 * "avia" found nothing, on the storefront and in the admin alike, so both boxes
 * looked broken while you were still typing.
 *
 * Metacharacters are escaped because they are almost never meant literally: an
 * unescaped ".*" matches the entire catalogue and reads as a working search.
 * Returns null for a blank term, since an empty regex matches everything.
 */
function searchRegex(term) {
  const trimmed = String(term ?? "").trim();
  if (!trimmed) return null;
  return new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

module.exports = { searchRegex };
