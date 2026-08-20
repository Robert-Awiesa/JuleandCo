"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/admin-ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/admin-ui/select";
import { Badge } from "@/components/admin-ui/badge";
import { Button } from "@/components/admin-ui/button";
import { Input } from "@/components/admin-ui/input";
import { api } from "../../_lib/api";
import { useCategories } from "../../_lib/useCatalogConfig";
import { formatCurrency, stockTone } from "../../_lib/format";
import type { AdminProduct, PaginatedResult } from "../../_lib/types";

interface Filters {
  category: string;
  stockStatus: string;
  search: string;
}

function useAdminProducts(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.stockStatus !== "all") params.set("stockStatus", filters.stockStatus);
  if (filters.search) params.set("search", filters.search);
  params.set("limit", "50");

  return useQuery({
    queryKey: ["admin-products", filters],
    queryFn: () => api.get<PaginatedResult<AdminProduct>>(`/products/admin?${params}`),
  });
}

export default function ProductsPage() {
  const [filters, setFilters] = useState<Filters>({ category: "all", stockStatus: "all", search: "" });
  const { data, isLoading } = useAdminProducts(filters);
  const { data: categories = [] } = useCategories();
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }

  const markOutOfStock = useMutation({
    mutationFn: (product: AdminProduct) =>
      api.patch(`/products/${product._id}/stock`, {
        variants: product.variants.map((v) => ({ id: v.id, stock: 0 })),
      }),
    onSuccess: () => {
      toast.success("Marked out of stock");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.del(`/products/${id}`),
    onSuccess: () => {
      toast.success("Product deleted");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const products = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-obsidian">Products</h1>
        <Link href="/admin/products/new">
          <Button>New Product</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search by name…"
          className="max-w-xs"
        />
        <Select value={filters.category} onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category._id} value={category.slug}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.stockStatus} onValueChange={(v) => setFilters((f) => ({ ...f, stockStatus: v }))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock levels</SelectItem>
            <SelectItem value="in">In stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-obsidian/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-obsidian/50">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && products.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-obsidian/50">
                  No products match these filters.
                </TableCell>
              </TableRow>
            )}
            {products.map((product) => {
              const tone = stockTone(product.stock);
              return (
                <TableRow key={product._id}>
                  <TableCell className="flex items-center gap-3">
                    {product.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.images[0]} alt="" className="h-10 w-10 rounded object-cover" />
                    )}
                    <span className="text-obsidian">{product.name}</span>
                  </TableCell>
                  <TableCell className="text-obsidian/70">
                    {product.category} / {product.subCategory}
                  </TableCell>
                  <TableCell className="text-obsidian/70">{formatCurrency(product.price)}</TableCell>
                  <TableCell>
                    <Badge tone={tone}>{product.stock} in stock</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-3 text-xs uppercase tracking-wide">
                      <Link href={`/admin/products/${product._id}/edit`} className="text-obsidian/70 hover:text-obsidian">
                        Edit
                      </Link>
                      {product.stock > 0 && (
                        <button
                          onClick={() => markOutOfStock.mutate(product)}
                          className="text-obsidian/70 hover:text-obsidian"
                        >
                          Mark out of stock
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${product.name}"?`)) deleteProduct.mutate(product._id);
                        }}
                        className="text-obsidian/70 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
