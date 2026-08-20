/**
 * A category slug. Deliberately a plain string: categories are database records
 * now, so a union here would put the two-category assumption straight back.
 */
export type ProductCategory = string;

/** One selectable value on a variant axis, with its own availability. */
export interface OptionValue {
  value: string;
  label: string;
  hex?: string;
  /** Optional per-value shot, swapped into the gallery when picked. */
  image?: string;
  inStock: boolean;
}

/**
 * A way the product varies — "Frame Colour", "Metal", "Length". Replaces the
 * old fixed colours/sizes pair, which allowed exactly two axes and made colour
 * mandatory even for a one-size bag.
 */
export interface ProductOption {
  name: string;
  groupKey?: string;
  values: OptionValue[];
}

/** One sellable combination. */
export interface ProductVariant {
  id: string;
  optionValues: { name: string; value: string }[];
  inStock: boolean;
}

/**
 * A choice that does not affect stock — lens type is the case this exists for.
 * Every lens is available in every frame colour, so making them stock-bearing
 * would multiply the inventory grid for no gain.
 */
export interface ProductSelection {
  key: string;
  label: string;
  values: { value: string; label: string }[];
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

/** A category as the storefront needs it. */
export interface StoreCategory {
  slug: string;
  name: string;
  description?: string;
  heroImage?: string;
}

export interface FacetOption {
  value: string;
  label: string;
  hex?: string;
}

/** Title and control style for a facet, so the UI can render one it has never heard of. */
export interface FacetMeta {
  key: string;
  label: string;
  filterStyle: "chips" | "checkbox";
  sortOrder: number;
}

export interface FacetResponse {
  /** Keyed by AttributeGroup.key — an open record, not a fixed set of groups. */
  groups: Record<string, FacetOption[]>;
  groupMeta: FacetMeta[];
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

  /** Raw attribute codes, for links and client-side checks. To display, use `specs`. */
  attributes: Record<string, string | string[] | number | undefined>;
  options: ProductOption[];
  variants: ProductVariant[];
  selections: ProductSelection[];
  /** Pre-resolved, ordered spec rows for the product page. */
  specs: ProductSpec[];

  stock: number;
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
  /** Identifies the exact stocked combination; the cart keys off this. */
  variantId?: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  /** Chosen option values, e.g. { "Metal": "Rose Gold", "Length": "18 in" }. */
  options?: Record<string, string>;
  /** Non-stocked choices such as lens type. */
  selections?: Record<string, string>;
  quantity: number;
}
