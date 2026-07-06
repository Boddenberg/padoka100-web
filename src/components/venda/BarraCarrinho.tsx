import { ChevronUp, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

interface BarraCarrinhoProps {
  itemCount: number;
  total: number;
  submitting: boolean;
  disabled: boolean;
  onOpen: () => void;
  onSubmit: () => void;
}

export function BarraCarrinho({ itemCount, total, submitting, disabled, onOpen, onSubmit }: BarraCarrinhoProps) {
  if (itemCount <= 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-clearance)+8px)] z-40 px-4 lg:bottom-5">
      <div className="pointer-events-auto mx-auto flex w-full max-w-[var(--sales-max-width)] items-center gap-2 rounded-full bg-bakery-ink p-2 text-white shadow-floating">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-full px-2 py-1 text-left transition active:scale-[0.99]"
          aria-label="Ver itens da sacola"
        >
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10">
            <ShoppingBag className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-bakery-brand px-1.5 text-xs font-extrabold tabular-nums text-white ring-2 ring-bakery-ink">
              {itemCount}
            </span>
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-xs font-semibold text-white/60">
              Ver sacola <ChevronUp className="h-3.5 w-3.5" />
            </span>
            <span className="block truncate text-xl font-extrabold leading-tight tracking-tight tabular-nums">
              {formatCurrency(total)}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || submitting}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-bakery-brand px-5 text-base font-bold text-white transition hover:bg-bakery-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 sm:px-7"
        >
          {submitting ? "Registrando..." : "Registrar"}
        </button>
      </div>
    </div>
  );
}
