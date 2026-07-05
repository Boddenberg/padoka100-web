import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, CalendarPlus } from "lucide-react";
import { CardCarrinho } from "@/components/venda/CardCarrinho";
import { CardDiaAtual } from "@/components/venda/CardDiaAtual";
import { CardProduto } from "@/components/venda/CardProduto";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { api } from "@/lib/api/client";
import { toNumber } from "@/lib/utils/format";
import type { Produto } from "@/types/api";

type Cart = Record<string, number>;
const EMPTY_PRODUCTS: Produto[] = [];

export function SalesModePage() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<Cart>({});
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const currentDayQuery = useQuery({
    queryKey: ["dias", "atual"],
    queryFn: api.dias.current
  });

  const productsQuery = useQuery({
    queryKey: ["produtos", "ativos"],
    queryFn: () => api.produtos.list(true)
  });

  const resumoQuery = useQuery({
    queryKey: ["relatorios", "dia", currentDayQuery.data?.id],
    queryFn: () => api.relatorios.day(currentDayQuery.data!.id),
    enabled: Boolean(currentDayQuery.data?.id)
  });

  const products = productsQuery.data || EMPTY_PRODUCTS;
  const currentDay = currentDayQuery.data;
  const cartItems = useMemo(
    () =>
      products
        .map((produto) => ({
          produto,
          quantidade: cart[produto.id] || 0,
          subtotal: (cart[produto.id] || 0) * toNumber(produto.preco_atual?.preco_venda)
        }))
        .filter((item) => item.quantidade > 0),
    [cart, products]
  );
  const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantidade, 0);

  const registerSale = useMutation({
    mutationFn: () =>
      api.vendas.create({
        dia_de_venda_id: currentDay!.id,
        tipo_entrada: "manual",
        itens: cartItems.map((item) => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade
        }))
      }),
    onSuccess: (sale) => {
      setCart({});
      setConfirmation(`Venda registrada: ${sale.itens?.length || itemCount} item(ns).`);
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      window.setTimeout(() => setConfirmation(null), 2600);
    }
  });

  function addProduct(produto: Produto) {
    if (!produto.preco_atual) return;
    setCart((current) => ({ ...current, [produto.id]: (current[produto.id] || 0) + 1 }));
  }

  function removeProduct(produtoId: string) {
    setCart((current) => {
      const next = { ...current };
      const value = (next[produtoId] || 0) - 1;
      if (value <= 0) delete next[produtoId];
      else next[produtoId] = value;
      return next;
    });
  }

  const loading = currentDayQuery.isLoading || productsQuery.isLoading;
  const error = currentDayQuery.error || productsQuery.error;

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[var(--sales-max-width)] gap-5 px-4 py-5 sm:px-6 lg:py-8">
      <header className="grid min-w-0 gap-2">
        <p className="text-base font-bold text-bakery-brand">{getGreeting()}</p>
        <h1 className="text-3xl font-black leading-tight text-bakery-ink sm:text-4xl">Venda de hoje</h1>
        <p className="text-base font-semibold leading-relaxed text-bakery-muted">
          Escolha os produtos, confira o carrinho e registre a venda em poucos toques.
        </p>
      </header>

      {loading ? <LoadingState label="Preparando venda" /> : null}
      {error ? <ErrorState message={error instanceof Error ? error.message : "Erro ao carregar venda."} /> : null}

      {!loading && !error && !currentDay ? (
        <EmptyState
          title="Nenhum dia de venda aberto"
          description="Abra um dia para comecar a registrar vendas."
          action={
            <Link
              to="/abrir-dia"
              className="mt-1 inline-flex min-h-14 items-center justify-center gap-2 rounded-bakeryLg bg-bakery-brand px-6 text-base font-bold text-white shadow-button transition active:scale-[0.98]"
            >
              <CalendarPlus className="h-5 w-5" />
              Abrir dia
            </Link>
          }
        />
      ) : null}

      {currentDay ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid min-w-0 gap-5">
            <CardDiaAtual dia={currentDay} resumo={resumoQuery.data} />

            {confirmation ? (
              <div className="flex items-center gap-3 rounded-bakeryLg bg-bakery-successSoft p-4 text-bakery-success ring-1 ring-bakery-success/15">
                <CheckCircle2 className="h-6 w-6" />
                <p className="text-lg font-black">{confirmation}</p>
              </div>
            ) : null}

            {products.length ? (
              <section className="grid gap-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-bakery-ink">Produtos</h2>
                    <p className="text-sm font-semibold text-bakery-muted">Toque em um card para adicionar.</p>
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
                  {products.map((produto) => (
                    <CardProduto key={produto.id} produto={produto} quantidade={cart[produto.id] || 0} onAdd={addProduct} />
                  ))}
                </div>
              </section>
            ) : (
              <EmptyState title="Nenhum produto cadastrado ainda" description="Cadastre os produtos para comecar a vender." />
            )}
          </div>

          <CardCarrinho
            cartItems={cartItems}
            itemCount={itemCount}
            total={total}
            submitting={registerSale.isPending}
            error={registerSale.error instanceof Error ? registerSale.error.message : null}
            onAdd={addProduct}
            onRemove={removeProduct}
            onClear={() => setCart({})}
            onSubmit={() => registerSale.mutate()}
            disabled={!currentDay || !cartItems.length || currentDay.situacao !== "aberto"}
          />
        </div>
      ) : null}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia!";
  if (hour < 18) return "Boa tarde!";
  return "Boa noite!";
}
