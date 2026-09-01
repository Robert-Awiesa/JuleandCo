"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api } from "../../_lib/api";
import { useCategories } from "../../_lib/useCatalogConfig";
import type { Category, Subcategory } from "../../_lib/types";
import { useInvalidate } from "../../_lib/invalidate";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function CategoryPanel({ category }: { category: Category }) {
  const invalidate = useInvalidate();
  const [newName, setNewName] = useState("");

  const { data: subcategories = [], isLoading } = useQuery({
    queryKey: ["subcategories", category.slug],
    queryFn: () => api.get<Subcategory[]>(`/subcategories?categoryType=${category.slug}`),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.post<Subcategory>("/subcategories", {
        name,
        slug: slugify(name),
        categoryType: category.slug,
        sortOrder: subcategories.length,
      }),
    onSuccess: () => {
      toast.success("Sub-category added");
      setNewName("");
      invalidate.configuration();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put<Subcategory>(`/subcategories/${id}`, { name }),
    onSuccess: () => {
      toast.success("Sub-category renamed");
      invalidate.configuration();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/subcategories/${id}`),
    onSuccess: () => {
      toast.success("Sub-category deleted");
      invalidate.configuration();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const retireMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      api.put<Category>(`/categories/id/${category._id}`, { isActive }),
    onSuccess: () => {
      toast.success(category.isActive ? "Category retired" : "Category reactivated");
      invalidate.configuration();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /**
   * Removing a category for good.
   *
   * Retiring is the right answer almost every time — it takes a line off the
   * shop and keeps its products editable. This is for a category that was
   * created by mistake, or a line the shop is genuinely finished with.
   *
   * The API refuses while anything still depends on it: products, sub-categories,
   * or attribute groups that apply to it and nothing else. Those refusals name
   * what is in the way, so they are shown as they come back rather than
   * flattened into "could not delete".
   */
  const deleteCategoryMutation = useMutation({
    mutationFn: () => api.del(`/categories/id/${category._id}`),
    onSuccess: () => {
      toast.success(`"${category.name}" deleted`);
      invalidate.configuration();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section
      className={
        category.isActive
          ? "rounded-lg border border-obsidian/10 bg-white p-5"
          : "rounded-lg border border-dashed border-obsidian/20 bg-obsidian/[0.02] p-5"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-obsidian">
            {category.name}
            {!category.isActive && (
              <span className="ml-2 rounded-full bg-obsidian/10 px-2 py-0.5 text-xs uppercase tracking-wide text-obsidian/60">
                Retired
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs text-obsidian/50">
            {category.optionDefaults.length > 0
              ? `Varies by ${category.optionDefaults.map((o) => o.label).join(" × ")}`
              : "No variant axes configured"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => retireMutation.mutate(!category.isActive)}
            className="text-xs uppercase tracking-wide text-obsidian/50 underline-offset-4 hover:text-obsidian hover:underline"
          >
            {category.isActive ? "Retire" : "Reactivate"}
          </button>

          {/* Deliberately quieter than Retire, and it says "permanently" —
              retiring is reversible and is what you almost always want. */}
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `Permanently delete the "${category.name}" category?\n\n` +
                    `This cannot be undone. Retiring hides it from the shop instead ` +
                    `and keeps everything editable.`
                )
              ) {
                deleteCategoryMutation.mutate();
              }
            }}
            disabled={deleteCategoryMutation.isPending}
            className="text-xs uppercase tracking-wide text-obsidian/35 underline-offset-4 hover:text-red-600 hover:underline disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      {!category.isActive && (
        <p className="mt-3 rounded bg-obsidian/5 px-3 py-2 text-xs text-obsidian/60">
          Hidden from the storefront. Its products are kept and stay editable here.
        </p>
      )}

      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-sm text-obsidian/40">Loading…</p>}
        {!isLoading && subcategories.length === 0 && (
          <p className="text-sm text-obsidian/40">No sub-categories yet.</p>
        )}
        {subcategories.map((sub) => (
          <div key={sub._id} className="flex items-center gap-3">
            <input
              defaultValue={sub.name}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== sub.name) renameMutation.mutate({ id: sub._id, name });
              }}
              className="flex-1 rounded border border-transparent px-2 py-1.5 text-sm hover:border-obsidian/15 focus:border-obsidian/40 focus:outline-none"
            />
            <code className="shrink-0 text-xs text-obsidian/35">{sub.slug}</code>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete "${sub.name}"?`)) deleteMutation.mutate(sub._id);
              }}
              aria-label={`Delete ${sub.name}`}
              className="shrink-0 text-obsidian/30 hover:text-red-600"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) createMutation.mutate(newName);
        }}
        className="mt-4 flex gap-2 border-t border-obsidian/10 pt-4"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a sub-category…"
          className="flex-1 rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !newName.trim()}
          className="rounded bg-obsidian px-4 py-2 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </section>
  );
}

/**
 * Creating a category used to require editing a Mongoose enum, two TypeScript
 * unions and a Zod schema. It is a form now.
 */
function NewCategoryForm() {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [primaryAxis, setPrimaryAxis] = useState("Colour");

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Category>("/categories", {
        name: name.trim(),
        slug: slugify(name),
        isActive: true,
        // A category needs at least one axis or its products cannot be stocked.
        optionDefaults: primaryAxis.trim()
          ? [{ label: primaryAxis.trim(), swatch: true }]
          : [],
        combinedSpecs: [],
      }),
    onSuccess: () => {
      toast.success("Category created");
      setName("");
      setOpen(false);
      invalidate.configuration();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-dashed border-obsidian/25 px-4 py-2 text-xs uppercase tracking-wide text-obsidian/60 hover:border-obsidian/50 hover:text-obsidian"
      >
        + New category
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) createMutation.mutate();
      }}
      className="rounded-lg border border-obsidian/15 bg-white p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nc-name" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Name
          </label>
          <input
            id="nc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jewellery"
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="nc-axis" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Main variant axis
          </label>
          <input
            id="nc-axis"
            value={primaryAxis}
            onChange={(e) => setPrimaryAxis(e.target.value)}
            placeholder="e.g. Metal"
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-obsidian/45">
            What products in this category vary by. Add more axes per product on the Options tab.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={!name.trim() || createMutation.isPending}
          className="rounded bg-obsidian px-4 py-2 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-40"
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-obsidian/20 px-4 py-2 text-xs uppercase tracking-wide text-obsidian/60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-obsidian">Categories</h1>
        <p className="mt-2 max-w-2xl text-sm text-obsidian/60">
          Top-level categories and the sub-categories beneath them. Retiring a category hides it and
          its products from the storefront without deleting anything; a category still holding
          products cannot be deleted outright.
        </p>
      </div>

      <NewCategoryForm />

      {isLoading ? (
        <p className="text-sm text-obsidian/40">Loading…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {categories.map((category) => (
            <CategoryPanel key={category._id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
