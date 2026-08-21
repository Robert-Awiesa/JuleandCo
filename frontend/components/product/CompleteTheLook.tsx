import { Product } from "@/lib/types";
import { ProductCard } from "@/components/shop/ProductCard";

interface CompleteTheLookProps {
  products: Product[];
}

export function CompleteTheLook({ products }: CompleteTheLookProps) {
  if (products.length === 0) return null;

  return (
    <section className="container-elevated border-t border-obsidian/10 py-20">
      <p className="eyebrow mb-2">Styled Together</p>
      <h2 className="mb-10 font-serif text-3xl font-bold leading-[1.2]">Complete the Look</h2>
      <div className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
