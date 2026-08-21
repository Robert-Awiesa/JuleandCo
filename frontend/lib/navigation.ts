import { collections } from "./mockData";

/**
 * The header mega menu.
 *
 * Curated navigation, not an exhaustive facet list — the shop sidebar renders
 * the full set from /api/products/facets. The values here are Attribute `value`
 * slugs and sub-category slugs, and must match what
 * backend/src/scripts/pivotToJewelleryAndBags.js seeds.
 *
 * TODO(copy): the section headings and featured tiles are placeholders — refine
 * the wording and swap in real photography before launch.
 */

export interface MegaMenuLink {
  label: string;
  href: string;
}

export interface MegaMenuColumn {
  title: string;
  links: MegaMenuLink[];
}

export interface MegaMenuSection {
  label: string;
  href: string;
  columns: MegaMenuColumn[];
  featured: { title: string; subtitle: string; image: string; href: string };
}

const FEATURED_FRAME_SHAPES = [
  { label: "Aviator", value: "aviator" },
  { label: "Round", value: "round" },
  { label: "Square", value: "square" },
  { label: "Cat-Eye", value: "cat-eye" },
  { label: "Oversized", value: "oversized" },
  { label: "Rectangle", value: "rectangle" },
];

export const megaMenu: Record<"eyewear" | "jewellery" | "bags", MegaMenuSection> = {
  eyewear: {
    label: "Eyewear",
    href: "/shop?category=eyewear",
    columns: [
      {
        title: "Shop by Shape",
        links: FEATURED_FRAME_SHAPES.map((shape) => ({
          label: shape.label,
          href: `/shop?category=eyewear&frameShape=${shape.value}`,
        })),
      },
      {
        title: "Shop by Type",
        links: [
          { label: "Sunglasses", href: "/shop?category=eyewear&subCategory=sunglasses" },
          { label: "Optical", href: "/shop?category=eyewear&subCategory=optical" },
          // The house reads women-first, so men's frames are the cut worth
          // surfacing as a shortcut. Uses the existing `gender` vocabulary
          // rather than a new one, so it is the same value the admin sets on a
          // product and the same chip the shop sidebar already renders.
          { label: "Men", href: "/shop?category=eyewear&gender=mens" },
          { label: "New Arrivals", href: "/shop?category=eyewear&sort=new" },
          { label: "Best Sellers", href: "/shop?category=eyewear&sort=bestseller" },
        ],
      },
    ],
    featured: {
      title: collections[0].title,
      subtitle: collections[0].subtitle,
      image: collections[0].image,
      href: collections[0].href,
    },
  },
  jewellery: {
    label: "Jewellery",
    href: "/shop?category=jewellery",
    columns: [
      {
        title: "Shop by Piece",
        links: [
          { label: "Necklaces", href: "/shop?category=jewellery&subCategory=necklaces" },
          { label: "Anklets", href: "/shop?category=jewellery&subCategory=anklets" },
          { label: "Bracelets", href: "/shop?category=jewellery&subCategory=bracelets" },
          { label: "Rings", href: "/shop?category=jewellery&subCategory=rings" },
          { label: "Earrings", href: "/shop?category=jewellery&subCategory=earrings" },
        ],
      },
      {
        title: "Shop by Metal",
        links: [
          { label: "Yellow Gold", href: "/shop?category=jewellery&metal=yellow-gold" },
          { label: "Rose Gold", href: "/shop?category=jewellery&metal=rose-gold" },
          { label: "Sterling Silver", href: "/shop?category=jewellery&metal=sterling-silver" },
          { label: "Gold Vermeil", href: "/shop?category=jewellery&metal=gold-vermeil" },
        ],
      },
    ],
    featured: {
      title: collections[1].title,
      subtitle: collections[1].subtitle,
      image: collections[1].image,
      href: collections[1].href,
    },
  },
  bags: {
    label: "Bags",
    href: "/shop?category=bags",
    columns: [
      {
        title: "Shop by Style",
        links: [
          { label: "Totes", href: "/shop?category=bags&subCategory=totes" },
          { label: "Shoulder Bags", href: "/shop?category=bags&subCategory=shoulder-bags" },
          { label: "Crossbody Bags", href: "/shop?category=bags&subCategory=crossbody-bags" },
          { label: "Clutches", href: "/shop?category=bags&subCategory=clutches" },
        ],
      },
      {
        title: "Shop by Material",
        links: [
          { label: "Full-Grain Leather", href: "/shop?category=bags&bagMaterial=full-grain-leather" },
          { label: "Suede", href: "/shop?category=bags&bagMaterial=suede" },
          { label: "Canvas", href: "/shop?category=bags&bagMaterial=canvas" },
          { label: "Raffia", href: "/shop?category=bags&bagMaterial=raffia" },
        ],
      },
    ],
    featured: {
      title: collections[3].title,
      subtitle: collections[3].subtitle,
      image: collections[3].image,
      href: collections[3].href,
    },
  },
};

export const primaryNav = [
  { label: "New Arrivals", href: "/shop?sort=new" },
  { label: "Eyewear", href: "/shop?category=eyewear", mega: "eyewear" as const },
  { label: "Jewellery", href: "/shop?category=jewellery", mega: "jewellery" as const },
  { label: "Bags", href: "/shop?category=bags", mega: "bags" as const },
  { label: "Our Ethos", href: "/ethos" },
];

/**
 * Product count for a navigation link, read straight off its own href.
 *
 * Deriving it from the URL rather than duplicating the group/value on every
 * link means the menu config stays a plain list, and a link cannot drift out of
 * sync with the filter it actually applies.
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
