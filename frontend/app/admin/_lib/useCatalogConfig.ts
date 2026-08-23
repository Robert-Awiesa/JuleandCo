"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Attribute, AttributeGroup, Category, CategorySlug } from "./types";

/**
 * Categories and vocabularies are read by nearly every admin screen and change
 * rarely, so they are worth caching — but five minutes was too long. A category
 * retired in one tab went on being offered by the product form in another for
 * the rest of that window, which looks like the form ignoring the change.
 *
 * Thirty seconds keeps the saving (a tab switch does not refetch the whole
 * vocabulary) while staying inside the time it takes to notice. Edits made in
 * this tab do not wait for it at all: they invalidate through
 * _lib/invalidate.ts.
 */
const CONFIG_STALE_TIME = 30_000;

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
