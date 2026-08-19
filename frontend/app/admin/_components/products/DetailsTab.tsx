"use client";

import { useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../_lib/api";
import type { Subcategory } from "../../_lib/types";
import { TagsInput } from "./TagsInput";
import type { ProductFormInput } from "./schema";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function DetailsTab() {
  const { register, watch, setValue, formState } = useFormContext<ProductFormInput>();
  const category = watch("category");

  const { data: subcategories = [] } = useQuery({
    queryKey: ["subcategories", category],
    queryFn: () => api.get<Subcategory[]>(`/subcategories?categoryType=${category}`),
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
            {...register("category", { onChange: () => setValue("subCategory", "", { shouldDirty: true }) })}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          >
            <option value="eyewear">Eyewear</option>
            <option value="apparel">Apparel</option>
          </select>
        </div>

        <div>
          <label htmlFor="product-subcategory" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Sub-category
          </label>
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
          <option value="published">Published — live for customers</option>
        </select>
        <p className="mt-1 text-xs text-obsidian/45">
          New products start as drafts. Nothing appears in the shop, search, or collections until this
          is set to Published.
        </p>
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
