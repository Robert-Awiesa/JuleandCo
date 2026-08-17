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
  frameShape?: string;
  lensColor?: string;
  fabric?: string;
  clothingSize?: string[];
  variants: Variant[];
  stock: number;
  isNew?: boolean;
  isBestSeller?: boolean;
  tags?: string[];
  pairsWith?: string[];
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
