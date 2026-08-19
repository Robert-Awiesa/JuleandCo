"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormContext } from "react-hook-form";
import { api } from "../../_lib/api";
import type { AdminProduct, PaginatedResult } from "../../_lib/types";
import type { ProductFormInput } from "./schema";

export function CrossSellTab({ currentProductId }: { currentProductId?: string }) {
  const { watch, setValue } = useFormContext<ProductFormInput>();
  const [search, setSearch] = useState("");
  const selected = watch("pairsWith") ?? [];

  const { data } = useQuery({
    queryKey: ["admin-products", "cross-sell", search],
    queryFn: () => api.get<PaginatedResult<AdminProduct>>(`/products/admin?search=${search}&limit=20`),
  });

  const options = (data?.items ?? []).filter((p) => p._id !== currentProductId);

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    setValue("pairsWith", next, { shouldDirty: true });
  }

  return (
    <div className="max-w-3xl space-y-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products to pair with…"
        className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
      />
      <div className="divide-y divide-obsidian/10 rounded border border-obsidian/10">
        {options.map((product) => (
          <label
            key={product._id}
            className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-obsidian/[0.02]"
          >
            <input type="checkbox" checked={selected.includes(product._id)} onChange={() => toggle(product._id)} />
            {product.name}
          </label>
        ))}
        {options.length === 0 && <p className="px-4 py-3 text-sm text-obsidian/50">No products found.</p>}
      </div>
    </div>
  );
}
