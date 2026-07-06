import type { Produto } from "@/types/api";

export type QuantityMap = Record<string, number>;

export function buildProductionItems(products: Produto[], quantities: QuantityMap, onlyPositive: boolean) {
  return products
    .map((produto) => ({
      produto_id: produto.id,
      quantidade_produzida: Math.max(0, Math.trunc(quantities[produto.id] || 0))
    }))
    .filter((item) => (onlyPositive ? item.quantidade_produzida > 0 : true));
}
