import { Minus, Plus, ShoppingBag, Trash2, Wheat } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/StateBlocks";
import { formatCurrency } from "@/lib/utils/format";
import { resolveMediaUrl } from "@/lib/utils/media";
import type { Produto } from "@/types/api";

interface CartItem {
  produto: Produto;
  quantidade: number;
  availableQuantity: number;
  subtotal: number;
}

interface SacolaSheetProps {
  open: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  total: number;
  submitting: boolean;
  error: string | null;
  disabled: boolean;
  onAdd: (produto: Produto) => void;
  onRemove: (produtoId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}

export function SacolaSheet({
  open,
  onClose,
  cartItems,
  total,
  submitting,
  error,
  disabled,
  onAdd,
  onRemove,
  onClear,
  onSubmit
}: SacolaSheetProps) {
  const hasItems = cartItems.length > 0;

  return (
    <Modal title="Sua sacola" open={open} onClose={onClose}>
      {hasItems ? (
        <div className="grid gap-4">
          <div className="grid gap-2.5">
            {cartItems.map((item) => {
              const image = resolveMediaUrl(item.produto.url_imagem_principal);
              const remainingQuantity = Math.max(0, item.availableQuantity - item.quantidade);
              const canAdd = remainingQuantity > 0;

              return (
                <div key={item.produto.id} className="flex items-center gap-3 rounded-bakeryLg bg-bakery-cream p-2.5">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-bakeryMd bg-white ring-1 ring-bakery-border">
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <Wheat className="h-6 w-6 text-bakery-brand" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-bakery-ink">{item.produto.nome}</p>
                    <p className="text-sm font-bold text-bakery-brand">{formatCurrency(item.subtotal)}</p>
                    <p className="text-xs font-bold text-bakery-muted">
                      {canAdd ? `Restam ${remainingQuantity}` : "Limite da producao"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-white p-1 ring-1 ring-bakery-border">
                    <button
                      type="button"
                      onClick={() => onRemove(item.produto.id)}
                      aria-label={`Remover uma unidade de ${item.produto.nome}`}
                      className="grid h-11 w-11 place-items-center rounded-full bg-bakery-soft text-bakery-brand transition active:scale-95"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="w-7 text-center text-lg font-black text-bakery-ink">{item.quantidade}</span>
                    <button
                      type="button"
                      onClick={() => onAdd(item.produto)}
                      disabled={!canAdd}
                      aria-label={`Adicionar mais uma unidade de ${item.produto.nome}`}
                      className="grid h-11 w-11 place-items-center rounded-full bg-bakery-brand text-white shadow-button transition active:scale-95 disabled:cursor-not-allowed disabled:bg-bakery-creamStrong disabled:text-bakery-muted disabled:shadow-none"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {error ? <ErrorState message={error} /> : null}

          <div className="grid gap-3 border-t border-bakery-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-bold text-bakery-muted">Total</span>
              <span className="text-3xl font-black text-bakery-ink">{formatCurrency(total)}</span>
            </div>
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled || submitting}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-bakeryLg bg-bakery-brand text-lg font-black text-white shadow-button transition hover:bg-bakery-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-bakery-creamStrong disabled:text-bakery-muted disabled:shadow-none"
            >
              <ShoppingBag className="h-5 w-5" />
              {submitting ? "Registrando..." : "Registrar venda"}
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={submitting}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-bakeryLg text-base font-bold text-bakery-muted transition hover:bg-bakery-cream hover:text-bakery-danger active:scale-[0.99] disabled:opacity-60"
            >
              <Trash2 className="h-5 w-5" />
              Limpar sacola
            </button>
          </div>
        </div>
      ) : (
        <div className="grid justify-items-center gap-3 py-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-bakery-soft text-bakery-brand">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <p className="text-lg font-black text-bakery-ink">Sua sacola está vazia</p>
          <p className="text-sm font-semibold text-bakery-muted">Toque em “Adicionar” nos produtos para começar.</p>
        </div>
      )}
    </Modal>
  );
}
