"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Instagram, Facebook, Twitter } from "lucide-react";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "Eyewear", href: "/shop?category=eyewear" },
      { label: "Jewellery", href: "/shop?category=jewellery" },
      { label: "Bags", href: "/shop?category=bags" },
      { label: "New Arrivals", href: "/shop?sort=new" },
      { label: "Best Sellers", href: "/shop?sort=bestseller" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact Us", href: "/contact" },
      { label: "Shipping & Returns", href: "/shipping" },
      { label: "Size Guide", href: "/size-guide" },
      { label: "Track Order", href: "/account/orders" },
    ],
  },
  {
    title: "The House",
    links: [
      { label: "Our Ethos", href: "/ethos" },
      { label: "What We Stand For", href: "/ethos" },
      { label: "Careers", href: "/careers" },
    ],
  },
];

export function Footer() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <footer className="border-t border-line bg-surface-raised text-ink">
      <div className="container-elevated grid grid-cols-1 gap-12 py-16 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <Image
            src="/images/brand/logo-footer.png"
            alt="JULES & CO — Wear the Difference"
            width={524}
            height={280}
            className="h-14 w-auto"
          />
          <p className="mt-4 max-w-xs text-sm text-ink-muted">
            Curated eyewear, jewellery and bags for the woman who wants to express herself
            with confidence, sophistication and individuality.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            className="mt-6 flex max-w-xs border border-line-strong"
          >
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="w-full bg-transparent px-4 py-3 text-sm placeholder:text-ink-subtle focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 bg-gold px-4 text-xs font-medium uppercase tracking-wide text-surface transition-colors hover:bg-gold-light"
            >
              {submitted ? "Thanks!" : "Join"}
            </button>
          </form>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="eyebrow mb-4 text-ink/50">{col.title}</p>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-ink-muted hover:text-gold">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container-elevated flex flex-col items-center justify-between gap-4 border-t border-line py-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="font-sans text-[11px] uppercase tracking-widest2 text-gold">
            Created with purpose &middot; Worn with confidence &middot; Inspired by legacy
          </p>
          <p className="mt-2 text-xs text-ink-subtle">
            &copy; {new Date().getFullYear()} JULES &amp; CO. All rights reserved.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <Instagram size={16} className="text-ink-muted hover:text-gold" />
          <Facebook size={16} className="text-ink-muted hover:text-gold" />
          <Twitter size={16} className="text-ink-muted hover:text-gold" />
        </div>
      </div>
    </footer>
  );
}
