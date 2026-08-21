"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative flex h-[92vh] min-h-[640px] w-full items-end overflow-hidden bg-obsidian">
      <Image
        src="/images/hero/jules-hero.jpg"
        alt="JULES & CO editorial campaign"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/20 to-obsidian/40" />

      <div className="container-elevated relative z-10 pb-20 text-alabaster">
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
          Vision, tailored to how you live.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 max-w-md text-alabaster/80"
        >
          Curated eyewear, jewellery and bags — designed in-house and made to outlast the season.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-9 flex flex-wrap gap-4"
        >
          <Link
            href="/shop?category=eyewear"
            className="btn-primary bg-alabaster text-obsidian hover:bg-gold"
          >
            Shop Eyewear
          </Link>
          <Link
            href="/shop?category=jewellery"
            className="btn-secondary border-alabaster/40 text-alabaster hover:bg-alabaster hover:text-obsidian"
          >
            Explore Jewellery
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
