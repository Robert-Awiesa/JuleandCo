/**
 * A category slug. Deliberately a plain string rather than a union: categories
 * are records in the database now, so pinning them in the type system would put
 * the two-category assumption straight back.
 */
export type CategorySlug = string;

/** How a group is captured in the admin form. */
export type AttributeInputType = "select" | "multiselect" | "text" | "number";

/**
 * spec        — appears in the product's spec list on the storefront.
 * selection   — customer picks one, but it carries no stock (lens type).
 * variantAxis — a stock-bearing option (metal, chain length, ring size).
 * internal    — admin-only, or a component of a combined spec.
 */
export type AttributeRole = "spec" | "selection" | "variantAxis" | "internal";

/** Defines a vocabulary: what it is called, where it applies, how it behaves. */
export interface AttributeGroup {
  _id: string;
  key: string;
  label: string;
  description?: string;
  categories: CategorySlug[];
  inputType: AttributeInputType;
  role: AttributeRole;
  showInFilters: boolean;
  filterStyle: "chips" | "checkbox";
  swatch: boolean;
  unit?: string;
  placeholder?: string;
  sortOrder: number;
}

/** One option inside a vocabulary. Products store `value`, never `label`. */
export interface Attribute {
  _id: string;
  group: string;
  value: string;
  label: string;
  hex?: string;
  description?: string;
  sortOrder: number;
}

/** A selectable value on a variant axis. */
export interface OptionValue {
  value: string;
  label: string;
  hex?: string;
  image?: string;
}

/** A variant axis. Replaces the old fixed colour/size pair. */
export interface ProductOption {
  name: string;
  groupKey?: string;
  values: OptionValue[];
}

/** One sellable combination. Stock and SKU live here and nowhere else. */
export interface Variant {
  id: string;
  optionValues: { name: string; value: string }[];
  stock: number;
  sku?: string;
}

/** Category-specific values, keyed by AttributeGroup.key. */
export type ProductAttributes = Record<string, string | string[] | number | undefined>;

export interface AdminProduct {
  _id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  subCategory: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  images: string[];

  attributes: ProductAttributes;
  options: ProductOption[];
  variants: Variant[];
  stock: number;

  isNewArrival?: boolean;
  isBestSeller?: boolean;
  tags?: string[];
  pairsWith?: string[];

  publishStatus?: "draft" | "published";
  costPrice?: number;
  barcode?: string;
  weightGrams?: number;
  seo?: { title?: string; description?: string };

  createdAt: string;
  updatedAt: string;
}

export interface Subcategory {
  _id: string;
  name: string;
  slug: string;
  categoryType: CategorySlug;
  sortOrder: number;
}

/** Names a variant axis for a category, e.g. "Metal" drawn from the metal group. */
export interface CategoryOptionDefault {
  groupKey?: string;
  label: string;
  swatch?: boolean;
}

/** A spec composed from several attributes, e.g. "{h} × {w} × {d} cm". */
export interface CategoryCombinedSpec {
  label: string;
  template: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: CategorySlug;
  description?: string;
  heroImage?: string;
  isActive: boolean;
  sortOrder: number;
  optionDefaults: CategoryOptionDefault[];
  combinedSpecs: CategoryCombinedSpec[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export interface OrderItem {
  product: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  variantId?: string;
  /** Chosen option values, e.g. { Metal: "Rose Gold" }. */
  options?: Record<string, string>;
  /** Non-stocked choices, e.g. { Lens: "Polarised" }. */
  selections?: Record<string, string>;
}

export interface AdminOrder {
  _id: string;
  orderNumber: string;
  customer: { name: string; email: string; phone: string };
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    region: string;
  };
  paymentMethod: "mobile_money" | "card";
  paymentStatus: "pending" | "paid" | "failed";
  itemsPrice: number;
  shippingPrice: number;
  totalPrice: number;
  status: OrderStatus;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStats {
  orders: number;
  revenue: number;
  averageOrderValue: number;
  unfulfilled: number;
}
