"use client";

import { useState, type KeyboardEvent } from "react";
import { useFormContext } from "react-hook-form";
import { X } from "lucide-react";
import type { ProductFormInput } from "./schema";

/**
 * Free-form tags, rendered as badges on both the product card and the product
 * page. The field was in the save payload from the start but had no input, so
 * every save wrote an empty array and no product could ever carry a tag.
 *
 * Deliberately not vocabulary-backed: tags are editorial ("Limited Edition",
 * "Made in Ghana"), not a filter facet.
 */
export function TagsInput() {
  const { watch, setValue } = useFormContext<ProductFormInput>();
  const tags = watch("tags") ?? [];
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    if (!value) return;
    if (!tags.includes(value)) {
      setValue("tags", [...tags, value], { shouldDirty: true });
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      // Enter would otherwise submit the whole product form.
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      setValue("tags", tags.slice(0, -1), { shouldDirty: true });
    }
  }

  return (
    <div>
      <label htmlFor="product-tags" className="text-xs uppercase tracking-widest2 text-obsidian/60">
        Tags
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2 rounded border border-obsidian/15 px-2 py-2 focus-within:border-obsidian/40">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-obsidian/5 px-2.5 py-1 text-xs text-obsidian/80"
          >
            {tag}
            <button
              type="button"
              onClick={() => setValue("tags", tags.filter((t) => t !== tag), { shouldDirty: true })}
              aria-label={`Remove ${tag}`}
              className="text-obsidian/40 hover:text-red-600"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          id="product-tags"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={tags.length === 0 ? "e.g. Limited Edition — press Enter after each" : ""}
          className="min-w-[12rem] flex-1 border-none bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
      <p className="mt-1 text-xs text-obsidian/45">Shown as badges on the product card and product page.</p>
    </div>
  );
}
