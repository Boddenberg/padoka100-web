import { Minus, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/StateBlocks";
import type { QuantityMap } from "@/lib/utils/production";
import type { Produto } from "@/types/api";

export function ProductionEditor({
  products,
  quantities,
  onChange
}: {
  products: Produto[];
  quantities: QuantityMap;
  onChange: (next: QuantityMap) => void;
}) {
  if (!products.length) {
    return <EmptyState title="Sem produtos ativos" description="Cadastre produtos antes de definir a produção." />;
  }

  function setProductQuantity(produtoId: string, value: number) {
    onChange({
      ...quantities,
      [produtoId]: Math.max(0, Math.trunc(value || 0))
    });
  }

  return (
    <div className="grid grid-cols-1 gap-2.5">
      {products.map((produto) => {
        const quantity = quantities[produto.id] ?? 0;

        return (
          <div
            key={produto.id}
            className="flex items-center justify-between gap-3 rounded-bakeryLg border border-bakery-border/70 bg-white p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-bakery-ink">{produto.nome}</p>
              <p className="text-sm font-semibold text-bakery-muted">{produto.preco_atual ? "Produto ativo" : "Sem preço atual"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-bakery-creamStrong p-1">
              <button
                type="button"
                disabled={quantity <= 0}
                onClick={() => setProductQuantity(produto.id, quantity - 1)}
                aria-label={`Diminuir quantidade produzida de ${produto.nome}`}
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-bakery-brand shadow-soft transition active:scale-95 disabled:text-bakery-muted"
              >
                <Minus className="h-5 w-5" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={quantity}
                onChange={(event) => setProductQuantity(produto.id, Number(event.target.value || 0))}
                aria-label={`Quantidade produzida de ${produto.nome}`}
                className="h-10 w-14 rounded-full border-none bg-transparent text-center text-lg font-extrabold tabular-nums text-bakery-ink outline-none focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setProductQuantity(produto.id, quantity + 1)}
                aria-label={`Aumentar quantidade produzida de ${produto.nome}`}
                className="grid h-10 w-10 place-items-center rounded-full bg-bakery-brand text-white transition active:scale-95"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
