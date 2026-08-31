import { fetchContentSlot } from "@/lib/content";
import { PolicyPage } from "@/components/layout/PolicyPage";

export const metadata = {
  title: "Terms of Sale — JULES & CO",
  description:
    "The terms that apply when you buy from JULES & CO, including how delivery is agreed.",
};

export default async function TermsPage() {
  const content = await fetchContentSlot("page.terms");
  return <PolicyPage eyebrow="Terms" content={content} />;
}
