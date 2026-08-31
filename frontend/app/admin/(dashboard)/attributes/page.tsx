"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
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

const ROLE_LABEL: Record<string, string> = {
  spec: "Spec",
  selection: "Selection",
  variantAxis: "Variant",
  internal: "Internal",
};

const INPUT_LABEL: Record<string, string> = {
  select: "Pick one from a list",
  multiselect: "Pick several from a list",
  text: "Free text",
  number: "Number",
};

const isList = (t: string) => t === "select" || t === "multiselect";

const fieldClass =
  "mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40";
const labelClass = "text-xs uppercase tracking-widest2 text-obsidian/60";

/* ------------------------------------------------------------------ */
/* Editing a group — previously impossible: the API had PUT and DELETE
   from the start and nothing in the admin ever called them, so a group
   created with the wrong role or category was permanent.               */
/* ------------------------------------------------------------------ */

function GroupSettings({
  group,
  categories,
  optionCount,
  onDone,
}: {
  group: AttributeGroup;
  categories: Category[];
  optionCount: number;
  onDone: () => void;
}) {
  const invalidate = useInvalidate();
  const [form, setForm] = useState({
    label: group.label,
    description: group.description ?? "",
    categories: group.categories as string[],
    inputType: group.inputType as string,
    role: group.role as string,
    showInFilters: group.showInFilters,
    filterStyle: group.filterStyle as string,
    swatch: group.swatch,
    unit: group.unit ?? "",
    placeholder: group.placeholder ?? "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: () => api.put<AttributeGroup>(`/attribute-groups/${group._id}`, form),
    onSuccess: () => {
      toast.success("Group updated");
      invalidate.configuration();
      onDone();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/attribute-groups/${group._id}`),
    onSuccess: () => {
      toast.success("Group removed");
      invalidate.configuration();
    },
    // A 409 names what is still using it.
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleCategory = (slug: string) =>
    set(
      "categories",
      form.categories.includes(slug)
        ? form.categories.filter((s) => s !== slug)
        : [...form.categories, slug]
    );

  // Refused by the API too; disabling it here explains why before the click.
  const listLocked = isList(group.inputType) && optionCount > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="mt-4 space-y-4 border-t border-obsidian/10 pt-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`lbl-${group._id}`} className={labelClass}>
            Name
          </label>
          <input
            id={`lbl-${group._id}`}
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={`role-${group._id}`} className={labelClass}>
            Behaves as
          </label>
          <select
            id={`role-${group._id}`}
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            className={fieldClass}
          >
            {Object.entries(ROLE_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-obsidian/45">{ROLE_BLURB[form.role]}</p>
        </div>
      </div>

      <div>
        <span className={labelClass}>Applies to</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {/* Multi-select. Creation only ever allowed one, and there was no way
              to add a second afterwards even though the model supports many. */}
          {categories.map((c) => {
            const on = form.categories.includes(c.slug);
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => toggleCategory(c.slug)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-xs ${
                  on
                    ? "border-obsidian bg-obsidian text-alabaster"
                    : "border-obsidian/20 text-obsidian/60 hover:border-obsidian/40"
                }`}
              >
                {c.name}
                {c.isActive === false && " (retired)"}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-obsidian/45">
          {form.categories.length === 0
            ? "Selected none — this applies to every category."
            : `Applies to ${form.categories.length} categor${form.categories.length === 1 ? "y" : "ies"}.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`input-${group._id}`} className={labelClass}>
            Entered as
          </label>
          <select
            id={`input-${group._id}`}
            value={form.inputType}
            onChange={(e) => set("inputType", e.target.value)}
            className={fieldClass}
          >
            {Object.entries(INPUT_LABEL).map(([value, text]) => (
              <option key={value} value={value} disabled={listLocked && !isList(value)}>
                {text}
              </option>
            ))}
          </select>
          {listLocked && (
            <p className="mt-1 text-xs text-obsidian/45">
              Remove its {optionCount} option{optionCount === 1 ? "" : "s"} before making this a
              free field, or they become unreachable.
            </p>
          )}
        </div>

        {isList(form.inputType) ? (
          <div>
            <label htmlFor={`fstyle-${group._id}`} className={labelClass}>
              Filter style
            </label>
            <select
              id={`fstyle-${group._id}`}
              value={form.filterStyle}
              onChange={(e) => set("filterStyle", e.target.value)}
              className={fieldClass}
            >
              <option value="chips">Chips</option>
              <option value="checkbox">Checkboxes</option>
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor={`unit-${group._id}`} className={labelClass}>
              Unit
            </label>
            <input
              id={`unit-${group._id}`}
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              placeholder="mm, cm, g…"
              className={fieldClass}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-obsidian/70">
          <input
            type="checkbox"
            checked={form.showInFilters}
            onChange={(e) => set("showInFilters", e.target.checked)}
          />
          Show as a shop filter
        </label>
        {isList(form.inputType) && (
          <label className="flex items-center gap-2 text-sm text-obsidian/70">
            <input
              type="checkbox"
              checked={form.swatch}
              onChange={(e) => set("swatch", e.target.checked)}
            />
            Options carry a colour swatch
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-obsidian/10 pt-4">
        <button
          type="submit"
          disabled={save.isPending || !form.label.trim()}
          className="rounded bg-obsidian px-4 py-2 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded border border-obsidian/20 px-4 py-2 text-xs uppercase tracking-wide text-obsidian/60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete the whole "${group.label}" group?`)) remove.mutate();
          }}
          disabled={remove.isPending}
          className="ml-auto text-xs uppercase tracking-wide text-obsidian/45 hover:text-red-600 disabled:opacity-40"
        >
          Delete group
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function GroupPanel({
  group,
  categories,
  options,
  usage,
  retired,
}: {
  group: AttributeGroup;
  categories: Category[];
  options: Attribute[];
  usage: Record<string, number>;
  retired: boolean;
}) {
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

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

  const patchMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Attribute>) =>
      api.put<Attribute>(`/attributes/${id}`, body),
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

  /**
   * Swaps two options' sortOrder.
   *
   * Sizes and chain lengths have a natural order that is not alphabetical —
   * XS/S/M/L/XL sorted by label reads L, M, S, XL, XS. `sortOrder` was in the
   * schema and honoured by the API from the start, with nothing able to set it.
   */
  const move = (index: number, direction: -1 | 1) => {
    const a = options[index];
    const b = options[index + direction];
    if (!a || !b) return;
    patchMutation.mutate({ id: a._id, sortOrder: b.sortOrder });
    patchMutation.mutate({ id: b._id, sortOrder: a.sortOrder });
  };

  const appliesTo =
    group.categories.length === 0
      ? "All categories"
      : group.categories
          .map((slug) => categories.find((c) => c.slug === slug)?.name || slug)
          .join(", ");

  const usesOptions = isList(group.inputType);

  return (
    <section
      className={`rounded-lg border bg-white p-5 ${
        retired ? "border-obsidian/10 opacity-70" : "border-obsidian/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-serif text-lg text-obsidian">
            {group.label}
            <span className="rounded bg-obsidian/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-obsidian/50">
              {ROLE_LABEL[group.role] || group.role}
            </span>
            {retired && (
              // The Apparel line was retired during the pivot, but its four
              // groups kept rendering as though they were live.
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-800">
                Retired line
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs text-obsidian/50">
            {appliesTo} · {ROLE_BLURB[group.role] || group.role}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <code className="text-xs text-obsidian/35">{group.key}</code>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label={`Edit ${group.label}`}
            aria-expanded={editing}
            className="text-obsidian/40 hover:text-obsidian"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <GroupSettings
          group={group}
          categories={categories}
          optionCount={options.length}
          onDone={() => setEditing(false)}
        />
      )}

      {!usesOptions ? (
        <p className="mt-4 text-sm text-obsidian/45">
          Free {group.inputType} field
          {group.unit ? ` in ${group.unit}` : ""} — typed directly on each product, no option list.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {options.length === 0 && (
              <p className="text-sm text-obsidian/40">Nothing defined yet.</p>
            )}
            {options.map((option, index) => {
              const used = usage[`${group.key}:${option.value}`] ?? 0;
              return (
                <div key={option._id} className="flex items-center gap-2">
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${option.label} up`}
                      className="text-obsidian/25 hover:text-obsidian disabled:opacity-0"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === options.length - 1}
                      aria-label={`Move ${option.label} down`}
                      className="text-obsidian/25 hover:text-obsidian disabled:opacity-0"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>

                  {group.swatch && (
                    <input
                      type="color"
                      value={option.hex || "#9CA3AF"}
                      onChange={(e) =>
                        patchMutation.mutate({ id: option._id, hex: e.target.value })
                      }
                      aria-label={`Colour for ${option.label}`}
                      className="h-7 w-7 shrink-0 cursor-pointer rounded border border-obsidian/15 bg-transparent p-0"
                    />
                  )}

                  <input
                    defaultValue={option.label}
                    onBlur={(e) => {
                      const label = e.target.value.trim();
                      if (label && label !== option.label) {
                        patchMutation.mutate({ id: option._id, label });
                      }
                    }}
                    className="min-w-0 flex-1 rounded border border-transparent px-2 py-1.5 text-sm hover:border-obsidian/15 focus:border-obsidian/40 focus:outline-none"
                  />

                  {/* What it costs to remove this, before you try — the API
                      only ever said so by refusing. */}
                  <span
                    title={used ? `${used} product(s) use this` : "Not used by any product"}
                    className={`shrink-0 text-xs ${used ? "text-obsidian/55" : "text-obsidian/25"}`}
                  >
                    {used || "—"}
                  </span>

                  <code className="hidden shrink-0 text-xs text-obsidian/35 sm:block">
                    {option.value}
                  </code>

                  <button
                    type="button"
                    onClick={() => {
                      const warning = used
                        ? `"${option.label}" is used by ${used} product(s) and cannot be removed until they change.\n\nTry anyway?`
                        : `Remove "${option.label}"?`;
                      if (confirm(warning)) deleteMutation.mutate(option._id);
                    }}
                    aria-label={`Remove ${option.label}`}
                    className="shrink-0 text-obsidian/30 hover:text-red-600"
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
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
              aria-label={`Add an option to ${group.label}`}
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
  const [picked, setPicked] = useState<string[]>([]);
  const [inputType, setInputType] = useState("select");
  const [role, setRole] = useState("spec");

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<AttributeGroup>("/attribute-groups", {
        key: slugify(label).replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
        label: label.trim(),
        categories: picked,
        inputType,
        role,
        showInFilters: role !== "internal",
        filterStyle: "chips",
      }),
    onSuccess: () => {
      toast.success("Attribute group created");
      setLabel("");
      setPicked([]);
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
          <label htmlFor="ng-label" className={labelClass}>
            Name
          </label>
          <input
            id="ng-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Gemstone"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="ng-role" className={labelClass}>
            Behaves as
          </label>
          <select
            id="ng-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={fieldClass}
          >
            {Object.entries(ROLE_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-obsidian/45">{ROLE_BLURB[role]}</p>
        </div>
        <div>
          <label htmlFor="ng-input" className={labelClass}>
            Entered as
          </label>
          <select
            id="ng-input"
            value={inputType}
            onChange={(e) => setInputType(e.target.value)}
            className={fieldClass}
          >
            {Object.entries(INPUT_LABEL).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelClass}>Applies to</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = picked.includes(c.slug);
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() =>
                    setPicked(on ? picked.filter((s) => s !== c.slug) : [...picked, c.slug])
                  }
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    on
                      ? "border-obsidian bg-obsidian text-alabaster"
                      : "border-obsidian/20 text-obsidian/60 hover:border-obsidian/40"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-obsidian/45">
            {picked.length === 0 ? "None selected — applies to every category." : ""}
          </p>
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

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [role, setRole] = useState("");
  const [showRetired, setShowRetired] = useState(false);

  /**
   * Every option in one request rather than one per panel.
   *
   * Each GroupPanel used to run its own query, so opening this page fired 26
   * requests for 109 rows. That is slow anywhere and expensive on a serverless
   * deployment, where each can be a cold start.
   */
  const { data: allOptions = [] } = useQuery({
    queryKey: ["attributes", "all"],
    queryFn: () => api.get<Attribute[]>("/attributes"),
  });

  const { data: usage = {} } = useQuery({
    queryKey: ["attributes", "usage"],
    queryFn: () => api.get<Record<string, number>>("/attributes/usage"),
  });

  const optionsByGroup = useMemo(() => {
    const map: Record<string, Attribute[]> = {};
    for (const option of allOptions) (map[option.group] ??= []).push(option);
    return map;
  }, [allOptions]);

  const retiredSlugs = useMemo(
    () => new Set(categories.filter((c) => c.isActive === false).map((c) => c.slug)),
    [categories]
  );

  /** A group belongs to a retired line when every category it names is retired. */
  const isRetired = (group: AttributeGroup) =>
    group.categories.length > 0 && group.categories.every((s) => retiredSlugs.has(s));

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return groups.filter((group) => {
      if (!showRetired && isRetired(group)) return false;
      if (role && group.role !== role) return false;
      if (category) {
        const applies =
          group.categories.length === 0 || group.categories.includes(category);
        if (!applies) return false;
      }
      if (!term) return true;

      // Searching an option's name should find the group holding it — that is
      // usually what you are actually looking for.
      return (
        group.label.toLowerCase().includes(term) ||
        group.key.toLowerCase().includes(term) ||
        (optionsByGroup[group.key] ?? []).some((o) => o.label.toLowerCase().includes(term))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, search, category, role, showRetired, retiredSlugs, optionsByGroup]);

  const retiredCount = groups.filter(isRetired).length;

  /**
   * Active categories with nothing to describe them.
   *
   * A category added after the vocabularies were seeded gets only the groups
   * that apply to everything — so its products have almost no specs and the
   * shop has almost no filters for it, with nothing anywhere saying so.
   */
  const barren = categories.filter(
    (c) =>
      c.isActive !== false &&
      !groups.some((g) => g.categories.includes(c.slug))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-obsidian">Attributes</h1>
        <p className="mt-2 max-w-2xl text-sm text-obsidian/60">
          The option lists behind every product dropdown and shop filter. Because products store a
          stable code rather than the text, renaming an option here updates it across the whole
          catalogue at once. The number beside each option is how many products use it, and one in
          use cannot be deleted.
        </p>
      </div>

      {barren.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            {barren.map((c) => c.name).join(", ")}{" "}
            {barren.length === 1 ? "has" : "have"} no attributes of{" "}
            {barren.length === 1 ? "its" : "their"} own.
          </p>
          <p className="mt-1 text-amber-800/80">
            Products in {barren.length === 1 ? "it" : "them"} can only use the groups that apply to
            every category, so they will show almost no specifications and the shop will offer
            almost no filters for them. Add a group below and tick{" "}
            {barren.map((c) => c.name).join(" / ")} under &ldquo;Applies to&rdquo;.
          </p>
        </div>
      )}

      <NewGroupForm categories={categories} />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-obsidian/10 bg-white p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups and options…"
          aria-label="Search attributes"
          className="min-w-[14rem] flex-1 rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="rounded border border-obsidian/15 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Filter by role"
          className="rounded border border-obsidian/15 px-3 py-2 text-sm"
        >
          <option value="">Any role</option>
          {Object.entries(ROLE_LABEL).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        {retiredCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-obsidian/70">
            <input
              type="checkbox"
              checked={showRetired}
              onChange={(e) => setShowRetired(e.target.checked)}
            />
            Show {retiredCount} from retired lines
          </label>
        )}
        <span className="ml-auto text-xs text-obsidian/45">
          {visible.length} of {groups.length}
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-obsidian/40">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-obsidian/45">Nothing matches those filters.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {visible.map((group) => (
            <GroupPanel
              key={group._id}
              group={group}
              categories={categories}
              options={optionsByGroup[group.key] ?? []}
              usage={usage}
              retired={isRetired(group)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
