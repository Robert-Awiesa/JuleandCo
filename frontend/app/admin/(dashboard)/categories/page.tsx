"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../_lib/api";
import type { Subcategory } from "../../_lib/types";

type CategoryType = "eyewear" | "apparel";

function useSubcategories(categoryType: CategoryType) {
  return useQuery({
    queryKey: ["subcategories", categoryType],
    queryFn: () => api.get<Subcategory[]>(`/subcategories?categoryType=${categoryType}`),
  });
}

function CategoryPanel({ categoryType, title }: { categoryType: CategoryType; title: string }) {
  const queryClient = useQueryClient();
  const { data: subcategories = [], isLoading } = useSubcategories(categoryType);
  const [newName, setNewName] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["subcategories", categoryType] });
  }

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.post<Subcategory>("/subcategories", {
        name,
        slug: name.toLowerCase().trim().replace(/\s+/g, "-"),
        categoryType,
        sortOrder: subcategories.length,
      }),
    onSuccess: () => {
      toast.success("Sub-category added");
      setNewName("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put<Subcategory>(`/subcategories/${id}`, { name }),
    onSuccess: () => {
      toast.success("Sub-category renamed");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/subcategories/${id}`),
    onSuccess: () => {
      toast.success("Sub-category deleted");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="rounded-lg border border-obsidian/10 bg-white">
      <div className="border-b border-obsidian/10 px-5 py-4">
        <h2 className="text-sm font-medium text-obsidian">{title}</h2>
      </div>
      <ul className="divide-y divide-obsidian/10">
        {isLoading && <li className="px-5 py-4 text-sm text-obsidian/50">Loading…</li>}
        {subcategories.map((sub) => (
          <li key={sub._id} className="flex items-center justify-between px-5 py-3">
            <input
              defaultValue={sub.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== sub.name) {
                  renameMutation.mutate({ id: sub._id, name: e.target.value.trim() });
                }
              }}
              className="w-full bg-transparent text-sm text-obsidian outline-none focus:underline"
            />
            <button
              onClick={() => {
                if (confirm(`Delete "${sub.name}"?`)) deleteMutation.mutate(sub._id);
              }}
              className="ml-4 text-xs uppercase tracking-wide text-obsidian/40 hover:text-red-600"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) createMutation.mutate(newName.trim());
        }}
        className="flex gap-2 border-t border-obsidian/10 px-5 py-3"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New sub-category name"
          className="flex-1 rounded border border-obsidian/15 px-3 py-1.5 text-sm outline-none focus:border-obsidian/40"
        />
        <button
          type="submit"
          className="rounded bg-obsidian px-4 py-1.5 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian"
        >
          Add
        </button>
      </form>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl text-obsidian">Categories</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <CategoryPanel categoryType="eyewear" title="Eyewear" />
        <CategoryPanel categoryType="apparel" title="Apparel" />
      </div>
    </div>
  );
}
