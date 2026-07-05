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
        "group relative grid min-h-[9.5rem] min-w-0 overflow-hidden rounded-bakeryLg bg-white text-left shadow-soft ring-1 ring-bakery-border transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
        quantidade ? "ring-2 ring-bakery-brand shadow-warm" : "hover:-translate-y-0.5 hover:shadow-warm"
      )}
    >
      <div className="relative h-16 overflow-hidden bg-bakery-cream">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-bakery-creamStrong/80 via-bakery-cream to-white">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-bakery-brand shadow-soft">
              <Wheat className="h-5 w-5" />
            </div>
          </div>
        )}
        {quantidade ? (
          <span className="absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-bakery-brand px-2 text-xs font-black text-white shadow-button">
            {quantidade}
          </span>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-1.5 p-2.5">
        <div className="min-w-0">
          <h3 className="line-clamp-2 break-words text-[0.93rem] font-black leading-tight text-bakery-ink">{produto.nome}</h3>
          <p className="mt-0.5 hidden text-[0.72rem] font-medium leading-tight text-bakery-muted sm:line-clamp-1 sm:block">
            {produto.descricao_visual || productInitials(produto.nome)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="whitespace-nowrap text-lg font-black text-bakery-brand">{formatCurrency(produto.preco_atual?.preco_venda)}</p>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bakery-soft text-bakery-brand ring-1 ring-bakery-brand/10 transition group-hover:bg-bakery-brand group-hover:text-white group-active:scale-95">
            <Plus className="h-5 w-5" />
          </span>
        </div>
        {!produto.preco_atual ? <span className="text-sm font-bold text-bakery-danger">Sem preco cadastrado</span> : null}
      </div>
    </button>
  );
}
