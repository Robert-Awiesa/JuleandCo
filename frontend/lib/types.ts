export type ProductCategory = "eyewear" | "apparel";

export interface ProductVariant {
  id: string;
  label: string;
  hex?: string;
  /** Optional per-colour shot, swapped into the gallery when that colour is picked. */
  image?: string;
  inStock: boolean;
}

/** A lens the frame can be ordered with. `value` is the stable code, `label` is display text. */
export interface LensOption {
  value: string;
  label: string;
}

/**
 * A display-ready spec row. Built server-side so the storefront never needs to
 * know the attribute vocabulary to turn a stored code into readable text.
 */
export interface ProductSpec {
  key: string;
  label: string;
  value: string;
}

export interface FacetOption {
  value: string;
  label: string;
  hex?: string;
}

export interface FacetResponse {
  groups: {
    frameShape: FacetOption[];
    frameMaterial: FacetOption[];
    lensType: FacetOption[];
    gender: FacetOption[];
    fit: FacetOption[];
    fabric: FacetOption[];
    clothingSize: FacetOption[];
  };
  subCategories: string[];
  priceBounds: [number, number];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  subCategory: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  images: [string, string] | string[];
  // Raw attribute codes — used for filtering. For display, use `specs`.
  frameShape?: string;
  frameMaterial?: string;
  lensColor?: string;
  lensOptions: LensOption[];
  measurements?: { lensWidthMm?: number; bridgeWidthMm?: number; templeLengthMm?: number };
  clothingSize?: string[];
  fabric?: string;
  composition?: string;
  fit?: string;
  gender?: string;
  careInstructions?: string;
  colors: ProductVariant[];
  sizes?: ProductVariant[];
  stock: number;
  /** Pre-resolved, ordered spec rows for the product page. */
  specs: ProductSpec[];
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  rating?: number;
  reviewCount?: number;
  pairsWith?: string[];
  tags?: string[];
}

export interface Collection {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
  span?: "wide" | "tall" | "default";
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
}

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  color?: string;
  size?: string;
  lens?: string;
  quantity: number;
}

export interface FilterState {
  category: ProductCategory | "all";
  frameShapes: string[];
  frameMaterials: string[];
  lensTypes: string[];
  genders: string[];
  fits: string[];
  sizes: string[];
  fabrics: string[];
  priceRange: [number, number];
  search: string;
}
