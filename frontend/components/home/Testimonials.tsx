"use client";

import Image from "next/image";
import { testimonials } from "@/lib/mockData";
import type { Testimonial } from "@/lib/types";

/** "Adjoa M." -> "AM". Used when a client has no photograph on file. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ClientAvatar({ testimonial }: { testimonial: Testimonial }) {
  const ring = "ring-1 ring-gold/40";

  if (testimonial.image) {
    return (
      <div className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full ${ring}`}>
        <Image
          src={testimonial.image}
          alt={testimonial.author}
          fill
          sizes="48px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/10 font-serif text-sm tracking-wide text-gold ${ring}`}
    >
      {initials(testimonial.author)}
    </div>
  );
}

export function Testimonials() {
  const loop = [...testimonials, ...testimonials];

  return (
    <section className="overflow-hidden border-y border-line bg-surface-raised py-16">
      <p className="eyebrow container-elevated mb-10 text-center">What Our Clients Say</p>

      <div className="flex w-max animate-marquee gap-8 sm:gap-10">
        {loop.map((t, i) => (
          <blockquote
            key={`${t.id}-${i}`}
            // justify-between with a floor height keeps every attribution row on
            // the same baseline, so the avatars line up across cards of
            // differing quote lengths.
            className="flex min-h-[16rem] w-[300px] shrink-0 flex-col justify-between border border-line bg-surface-overlay p-7 sm:w-[380px] sm:p-8"
          >
            <p className="font-serif text-lg leading-relaxed text-ink">
              &ldquo;{t.quote}&rdquo;
            </p>

            <footer className="mt-7 flex items-center gap-4 border-t border-line pt-5">
              <ClientAvatar testimonial={t} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{t.author}</p>
                <p className="truncate text-xs text-ink-subtle">{t.role}</p>
              </div>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
