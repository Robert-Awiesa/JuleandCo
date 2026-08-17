import { cn } from "@/lib/utils";

interface BadgeProps {
  tone?: "gold" | "sage" | "obsidian" | "low";
  children: React.ReactNode;
  className?: string;
}

const toneClass: Record<NonNullable<BadgeProps["tone"]>, string> = {
  gold: "bg-gold/15 text-gold-dark border-gold/30",
  sage: "bg-sage/15 text-sage-dark border-sage/30",
  obsidian: "bg-obsidian text-alabaster border-obsidian",
  low: "bg-obsidian/5 text-obsidian/70 border-obsidian/15",
};

export function Badge({ tone = "obsidian", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2.5 py-1 text-[10px] uppercase tracking-widest2 font-medium",
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
