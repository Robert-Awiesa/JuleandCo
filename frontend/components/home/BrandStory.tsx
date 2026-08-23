"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

/**
 * The three values that speak to the customer rather than about the brand.
 * Legacy, Elegance and Purpose are the founder's own framing and live on the
 * full /ethos page; these three answer "why this piece, for me".
 *
 * Wording is verbatim from the brand's copy — not paraphrased.
 */
const values = [
  {
    title: "Individuality",
    body: "Your style should speak before you do. We encourage every woman to embrace what makes her different.",
  },
  {
    title: "Confidence",
    body: "Designed for women who know that looking good is not vanity — it is a form of self-expression.",
  },
  {
    title: "Affordability",
    body: "Luxury should feel attainable. Pieces that look sophisticated, feel special and remain accessible.",
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
            src="/images/brand/ethos-image.jpeg"
            alt="JULES &amp; CO"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </motion.div>

        <div>
          <p className="eyebrow mb-4 text-gold">Our Ethos</p>
          <h2 className="font-serif text-4xl font-bold leading-[1.18] md:text-5xl">
            Born from loss, created from love.
          </h2>
          {/*
            The homepage carries only the essence. The origin story, the six
            values in full, and the founder's own words live on /ethos, where
            they have room — rather than being compressed into a scroll-past band.
          */}
          <p className="mt-6 max-w-lg text-ink-muted">
            We believe that style is personal, confidence is powerful, and elegance should never
            require compromise. Every piece is thoughtfully selected for the woman who wants to
            express herself with confidence, sophistication and individuality.
          </p>

          <Link href="/ethos" className="btn-ghost mt-6 !px-0">
            Read our story
          </Link>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <p className="mb-2 font-serif text-lg text-gold">{value.title}</p>
                <p className="text-sm text-ink-muted">{value.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
