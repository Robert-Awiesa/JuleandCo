import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "in" | "low" | "out" | "neutral";

const toneClass: Record<Tone, string> = {
  in: "bg-green-100 text-green-700",
  low: "bg-amber-100 text-amber-700",
  out: "bg-red-100 text-red-700",
  neutral: "bg-obsidian/5 text-obsidian/70",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("rounded-full px-2.5 py-1 text-xs font-medium", toneClass[tone], className)}
      {...props}
    />
  );
}
