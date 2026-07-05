import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StatusBadgeProps {
  tone?: "neutral" | "good" | "warn" | "danger";
  children: ReactNode;
}

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  const styles = {
    neutral: "bg-bakery-cream text-bakery-muted",
    good: "bg-bakery-successSoft text-bakery-success",
    warn: "bg-bakery-warningSoft text-bakery-warning",
    danger: "bg-bakery-dangerSoft text-bakery-danger"
  };
  const Icon = tone === "good" ? CheckCircle2 : tone === "danger" ? CircleAlert : CircleDot;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", styles[tone])}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
