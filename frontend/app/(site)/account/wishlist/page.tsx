import { fetchProducts } from "@/lib/api";
import { WishlistView } from "@/components/account/WishlistView";

export const metadata = {
  title: "Wishlist — JULES & CO",
};

export default async function WishlistPage() {
  // Saved ids live in a browser store, so the server cannot know them. It ships
  // the published catalogue and the client picks out the saved ones — fine at
  // this catalogue size, and it keeps a wishlist of unpublished items from
  // resurrecting products that have been taken down.
  const products = await fetchProducts();
  return <WishlistView products={products} />;
}
