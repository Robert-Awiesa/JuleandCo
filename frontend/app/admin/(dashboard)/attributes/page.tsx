"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api } from "../../_lib/api";
import { resolveColorHex } from "../../_components/products/colorNames";
import { useAttributeGroups, useCategories } from "../../_lib/useCatalogConfig";
import type { Attribute, AttributeGroup, Category } from "../../_lib/types";
import { useInvalidate } from "../../_lib/invalidate";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const ROLE_BLURB: Record<string, string> = {
  spec: "Shown in the product's spec list.",
  selection: "Customers pick one, but it does not affect stock.",
  variantAxis: "A stock-bearing option — every value becomes an inventory row.",
  internal: "Admin only, or part of a combined spec such as measurements.",
};

function GroupPanel({ group, categories }: { group: AttributeGroup; categories: Category[] }) {
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState("");

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["attributes", group.key],
    queryFn: () => api.get<Attribute[]>(`/attributes?group=${group.key}`),
  });

  const createMutation = useMutation({
    mutationFn: (label: string) =>
      api.post<Attribute>("/attributes", {
        group: group.key,
        // Sizes and similar short codes are already canonical and are embedded
        // in variant ids, so they must not be slugified into "xs"/"s".
        value: group.key === "clothingSize" ? label.trim().toUpperCase() : slugify(label),
        label: label.trim(),
        hex: group.swatch ? resolveColorHex(label) ?? undefined : undefined,
        sortOrder: options.length,
      }),
    onSuccess: () => {
      toast.success("Option added");
      setDraft("");
      invalidate.configuration();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      api.put<Attribute>(`/attributes/${id}`, { label }),
    onSuccess: () => {
      toast.success("Renamed");
      invalidate.configuration();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const recolorMutation = useMutation({
    mutationFn: ({ id, hex }: { id: string; hex: string }) => api.put<Attribute>(`/attributes/${id}`, { hex }),
    onSuccess: () => invalidate.configuration(),
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/attributes/${id}`),
    onSuccess: () => {
      toast.success("Option removed");
      invalidate.configuration();
    },
    // A 409 means products still reference it; the API names how many.
    onError: (err: Error) => toast.error(err.message),
  });

  const appliesTo =
    group.categories.length === 0
      ? "All categories"
      : group.categories
          .map((slug) => categories.find((c) => c.slug === slug)?.name || slug)
          .join(", ");

  const usesOptions = group.inputType === "select" || group.inputType === "multiselect";

  return (
    <section className="rounded-lg border border-obsidian/10 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-obsidian">{group.label}</h2>
          <p className="mt-1 text-xs text-obsidian/50">
            {appliesTo} · {ROLE_BLURB[group.role] || group.role}
          </p>
        </div>
        <code className="shrink-0 text-xs text-obsidian/35">{group.key}</code>
      </div>

      {!usesOptions ? (
        <p className="mt-4 text-sm text-obsidian/45">
          Free {group.inputType} field — typed directly on each product, no option list.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {isLoading && <p className="text-sm text-obsidian/40">Loading…</p>}
            {!isLoading && options.length === 0 && (
              <p className="text-sm text-obsidian/40">Nothing defined yet.</p>
            )}
            {options.map((option) => (
              <div key={option._id} className="flex items-center gap-3">
                {group.swatch && (
                  <input
                    type="color"
                    value={option.hex || "#9CA3AF"}
                    onChange={(e) => recolorMutation.mutate({ id: option._id, hex: e.target.value })}
                    aria-label={`Colour for ${option.label}`}
                    className="h-7 w-7 shrink-0 cursor-pointer rounded border border-obsidian/15 bg-transparent p-0"
                  />
                )}
                <input
                  defaultValue={option.label}
                  onBlur={(e) => {
                    const label = e.target.value.trim();
                    if (label && label !== option.label) renameMutation.mutate({ id: option._id, label });
                  }}
                  className="flex-1 rounded border border-transparent px-2 py-1.5 text-sm hover:border-obsidian/15 focus:border-obsidian/40 focus:outline-none"
                />
                <code className="shrink-0 text-xs text-obsidian/35">{option.value}</code>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove "${option.label}"?`)) deleteMutation.mutate(option._id);
                  }}
                  aria-label={`Remove ${option.label}`}
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
              if (draft.trim()) createMutation.mutate(draft);
            }}
            className="mt-4 flex gap-2 border-t border-obsidian/10 pt-4"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add an option…"
              className="flex-1 rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
            />
            <button
              type="submit"
              disabled={createMutation.isPending || !draft.trim()}
              className="rounded bg-obsidian px-4 py-2 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </>
      )}
    </section>
  );
}

/** Creates a whole new vocabulary — previously only possible in code. */
function NewGroupForm({ categories }: { categories: Category[] }) {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [inputType, setInputType] = useState("select");
  const [role, setRole] = useState("spec");

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<AttributeGroup>("/attribute-groups", {
        key: slugify(label).replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
        label: label.trim(),
        categories: category ? [category] : [],
        inputType,
        role,
        showInFilters: role === "spec" || role === "selection" || role === "variantAxis",
        filterStyle: "chips",
      }),
    onSuccess: () => {
      toast.success("Attribute group created");
      setLabel("");
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
        + New attribute group
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (label.trim()) createMutation.mutate();
      }}
      className="rounded-lg border border-obsidian/15 bg-white p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ng-label" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Name
          </label>
          <input
            id="ng-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Gemstone"
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ng-category" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Applies to
          </label>
          <select
            id="ng-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ng-input" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Entered as
          </label>
          <select
            id="ng-input"
            value={inputType}
            onChange={(e) => setInputType(e.target.value)}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          >
            <option value="select">Pick one from a list</option>
            <option value="multiselect">Pick several from a list</option>
            <option value="text">Free text</option>
            <option value="number">Number</option>
          </select>
        </div>
        <div>
          <label htmlFor="ng-role" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Behaves as
          </label>
          <select
            id="ng-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm"
          >
            <option value="spec">Spec — listed on the product page</option>
            <option value="selection">Selection — chosen, but not stocked</option>
            <option value="variantAxis">Variant — every value is stocked</option>
            <option value="internal">Internal — admin only</option>
          </select>
          <p className="mt-1 text-xs text-obsidian/45">{ROLE_BLURB[role]}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={!label.trim() || createMutation.isPending}
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

export default function AttributesPage() {
  const { data: groups = [], isLoading } = useAttributeGroups();
  const { data: categories = [] } = useCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-obsidian">Attributes</h1>
        <p className="mt-2 max-w-2xl text-sm text-obsidian/60">
          The option lists behind every product dropdown and shop filter. Because products store a
          stable code rather than the text, renaming an option here updates it across the whole
          catalogue at once. An option in use by any product cannot be deleted.
        </p>
      </div>

      <NewGroupForm categories={categories} />

      {isLoading ? (
        <p className="text-sm text-obsidian/40">Loading…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {groups.map((group) => (
            <GroupPanel key={group._id} group={group} categories={categories} />
          ))}
        </div>
      )}
    </div>
  );
}
