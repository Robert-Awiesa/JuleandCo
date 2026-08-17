import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartLine } from "@/lib/types";

interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  removeLine: (productId: string, color?: string, size?: string) => void;
  updateQuantity: (
    productId: string,
    quantity: number,
    color?: string,
    size?: string
  ) => void;
  clear: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

const lineKey = (productId: string, color?: string, size?: string) =>
  `${productId}__${color ?? ""}__${size ?? ""}`;

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
          const key = lineKey(line.productId, line.color, line.size);
          const existing = state.lines.find(
            (l) => lineKey(l.productId, l.color, l.size) === key
          );
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                lineKey(l.productId, l.color, l.size) === key
                  ? { ...l, quantity: l.quantity + quantity }
                  : l
              ),
              isOpen: true,
            };
          }
          return {
            lines: [...state.lines, { ...line, quantity }],
            isOpen: true,
          };
        }),
      removeLine: (productId, color, size) =>
        set((state) => ({
          lines: state.lines.filter(
            (l) => lineKey(l.productId, l.color, l.size) !== lineKey(productId, color, size)
          ),
        })),
      updateQuantity: (productId, quantity, color, size) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              lineKey(l.productId, l.color, l.size) === lineKey(productId, color, size)
                ? { ...l, quantity }
                : l
            )
            .filter((l) => l.quantity > 0),
        })),
      clear: () => set({ lines: [] }),
      subtotal: () =>
        get().lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
      itemCount: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
    }),
    { name: "aura-optic-cart" }
  )
);
