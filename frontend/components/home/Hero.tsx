"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative flex h-[92vh] min-h-[640px] w-full items-end overflow-hidden bg-surface">
      <Image
        src="/images/hero/jules-hero.jpg"
        alt="JULES & CO editorial campaign"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-70"
      />
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
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="max-w-[18ch] font-serif text-[2.5rem] font-bold leading-[1.08] tracking-tightest [text-shadow:0_2px_24px_rgb(0_0_0/0.55)] sm:text-5xl lg:text-6xl xl:text-[4.25rem]"
        >
          Thank you for visiting Jules and Co! Pick a Pair{" "}
          <span className="inline-block align-middle text-[0.55em] leading-none">😎</span>
        </motion.h1>
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
          <Link
            href="/shop?category=eyewear"
            className="btn-primary"
          >
            Shop Eyewear
          </Link>
          <Link
            href="/shop?category=jewellery"
            className="btn-secondary"
          >
            Explore Jewellery
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
