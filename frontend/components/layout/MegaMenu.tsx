"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MegaMenuSection, countForHref } from "@/lib/navigation";

interface MegaMenuProps {
  section: MegaMenuSection;
  /** group key -> value -> product count, from /api/products/facets. */
  counts: Record<string, Record<string, number>>;
  onNavigate: () => void;
}

export function MegaMenu({ section, counts, onNavigate }: MegaMenuProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="glass-panel absolute left-0 right-0 top-full border-t-0 shadow-soft"
    >
      <div className="container-elevated grid grid-cols-1 gap-10 py-10 md:grid-cols-[1fr_1fr_1.1fr]">
        {section.columns.map((column) => (
          <div key={column.title}>
            <p className="eyebrow mb-4">{column.title}</p>
            <ul className="space-y-3">
              {column.links.map((link) => {
                const count = countForHref(link.href, counts);
                return (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      className="group/link inline-flex items-baseline gap-1.5 py-0.5 text-[15px] text-ink transition-colors hover:text-gold"
                    >
                      {link.label}
                      {count !== null && (
                        <span
                          className={
                            count === 0
                              ? "numeric text-xs text-ink-subtle/60"
                              : "numeric text-xs text-ink-subtle"
                          }
                        >
                          ({count})
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <Link
          href={section.featured.href}
          onClick={onNavigate}
          className="group relative block h-64 overflow-hidden md:h-full"
        >
          <Image
            src={section.featured.image}
            alt={section.featured.title}
            fill
            sizes="400px"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-ink">
            <p className="font-serif text-lg">{section.featured.title}</p>
            <p className="mt-1 text-xs text-ink-muted">{section.featured.subtitle}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-widest2">
              Discover <ArrowUpRight size={13} />
            </span>
          </div>
        </Link>
      </div>
    </motion.div>
  );
}
