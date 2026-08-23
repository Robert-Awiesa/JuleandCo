"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../_lib/api";
import { formatCurrency } from "../../_lib/format";
import type { AdminProduct, OrderStats, PaginatedResult } from "../../_lib/types";

async function fetchAllProducts() {
  return api.get<PaginatedResult<AdminProduct>>("/products/admin?limit=1000");
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", "dashboard"],
    queryFn: fetchAllProducts,
  });

  const { data: stats } = useQuery({
    queryKey: ["order-stats"],
    queryFn: () => api.get<OrderStats>("/orders/stats"),
  });

  const products = data?.items ?? [];
  const outOfStock = products.filter((p) => p.stock === 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const catalogValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

  // Trade first, then the catalogue. Revenue and unfulfilled orders are what a
  // shop owner opens this page to see; stock levels are the follow-up.
  const tiles = [
    { label: "Revenue", value: formatCurrency(stats?.revenue ?? 0) },
    { label: "Orders", value: String(stats?.orders ?? 0) },
    { label: "Avg. Order", value: formatCurrency(stats?.averageOrderValue ?? 0) },
    { label: "To Fulfil", value: String(stats?.unfulfilled ?? 0) },
    { label: "Total Products", value: String(products.length) },
    { label: "Low Stock", value: String(lowStock.length) },
    { label: "Out of Stock", value: String(outOfStock.length) },
    { label: "Catalog Value", value: formatCurrency(catalogValue) },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl text-obsidian">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-obsidian/10 bg-white p-5">
            <p className="text-xs uppercase tracking-widest2 text-obsidian/50">{tile.label}</p>
            <p className="mt-2 font-serif text-2xl text-obsidian">{isLoading ? "…" : tile.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-obsidian/10 bg-white">
        <div className="border-b border-obsidian/10 px-5 py-4">
          <h2 className="text-sm font-medium text-obsidian">Needs attention</h2>
        </div>
        <div className="divide-y divide-obsidian/10">
          {[...outOfStock, ...lowStock].slice(0, 8).map((product) => (
            <Link
              key={product._id}
              href={`/admin/products/${product._id}/edit`}
              className="flex items-center justify-between px-5 py-3 text-sm hover:bg-obsidian/5"
            >
              <span className="text-obsidian">{product.name}</span>
              <span className={product.stock === 0 ? "text-red-600" : "text-amber-600"}>
                {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
              </span>
            </Link>
          ))}
          {!isLoading && outOfStock.length === 0 && lowStock.length === 0 && (
            <p className="px-5 py-6 text-sm text-obsidian/50">Everything is well stocked.</p>
          )}
        </div>
      </div>
    </div>
  );
}
