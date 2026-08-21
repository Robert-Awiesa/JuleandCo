"use client";

import { testimonials } from "@/lib/mockData";

export function Testimonials() {
  const loop = [...testimonials, ...testimonials];

  return (
    <section className="overflow-hidden border-y border-line bg-surface-raised py-16">
      <p className="eyebrow container-elevated mb-10 text-center">What Our Clients Say</p>

      <div className="flex w-max animate-marquee gap-10">
        {loop.map((t, i) => (
          <blockquote
            key={`${t.id}-${i}`}
            className="w-[360px] shrink-0 border border-line bg-surface-overlay p-8"
          >
            <p className="font-serif text-lg leading-relaxed text-ink">
              &ldquo;{t.quote}&rdquo;
            </p>
            <footer className="mt-6 text-sm text-ink-subtle">
              {t.author} &middot; {t.role}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
