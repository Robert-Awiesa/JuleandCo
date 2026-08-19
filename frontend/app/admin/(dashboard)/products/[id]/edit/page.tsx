"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../_lib/api";
import type { AdminProduct } from "../../../../_lib/types";
import { ProductForm } from "../../../../_components/products/ProductForm";

export default function EditProductPage({ params }: { params: { id: string } }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-product", params.id],
    queryFn: () => api.get<AdminProduct>(`/products/id/${params.id}`),
  });

  if (isLoading) return <p className="text-sm text-obsidian/50">Loading…</p>;
  if (!data) return <p className="text-sm text-red-600">Product not found.</p>;

  return <ProductForm product={data} />;
}
