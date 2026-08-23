import { Hero } from "@/components/home/Hero";
import { CuratedCollections } from "@/components/home/CuratedCollections";
import { BrandStory } from "@/components/home/BrandStory";
import { Testimonials } from "@/components/home/Testimonials";
import { fetchSiteContent } from "@/lib/content";

/**
 * Every block on this page used to render a hardcoded array. Content is fetched
 * once here and passed down, so the three sections make one request between
 * them rather than one each.
 */
export default async function HomePage() {
  const content = await fetchSiteContent();

  return (
    <>
      <Hero slides={content["hero.slides"]} />
      <CuratedCollections collections={content["home.collections"]} />
      <BrandStory />
      <Testimonials testimonials={content["home.testimonials"]} />
    </>
  );
}
