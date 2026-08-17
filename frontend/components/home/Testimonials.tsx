"use client";

import { testimonials } from "@/lib/mockData";

export function Testimonials() {
  const loop = [...testimonials, ...testimonials];

  return (
    <section className="overflow-hidden border-y border-obsidian/10 bg-alabaster py-16">
      <p className="eyebrow container-elevated mb-10 text-center">What Our Clients Say</p>

      <div className="flex w-max animate-marquee gap-10">
        {loop.map((t, i) => (
          <blockquote
            key={`${t.id}-${i}`}
            className="w-[360px] shrink-0 border border-obsidian/10 bg-white/40 p-8"
          >
            <p className="font-serif text-lg leading-relaxed text-obsidian/90">
              &ldquo;{t.quote}&rdquo;
            </p>
            <footer className="mt-6 text-sm text-obsidian/50">
              {t.author} &middot; {t.role}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
