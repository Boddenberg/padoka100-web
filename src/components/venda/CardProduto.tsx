import { Plus, Wheat } from "lucide-react";
import { ProductImage } from "@/components/ui/ProductImage";
import { Stepper } from "@/components/ui/Stepper";
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
        "grid min-w-0 grid-rows-[auto_1fr] overflow-hidden rounded-bakeryXl border bg-white shadow-soft transition duration-200",
        selected ? "border-bakery-brand shadow-warm" : "border-bakery-border/70",
        unavailable ? "opacity-70" : null
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-bakery-creamStrong">
        <ProductImage
          src={image}
          className="h-full w-full object-cover"
          fallback={
            <div className="grid h-full place-items-center gap-1.5">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-bakery-muted shadow-soft">
                <Wheat className="h-6 w-6" />
              </div>
              <span className="text-sm font-bold text-bakery-muted">{productInitials(produto.nome)}</span>
            </div>
          }
        />
        {selected ? (
          <span className="absolute right-2.5 top-2.5 grid h-8 min-w-8 place-items-center rounded-full bg-bakery-brand px-2 text-base font-extrabold tabular-nums text-white shadow-button">
            {quantidade}
          </span>
        ) : null}
      </div>

      <div className="grid min-w-0 content-between gap-2.5 p-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 min-h-[2.6rem] break-words text-base font-bold leading-tight text-bakery-ink">
            {produto.nome}
          </h3>
          <p className="mt-1 text-xl font-extrabold tracking-tight tabular-nums text-bakery-ink">
            {missingPrice ? "Sem preço" : formatCurrency(produto.preco_atual?.preco_venda)}
          </p>
          {!missingPrice ? <p className="mt-0.5 text-xs font-semibold text-bakery-muted">{stockLabel}</p> : null}
        </div>

        {missingPrice ? (
          <p className="rounded-full bg-bakery-creamStrong px-3 py-2.5 text-center text-sm font-bold text-bakery-muted">
            Cadastre um preço
          </p>
        ) : selected ? (
          <Stepper
            value={quantidade}
            onIncrement={() => onAdd(produto)}
            onDecrement={() => onRemove(produto.id)}
            canAdd={canAdd}
            removeAsTrash
            label={produto.nome}
          />
        ) : (
          <button
            type="button"
            onClick={() => onAdd(produto)}
            disabled={!canAdd}
            aria-label={`Adicionar ${produto.nome}`}
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full border border-bakery-border bg-white text-base font-bold text-bakery-ink transition hover:border-bakery-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-bakery-creamStrong disabled:text-bakery-muted"
          >
            <Plus className="h-5 w-5 text-bakery-brand" />
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
  if (!stockReady) return "Conferindo produção";
  if (availableQuantity <= 0) return "Esgotado";
  return selected ? `Restam ${remainingQuantity}` : `Disponível: ${availableQuantity}`;
}
