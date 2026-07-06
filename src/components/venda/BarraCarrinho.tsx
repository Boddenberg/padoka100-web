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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+0.5rem)] z-40 px-3 lg:bottom-5">
      <div className="pointer-events-auto mx-auto flex w-full max-w-[var(--sales-max-width)] items-center gap-2.5 rounded-bakeryXl bg-white p-2.5 shadow-floating ring-1 ring-bakery-border">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-bakeryLg px-2 py-1.5 text-left transition active:scale-[0.99]"
          aria-label="Ver itens da sacola"
        >
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-bakery-soft text-bakery-brand">
            <ShoppingBag className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-bakery-brand px-1.5 text-xs font-black text-white ring-2 ring-white">
              {itemCount}
            </span>
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-sm font-bold text-bakery-muted">
              Ver sacola <ChevronUp className="h-4 w-4" />
            </span>
            <span className="block truncate text-2xl font-black leading-tight text-bakery-ink">{formatCurrency(total)}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || submitting}
          className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-bakeryLg bg-bakery-brand px-5 text-base font-black text-white shadow-button transition hover:bg-bakery-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-bakery-creamStrong disabled:text-bakery-muted disabled:shadow-none sm:px-7 sm:text-lg"
        >
          {submitting ? "Registrando..." : "Registrar venda"}
        </button>
      </div>
    </div>
  );
}
