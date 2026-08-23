"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Check, AlertTriangle, Circle } from "lucide-react";
import { useAttributeGroups } from "../../_lib/useCatalogConfig";
import { evaluateReadiness, type ReadinessItem } from "./readiness";
import type { ProductFormInput } from "./schema";

function Item({ item, tone }: { item: ReadinessItem; tone: "blocker" | "warning" }) {
  const Icon = item.done ? Check : tone === "blocker" ? Circle : AlertTriangle;

  return (
    <li className="flex gap-2.5">
      <Icon
        size={14}
        className={
          item.done
            ? "mt-0.5 shrink-0 text-green-600"
            : tone === "blocker"
              ? "mt-0.5 shrink-0 text-obsidian/30"
              : "mt-0.5 shrink-0 text-amber-500"
        }
      />
      <span>
        <span className={item.done ? "text-obsidian/45 line-through" : "text-obsidian"}>
          {item.label}
        </span>
        {!item.done && item.hint && (
          <span className="mt-0.5 block text-xs text-obsidian/45">{item.hint}</span>
        )}
      </span>
    </li>
  );
}

/**
 * The checklist between this product and the storefront.
 *
 * The form was complete but silent about what was missing — you could save a
 * product all day without learning why it never appeared in the shop. This
 * reads the live form values, so it answers that question while you type
 * rather than at submit time.
 */
export function ReadinessPanel() {
  const { control } = useFormContext<ProductFormInput>();
  const values = useWatch({ control }) as ProductFormInput;
  const { data: groups = [] } = useAttributeGroups(values.category || undefined);

  const { blockers, warnings, canPublish, completed, total } = evaluateReadiness(values, groups);
  const isPublished = values.publishStatus === "published";

  return (
    <aside className="w-full shrink-0 space-y-4 rounded-lg border border-obsidian/10 bg-white p-4 lg:w-72">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs uppercase tracking-widest2 text-obsidian/60">Ready to publish</h2>
          <span className="text-xs text-obsidian/45">
            {completed}/{total}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-obsidian/10">
          <div
            className={canPublish ? "h-full bg-green-600" : "h-full bg-gold"}
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      </div>

      <ul className="space-y-2 text-sm">
        {blockers.map((item) => (
          <Item key={item.id} item={item} tone="blocker" />
        ))}
      </ul>

      <div className="border-t border-obsidian/10 pt-4">
        <h3 className="mb-2 text-xs uppercase tracking-widest2 text-obsidian/60">Recommended</h3>
        <ul className="space-y-2 text-sm">
          {warnings.map((item) => (
            <Item key={item.id} item={item} tone="warning" />
          ))}
        </ul>
      </div>

      <p
        className={
          canPublish
            ? "rounded bg-green-50 px-3 py-2 text-xs text-green-800"
            : "rounded bg-amber-50 px-3 py-2 text-xs text-amber-800"
        }
      >
        {canPublish
          ? isPublished
            ? "Live on the storefront once saved."
            : "Everything needed is here — set Visibility to Published on the Details tab."
          : "Save as a draft any time. Publishing unlocks once the list above is complete."}
      </p>
    </aside>
  );
}
