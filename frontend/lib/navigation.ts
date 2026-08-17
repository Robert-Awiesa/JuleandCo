import { collections, frameShapes } from "./mockData";

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
        links: frameShapes.map((shape) => ({
          label: shape,
          href: `/shop?category=eyewear&frameShape=${encodeURIComponent(shape)}`,
        })),
      },
      {
        title: "Shop by Type",
        links: [
          { label: "Sunglasses", href: "/shop?category=eyewear&subCategory=Sunglasses" },
          { label: "Optical", href: "/shop?category=eyewear&subCategory=Optical" },
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
          { label: "Knitwear", href: "/shop?category=apparel&subCategory=Knitwear" },
          { label: "Outerwear", href: "/shop?category=apparel&subCategory=Outerwear" },
          { label: "Shirting", href: "/shop?category=apparel&subCategory=Shirting" },
          { label: "Bottoms", href: "/shop?category=apparel&subCategory=Bottoms" },
        ],
      },
      {
        title: "Shop by Fabric",
        links: [
          { label: "Cashmere", href: "/shop?category=apparel&fabric=Cashmere" },
          { label: "Merino Wool", href: "/shop?category=apparel&fabric=Merino" },
          { label: "Linen", href: "/shop?category=apparel&fabric=Linen" },
          { label: "Silk", href: "/shop?category=apparel&fabric=Silk" },
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
