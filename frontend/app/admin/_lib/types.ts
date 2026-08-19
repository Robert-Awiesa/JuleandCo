export type ProductCategory = "eyewear" | "apparel";

export interface Variant {
  id: string;
  colorId: string;
  colorLabel: string;
  colorHex?: string;
  colorImage?: string;
  sizeId?: string;
  sizeLabel?: string;
  stock: number;
  sku?: string;
}

export type AttributeGroup =
  | "frameShape"
  | "lensType"
  | "frameMaterial"
  | "fabric"
  | "clothingSize"
  | "fit"
  | "gender";

/** One option in an admin-managed vocabulary. Products store `value`, never `label`. */
export interface Attribute {
  _id: string;
  group: AttributeGroup;
  value: string;
  label: string;
  hex?: string;
  categoryType?: ProductCategory;
  description?: string;
  sortOrder: number;
}

export interface AdminProduct {
  _id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  subCategory: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  images: string[];
  // Eyewear
  frameShape?: string;
  frameMaterial?: string;
  lensColor?: string;
  lensOptions?: string[];
  measurements?: {
    lensWidthMm?: number;
    bridgeWidthMm?: number;
    templeLengthMm?: number;
  };
  // Apparel
  fabric?: string;
  clothingSize?: string[];
  composition?: string;
  fit?: string;
  // Shared
  gender?: string;
  careInstructions?: string;

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
  categoryType: ProductCategory;
  sortOrder: number;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  type: ProductCategory;
  description?: string;
  heroImage?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
