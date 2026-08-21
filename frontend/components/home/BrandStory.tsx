"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const pillars = [
  {
    title: "Considered Materials",
    body: "Italian acetate, Mongolian cashmere, and mulberry silk — sourced from mills we've worked with for years.",
  },
  {
    title: "Made to Last",
    body: "Every piece is built for repair, not replacement. Lifetime frame adjustments, always complimentary.",
  },
  {
    title: "Quietly Confident",
    body: "No logos, no noise. Just proportion, material, and fit that speak for themselves.",
  },
];

export function BrandStory() {
  return (
    <section id="brand-story" className="border-y border-line bg-surface-raised py-24 text-ink">
      <div className="container-elevated grid grid-cols-1 items-center gap-14 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="relative aspect-[4/5] overflow-hidden"
        >
          <Image
            src="https://picsum.photos/seed/brand-story/900/1125"
            alt="JULES & CO craftsmanship"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </motion.div>

        <div>
          <p className="eyebrow mb-4 text-gold">Our Ethos</p>
          <h2 className="font-serif text-4xl font-bold leading-[1.18] md:text-5xl">
            Craftsmanship, edited for a modern wardrobe.
          </h2>
          <p className="mt-6 max-w-lg text-ink-muted">
            JULES &amp; CO started with a simple belief: what you wear should set you apart,
            not blend in. Too much of what&apos;s sold as &ldquo;premium&rdquo; is neither
            considered nor built to last. We work directly with a small circle of ateliers to
            produce fewer, better pieces — each one designed to pair effortlessly with the
            rest of your wardrobe. That&apos;s the difference we mean when we say wear it.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {pillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <p className="mb-2 font-serif text-lg text-gold">{pillar.title}</p>
                <p className="text-sm text-ink-muted">{pillar.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
