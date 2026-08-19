"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api } from "../../_lib/api";
import { resolveColorHex } from "../../_components/products/colorNames";
import type { Attribute, AttributeGroup, ProductCategory } from "../../_lib/types";

/**
 * The controlled vocabularies behind the product form's dropdowns and the
 * storefront's filter facets. Editing a label here renames it everywhere,
 * because products store the immutable `value` slug rather than the label.
 */
const GROUPS: {
  group: AttributeGroup;
  title: string;
  blurb: string;
  categoryType?: ProductCategory;
  swatches?: boolean;
}[] = [
  {
    group: "frameShape",
    title: "Frame shapes",
    blurb: "Aviator, Round, Cat-Eye… Becomes the Frame Shape filter on the shop page.",
    categoryType: "eyewear",
  },
  {
    group: "lensType",
    title: "Lens types",
    blurb:
      "Both finishes (Gold Mirror, Smoke) and technologies (Polarised, UV400). Shoppers choose from these on the product page.",
    categoryType: "eyewear",
    swatches: true,
  },
  {
    group: "frameMaterial",
    title: "Frame materials",
    blurb: "Acetate, Titanium, Bio-Acetate…",
    categoryType: "eyewear",
  },
  {
    group: "fabric",
    title: "Fabrics",
    blurb: "Used for apparel, and drives the Fabric filter.",
    categoryType: "apparel",
  },
  {
    group: "clothingSize",
    title: "Clothing sizes",
    blurb: "Each size selected on a product becomes a row per colour in its Inventory grid.",
    categoryType: "apparel",
  },
  { group: "fit", title: "Fits", blurb: "Slim, Relaxed, Tailored…", categoryType: "apparel" },
  { group: "gender", title: "Designed for", blurb: "Applies to both eyewear and apparel." },
];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function GroupPanel({
  group,
  title,
  blurb,
  categoryType,
  swatches,
}: (typeof GROUPS)[number]) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["attributes", group, "all"],
    queryFn: () => api.get<Attribute[]>(`/attributes?group=${group}`),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["attributes"] });
  }

  const createMutation = useMutation({
    mutationFn: (label: string) =>
      api.post<Attribute>("/attributes", {
        group,
        // Sizes are already canonical codes and are embedded in variant ids,
        // so they must not be slugified into "xs"/"s".
        value: group === "clothingSize" ? label.trim().toUpperCase() : slugify(label),
        label: label.trim(),
        hex: swatches ? resolveColorHex(label) ?? undefined : undefined,
        categoryType,
        sortOrder: options.length,
      }),
    onSuccess: () => {
      toast.success("Option added");
      setDraft("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      api.put<Attribute>(`/attributes/${id}`, { label }),
    onSuccess: () => {
      toast.success("Renamed");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const recolorMutation = useMutation({
    mutationFn: ({ id, hex }: { id: string; hex: string }) => api.put<Attribute>(`/attributes/${id}`, { hex }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/attributes/${id}`),
    onSuccess: () => {
      toast.success("Option removed");
      invalidate();
    },
    // A 409 here means products still reference the option — the message from
    // the API names how many, so surface it verbatim.
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="rounded-lg border border-obsidian/10 bg-white p-5">
      <h2 className="font-serif text-lg text-obsidian">{title}</h2>
      <p className="mt-1 text-xs text-obsidian/50">{blurb}</p>

      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-sm text-obsidian/40">Loading…</p>}
        {!isLoading && options.length === 0 && (
          <p className="text-sm text-obsidian/40">Nothing defined yet.</p>
        )}
        {options.map((option) => (
          <div key={option._id} className="flex items-center gap-3">
            {swatches && (
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
    </section>
  );
}

export default function AttributesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-obsidian">Attributes</h1>
        <p className="mt-2 max-w-2xl text-sm text-obsidian/60">
          The option lists behind every product dropdown. Because products store a stable code rather
          than the text, renaming an option here updates it across the whole catalogue and the shop
          filters at once. An option in use by any product cannot be deleted.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <GroupPanel key={g.group} {...g} />
        ))}
      </div>
    </div>
  );
}
