"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../_lib/api";
import type { Subcategory } from "../../_lib/types";
import { useAttributeGroups, useCategories } from "../../_lib/useCatalogConfig";
import { TagsInput } from "./TagsInput";
import { evaluateReadiness } from "./readiness";
import { useInvalidate } from "../../_lib/invalidate";
import type { ProductFormInput } from "./schema";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function DetailsTab() {
  const { control, register, watch, setValue, formState } = useFormContext<ProductFormInput>();
  const category = watch("category");
  const invalidate = useInvalidate();

  const [addingSub, setAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");

  // Publishing is gated on the same rules the API enforces, so the option is
  // unselectable rather than failing on save with a message from the server.
  const values = useWatch({ control }) as ProductFormInput;
  const { data: groups = [] } = useAttributeGroups(category || undefined);
  const { blockers, canPublish } = evaluateReadiness(values, groups);
  const missing = blockers.filter((b) => !b.done);

  // Categories are records now, so the dropdown is data rather than two
  // hardcoded <option>s. A retired category is still offered when the product
  // being edited already sits in it, so its form stays usable.
  const { data: categories = [] } = useCategories();
  const selectable = categories.filter((c) => c.isActive || c.slug === category);

  const { data: subcategories = [] } = useQuery({
    queryKey: ["subcategories", category],
    queryFn: () => api.get<Subcategory[]>(`/subcategories?categoryType=${category}`),
    enabled: Boolean(category),
  });

  const createSub = useMutation({
    mutationFn: (name: string) =>
      api.post<Subcategory>("/subcategories", {
        name: name.trim(),
        slug: slugify(name),
        categoryType: category,
      }),
    onSuccess: (created) => {
      invalidate.configuration();
      // Select it straight away — creating one is always in order to use it.
      setValue("subCategory", created.slug, { shouldDirty: true, shouldValidate: true });
      setAddingSub(false);
      setNewSubName("");
      toast.success(`Added "${created.name}"`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="grid max-w-3xl gap-5">
      <div>
        <label htmlFor="product-name" className="text-xs uppercase tracking-widest2 text-obsidian/60">
          Name
        </label>
        <input
          id="product-name"
          {...register("name", {
            onChange: (e) => setValue("slug", slugify(e.target.value), { shouldDirty: true }),
          })}
          className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
        />
        {formState.errors.name && <p className="mt-1 text-xs text-red-600">{formState.errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="product-slug" className="text-xs uppercase tracking-widest2 text-obsidian/60">
          Slug
        </label>
        <input
          id="product-slug"
          {...register("slug")}
          className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label htmlFor="product-category" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Category
          </label>
          <select
            id="product-category"
            {...register("category", {
              onChange: () => {
                // Changing category invalidates the sub-category, the
                // attribute values and the variant axes, all of which are
                // category-specific. Leaving them would save nonsense.
                setValue("subCategory", "", { shouldDirty: true });
                setValue("attributes", {}, { shouldDirty: true });
                setValue("options", [], { shouldDirty: true });
                setValue("variants", [], { shouldDirty: true });
              },
            })}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {selectable.map((option) => (
              <option key={option._id} value={option.slug}>
                {option.name}
                {option.isActive ? "" : " (retired)"}
              </option>
            ))}
          </select>
          {formState.errors.category && (
            <p className="mt-1 text-xs text-red-600">{formState.errors.category.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="product-subcategory" className="text-xs uppercase tracking-widest2 text-obsidian/60">
              Sub-category
            </label>
            {category && (
              <button
                type="button"
                onClick={() => setAddingSub(true)}
                className="text-xs text-gold-dark hover:underline"
              >
                + New
              </button>
            )}
          </div>

          {/* Creating one used to mean leaving the form for Categories and
              coming back, losing everything typed so far. */}
          {addingSub ? (
            <div className="mt-1 flex gap-2">
              <input
                autoFocus
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createSub.mutate(newSubName);
                  }
                  if (e.key === "Escape") setAddingSub(false);
                }}
                placeholder="e.g. Anklets"
                className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
              />
              <button
                type="button"
                onClick={() => createSub.mutate(newSubName)}
                disabled={!newSubName.trim() || createSub.isPending}
                className="shrink-0 rounded bg-obsidian px-3 text-xs uppercase tracking-wide text-alabaster disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAddingSub(false)}
                className="shrink-0 text-xs uppercase tracking-wide text-obsidian/50 hover:text-obsidian"
              >
                Cancel
              </button>
            </div>
          ) : (
            <select
              id="product-subcategory"
              {...register("subCategory")}
              className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {subcategories.map((sub) => (
                <option key={sub._id} value={sub.slug}>
                  {sub.name}
                </option>
              ))}
            </select>
          )}
          {formState.errors.subCategory && (
            <p className="mt-1 text-xs text-red-600">{formState.errors.subCategory.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="product-description" className="text-xs uppercase tracking-widest2 text-obsidian/60">
          Description
        </label>
        <textarea
          id="product-description"
          {...register("description")}
          rows={4}
          className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
        />
        {formState.errors.description && (
          <p className="mt-1 text-xs text-red-600">{formState.errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label htmlFor="product-price" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Price (GHS)
          </label>
          <input
            id="product-price"
            type="number"
            step="0.01"
            {...register("price")}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
          {formState.errors.price && <p className="mt-1 text-xs text-red-600">{formState.errors.price.message}</p>}
        </div>
        <div>
          <label htmlFor="product-compare-price" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Compare-at price
          </label>
          <input
            id="product-compare-price"
            type="number"
            step="0.01"
            {...register("compareAtPrice")}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-obsidian">
          <input type="checkbox" {...register("isNewArrival")} /> New arrival
        </label>
        <label className="flex items-center gap-2 text-sm text-obsidian">
          <input type="checkbox" {...register("isBestSeller")} /> Best seller
        </label>
      </div>

      <TagsInput />

      <div className="rounded border border-obsidian/10 p-4">
        <label htmlFor="publish-status" className="text-xs uppercase tracking-widest2 text-obsidian/60">
          Visibility
        </label>
        <select
          id="publish-status"
          {...register("publishStatus")}
          className="mt-1 w-full max-w-xs rounded border border-obsidian/15 px-3 py-2 text-sm"
        >
          <option value="draft">Draft — hidden from the storefront</option>
          <option value="published" disabled={!canPublish}>
            Published — live for customers
            {canPublish ? "" : " (not ready yet)"}
          </option>
        </select>
        {canPublish ? (
          <p className="mt-1 text-xs text-obsidian/45">
            New products start as drafts. Nothing appears in the shop, search, or collections until
            this is set to Published.
          </p>
        ) : (
          <p className="mt-1 text-xs text-amber-700">
            Cannot be published yet — still needs{" "}
            {missing.map((b) => b.label.toLowerCase()).join(", ")}. The checklist beside the form
            tracks this.
          </p>
        )}
      </div>

      <details className="rounded border border-obsidian/10 p-4">
        <summary className="cursor-pointer text-xs uppercase tracking-widest2 text-obsidian/60">
          Stock-keeping &amp; margin
        </summary>
        <div className="mt-4 grid grid-cols-3 gap-5">
          <div>
            <label htmlFor="cost-price" className="text-xs uppercase tracking-widest2 text-obsidian/60">
              Cost price
            </label>
            <input
              id="cost-price"
              type="number"
              step="0.01"
              {...register("costPrice")}
              className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
            />
          </div>
          <div>
            <label htmlFor="barcode" className="text-xs uppercase tracking-widest2 text-obsidian/60">
              Barcode
            </label>
            <input
              id="barcode"
              {...register("barcode")}
              className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
            />
          </div>
          <div>
            <label htmlFor="weight" className="text-xs uppercase tracking-widest2 text-obsidian/60">
              Weight (g)
            </label>
            <input
              id="weight"
              type="number"
              {...register("weightGrams")}
              className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-obsidian/45">Internal only — never sent to the storefront.</p>
      </details>

      <details className="rounded border border-obsidian/10 p-4">
        <summary className="cursor-pointer text-xs uppercase tracking-widest2 text-obsidian/60">
          Search engine listing
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="seo-title" className="text-xs uppercase tracking-widest2 text-obsidian/60">
              Page title
            </label>
            <input
              id="seo-title"
              {...register("seo.title")}
              placeholder={watch("name") || "Defaults to the product name"}
              className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
            />
          </div>
          <div>
            <label htmlFor="seo-description" className="text-xs uppercase tracking-widest2 text-obsidian/60">
              Meta description
            </label>
            <textarea
              id="seo-description"
              rows={2}
              {...register("seo.description")}
              placeholder="Defaults to the product description"
              className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
