import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, error, hint, children }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-bakery-ink">
      <span>{label}</span>
      {children}
      {error ? <span className="text-sm font-semibold text-bakery-danger">{error}</span> : null}
      {hint ? <span className="text-sm font-semibold text-bakery-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-12 w-full min-w-0 rounded-2xl border border-bakery-border bg-white px-4 text-base font-semibold text-bakery-ink outline-none transition placeholder:text-bakery-muted/70 focus:border-bakery-ink focus:ring-4 focus:ring-bakery-ink/10",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full min-w-0 rounded-2xl border border-bakery-border bg-white px-4 py-3 text-base font-semibold text-bakery-ink outline-none transition placeholder:text-bakery-muted/70 focus:border-bakery-ink focus:ring-4 focus:ring-bakery-ink/10",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-12 w-full min-w-0 rounded-bakeryLg border border-bakery-border bg-white px-3 text-base font-semibold text-bakery-ink outline-none transition focus:border-bakery-brand focus:ring-4 focus:ring-bakery-soft",
        className
      )}
      {...props}
    />
  );
}
