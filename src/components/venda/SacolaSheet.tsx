import { ShoppingBag, Trash2, Wheat } from "lucide-react";
import { ProductImage } from "@/components/ui/ProductImage";
import { Modal } from "@/components/ui/Modal";
import { Stepper } from "@/components/ui/Stepper";
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
    <Modal
      title="Sua sacola"
      open={open}
      onClose={onClose}
      footer={
        hasItems ? (
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-semibold text-bakery-muted">Total</span>
              <span className="text-3xl font-extrabold tracking-tight tabular-nums text-bakery-ink">{formatCurrency(total)}</span>
            </div>
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled || submitting}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-bakery-brand text-lg font-bold text-white shadow-button transition hover:bg-bakery-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-bakery-creamStrong disabled:text-bakery-muted disabled:shadow-none"
            >
              <ShoppingBag className="h-5 w-5" />
              {submitting ? "Registrando..." : "Registrar venda"}
            </button>
          </div>
        ) : undefined
      }
    >
      {hasItems ? (
        <div className="grid grid-cols-1 gap-4">
          <div className="divide-y divide-bakery-border/70">
            {cartItems.map((item) => {
              const image = resolveMediaUrl(item.produto.url_imagem_principal);
              const remainingQuantity = Math.max(0, item.availableQuantity - item.quantidade);
              const canAdd = remainingQuantity > 0;

              return (
                <div key={item.produto.id} className="flex items-center gap-3 py-3">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-bakery-creamStrong">
                    <ProductImage
                      src={image}
                      className="h-full w-full object-cover"
                      fallback={<Wheat className="h-6 w-6 text-bakery-muted" />}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-bakery-ink">{item.produto.nome}</p>
                    <p className="text-sm font-extrabold tabular-nums text-bakery-ink">{formatCurrency(item.subtotal)}</p>
                    <p className="text-xs font-semibold text-bakery-muted">
                      {canAdd ? `Restam ${remainingQuantity}` : "Limite da produção"}
                    </p>
                  </div>
                  <Stepper
                    value={item.quantidade}
                    onIncrement={() => onAdd(item.produto)}
                    onDecrement={() => onRemove(item.produto.id)}
                    canAdd={canAdd}
                    removeAsTrash
                    size="sm"
                    label={item.produto.nome}
                    className="shrink-0"
                  />
                </div>
              );
            })}
          </div>

          {error ? <ErrorState message={error} /> : null}

          <button
            type="button"
            onClick={onClear}
            disabled={submitting}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-base font-bold text-bakery-muted transition hover:bg-bakery-creamStrong hover:text-bakery-danger active:scale-[0.99] disabled:opacity-60"
          >
            <Trash2 className="h-5 w-5" />
            Limpar sacola
          </button>
        </div>
      ) : (
        <div className="grid justify-items-center gap-3 py-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-bakery-creamStrong text-bakery-muted">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <p className="text-lg font-extrabold text-bakery-ink">Sua sacola está vazia</p>
          <p className="text-sm font-semibold text-bakery-muted">Toque em “Adicionar” nos produtos para começar.</p>
        </div>
      )}
    </Modal>
  );
}
