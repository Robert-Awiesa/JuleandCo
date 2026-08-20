"use client";

import { useFormContext } from "react-hook-form";
import { useAttributeGroups, useAttributes } from "../../_lib/useCatalogConfig";
import type { AttributeGroup } from "../../_lib/types";
import type { ProductFormInput } from "./schema";

const inputClass =
  "mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40";
const labelClass = "text-xs uppercase tracking-widest2 text-obsidian/60";

function FieldShell({
  group,
  children,
}: {
  group: AttributeGroup;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`attr-${group.key}`} className={labelClass}>
        {group.label}
        {group.unit ? ` (${group.unit})` : ""}
      </label>
      {children}
      {group.description && <p className="mt-1 text-xs text-obsidian/45">{group.description}</p>}
    </div>
  );
}

function EmptyVocabularyNote() {
  return (
    <p className="mt-1 text-xs text-gold-dark">
      No options defined yet — add them under Attributes in the sidebar.
    </p>
  );
}

/** A single-choice vocabulary field. */
function SelectField({ group }: { group: AttributeGroup }) {
  const { register } = useFormContext<ProductFormInput>();
  const { data: options = [], isLoading } = useAttributes(group.key);

  return (
    <FieldShell group={group}>
      <select id={`attr-${group.key}`} {...register(`attributes.${group.key}`)} className={inputClass}>
        <option value="">{isLoading ? "Loading…" : "Not specified"}</option>
        {options.map((option) => (
          <option key={option._id} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {!isLoading && options.length === 0 && <EmptyVocabularyNote />}
    </FieldShell>
  );
}

/** A multi-choice vocabulary field, rendered as toggle chips. */
function MultiSelectField({ group }: { group: AttributeGroup }) {
  const { watch, setValue } = useFormContext<ProductFormInput>();
  const { data: options = [], isLoading } = useAttributes(group.key);

  const raw = watch(`attributes.${group.key}`);
  const selected: string[] = Array.isArray(raw) ? raw : [];

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    setValue(`attributes.${group.key}`, next, { shouldDirty: true });
  }

  return (
    <div>
      <span className={labelClass}>{group.label}</span>
      {group.description && <p className="mt-1 text-xs text-obsidian/45">{group.description}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {isLoading && <span className="text-sm text-obsidian/40">Loading…</span>}
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option._id}
              type="button"
              onClick={() => toggle(option.value)}
              className={
                active
                  ? "flex items-center gap-2 rounded border border-obsidian bg-obsidian px-3 py-1.5 text-sm text-alabaster"
                  : "flex items-center gap-2 rounded border border-obsidian/20 px-3 py-1.5 text-sm text-obsidian/70 hover:border-obsidian/50"
              }
            >
              {option.hex && (
                <span
                  className="h-3.5 w-3.5 rounded-full border border-white/40"
                  style={{ backgroundColor: option.hex }}
                />
              )}
              {option.label}
            </button>
          );
        })}
        {!isLoading && options.length === 0 && <EmptyVocabularyNote />}
      </div>
    </div>
  );
}

function TextField({ group }: { group: AttributeGroup }) {
  const { register } = useFormContext<ProductFormInput>();
  return (
    <FieldShell group={group}>
      <textarea
        id={`attr-${group.key}`}
        rows={2}
        placeholder={group.placeholder}
        {...register(`attributes.${group.key}`)}
        className={inputClass}
      />
    </FieldShell>
  );
}

function NumberField({ group }: { group: AttributeGroup }) {
  const { register } = useFormContext<ProductFormInput>();
  return (
    <FieldShell group={group}>
      <input
        id={`attr-${group.key}`}
        type="number"
        min={0}
        placeholder={group.placeholder}
        {...register(`attributes.${group.key}`)}
        className={inputClass}
      />
    </FieldShell>
  );
}

function AttributeField({ group }: { group: AttributeGroup }) {
  switch (group.inputType) {
    case "multiselect":
      return <MultiSelectField group={group} />;
    case "text":
      return <TextField group={group} />;
    case "number":
      return <NumberField group={group} />;
    default:
      return <SelectField group={group} />;
  }
}

/**
 * Renders whatever attributes the chosen category defines.
 *
 * This was a binary ternary — `category === "eyewear" ? (eyewear fields) :
 * (apparel fields)` — so the apparel branch was the else case and a third
 * category would silently have rendered clothing fields. Nothing here names a
 * category or an attribute any more: the fields come from the AttributeGroup
 * records bound to the product's category.
 */
export function AttributesTab() {
  const { watch } = useFormContext<ProductFormInput>();
  const category = watch("category");
  const { data: groups = [], isLoading } = useAttributeGroups(category);

  // variantAxis groups drive the Inventory grid, not this tab.
  const fields = groups
    .filter((g) => g.role !== "variantAxis")
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const specs = fields.filter((g) => g.role !== "internal");
  const measurements = fields.filter((g) => g.role === "internal");

  if (!category) {
    return <p className="max-w-3xl text-sm text-obsidian/50">Choose a category on the Details tab first.</p>;
  }

  if (isLoading) {
    return <p className="max-w-3xl text-sm text-obsidian/40">Loading attributes…</p>;
  }

  if (fields.length === 0) {
    return (
      <p className="max-w-3xl text-sm text-obsidian/50">
        No attributes are defined for this category yet. Add them under Attributes in the sidebar and
        they will appear here automatically.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="grid grid-cols-2 gap-5">
        {specs.map((group) => (
          <div key={group.key} className={group.inputType === "text" ? "col-span-2" : undefined}>
            <AttributeField group={group} />
          </div>
        ))}
      </div>

      {measurements.length > 0 && (
        <div>
          <span className={labelClass}>Measurements</span>
          <p className="mt-1 text-xs text-obsidian/45">
            Combined into a single spec line on the product page, in the order shown.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-4">
            {measurements.map((group) => (
              <AttributeField key={group.key} group={group} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
