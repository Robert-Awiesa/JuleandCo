/**
 * Navigation helpers.
 *
 * The menu itself used to live here as a hardcoded object, which meant a new
 * column or a reworded link was a code change and a deploy. It is admin content
 * now — see `nav.megaMenu` in backend/src/utils/contentSlots.js — and reaches
 * the Header as a prop from the layout.
 *
 * What is left is the one thing that is genuinely logic: turning a link's own
 * href into the product count shown beside it.
 */

/**
 * Product count for a navigation link, read straight off its own href.
 *
 * Deriving it from the URL rather than duplicating the group/value on every
 * link means a menu entry cannot drift out of sync with the filter it applies,
 * and the admin only ever types a link.
 *
 * Returns null when the link applies no counted facet — "New Arrivals" sorts
 * rather than filters, so a number there would be meaningless.
 */
export function countForHref(
  href: string,
  counts: Record<string, Record<string, number>>
): number | null {
  const query = href.split("?")[1];
  if (!query) return null;

  for (const [key, value] of new URLSearchParams(query)) {
    if (key === "category") continue;
    const group = counts[key];
    if (!group) continue;
    // A known facet with nothing behind it is a real zero, not a missing count.
    return group[value] ?? 0;
  }
  return null;
}
