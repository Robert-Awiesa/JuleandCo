import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded text-xs uppercase tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-obsidian text-alabaster hover:bg-gold hover:text-obsidian",
        outline: "border border-obsidian/20 text-obsidian hover:border-obsidian",
        ghost: "text-obsidian/70 hover:text-obsidian",
        destructive: "text-red-600 hover:text-red-700",
      },
      size: {
        sm: "px-3 py-1.5",
        md: "px-5 py-2.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
