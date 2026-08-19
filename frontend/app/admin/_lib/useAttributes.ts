"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Attribute, AttributeGroup, ProductCategory } from "./types";

/**
 * Reads one controlled vocabulary. Options with no `categoryType` apply to both
 * categories, so the server includes them whenever a category is supplied.
 */
export function useAttributes(group: AttributeGroup, categoryType?: ProductCategory) {
  const params = new URLSearchParams({ group });
  if (categoryType) params.set("categoryType", categoryType);

  return useQuery({
    queryKey: ["attributes", group, categoryType ?? "all"],
    queryFn: () => api.get<Attribute[]>(`/attributes?${params}`),
    // Vocabularies change rarely; avoid refetching on every tab switch.
    staleTime: 5 * 60_000,
  });
}
