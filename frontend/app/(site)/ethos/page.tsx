import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Our Ethos — JULES & CO",
  description:
    "Jules & Co. was born from loss, but created from love. Style is personal, confidence is powerful, and elegance should never require compromise.",
};

/**
 * The values, in the founder's own words. Kept verbatim — this is brand copy
 * the owner wrote, not marketing filler to be rephrased.
 */
const values = [
  {
    title: "Legacy",
    body: "We honour where we come from while creating something meaningful for the future.",
  },
  {
    title: "Elegance",
    body: "We believe true elegance is timeless. It is found in simplicity, confidence and the way you carry yourself.",
  },
  {
    title: "Individuality",
    body: "Your style should speak before you do. We encourage every woman to embrace what makes her different.",
  },
  {
    title: "Confidence",
    body: "Jules & Co. is designed for women who know that looking good is not vanity — it is a form of self-expression.",
  },
  {
    title: "Affordability",
    body: "Luxury should feel attainable. We strive to offer pieces that look sophisticated, feel special and remain accessible.",
  },
  {
    title: "Purpose",
    body: "Every brand should stand for something bigger than what it sells. For Jules & Co., that purpose is to turn inspiration into something tangible and lasting.",
  },
];

const beliefs = [
  "We believe that beauty can emerge from the hardest seasons of life.",
  "We believe that grief can coexist with growth.",
  "We believe that a legacy can begin with a single idea.",
  "And we believe that sometimes, the most beautiful chapters of our lives are written after the chapters we never wanted to end.",
];

export default function EthosPage() {
  return (
    <div className="pb-24">
      {/* Opening. Deliberately quiet — no imagery competing with the first line. */}
      <section className="container-elevated pt-20 text-center md:pt-28">
        <p className="eyebrow mb-5 text-gold">Our Ethos</p>
        <h1 className="mx-auto max-w-3xl font-serif text-4xl font-bold leading-[1.15] md:text-6xl">
          Born from loss, created from love.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-ink-muted">
          We believe that style is personal, confidence is powerful, and elegance should never
          require compromise. From our sunglasses and optical frames to our jewellery and future
          collections, every piece is thoughtfully selected for the woman who wants to express
          herself with confidence, sophistication and individuality.
        </p>
      </section>

      <section className="container-elevated mt-20">
        <div className="relative aspect-[16/7] w-full overflow-hidden">
          <Image
            src="/images/brand/ethos-image.jpeg"
            alt="JULES &amp; CO"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </section>

      {/* What We Stand For */}
      <section className="container-elevated mt-24">
        <p className="eyebrow mb-3 text-gold">What We Stand For</p>
        <h2 className="max-w-2xl font-serif text-3xl font-bold leading-[1.2] md:text-4xl">
          Six things we will not compromise on.
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-x-14 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value) => (
            <div key={value.title} className="border-t border-line-strong pt-6">
              <p className="font-sans text-xs font-medium uppercase tracking-widest2 text-gold">
                {value.title}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{value.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Our Belief — set on a raised surface and given air. This is the most
          personal passage on the site and should not be crowded. */}
      <section className="mt-28 border-y border-line bg-surface-raised py-24">
        <div className="container-elevated max-w-3xl">
          <p className="eyebrow mb-8 text-gold">Our Belief</p>
          <div className="space-y-5">
            {beliefs.map((line) => (
              <p key={line} className="font-serif text-xl leading-relaxed md:text-2xl">
                {line}
              </p>
            ))}
          </div>

          {/* The founder's voice, in the first person — set apart rather than
              folded into the surrounding copy. */}
          <blockquote className="mt-14 border-l-2 border-gold pl-7">
            <p className="font-serif text-lg italic leading-relaxed text-ink-muted md:text-xl">
              Jules &amp; Co. is my reminder that from loss can come purpose, from memories can
              come inspiration, and from love can come something that lives on.
            </p>
          </blockquote>
        </div>
      </section>

      {/* Our Promise */}
      <section className="container-elevated mt-24 max-w-3xl text-center">
        <p className="eyebrow mb-5 text-gold">Our Promise</p>
        <p className="font-serif text-2xl leading-[1.35] md:text-3xl">
          To create pieces that make you feel seen, confident and beautifully yourself.
        </p>
        <p className="mt-6 text-ink-muted">
          Because Jules &amp; Co. isn&rsquo;t simply about what you wear. It is about who you
          become when you wear it.
        </p>

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
