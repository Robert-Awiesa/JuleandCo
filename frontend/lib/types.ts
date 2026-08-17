export type ProductCategory = "eyewear" | "apparel";

export interface ProductVariant {
  id: string;
  label: string;
  hex?: string;
  inStock: boolean;
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
  frameShape?: string;
  lensColor?: string;
  clothingSize?: string[];
  fabric?: string;
  colors: ProductVariant[];
  sizes?: ProductVariant[];
  stock: number;
  isNew?: boolean;
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
  quantity: number;
}

export interface FilterState {
  category: ProductCategory | "all";
  frameShapes: string[];
  lensColors: string[];
  sizes: string[];
  fabrics: string[];
  priceRange: [number, number];
  search: string;
}
