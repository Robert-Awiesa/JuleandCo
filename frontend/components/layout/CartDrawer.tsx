"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { formatCurrency } from "@/lib/utils";

export function CartDrawer() {
  const { lines, isOpen, close, updateQuantity, removeLine, subtotal } = useCartStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[80] bg-obsidian/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            className="fixed right-0 top-0 z-[81] flex h-full w-full max-w-md flex-col bg-alabaster shadow-soft"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-obsidian/10 px-6 py-5">
              <h2 className="font-serif text-xl">
                Your Bag <span className="text-obsidian/40">({lines.length})</span>
              </h2>
              <button onClick={close} aria-label="Close cart" className="text-obsidian/60 hover:text-obsidian">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <p className="text-obsidian/50">Your bag is empty.</p>
                  <Link href="/shop" onClick={close} className="btn-secondary w-fit">
                    Continue Shopping
                  </Link>
                </div>
              ) : (
                <ul className="space-y-6">
                  {lines.map((line) => (
                    <li
                      key={`${line.productId}-${line.color}-${line.size}`}
                      className="flex gap-4"
                    >
                      <div className="relative h-28 w-24 shrink-0 overflow-hidden bg-obsidian/5">
                        <Image src={line.image} alt={line.name} fill sizes="96px" className="object-cover" />
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/product/${line.slug}`}
                              onClick={close}
                              className="text-sm font-medium hover:text-gold-dark"
                            >
                              {line.name}
                            </Link>
                            <button
                              onClick={() => removeLine(line.productId, line.color, line.size)}
                              className="text-obsidian/40 hover:text-obsidian"
                              aria-label="Remove item"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-obsidian/50">
                            {[line.color, line.size].filter(Boolean).join(" / ")}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center border border-obsidian/15">
                            <button
                              className="p-1.5 hover:bg-obsidian/5"
                              onClick={() =>
                                updateQuantity(line.productId, line.quantity - 1, line.color, line.size)
                              }
                              aria-label="Decrease quantity"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-8 text-center text-sm">{line.quantity}</span>
                            <button
                              className="p-1.5 hover:bg-obsidian/5"
                              onClick={() =>
                                updateQuantity(line.productId, line.quantity + 1, line.color, line.size)
                              }
                              aria-label="Increase quantity"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <p className="text-sm font-medium">
                            {formatCurrency(line.price * line.quantity)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <div className="border-t border-obsidian/10 px-6 py-5">
                <div className="mb-4 flex items-center justify-between text-sm">
                  <span className="text-obsidian/60">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal())}</span>
                </div>
                <p className="mb-4 text-xs text-obsidian/50">
                  Shipping and taxes calculated at checkout.
                </p>
                <Link href="/checkout" onClick={close} className="btn-primary w-full">
                  Proceed to Checkout
                </Link>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
