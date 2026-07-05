import { Minus, Plus, RotateCcw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ErrorState, FriendlyHint } from "@/components/ui/StateBlocks";
import { formatCurrency } from "@/lib/utils/format";
import type { Produto } from "@/types/api";

interface CartItem {
  produto: Produto;
  quantidade: number;
  subtotal: number;
}

interface CardCarrinhoProps {
  cartItems: CartItem[];
  itemCount: number;
  total: number;
  submitting: boolean;
  error: string | null;
  disabled: boolean;
  onAdd: (produto: Produto) => void;
  onRemove: (produtoId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}

export function CardCarrinho({
  cartItems,
  itemCount,
  total,
  submitting,
  error,
  disabled,
  onAdd,
  onRemove,
  onClear,
  onSubmit
}: CardCarrinhoProps) {
  return (
    <Card className="overflow-hidden border-none bg-white xl:sticky xl:top-6 xl:self-start">
      <CardContent className="grid gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-black text-bakery-ink">Carrinho</p>
            <p className="mt-1 text-sm font-semibold text-bakery-muted">{itemCount ? `${itemCount} item(ns)` : "Nada adicionado ainda"}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-bakery-muted">Total</p>
            <p className="text-3xl font-black text-bakery-ink">{formatCurrency(total)}</p>
          </div>
        </div>

        {cartItems.length ? (
          <div className="grid gap-3">
            {cartItems.map((item) => (
              <div key={item.produto.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-bakeryLg bg-bakery-cream p-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-bakery-ink">{item.produto.nome}</p>
                  <p className="text-sm font-semibold text-bakery-muted">{formatCurrency(item.subtotal)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="icon" onClick={() => onRemove(item.produto.id)} aria-label="Remover item">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-xl font-black text-bakery-ink">{item.quantidade}</span>
                  <Button type="button" variant="secondary" size="icon" onClick={() => onAdd(item.produto)} aria-label="Adicionar item">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <FriendlyHint>Toque em um produto para comecar uma venda.</FriendlyHint>
        )}

        {error ? <ErrorState message={error} /> : null}

        <div className="grid gap-3">
          <Button
            type="button"
            size="lg"
            disabled={disabled || submitting}
            onClick={onSubmit}
            icon={<ShoppingBag className="h-5 w-5" />}
            className="w-full"
          >
            {submitting ? "Registrando" : "Registrar venda"}
          </Button>
          <Button type="button" variant="ghost" disabled={!cartItems.length || submitting} onClick={onClear} icon={<RotateCcw className="h-4 w-4" />}>
            Limpar carrinho
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
