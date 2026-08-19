/**
 * Resolves a typed colour name to a hex value.
 *
 * The colour picker used to seed every new swatch with #121212, so a colour
 * named "Red" stayed black until someone opened the picker and dialled it in by
 * hand — and the storefront renders these swatches literally, so a missed one
 * shipped a wrong colour to customers.
 *
 * Covers the fashion/eyewear vocabulary this catalogue actually uses (tortoise,
 * champagne, walnut…) on top of the standard CSS colour names, since "Tortoise"
 * means nothing to a browser.
 */
const NAMED_COLORS: Record<string, string> = {
  // Fashion / eyewear finishes
  tortoise: "#6B4226",
  tortoiseshell: "#6B4226",
  havana: "#7A4B28",
  champagne: "#D4C08A",
  obsidian: "#121212",
  alabaster: "#F5F3EF",
  sage: "#8A9A86",
  cream: "#F5F0E6",
  ivory: "#FFFFF0",
  walnut: "#5A4632",
  camel: "#B08A5A",
  tan: "#D2B48C",
  taupe: "#8B7D6B",
  sand: "#D8C7A9",
  stone: "#A8A29E",
  charcoal: "#36454F",
  slate: "#708090",
  smoke: "#4A4A4A",
  amber: "#B4762A",
  honey: "#E0A458",
  rose: "#C08081",
  blush: "#DE9DA0",
  burgundy: "#800020",
  wine: "#722F37",
  oxblood: "#4A0000",
  forest: "#228B22",
  olive: "#708238",
  emerald: "#50C878",
  navy: "#1B2A4A",
  midnight: "#191970",
  cobalt: "#0047AB",
  mustard: "#E1AD01",
  rust: "#B7410E",
  terracotta: "#E2725B",
  chocolate: "#7B3F00",
  espresso: "#3B2F2F",
  pewter: "#8E8E8E",
  gunmetal: "#2A3439",
  bronze: "#CD7F32",
  copper: "#B87333",
  brass: "#B5A642",
  gold: "#CDAD54",
  "rose gold": "#B76E79",
  silver: "#C0C0C0",
  platinum: "#E5E4E2",

  // Standard names a browser would know, restated so lookup stays uniform
  black: "#000000",
  white: "#FFFFFF",
  grey: "#808080",
  gray: "#808080",
  red: "#D32F2F",
  blue: "#1976D2",
  green: "#388E3C",
  yellow: "#FBC02D",
  orange: "#F57C00",
  purple: "#7B1FA2",
  violet: "#8F00FF",
  pink: "#EC407A",
  brown: "#795548",
  beige: "#F5F5DC",
  teal: "#00796B",
  turquoise: "#40E0D0",
  lilac: "#C8A2C8",
  lavender: "#E6E6FA",
  mint: "#98FF98",
  peach: "#FFE5B4",
  coral: "#FF7F50",
  khaki: "#C3B091",
  denim: "#1560BD",
  clear: "#EFEFEF",
};

/** Fallback for an unrecognised name — a neutral grey, never a confident black. */
export const UNRESOLVED_COLOR = "#9CA3AF";

/**
 * Best-effort hex for a colour name. Tries the whole name first, then each word,
 * so "Deep Forest Green" and "Polished Gold" still resolve. Returns null when
 * nothing matches, leaving the caller free to keep whatever the user set.
 */
export function resolveColorHex(name: string): string | null {
  const cleaned = name.trim().toLowerCase();
  if (!cleaned) return null;

  if (NAMED_COLORS[cleaned]) return NAMED_COLORS[cleaned];

  // Longest word first: "rose gold" should beat a bare "gold" match.
  const words = cleaned.split(/[^a-z]+/).filter(Boolean);
  for (let size = words.length; size >= 1; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const phrase = words.slice(start, start + size).join(" ");
      if (NAMED_COLORS[phrase]) return NAMED_COLORS[phrase];
    }
  }

  return null;
}
