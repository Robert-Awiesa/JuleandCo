import { notFound } from "next/navigation";
import { fetchProductBySlug } from "@/lib/api";
import { ProductDetailView } from "@/components/product/ProductDetailView";

interface ProductPageProps {
  params: { slug: string };
}

// Rendered on demand rather than pre-generated: the catalogue lives in Mongo
// now, so a product published in the admin must become reachable without a
// rebuild. lib/api.ts sets the revalidate window.
export const dynamicParams = true;

export async function generateMetadata({ params }: ProductPageProps) {
  const product = await fetchProductBySlug(params.slug);
  if (!product) return {};

  return {
    title: `${product.name} — JULES & CO`,
    description: product.description,
    openGraph: {
      title: `${product.name} — JULES & CO`,
      description: product.description,
      images: product.images?.[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await fetchProductBySlug(params.slug);
  if (!product) notFound();

  return <ProductDetailView product={product} related={product.related ?? []} />;
}
