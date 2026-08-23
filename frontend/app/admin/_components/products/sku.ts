import type { ProductOption, Variant } from "../../_lib/types";

/**
 * Builds a stock-keeping code for a variant.
 *
 * SKUs were a blank field on every row, so a catalogue of any size had none —
 * and without them the admin search cannot find a piece by its code, a picking
 * list has nothing to print, and stock cannot be reconciled against anything
 * physical. Typing them by hand across a twelve-row inventory grid is exactly
 * the work nobody does.
 *
 * The scheme is deliberately readable rather than clever: an abbreviation of
 * the sub-category, one of the product, then each chosen option value. So a
 * sterling silver, 18-inch anklet reads JC-ANK-ZURI-SS-18IN — you can tell what
 * a code refers to without looking it up, which is the point of a SKU on a
 * label in a drawer.
 *
 * Generated codes are only ever suggestions: a code already typed is never
 * overwritten, because a shop that already has a numbering scheme should keep it.
 */

const PREFIX = "JC";

/** Letters and digits only, uppercase — a SKU goes on a label and into a search box. */
function clean(value: string) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * Shortens a phrase to something recognisable: initials when it is several
 * words ("yellow gold" → YG), otherwise a truncation ("tortoise" → TORT).
 */
function abbreviate(value: string, max = 4) {
  const words = String(value || "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) return "";

  // A measurement like "18 in" or "52mm" keeps its digits — dropping them would
  // make every length in a range collapse to the same code.
  const hasNumber = words.some((w) => /\d/.test(w));
  if (hasNumber) return clean(words.join("")).slice(0, max + 2);

  if (words.length > 1) return words.map((w) => clean(w)[0] || "").join("");
  return clean(words[0]).slice(0, max);
}

/**
 * The distinctive part of a product's name.
 *
 * Initials are too weak here: "The Aviator" and "The Anklet" would both give
 * TA, and two pieces sharing a code defeats the purpose. Articles carry no
 * information, so they are dropped and the first real word kept — "the-zuri-
 * anklet" becomes ZURI, "the-aviator" AVIATO.
 */
const ARTICLES = new Set(["THE", "A", "AN", "OF", "AND", "MY", "OUR"]);

function productPart(slug: string, max = 6) {
  const words = String(slug || "")
    .split(/[^A-Za-z0-9]+/)
    .map(clean)
    .filter(Boolean);

  const meaningful = words.filter((w) => !ARTICLES.has(w));
  const chosen = meaningful.length > 0 ? meaningful : words;

  // One word rarely fills the budget; borrow from the next so two pieces in a
  // line ("Zuri Studs", "Zuri Hoops") do not collapse to the same code.
  return chosen.join("").slice(0, max);
}

/** The label an option value carries, falling back to its stored value. */
function labelFor(options: ProductOption[], name: string, value: string) {
  const option = options.find((o) => o.name === name);
  return option?.values.find((v) => v.value === value)?.label || value;
}

export function buildSku(
  variant: Pick<Variant, "optionValues">,
  {
    productSlug,
    subCategory,
    options,
  }: { productSlug: string; subCategory: string; options: ProductOption[] }
) {
  const parts = [
    PREFIX,
    abbreviate(subCategory, 4),
    productPart(productSlug),
    ...(variant.optionValues || []).map((ov) => abbreviate(labelFor(options, ov.name, ov.value), 4)),
  ];

  return parts.filter(Boolean).join("-");
}

/**
 * Fills in the codes that are missing, leaving the rest alone.
 *
 * Returns the count as well as the rows, so the admin can be told what happened
 * rather than watching some fields change and guessing which.
 */
export function fillMissingSkus<T extends { sku?: string; optionValues: Variant["optionValues"] }>(
  variants: T[],
  context: { productSlug: string; subCategory: string; options: ProductOption[] }
): { variants: T[]; filled: number } {
  let filled = 0;

  const next = variants.map((variant) => {
    if (variant.sku && variant.sku.trim()) return variant;
    const sku = buildSku(variant, context);
    if (!sku) return variant;
    filled += 1;
    return { ...variant, sku };
  });

  return { variants: next, filled };
}
