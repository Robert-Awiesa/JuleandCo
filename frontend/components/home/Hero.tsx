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
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-surface/60" />

      <div className="container-elevated relative z-10 pb-20 text-ink">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="eyebrow mb-5 text-gold"
        >
          Wear the Difference
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="max-w-2xl font-serif text-5xl font-bold leading-[1.12] tracking-tightest sm:text-6xl md:text-7xl"
        >
          Thank you for visiting Jules and Co! Pick a Pair😎
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 max-w-md text-ink-muted"
        >
          Curated eyewear, jewellery and bags — designed and made to outlast the season.
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
