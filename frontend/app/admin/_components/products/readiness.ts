import type { AttributeGroup } from "../../_lib/types";
import type { ProductFormInput } from "./schema";

/**
 * What still stands between this product and the storefront.
 *
 * Blockers mirror backend/src/utils/productReadiness.js rule for rule, ids
 * included — that copy is the gate, this one is the explanation. Warnings exist
 * only here: they need the category's attribute groups, which the form already
 * has loaded and the API would have to re-fetch.
 */

export interface ReadinessItem {
  id: string;
  label: string;
  hint?: string;
  done: boolean;
}

export interface Readiness {
  blockers: ReadinessItem[];
  warnings: ReadinessItem[];
  /** Every blocker satisfied — the Published option is selectable. */
  canPublish: boolean;
  /** Blockers cleared, counted for the progress line. */
  completed: number;
  total: number;
}

export function evaluateReadiness(
  values: ProductFormInput,
  groups: AttributeGroup[] = []
): Readiness {
  const images = values.images ?? [];
  const options = values.options ?? [];
  const variants = values.variants ?? [];
  const attributes = values.attributes ?? {};

  const blockers: ReadinessItem[] = [
    {
      id: "images",
      label: "At least one image",
      hint: "A published product with no image renders an empty card.",
      done: images.length > 0,
    },
    {
      id: "subCategory",
      label: "A sub-category",
      hint: "Navigation and filters place the product by its sub-category.",
      done: Boolean(values.subCategory),
    },
    {
      id: "price",
      label: "A price above zero",
      done: Number(values.price) > 0,
    },
    {
      id: "variants",
      label: "A variant for every option",
      hint: "Options with no variants leave a picker a customer can never add to the cart.",
      done: options.length === 0 || variants.length > 0,
    },
    {
      // Ids are kept identical to the backend gate so the two can be compared.
      id: "optionValues",
      label: "A value for every option",
      hint: "An empty option renders its heading with nothing under it, so no variant can match and the product reads as sold out.",
      done: options.every((o) => (o.values ?? []).length > 0),
    },
    {
      id: "variantsMatchOptions",
      label: "Stock held against the actual options",
      hint: "The stock grid does not match the options — open the Inventory tab to rebuild it.",
      // No variants at all is the rule above's to report, not this one's.
      done:
        variants.length === 0 ||
        options
          .filter((o) => (o.values ?? []).length > 0)
          .every((axis) =>
            variants.some((v) => (v.optionValues ?? []).some((ov) => ov.name === axis.name))
          ),
    },
  ];

  // Only spec-role groups: a selection or an internal measurement missing is
  // not a gap the shopper sees as a hole in the spec table.
  const specGroups = groups.filter((g) => g.role === "spec");
  const filledSpecs = specGroups.filter((g) => {
    const value = attributes[g.key];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "";
  });

  // A product with no options still has one "default" variant, so this covers
  // single-item products as well as multi-axis ones.
  const totalStock = variants.reduce((n, v) => n + (Number(v.stock) || 0), 0);

  const warnings: ReadinessItem[] = [
    {
      id: "stock",
      label: "Stock on at least one variant",
      hint: "With none, the product publishes as sold out.",
      done: variants.length === 0 || totalStock > 0,
    },
    {
      id: "specs",
      label:
        specGroups.length > 0
          ? `Spec details (${filledSpecs.length}/${specGroups.length})`
          : "Spec details",
      hint: "These fill the spec table on the product page.",
      done: specGroups.length === 0 || filledSpecs.length === specGroups.length,
    },
    {
      id: "gallery",
      label: "More than one image",
      hint: "A single shot gives the gallery nothing to page through.",
      done: images.length > 1,
    },
    {
      id: "seo",
      label: "Search engine listing",
      hint: "Falls back to the product name and description if left blank.",
      done: Boolean(values.seo?.title || values.seo?.description),
    },
  ];

  const completed = blockers.filter((b) => b.done).length;

  return {
    blockers,
    warnings,
    canPublish: completed === blockers.length,
    completed,
    total: blockers.length,
  };
}
