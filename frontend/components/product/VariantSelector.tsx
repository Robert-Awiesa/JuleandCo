"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ruler, X } from "lucide-react";
import { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VariantSelectorProps {
  product: Product;
  color?: string;
  size?: string;
  onColorChange: (color: string) => void;
  onSizeChange: (size: string) => void;
}

const apparelSizeChart = [
  { size: "XS", chest: "84–87 cm", waist: "66–69 cm" },
  { size: "S", chest: "88–91 cm", waist: "70–73 cm" },
  { size: "M", chest: "92–96 cm", waist: "74–78 cm" },
  { size: "L", chest: "97–102 cm", waist: "79–84 cm" },
  { size: "XL", chest: "103–109 cm", waist: "85–91 cm" },
];

export function VariantSelector({
  product,
  color,
  size,
  onColorChange,
  onSizeChange,
}: VariantSelectorProps) {
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  return (
    <div>
      {product.colors.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 text-xs uppercase tracking-widest2 text-obsidian/50">
            {product.category === "eyewear" ? "Frame Color" : "Color"} — {color}
          </p>
          <div className="flex gap-2.5">
            {product.colors.map((c) => (
              <button
                key={c.id}
                disabled={!c.inStock}
                onClick={() => onColorChange(c.label)}
                title={c.inStock ? c.label : `${c.label} — Sold Out`}
                className={cn(
                  "h-9 w-9 rounded-full border-2 transition-transform disabled:cursor-not-allowed disabled:opacity-30",
                  color === c.label ? "border-obsidian scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
      )}

      {product.sizes && product.sizes.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest2 text-obsidian/50">Size — {size}</p>
            {product.category === "apparel" && (
              <button
                onClick={() => setSizeGuideOpen(true)}
                className="flex items-center gap-1 text-xs text-obsidian/60 underline-offset-4 hover:underline"
              >
                <Ruler size={12} /> Find My Size
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s.id}
                disabled={!s.inStock}
                onClick={() => onSizeChange(s.label)}
                className={cn(
                  "min-w-[3rem] border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:line-through",
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

      <AnimatePresence>
        {sizeGuideOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[95] bg-obsidian/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSizeGuideOpen(false)}
            />
            <div className="fixed inset-0 z-[96] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-alabaster p-7 shadow-soft pointer-events-auto"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-serif text-xl">Find My Size</h3>
                  <button onClick={() => setSizeGuideOpen(false)} aria-label="Close size guide">
                    <X size={18} />
                  </button>
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-obsidian/15 text-xs uppercase tracking-widest2 text-obsidian/50">
                      <th className="pb-2">Size</th>
                      <th className="pb-2">Chest</th>
                      <th className="pb-2">Waist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apparelSizeChart.map((row) => (
                      <tr key={row.size} className="border-b border-obsidian/5">
                        <td className="py-2 font-medium">{row.size}</td>
                        <td className="py-2 text-obsidian/70">{row.chest}</td>
                        <td className="py-2 text-obsidian/70">{row.waist}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 text-xs text-obsidian/50">
                  Between sizes? We recommend sizing up for a more relaxed fit.
                </p>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
