"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Instagram } from "lucide-react";
import type { ContactSettings, FooterContent } from "@/lib/content";

function TikTokIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.67a6.34 6.34 0 0 0 6.34 6.33 6.34 6.34 0 0 0 6.33-6.33V8.87a8.28 8.28 0 0 0 4.84 1.56v-3.46a4.85 4.85 0 0 1-.92-.28z" />
    </svg>
  );
}

export function Footer({
  content,
  contact = {},
}: {
  content: FooterContent;
  contact?: ContactSettings;
}) {
  const [email, setEmail] = useState("");

  /**
   * The signup used to set a flag and say "Thanks!" while throwing the address
   * away. Nobody who joined was ever going to hear anything, which is worse
   * than not offering it: they believe they are on a list that does not exist.
   */
  const [status, setStatus] = useState<"idle" | "sending" | "joined" | "error">("idle");
  const [error, setError] = useState("");

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError("");

    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${base}/subscribers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || "We could not sign you up. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("joined");
      setEmail("");
    } catch {
      setError("We could not reach the store. Check your connection and try again.");
      setStatus("error");
    }
  };

  const social = [
    {
      key: "instagram",
      href: contact.instagram || "https://instagram.com",
      label: "JULES & CO on Instagram",
      Icon: Instagram,
    },
    {
      key: "tiktok",
      href: contact.tiktok || "https://tiktok.com",
      label: "JULES & CO on TikTok",
      Icon: TikTokIcon,
    },
  ];

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
          <div className="mt-6 max-w-xs">
            {status === "joined" ? (
              <p role="status" className="border border-gold/40 px-4 py-3 text-sm text-ink-muted">
                You are on the list. We will be in touch when something new arrives.
              </p>
            ) : (
              <form onSubmit={join} className="flex border border-line-strong">
                <label htmlFor="footer-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="footer-email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  className="w-full bg-transparent px-4 py-3 text-sm placeholder:text-ink-subtle focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="shrink-0 bg-gold px-4 text-xs font-medium uppercase tracking-wide text-surface transition-colors hover:bg-gold-light disabled:opacity-60"
                >
                  {status === "sending" ? "…" : "Join"}
                </button>
              </form>
            )}

            {status === "error" && (
              <p role="alert" className="mt-2 text-xs text-ink-subtle">
                {error}
              </p>
            )}
          </div>
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

      <div className="container-elevated flex flex-col items-center justify-between gap-6 border-t border-line py-8 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="font-sans text-xs uppercase tracking-widest2 text-gold">
            {content.tagline}
          </p>
          <p className="mt-2 text-xs text-ink-subtle">
            &copy; {new Date().getFullYear()} JULES &amp; CO. All rights reserved.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {social.map(({ key, href, label, Icon }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={label}
              className="group flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface/40 text-ink-muted transition-all duration-300 hover:border-gold hover:bg-gold/10 hover:text-gold hover:scale-105 active:scale-95"
            >
              <Icon size={22} className="transition-transform group-hover:scale-110" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
