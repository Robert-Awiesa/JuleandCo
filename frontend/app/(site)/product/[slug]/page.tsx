import { notFound } from "next/navigation";
import { fetchProductBySlug, fetchProductReviews } from "@/lib/api";
import { ProductDetailView } from "@/components/product/ProductDetailView";
import { ProductReviews } from "@/components/product/ProductReviews";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, productSchema } from "@/lib/structuredData";

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
    // One address per product. Without this, the same piece reached through a
    // filter, a search or a shared link looks like several pages to a crawler.
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} — JULES & CO`,
      description: product.description,
      images: product.images?.[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await fetchProductBySlug(params.slug);
  if (!product) notFound();

  const reviews = await fetchProductReviews(product.id);

  return (
    <>
      {/* What puts the price, the stock status and any rating into a Google
          result rather than a plain blue link. */}
      <JsonLd schema={productSchema(product)} />
      <JsonLd
        schema={breadcrumbSchema([
          { name: "Shop", path: "/shop" },
          { name: product.category, path: `/shop?category=${product.category}` },
          { name: product.name, path: `/product/${product.slug}` },
        ])}
      />

      <ProductDetailView product={product} related={product.related ?? []} />
      <ProductReviews
        productId={product.id}
        reviews={reviews}
        rating={product.rating}
        reviewCount={product.reviewCount}
      />
    </>
  );
}
