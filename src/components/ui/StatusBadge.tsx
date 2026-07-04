import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StatusBadgeProps {
  tone?: "neutral" | "good" | "warn" | "danger";
  children: ReactNode;
}

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  const styles = {
    neutral: "bg-slate-100 text-slate-700",
    good: "bg-teal-50 text-teal-700",
    warn: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700"
  };
  const Icon = tone === "good" ? CheckCircle2 : tone === "danger" ? CircleAlert : CircleDot;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", styles[tone])}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
