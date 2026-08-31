import { fetchContentSlot } from "@/lib/content";
import { PolicyPage } from "@/components/layout/PolicyPage";

export const metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy Notice — JULES & CO",
  description:
    "What JULES & CO collects when you shop with us, why we need it, and who else handles it.",
};

export default async function PrivacyPage() {
  const content = await fetchContentSlot("page.privacy");
  return <PolicyPage eyebrow="Privacy" content={content} />;
}
