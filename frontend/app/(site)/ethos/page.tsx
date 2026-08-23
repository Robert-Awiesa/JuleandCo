import Image from "next/image";
import Link from "next/link";
import { fetchContentSlot } from "@/lib/content";

export const metadata = {
  title: "Our Ethos — JULES & CO",
  description:
    "Jules & Co. was born from loss, but created from love. Style is personal, confidence is powerful, and elegance should never require compromise.",
};

/**
 * The values, in the founder's own words — brand copy the owner wrote, not
 * marketing filler. It now lives in the admin rather than in this file, so it
 * can be corrected without a deploy, but it is still hers to change: the
 * defaults behind the API are the exact text that shipped here.
 */
export default async function EthosPage() {
  const ethos = await fetchContentSlot("page.ethos");

  return (
    <div className="pb-24">
      {/* Opening. Deliberately quiet — no imagery competing with the first line. */}
      <section className="container-elevated pt-20 text-center md:pt-28">
        <p className="eyebrow mb-5 text-gold">Our Ethos</p>
        <h1 className="mx-auto max-w-3xl font-serif text-4xl font-bold leading-[1.15] md:text-6xl">
          {ethos.headline}
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-ink-muted">{ethos.intro}</p>
      </section>

      {ethos.image && (
        <section className="container-elevated mt-20">
          <div className="relative aspect-[16/7] w-full overflow-hidden">
            <Image
              src={ethos.image}
              alt="JULES &amp; CO"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
        </section>
      )}

      {/* What We Stand For */}
      {ethos.values.length > 0 && (
        <section className="container-elevated mt-24">
          <p className="eyebrow mb-3 text-gold">What We Stand For</p>
          <h2 className="max-w-2xl font-serif text-3xl font-bold leading-[1.2] md:text-4xl">
            {ethos.valuesHeading}
          </h2>

          <div className="mt-14 grid grid-cols-1 gap-x-14 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {ethos.values.map((value) => (
              <div key={value.id} className="border-t border-line-strong pt-6">
                <p className="font-sans text-xs font-medium uppercase tracking-widest2 text-gold">
                  {value.title}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{value.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Our Belief — set on a raised surface and given air. This is the most
          personal passage on the site and should not be crowded. */}
      {(ethos.beliefs.length > 0 || ethos.founderQuote) && (
        <section className="mt-28 border-y border-line bg-surface-raised py-24">
          <div className="container-elevated max-w-3xl">
            <p className="eyebrow mb-8 text-gold">Our Belief</p>
            <div className="space-y-5">
              {ethos.beliefs.map((belief) => (
                <p key={belief.id} className="font-serif text-xl leading-relaxed md:text-2xl">
                  {belief.text}
                </p>
              ))}
            </div>

            {/* The founder's voice, in the first person — set apart rather than
                folded into the surrounding copy. */}
            {ethos.founderQuote && (
              <blockquote className="mt-14 border-l-2 border-gold pl-7">
                <p className="font-serif text-lg italic leading-relaxed text-ink-muted md:text-xl">
                  {ethos.founderQuote}
                </p>
              </blockquote>
            )}
          </div>
        </section>
      )}

      {/* Our Promise */}
      <section className="container-elevated mt-24 max-w-3xl text-center">
        <p className="eyebrow mb-5 text-gold">Our Promise</p>
        <p className="font-serif text-2xl leading-[1.35] md:text-3xl">{ethos.promise}</p>
        {ethos.promiseBody && <p className="mt-6 text-ink-muted">{ethos.promiseBody}</p>}

        <div className="mt-14 border-t border-line pt-12">
          <p className="font-serif text-lg tracking-widest2 text-gold">JULES &amp; CO.</p>
          <p className="mt-2 font-sans text-xs uppercase tracking-widest2 text-ink-subtle">
            Created with purpose · Worn with confidence · Inspired by legacy
          </p>
          <Link href="/shop" className="btn-primary mt-10">
            Explore the Collection
          </Link>
        </div>
      </section>
    </div>
  );
}
