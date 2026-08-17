"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { collections } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const spanClass: Record<string, string> = {
  wide: "md:col-span-2 md:aspect-[16/8]",
  tall: "md:row-span-2 md:aspect-[3/4.6]",
  default: "aspect-[3/4]",
};

export function CuratedCollections() {
  return (
    <section className="container-elevated py-24">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <p className="eyebrow mb-3">Curated Edits</p>
          <h2 className="font-serif text-4xl">Shop the Season</h2>
        </div>
        <Link href="/shop" className="hidden text-sm underline-offset-4 hover:underline sm:block">
          View all collections
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:grid-rows-2">
        {collections.map((collection, i) => (
          <motion.div
            key={collection.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: i * 0.08 }}
            className={cn(
              "group relative aspect-[3/4] overflow-hidden",
              spanClass[collection.span ?? "default"]
            )}
          >
            <Link href={collection.href}>
              <Image
                src={collection.image}
                alt={collection.title}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-obsidian/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-alabaster">
                <p className="font-serif text-2xl">{collection.title}</p>
                <p className="mt-1 text-sm text-alabaster/75">{collection.subtitle}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-widest2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Shop the edit <ArrowUpRight size={13} />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
