"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/admin-ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/admin-ui/select";
import { Badge } from "@/components/admin-ui/badge";
import { Button } from "@/components/admin-ui/button";
import { Input } from "@/components/admin-ui/input";
import { api } from "../../_lib/api";
import { useCategories } from "../../_lib/useCatalogConfig";
import { useInvalidate } from "../../_lib/invalidate";
import { formatCurrency, stockTone } from "../../_lib/format";
import type { AdminProduct, PaginatedResult } from "../../_lib/types";

const PAGE_SIZE = 25;

interface Filters {
  category: string;
  stockStatus: string;
  publishStatus: string;
  search: string;
  sort: string;
}

interface BulkResult {
  updated: number;
  skipped: { id: string; name: string; blockers: { id: string; label: string }[] }[];
}

function useAdminProducts(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.stockStatus !== "all") params.set("stockStatus", filters.stockStatus);
  if (filters.publishStatus !== "all") params.set("publishStatus", filters.publishStatus);
  if (filters.search) params.set("search", filters.search);
  params.set("sort", filters.sort);
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));

  return useQuery({
    queryKey: ["admin-products", filters, page],
    queryFn: () => api.get<PaginatedResult<AdminProduct>>(`/products/admin?${params}`),
  });
}

export default function ProductsPage() {
  const [filters, setFilters] = useState<Filters>({
    category: "all",
    stockStatus: "all",
    publishStatus: "all",
    search: "",
    sort: "newest",
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading } = useAdminProducts(filters, page);
  const { data: categories = [] } = useCategories();
  const invalidate = useInvalidate();

  // Any filter change re-pages from the start, otherwise you can land on page 4
  // of a two-page result and see nothing.
  function setFilter(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setSelected([]);
  }

  const markOutOfStock = useMutation({
    mutationFn: (product: AdminProduct) =>
      api.patch(`/products/${product._id}/stock`, {
        variants: product.variants.map((v) => ({ id: v.id, stock: 0 })),
      }),
    onSuccess: () => {
      toast.success("Marked out of stock");
      invalidate.catalogue();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /**
   * Deleting asks the API what points at the product first.
   *
   * Order lines, reviews and other products' cross-sell lists all reference it,
   * and none of that was mentioned before. An ordered product cannot be deleted
   * at all — the API refuses — so the offer becomes "move it to draft", which is
   * what was almost always wanted anyway.
   */
  const deleteProduct = useMutation({
    mutationFn: async (product: AdminProduct) => {
      const usage = await api.get<{
        orders: number;
        reviews: number;
        pairedWith: number;
        canDelete: boolean;
      }>(`/products/${product._id}/usage`);

      if (!usage.canDelete) {
        const draft = confirm(
          `"${product.name}" appears in ${usage.orders} ${usage.orders === 1 ? "order" : "orders"}, ` +
            `so it cannot be deleted without breaking that history.

` +
            `Move it to Draft instead? It comes off the shop straight away and the orders stay intact.`
        );
        if (draft) {
          await api.patch("/products/bulk", { ids: [product._id], action: "unpublish" });
          return { drafted: true } as const;
        }
        return { cancelled: true } as const;
      }

      const attached: string[] = [];
      if (usage.reviews > 0) attached.push(`${usage.reviews} review${usage.reviews === 1 ? "" : "s"}`);
      if (usage.pairedWith > 0)
        attached.push(`${usage.pairedWith} cross-sell link${usage.pairedWith === 1 ? "" : "s"}`);

      const warning = attached.length
        ? `

This will also remove ${attached.join(" and ")}.`
        : "";

      if (!confirm(`Delete "${product.name}" permanently?${warning}`)) {
        return { cancelled: true } as const;
      }

      await api.del(`/products/${product._id}`);
      return { deleted: true } as const;
    },
    onSuccess: (result) => {
      if ("cancelled" in result) return;
      toast.success("drafted" in result ? "Moved to draft and off the shop" : "Product deleted");
      invalidate.catalogue();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => api.post<AdminProduct>(`/products/${id}/duplicate`, {}),
    onSuccess: (copy) => {
      toast.success(`Created "${copy.name}" as a draft`);
      invalidate.catalogue();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulk = useMutation({
    mutationFn: (action: "publish" | "unpublish" | "outOfStock") =>
      api.patch<BulkResult>("/products/bulk", { ids: selected, action }),
    onSuccess: (result) => {
      if (result.skipped.length > 0) {
        // The API refuses to publish an incomplete product. Saying which, and
        // why, is the difference between a bug and an explanation.
        const names = result.skipped.map((s) => s.name).join(", ");
        toast.warning(
          `${result.updated} published. ${result.skipped.length} skipped — ${names} still need work.`,
          { duration: 8000 }
        );
      } else {
        toast.success(`${result.updated} ${result.updated === 1 ? "product" : "products"} updated`);
      }
      setSelected([]);
      invalidate.catalogue();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const products = data?.items ?? [];
  const allOnPageSelected = products.length > 0 && products.every((p) => selected.includes(p._id));

  function toggleAll() {
    setSelected(allOnPageSelected ? [] : products.map((p) => p._id));
  }

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

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
          onChange={(e) => setFilter({ search: e.target.value })}
          placeholder="Name, tag or SKU…"
          className="max-w-xs"
        />
        <Select value={filters.category} onValueChange={(v) => setFilter({ category: v })}>
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
        <Select value={filters.publishStatus} onValueChange={(v) => setFilter({ publishStatus: v })}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Drafts &amp; published</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.stockStatus} onValueChange={(v) => setFilter({ stockStatus: v })}>
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
        <Select value={filters.sort} onValueChange={(v) => setFilter({ sort: v })}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="price-desc">Price, high to low</SelectItem>
            <SelectItem value="price-asc">Price, low to high</SelectItem>
            <SelectItem value="stock-asc">Stock, lowest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/40 bg-gold/5 px-4 py-3">
          <span className="text-sm text-obsidian">
            {selected.length} selected
          </span>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide">
            <button
              onClick={() => bulk.mutate("publish")}
              disabled={bulk.isPending}
              className="rounded bg-obsidian px-3 py-1.5 text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-40"
            >
              Publish
            </button>
            <button
              onClick={() => bulk.mutate("unpublish")}
              disabled={bulk.isPending}
              className="rounded border border-obsidian/25 px-3 py-1.5 text-obsidian/70 hover:text-obsidian disabled:opacity-40"
            >
              Move to draft
            </button>
            <button
              onClick={() => {
                if (confirm(`Mark ${selected.length} product(s) out of stock?`)) {
                  bulk.mutate("outOfStock");
                }
              }}
              disabled={bulk.isPending}
              className="rounded border border-obsidian/25 px-3 py-1.5 text-obsidian/70 hover:text-obsidian disabled:opacity-40"
            >
              Mark out of stock
            </button>
          </div>
          <button
            onClick={() => setSelected([])}
            className="ml-auto text-xs uppercase tracking-wide text-obsidian/50 hover:text-obsidian"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-obsidian/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  aria-label="Select all on this page"
                  className="h-4 w-4 accent-black"
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-obsidian/50">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && products.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-obsidian/50">
                  No products match these filters.
                </TableCell>
              </TableRow>
            )}
            {products.map((product) => {
              const tone = stockTone(product.stock);
              const isDraft = product.publishStatus !== "published";
              return (
                <TableRow key={product._id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.includes(product._id)}
                      onChange={() => toggleOne(product._id)}
                      aria-label={`Select ${product.name}`}
                      className="h-4 w-4 accent-black"
                    />
                  </TableCell>
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
                  <TableCell>
                    <Badge tone={isDraft ? "neutral" : "in"}>{isDraft ? "Draft" : "Live"}</Badge>
                    {/* Why it is a draft, rather than making someone open it
                        to find out. A draft with nothing blocking it is a piece
                        that could be earning. */}
                    {isDraft && (
                      <p
                        className={
                          (product.blockers?.length ?? 0) > 0
                            ? "mt-1 text-xs text-obsidian/45"
                            : "mt-1 text-xs text-green-700"
                        }
                      >
                        {(product.blockers?.length ?? 0) > 0
                          ? `Needs ${product.blockers!.join(", ").toLowerCase()}`
                          : "Ready to publish"}
                      </p>
                    )}
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
                      <button
                        onClick={() => duplicate.mutate(product._id)}
                        disabled={duplicate.isPending}
                        className="text-obsidian/70 hover:text-obsidian disabled:opacity-40"
                      >
                        Duplicate
                      </button>
                      {product.stock > 0 ? (
                        <button
                          onClick={() => markOutOfStock.mutate(product)}
                          className="text-obsidian/70 hover:text-obsidian"
                        >
                          Mark out of stock
                        </button>
                      ) : (
                        // The way back. Real numbers are set per variant, so
                        // this opens the grid rather than inventing a figure.
                        <Link
                          href={`/admin/products/${product._id}/edit?tab=inventory`}
                          className="text-obsidian/70 hover:text-obsidian"
                        >
                          Restock
                        </Link>
                      )}
                      <button
                        onClick={() => deleteProduct.mutate(product)}
                        disabled={deleteProduct.isPending}
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

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-obsidian/50">
            Page {data.page} of {data.pages} · {data.total} products
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                setSelected([]);
              }}
              disabled={data.page <= 1}
              className="rounded border border-obsidian/20 px-4 py-2 text-xs uppercase tracking-wide disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => {
                setPage((p) => p + 1);
                setSelected([]);
              }}
              disabled={data.page >= data.pages}
              className="rounded border border-obsidian/20 px-4 py-2 text-xs uppercase tracking-wide disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
