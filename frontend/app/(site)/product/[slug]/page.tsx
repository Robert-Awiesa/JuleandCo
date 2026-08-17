import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, products } from "@/lib/mockData";
import { ProductDetailView } from "@/components/product/ProductDetailView";

interface ProductPageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: ProductPageProps) {
  const product = getProductBySlug(params.slug);
  if (!product) return {};
  return {
    title: `${product.name} — Aura & Optic`,
    description: product.description,
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const related = getRelatedProducts(product);

  return <ProductDetailView product={product} related={related} />;
}
