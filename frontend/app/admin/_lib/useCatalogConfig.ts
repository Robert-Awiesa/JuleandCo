"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Attribute, AttributeGroup, Category, CategorySlug } from "./types";

// Categories and vocabularies change rarely but are read by nearly every admin
// screen, so they are cached for the session rather than refetched per tab.
const CONFIG_STALE_TIME = 5 * 60_000;

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
    staleTime: CONFIG_STALE_TIME,
  });
}

/**
 * Attribute groups, optionally narrowed to one category. The server includes
 * groups with no categories listed, which apply everywhere.
 */
export function useAttributeGroups(category?: CategorySlug) {
  const params = category ? `?category=${encodeURIComponent(category)}` : "";
  return useQuery({
    queryKey: ["attribute-groups", category ?? "all"],
    queryFn: () => api.get<AttributeGroup[]>(`/attribute-groups${params}`),
    staleTime: CONFIG_STALE_TIME,
  });
}

/** Every option in one vocabulary. */
export function useAttributes(group: string, enabled = true) {
  return useQuery({
    queryKey: ["attributes", group],
    queryFn: () => api.get<Attribute[]>(`/attributes?group=${encodeURIComponent(group)}`),
    staleTime: CONFIG_STALE_TIME,
    enabled: enabled && Boolean(group),
  });
}

/** Every option for a category's groups in one request, keyed by group. */
export function useAttributesForCategory(category?: CategorySlug) {
  return useQuery({
    queryKey: ["attributes", "by-category", category ?? "all"],
    queryFn: async () => {
      const params = category ? `?category=${encodeURIComponent(category)}` : "";
      const all = await api.get<Attribute[]>(`/attributes${params}`);
      return all.reduce<Record<string, Attribute[]>>((acc, attribute) => {
        (acc[attribute.group] ||= []).push(attribute);
        return acc;
      }, {});
    },
    staleTime: CONFIG_STALE_TIME,
  });
}
