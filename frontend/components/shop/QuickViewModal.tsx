"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { Product } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PriceTag } from "@/components/ui/PriceTag";
import { useCartStore } from "@/store/useCartStore";
import { cn, stockLabel } from "@/lib/utils";

interface QuickViewModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

export function QuickViewModal({ product, isOpen, onClose }: QuickViewModalProps) {
  const [color, setColor] = useState(product.colors[0]?.label);
  const [size, setSize] = useState(product.sizes?.[0]?.label);
  const addLine = useCartStore((s) => s.addLine);
  const stock = stockLabel(product.stock);

  const handleAdd = () => {
    addLine({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      price: product.price,
      color,
      size,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[75] bg-obsidian/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[76] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              className="w-full max-w-3xl pointer-events-auto"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="grid h-[min(85vh,640px)] grid-rows-[14rem_1fr] overflow-hidden bg-alabaster shadow-soft sm:grid-cols-2 sm:grid-rows-1">
                <div className="relative h-full w-full">
                  <Image src={product.images[0]} alt={product.name} fill sizes="400px" className="object-cover" />
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-alabaster/90 sm:hidden"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="relative flex min-h-0 flex-col overflow-y-auto">
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-6 top-6 hidden text-obsidian/50 hover:text-obsidian sm:block"
                  >
                    <X size={18} />
                  </button>

                  <div className="flex-1 p-7 pb-0">
                    <p className="text-xs uppercase tracking-widest2 text-obsidian/45">
                      {product.subCategory}
                    </p>
                    <h3 className="mt-1 font-serif text-2xl">{product.name}</h3>
                    <PriceTag
                      price={product.price}
                      compareAtPrice={product.compareAtPrice}
                      size="lg"
                      className="mt-2"
                    />
                    <p className="mt-3 line-clamp-2 text-sm text-obsidian/65">{product.description}</p>
                    <p
                      className={cn(
                        "mt-2 text-xs uppercase tracking-wide",
                        stock.tone === "out" && "text-obsidian/40",
                        stock.tone === "low" && "text-gold-dark",
                        stock.tone === "in" && "text-sage-dark"
                      )}
                    >
                      {stock.label}
                    </p>

                    {product.tags && product.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {product.tags.map((tag) => (
                          <Badge key={tag} tone="sage">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {product.colors.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs uppercase tracking-widest2 text-obsidian/50">
                          Color — {color}
                        </p>
                        <div className="flex gap-2">
                          {product.colors.map((c) => (
                            <button
                              key={c.id}
                              disabled={!c.inStock}
                              onClick={() => setColor(c.label)}
                              title={c.label}
                              className={cn(
                                "h-8 w-8 rounded-full border-2 transition-transform disabled:cursor-not-allowed disabled:opacity-30",
                                color === c.label ? "border-obsidian scale-110" : "border-transparent"
                              )}
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {product.sizes && product.sizes.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs uppercase tracking-widest2 text-obsidian/50">
                          Size — {size}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {product.sizes.map((s) => (
                            <button
                              key={s.id}
                              disabled={!s.inStock}
                              onClick={() => setSize(s.label)}
                              className={cn(
                                "border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:line-through",
                                size === s.label
                                  ? "border-obsidian bg-obsidian text-alabaster"
                                  : "border-obsidian/20 hover:border-obsidian"
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="sticky bottom-0 flex flex-col gap-3 border-t border-obsidian/10 bg-alabaster p-7 pt-4">
                    <Button onClick={handleAdd} disabled={product.stock === 0}>
                      {product.stock === 0 ? "Sold Out" : "Add to Bag"}
                    </Button>
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={onClose}
                      className="btn-ghost w-full"
                    >
                      View Full Details
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
