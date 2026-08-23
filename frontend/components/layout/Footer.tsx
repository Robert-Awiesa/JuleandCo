"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Instagram, Facebook, Twitter } from "lucide-react";
import type { FooterContent } from "@/lib/content";

export function Footer({ content }: { content: FooterContent }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <footer className="border-t border-line bg-surface-raised text-ink">
      <div className="container-elevated grid grid-cols-1 gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.3fr_repeat(var(--footer-cols,3),1fr)]"
        style={{ ["--footer-cols" as string]: content.columns.length }}>
        <div>
          <Image
            src="/images/brand/logo-footer.png"
            alt="JULES & CO — Wear the Difference"
            width={524}
            height={280}
            className="h-14 w-auto"
          />
          <p className="mt-4 max-w-xs text-sm text-ink-muted">{content.blurb}</p>
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

        {content.columns.map((col) => (
          <div key={col.id}>
            <p className="eyebrow mb-4 text-ink/50">{col.title}</p>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.id}>
                  <Link href={link.href} className="inline-block py-1.5 text-sm text-ink-muted transition-colors hover:text-gold">
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
          <p className="font-sans text-xs uppercase tracking-widest2 text-gold">
            {content.tagline}
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
