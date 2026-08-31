import type { PolicyContent } from "@/lib/content";

/**
 * Privacy, returns and terms all render through here.
 *
 * One component rather than three near-identical pages: the shape is the same,
 * the reading experience should be the same, and a change to how a policy reads
 * should not have to be made three times.
 *
 * Deliberately plain. These pages are read by someone who is worried about
 * something — a charge they do not recognise, a piece that arrived damaged — so
 * the job is legibility, not atmosphere. Long measure, generous leading, real
 * headings they can scan for the paragraph that concerns them.
 */
export function PolicyPage({ eyebrow, content }: { eyebrow: string; content: PolicyContent }) {
  return (
    <div className="container-elevated max-w-3xl pb-24 pt-20 md:pt-28">
      <p className="eyebrow mb-5 text-gold">{eyebrow}</p>

      <h1 className="font-serif text-4xl font-bold leading-[1.15] md:text-5xl">
        {content.headline}
      </h1>

      {content.intro && <p className="mt-7 text-lg leading-relaxed text-ink-muted">{content.intro}</p>}

      {content.updated && <p className="mt-5 text-sm text-ink-subtle">{content.updated}</p>}

      <div className="mt-14 space-y-12">
        {content.sections.map((section) => (
          <section key={section.id}>
            <h2 className="font-serif text-2xl leading-snug">{section.heading}</h2>

            {/* Blank lines in the admin become paragraphs. Editors type them
                naturally, and without this the whole section runs together. */}
            <div className="mt-4 space-y-4 leading-relaxed text-ink-muted">
              {section.body
                .split(/\n\s*\n/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
