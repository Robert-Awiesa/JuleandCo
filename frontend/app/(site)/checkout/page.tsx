import { CheckoutView } from "@/components/checkout/CheckoutView";
import { fetchContentSlot } from "@/lib/content";

/**
 * Thin server component: checkout itself is interactive and stays a client
 * component, but what customers are told about delivery is a store setting and
 * only a server component can await it.
 */
export default async function CheckoutPage() {
  const delivery = await fetchContentSlot("store.delivery");
  return <CheckoutView delivery={delivery} />;
}
