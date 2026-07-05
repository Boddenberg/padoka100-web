import { Plus, Wheat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, productInitials } from "@/lib/utils/format";
import { resolveMediaUrl } from "@/lib/utils/media";
import type { Produto } from "@/types/api";

interface CardProdutoProps {
  produto: Produto;
  quantidade: number;
  onAdd: (produto: Produto) => void;
}

export function CardProduto({ produto, quantidade, onAdd }: CardProdutoProps) {
  const image = resolveMediaUrl(produto.url_imagem_principal);
  const disabled = !produto.preco_atual;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAdd(produto)}
      className={cn(
        "group relative grid min-h-[13.5rem] min-w-0 overflow-hidden rounded-bakeryXl bg-white text-left shadow-soft ring-1 ring-bakery-border transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
        quantidade ? "ring-2 ring-bakery-brand shadow-warm" : "hover:-translate-y-0.5 hover:shadow-warm"
      )}
    >
      <div className="relative h-28 overflow-hidden bg-bakery-cream">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-bakery-creamStrong via-bakery-cream to-white">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-bakery-brand shadow-soft">
              <Wheat className="h-8 w-8" />
            </div>
          </div>
        )}
        {quantidade ? (
          <span className="absolute right-3 top-3 grid h-8 min-w-8 place-items-center rounded-full bg-bakery-brand px-2 text-sm font-black text-white shadow-button">
            {quantidade}
          </span>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-2 p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 break-words text-[1.02rem] font-black leading-tight text-bakery-ink">{produto.nome}</h3>
          <p className="mt-1 text-xs font-bold text-bakery-muted">{produto.descricao_visual || productInitials(produto.nome)}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="whitespace-nowrap text-xl font-black text-bakery-brand">{formatCurrency(produto.preco_atual?.preco_venda)}</p>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-bakery-soft text-bakery-brand transition group-hover:bg-bakery-brand group-hover:text-white">
            <Plus className="h-5 w-5" />
          </span>
        </div>
        {!produto.preco_atual ? <span className="text-sm font-bold text-bakery-danger">Sem preco cadastrado</span> : null}
      </div>
    </button>
  );
}
