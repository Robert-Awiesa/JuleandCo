import { Suspense } from "react";
import { ShopView } from "@/components/shop/ShopView";

export const metadata = {
  title: "Shop — Aura & Optic",
};

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopView />
    </Suspense>
  );
}
