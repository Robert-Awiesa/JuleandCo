import { Suspense } from "react";
import { ShopView } from "@/components/shop/ShopView";

export const metadata = {
  title: "Shop — JULES & CO",
};

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopView />
    </Suspense>
  );
}
