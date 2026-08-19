"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  // Searches the live catalogue instead of a hardcoded array. Debounced so
  // typing does not fire a request per keystroke, and aborted on change so a
  // slow earlier response cannot overwrite a newer one.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
        const res = await fetch(`${base}/products?search=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        setResults(res.ok ? ((await res.json()) as Product[]).slice(0, 6) : []);
      } catch {
        // Aborted or offline — leave the previous results rather than flashing empty.
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-obsidian/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[71] flex justify-center p-4 pt-24 pointer-events-none">
            <motion.div
              className="w-full max-w-2xl pointer-events-auto"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="bg-alabaster shadow-soft border border-obsidian/10">
                <div className="flex items-center gap-3 border-b border-obsidian/10 px-5 py-4">
                  <Search size={18} className="text-obsidian/50 shrink-0" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search eyewear, apparel, fabrics, shapes…"
                    className="w-full bg-transparent text-sm placeholder:text-obsidian/40 focus:outline-none"
                  />
                  <button
                    onClick={onClose}
                    aria-label="Close search"
                    className="text-obsidian/50 hover:text-obsidian"
                  >
                    <X size={18} />
                  </button>
                </div>

                {query.trim() && (
                  <div className="max-h-[60vh] overflow-y-auto p-2">
                    {searching && results.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-obsidian/40">Searching…</p>
                    ) : results.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-obsidian/50">
                        No results for &ldquo;{query}&rdquo;
                      </p>
                    ) : (
                      results.map((product) => (
                        <Link
                          key={product.id}
                          href={`/product/${product.slug}`}
                          onClick={onClose}
                          className="flex items-center gap-4 p-3 hover:bg-obsidian/5 transition-colors"
                        >
                          <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-obsidian/5">
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{product.name}</p>
                            <p className="text-xs text-obsidian/50">{product.subCategory}</p>
                          </div>
                          <p className="text-sm shrink-0">{formatCurrency(product.price)}</p>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
