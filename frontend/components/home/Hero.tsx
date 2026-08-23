"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { HeroSlide } from "@/lib/content";

/**
 * Only the photograph and the headline change between slides. The eyebrow,
 * the supporting paragraph, both buttons and the scrims are fixed, so the
 * hero reads as one composition that re-dresses itself rather than three
 * separate banners.
 *
 * Slides arrive from the admin rather than a hardcoded array, so a headline or
 * a photograph can be changed without a deploy. `objectPosition` is per slide
 * because a landscape hero crops portrait photographs hard: left at the default
 * centre, the frame lands on a torso and cuts the face off.
 */
const SLIDE_MS = 5000;

export function Hero({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  // A slide can be switched off in the admin without deleting it.
  const visible = slides.filter((s) => s.active !== false);

  useEffect(() => {
    // An auto-advancing carousel is exactly what "reduce motion" asks us not to
    // do, so that preference holds the hero on the first slide. One slide has
    // nothing to rotate to.
    if (reduceMotion || visible.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % visible.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [reduceMotion, visible.length]);

  // Deleting slides in the admin can leave the index past the end.
  const slide = visible[index % Math.max(1, visible.length)];

  // Without a slide there is no photograph and no headline, so the section
  // would render as an empty 92vh hole. Better to take it out of the page.
  if (!slide) return null;

  return (
    <section className="relative flex h-[92vh] min-h-[640px] w-full items-end overflow-hidden bg-surface">
      {/*
        Every slide stays mounted and is faded by opacity rather than swapped,
        so the browser is never decoding an image mid-transition and the
        crossfade cannot flash the background through.
      */}
      {visible.map((s, i) => (
        <Image
          key={s.id || s.image}
          src={s.image}
          alt={s.alt}
          fill
          // Only the first is priority: it is the LCP element. Preloading all
          // three would compete with it.
          priority={i === 0}
          sizes="100vw"
          style={{ objectPosition: s.objectPosition }}
          className={`object-cover transition-opacity duration-1000 ease-in-out ${
            i === index % visible.length ? "opacity-70" : "opacity-0"
          }`}
        />
      ))}

      {/* Vertical scrim blends the image into the page below. */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/25 to-surface/50" />
      {/* Horizontal scrim guarantees the copy stays legible over any photo,
          not just one that happens to be dark behind the text. */}
      <div className="absolute inset-0 bg-gradient-to-r from-surface/85 via-surface/40 to-transparent" />

      <div className="container-elevated relative z-10 pb-20 text-ink">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="eyebrow mb-5 flex items-center gap-3 text-gold"
        >
          <span className="h-px w-8 bg-gold" aria-hidden="true" />
          Wear the Difference
        </motion.p>

        {/*
          The headlines differ in length, so a floor height stops the paragraph
          and buttons below from jumping as the slides rotate.
        */}
        <div className="min-h-[4.6rem] sm:min-h-[5.6rem] lg:min-h-[6.8rem] xl:min-h-[8rem]">
          <AnimatePresence mode="wait">
            <motion.h1
              key={slide.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-[22ch] font-serif text-[1.85rem] font-bold leading-[1.12] tracking-tightest [text-shadow:0_2px_24px_rgb(0_0_0/0.55)] sm:text-[2.25rem] lg:text-[2.75rem] xl:text-[3.25rem]"
            >
              {slide.headline}
              {slide.emoji && (
                <>
                  {" "}
                  <span className="inline-block align-middle text-[0.55em] leading-none">
                    {slide.emoji}
                  </span>
                </>
              )}
            </motion.h1>
          </AnimatePresence>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-7 max-w-md text-[0.975rem] leading-relaxed text-ink/85 [text-shadow:0_1px_12px_rgb(0_0_0/0.5)]"
        >
          Curated eyewear, jewellery and bags for the woman who wants to express herself
          with confidence, sophistication and individuality.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-9 flex flex-wrap gap-4"
        >
          <Link href="/shop?category=eyewear" className="btn-primary">
            Shop Eyewear
          </Link>
          <Link href="/shop?category=jewellery" className="btn-secondary">
            Explore Jewellery
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
