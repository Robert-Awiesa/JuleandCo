import { collections } from "./mockData";

// Curated navigation, not an exhaustive facet list — the shop sidebar renders
// the full set from /api/products/facets. These values are Attribute `value`
// slugs and must match the vocabulary seeded by backend/src/scripts/seedAttributes.js;
// they were previously display names ("Cashmere"), which no longer match anything
// now that products store slugs.
const FEATURED_FRAME_SHAPES = [
  { label: "Aviator", value: "aviator" },
  { label: "Round", value: "round" },
  { label: "Square", value: "square" },
  { label: "Cat-Eye", value: "cat-eye" },
  { label: "Oversized", value: "oversized" },
  { label: "Rectangle", value: "rectangle" },
];

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

export const megaMenu: Record<"eyewear" | "apparel", MegaMenuSection> = {
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
  apparel: {
    label: "Apparel",
    href: "/shop?category=apparel",
    columns: [
      {
        title: "Shop by Category",
        links: [
          { label: "Knitwear", href: "/shop?category=apparel&subCategory=knitwear" },
          { label: "Outerwear", href: "/shop?category=apparel&subCategory=outerwear" },
          { label: "Shirting", href: "/shop?category=apparel&subCategory=shirting" },
          { label: "Bottoms", href: "/shop?category=apparel&subCategory=bottoms" },
        ],
      },
      {
        title: "Shop by Fabric",
        links: [
          { label: "Cashmere", href: "/shop?category=apparel&fabric=100-cashmere" },
          { label: "Merino Wool", href: "/shop?category=apparel&fabric=100-merino-wool" },
          { label: "Linen", href: "/shop?category=apparel&fabric=100-linen" },
          { label: "Silk", href: "/shop?category=apparel&fabric=100-mulberry-silk" },
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
};

export const primaryNav = [
  { label: "New Arrivals", href: "/shop?sort=new" },
  { label: "Eyewear", href: "/shop?category=eyewear", mega: "eyewear" as const },
  { label: "Apparel", href: "/shop?category=apparel", mega: "apparel" as const },
  { label: "Journal", href: "/#brand-story" },
];
