import { Hero } from "@/components/home/Hero";
import { CuratedCollections } from "@/components/home/CuratedCollections";
import { BrandStory } from "@/components/home/BrandStory";
import { Testimonials } from "@/components/home/Testimonials";

export default function HomePage() {
  return (
    <>
      <Hero />
      <CuratedCollections />
      <BrandStory />
      <Testimonials />
    </>
  );
}
