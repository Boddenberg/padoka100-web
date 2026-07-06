import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StepperProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  canAdd?: boolean;
  removeAsTrash?: boolean;
  size?: "sm" | "md";
  label?: string;
  className?: string;
}

export function Stepper({
  value,
  onIncrement,
  onDecrement,
  canAdd = true,
  removeAsTrash = false,
  size = "md",
  label,
  className
}: StepperProps) {
  const buttonSize = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const showTrash = removeAsTrash && value === 1;

  return (
    <div className={cn("flex items-center justify-between gap-1 rounded-full bg-bakery-creamStrong p-1", className)}>
      <button
        type="button"
        onClick={onDecrement}
        aria-label={showTrash ? `Remover ${label ?? "item"}` : `Diminuir ${label ?? "quantidade"}`}
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-white text-bakery-brand shadow-soft transition active:scale-95",
          buttonSize
        )}
      >
        {showTrash ? <Trash2 className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
      </button>
      <span
        aria-live="polite"
        className={cn("min-w-8 text-center font-extrabold tabular-nums text-bakery-ink", size === "sm" ? "text-base" : "text-lg")}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={!canAdd}
        aria-label={`Aumentar ${label ?? "quantidade"}`}
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-bakery-brand text-white transition active:scale-95 disabled:bg-bakery-border disabled:text-bakery-muted",
          buttonSize
        )}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
