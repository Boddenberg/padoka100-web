import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-bakery-brand text-white shadow-button hover:bg-bakery-dark focus-visible:ring-bakery-brand/30",
  secondary: "bg-white text-bakery-ink ring-1 ring-bakery-border hover:bg-bakery-cream focus-visible:ring-bakery-brand/25",
  ghost: "bg-transparent text-bakery-muted hover:bg-bakery-cream hover:text-bakery-ink focus-visible:ring-bakery-brand/25",
  danger: "bg-bakery-danger text-white hover:bg-bakery-danger/90 focus-visible:ring-bakery-danger/30",
  success: "bg-bakery-success text-white hover:bg-bakery-success/90 focus-visible:ring-bakery-success/30"
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-6 text-[1.05rem]",
  icon: "h-12 w-12 p-0"
};

export function Button({ className, variant = "primary", size = "md", icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-bakeryLg font-bold transition active:scale-[0.98] focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:bg-bakery-creamStrong disabled:text-bakery-muted disabled:shadow-none disabled:ring-bakery-border",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
