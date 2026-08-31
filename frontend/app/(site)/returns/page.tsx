import { fetchContentSlot } from "@/lib/content";
import { PolicyPage } from "@/components/layout/PolicyPage";

export const metadata = {
  alternates: { canonical: "/returns" },
  title: "Returns & Refunds — JULES & CO",
  description:
    "What happens if a piece arrives damaged, or is not what you expected, and how refunds are paid.",
};

export default async function ReturnsPage() {
  const content = await fetchContentSlot("page.returns");
  return <PolicyPage eyebrow="Returns" content={content} />;
}
