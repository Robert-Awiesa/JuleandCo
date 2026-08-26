import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartLine } from "@/lib/types";

/**
 * Cart lines are keyed by variant, not by a colour/size pair.
 *
 * The old key was `productId__color__size`, which assumed every product varied
 * by exactly those two things. A ring sized by circumference or a necklace by
 * chain length had nowhere to go. The variant id already encodes whatever axes
 * a product actually has, so it is the natural key — with non-stocked
 * selections (lens type) folded in, since two lines differing only by lens are
 * still distinct order lines.
 */
const lineKey = (productId: string, variantId?: string, selections?: Record<string, string>) => {
  const chosen = Object.entries(selections ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(",");
  return `${productId}__${variantId ?? ""}__${chosen}`;
};

const keyOf = (line: CartLine) => lineKey(line.productId, line.variantId, line.selections);

interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  removeLine: (productId: string, variantId?: string, selections?: Record<string, string>) => void;
  updateQuantity: (
    productId: string,
    quantity: number,
    variantId?: string,
    selections?: Record<string, string>
  ) => void;
  clear: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      addLine: (line, quantity = 1) =>
        set((state) => {
          const key = lineKey(line.productId, line.variantId, line.selections);
          const existing = state.lines.find((l) => keyOf(l) === key);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                keyOf(l) === key ? { ...l, quantity: l.quantity + quantity } : l
              ),
              isOpen: true,
            };
          }
          return { lines: [...state.lines, { ...line, quantity }], isOpen: true };
        }),
      removeLine: (productId, variantId, selections) =>
        set((state) => ({
          lines: state.lines.filter((l) => keyOf(l) !== lineKey(productId, variantId, selections)),
        })),
      updateQuantity: (productId, quantity, variantId, selections) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              keyOf(l) === lineKey(productId, variantId, selections) ? { ...l, quantity } : l
            )
            .filter((l) => l.quantity > 0),
        })),
      clear: () => set({ lines: [] }),
      subtotal: () => get().lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
      itemCount: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
    }),
    {
      name: "jules-and-co-cart",
      /**
       * Only the basket is remembered, not whether the drawer was open.
       *
       * Persisting `isOpen` meant reloading the page re-opened the cart over
       * whatever the shopper had navigated to — and since the server always
       * renders it closed, it was also a hydration mismatch that threw away the
       * whole page's server rendering.
       */
      partialize: (state) => ({ lines: state.lines }) as never,
      // The line shape changed (colour/size → variant + options). Old persisted
      // carts cannot be keyed correctly, and silently mispricing or mislabelling
      // someone's basket is worse than asking them to re-add.
      version: 2,
      migrate: () => ({ lines: [], isOpen: false }) as never,
    }
  )
);
