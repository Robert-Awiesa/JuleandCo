"use client";

import { useId } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { ImageUploader } from "../products/ImageUploader";

/**
 * Draws the editor for one content field from its declaration.
 *
 * The field specs come from the API (backend/src/utils/contentSlots.js), which
 * is also what validates the save — so a slot is described once and the admin
 * form for it does not have to be written. `list` recurses, which is how the
 * mega menu's columns of links get an editor without one being coded for them.
 */

export interface FieldSpec {
  key: string;
  label: string;
  type: "text" | "textarea" | "image" | "boolean" | "url" | "select" | "list" | "group";
  required?: boolean;
  help?: string;
  default?: unknown;
  options?: { value: string; label: string }[];
  fields?: FieldSpec[];
  itemLabel?: string;
  itemTitle?: string;
}

export type ContentRow = Record<string, unknown>;

const inputClass =
  "mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40";

const labelClass = "text-xs uppercase tracking-widest2 text-obsidian/60";

function Help({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mt-1 text-xs text-obsidian/45">{text}</p>;
}

/** A row's heading, so a collapsed list is still readable. */
function rowTitle(spec: FieldSpec, row: ContentRow, index: number) {
  const key = spec.itemTitle;
  const value = key ? row[key] : undefined;
  const text = typeof value === "string" ? value.trim() : "";
  return text || `${spec.itemLabel || "Item"} ${index + 1}`;
}

export function FieldEditor({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  // Every control is bound to its label. Without this the form is unusable with
  // a screen reader, and clicking a label does not focus its field.
  const fieldId = useId();

  if (spec.type === "list") {
    const rows = Array.isArray(value) ? (value as ContentRow[]) : [];

    function update(index: number, next: ContentRow) {
      onChange(rows.map((row, i) => (i === index ? next : row)));
    }

    function move(index: number, delta: number) {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      onChange(next);
    }

    return (
      <div>
        <p className={labelClass}>{spec.label}</p>
        <Help text={spec.help} />

        <div className="mt-2 space-y-3">
          {rows.map((row, index) => (
            <div key={String(row.id ?? index)} className="rounded border border-obsidian/15 bg-white">
              <div className="flex items-center justify-between border-b border-obsidian/10 px-3 py-2">
                <p className="truncate text-sm font-medium text-obsidian">
                  {rowTitle(spec, row, index)}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="rounded p-1 text-obsidian/50 hover:text-obsidian disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    aria-label="Move down"
                    className="rounded p-1 text-obsidian/50 hover:text-obsidian disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    aria-label={`Remove ${rowTitle(spec, row, index)}`}
                    className="rounded p-1 text-obsidian/50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-4">
                {(spec.fields || []).map((child) => (
                  <FieldEditor
                    key={child.key}
                    spec={child}
                    value={row[child.key]}
                    onChange={(next) => update(index, { ...row, [child.key]: next })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            // A client-side id keeps React keys and reordering stable before
            // the server has seen the row.
            onChange([...rows, { id: `new-${Date.now()}-${rows.length}` }])
          }
          className="mt-3 inline-flex items-center gap-1.5 rounded border border-dashed border-obsidian/25 px-3 py-2 text-xs uppercase tracking-wide text-obsidian/60 hover:border-obsidian/50 hover:text-obsidian"
        >
          <Plus size={14} /> Add {spec.itemLabel?.toLowerCase() || "item"}
        </button>
      </div>
    );
  }

  if (spec.type === "group") {
    const group = (value && typeof value === "object" ? value : {}) as ContentRow;
    return (
      <div className="rounded border border-obsidian/15 p-4">
        <p className={labelClass}>{spec.label}</p>
        <Help text={spec.help} />
        <div className="mt-3 space-y-4">
          {(spec.fields || []).map((child) => (
            <FieldEditor
              key={child.key}
              spec={child}
              value={group[child.key]}
              onChange={(next) => onChange({ ...group, [child.key]: next })}
            />
          ))}
        </div>
      </div>
    );
  }

  if (spec.type === "image") {
    const src = typeof value === "string" ? value : "";
    return (
      <div>
        <p className={labelClass}>
          {spec.label}
          {spec.required && <span className="ml-1 text-red-600">*</span>}
        </p>
        <Help text={spec.help} />
        <div className="mt-2 mb-2">
          <ImageUploader
            images={src ? [src] : []}
            multiple={false}
            onChange={(images) => onChange(images[0] ?? "")}
          />
        </div>
        <label htmlFor={fieldId} className="sr-only">
          {spec.label} image URL
        </label>
        <input
          id={fieldId}
          value={src}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste an image URL"
          className={inputClass}
        />
      </div>
    );
  }

  if (spec.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-obsidian">
        <input
          type="checkbox"
          checked={value === undefined ? Boolean(spec.default) : Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-black"
        />
        {spec.label}
      </label>
    );
  }

  if (spec.type === "select") {
    return (
      <div>
        <label htmlFor={fieldId} className={labelClass}>
          {spec.label}
        </label>
        <select
          id={fieldId}
          value={typeof value === "string" ? value : String(spec.default ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {(spec.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Help text={spec.help} />
      </div>
    );
  }

  if (spec.type === "textarea") {
    return (
      <div>
        <label htmlFor={fieldId} className={labelClass}>
          {spec.label}
          {spec.required && <span className="ml-1 text-red-600">*</span>}
        </label>
        <textarea
          id={fieldId}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
        <Help text={spec.help} />
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={fieldId} className={labelClass}>
        {spec.label}
        {spec.required && <span className="ml-1 text-red-600">*</span>}
      </label>
      <input
        id={fieldId}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
      <Help text={spec.help} />
    </div>
  );
}
