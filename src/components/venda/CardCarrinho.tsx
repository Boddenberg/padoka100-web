import { Minus, Plus, RotateCcw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/StateBlocks";
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
  const hasItems = cartItems.length > 0;

  return (
    <Card className="overflow-hidden border-none bg-white xl:sticky xl:top-6 xl:self-start">
      <CardContent className="grid gap-3 p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-black text-bakery-ink">{hasItems ? "Carrinho" : "Carrinho vazio"}</p>
            <p className="mt-0.5 text-xs font-medium text-bakery-muted">{itemCount ? `${itemCount} item(ns)` : "Toque em um produto para comecar."}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-bakery-muted">Total</p>
            <p className={hasItems ? "text-3xl font-black text-bakery-ink" : "text-2xl font-black text-bakery-muted"}>
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        {hasItems ? (
          <div className="grid gap-2">
            {cartItems.map((item) => (
              <div key={item.produto.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-bakeryLg bg-bakery-cream p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-bakery-ink">{item.produto.nome}</p>
                  <p className="text-xs font-medium text-bakery-muted">{formatCurrency(item.subtotal)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="secondary" size="icon" className="h-10 w-10" onClick={() => onRemove(item.produto.id)} aria-label="Remover item">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-7 text-center text-lg font-black text-bakery-ink">{item.quantidade}</span>
                  <Button type="button" variant="secondary" size="icon" className="h-10 w-10" onClick={() => onAdd(item.produto)} aria-label="Adicionar item">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <ErrorState message={error} /> : null}

        <div className="grid gap-2">
          <Button
            type="button"
            size={hasItems ? "lg" : "md"}
            disabled={disabled || submitting}
            onClick={onSubmit}
            icon={<ShoppingBag className="h-5 w-5" />}
            className="w-full"
          >
            {submitting ? "Registrando" : "Registrar venda"}
          </Button>
          {hasItems ? (
            <Button type="button" variant="ghost" disabled={submitting} onClick={onClear} icon={<RotateCcw className="h-4 w-4" />}>
              Limpar carrinho
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
