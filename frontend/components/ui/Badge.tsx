import { cn } from "@/lib/utils";

interface BadgeProps {
  tone?: "gold" | "sage" | "obsidian" | "low" | "sale";
  children: React.ReactNode;
  className?: string;
}

const toneClass: Record<NonNullable<BadgeProps["tone"]>, string> = {
  gold: "bg-gold/15 text-gold border-gold/40",
  sage: "bg-sage/15 text-sage-light border-sage/30",
  obsidian: "bg-ink/10 text-ink border-line-strong",
  low: "bg-ink/5 text-ink-muted border-line",
  // Solid rather than tinted: a reduction is the one badge meant to be seen
  // first, and a tinted one would sit at the same weight as "New".
  sale: "bg-gold text-surface border-gold",
};

export function Badge({ tone = "obsidian", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2.5 py-1 text-[11px] font-medium uppercase tracking-widest2",
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
