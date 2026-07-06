import { Minus, Plus, Wheat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, productInitials } from "@/lib/utils/format";
import { resolveMediaUrl } from "@/lib/utils/media";
import type { Produto } from "@/types/api";

interface CardProdutoProps {
  produto: Produto;
  quantidade: number;
  availableQuantity: number;
  stockReady: boolean;
  onAdd: (produto: Produto) => void;
  onRemove: (produtoId: string) => void;
}

export function CardProduto({ produto, quantidade, availableQuantity, stockReady, onAdd, onRemove }: CardProdutoProps) {
  const image = resolveMediaUrl(produto.url_imagem_principal);
  const missingPrice = !produto.preco_atual;
  const selected = quantidade > 0;
  const remainingQuantity = Math.max(0, availableQuantity - quantidade);
  const canAdd = Boolean(produto.preco_atual) && stockReady && remainingQuantity > 0;
  const unavailable = missingPrice || (!selected && !canAdd);
  const stockLabel = getStockLabel({ selected, stockReady, availableQuantity, remainingQuantity });

  return (
    <div
      className={cn(
        "grid min-w-0 grid-rows-[auto_1fr] overflow-hidden rounded-bakeryLg bg-white shadow-soft ring-1 transition duration-200",
        selected ? "ring-2 ring-bakery-brand shadow-warm" : "ring-bakery-border",
        unavailable ? "opacity-70" : null
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-bakery-cream">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center gap-1.5 bg-gradient-to-br from-bakery-creamStrong via-bakery-cream to-white">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-bakery-brand shadow-soft">
              <Wheat className="h-6 w-6" />
            </div>
            <span className="text-sm font-black text-bakery-brand/70">{productInitials(produto.nome)}</span>
          </div>
        )}
        {selected ? (
          <span className="absolute right-2.5 top-2.5 grid h-8 min-w-8 place-items-center rounded-full bg-bakery-brand px-2 text-base font-black text-white shadow-button">
            {quantidade}
          </span>
        ) : null}
      </div>

      <div className="grid min-w-0 content-between gap-2.5 p-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 min-h-[2.6rem] break-words text-base font-black leading-tight text-bakery-ink">
            {produto.nome}
          </h3>
          <p className="mt-1 text-xl font-black text-bakery-brand">
            {missingPrice ? "Sem preço" : formatCurrency(produto.preco_atual?.preco_venda)}
          </p>
          {!missingPrice ? <p className="mt-1 text-xs font-black text-bakery-muted">{stockLabel}</p> : null}
        </div>

        {missingPrice ? (
          <p className="rounded-bakeryMd bg-bakery-cream px-3 py-2.5 text-center text-sm font-bold text-bakery-muted">
            Cadastre um preço
          </p>
        ) : selected ? (
          <div className="flex items-center justify-between gap-2 rounded-full bg-bakery-soft p-1.5">
            <button
              type="button"
              onClick={() => onRemove(produto.id)}
              aria-label={`Remover uma unidade de ${produto.nome}`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-bakery-brand shadow-soft ring-1 ring-bakery-brand/10 transition active:scale-95"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="text-xl font-black text-bakery-ink" aria-live="polite">
              {quantidade}
            </span>
            <button
              type="button"
              onClick={() => onAdd(produto)}
              disabled={!canAdd}
              aria-label={`Adicionar mais uma unidade de ${produto.nome}`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bakery-brand text-white shadow-button transition active:scale-95 disabled:cursor-not-allowed disabled:bg-bakery-creamStrong disabled:text-bakery-muted disabled:shadow-none"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onAdd(produto)}
            disabled={!canAdd}
            aria-label={`Adicionar ${produto.nome}`}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-bakery-brand text-base font-black text-white shadow-button transition hover:bg-bakery-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-bakery-creamStrong disabled:text-bakery-muted disabled:shadow-none"
          >
            <Plus className="h-5 w-5" />
            {canAdd ? "Adicionar" : stockReady ? "Esgotado" : "Conferindo"}
          </button>
        )}
      </div>
    </div>
  );
}

function getStockLabel({
  selected,
  stockReady,
  availableQuantity,
  remainingQuantity
}: {
  selected: boolean;
  stockReady: boolean;
  availableQuantity: number;
  remainingQuantity: number;
}) {
  if (!stockReady) return "Conferindo producao";
  if (availableQuantity <= 0) return "Esgotado";
  return selected ? `Restam ${remainingQuantity}` : `Disponivel: ${availableQuantity}`;
}
