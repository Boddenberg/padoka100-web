import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarPlus, CheckCircle2, Search, X } from "lucide-react";
import { BarraCarrinho } from "@/components/venda/BarraCarrinho";
import { CardDiaAtual } from "@/components/venda/CardDiaAtual";
import { CardProduto } from "@/components/venda/CardProduto";
import { SacolaSheet } from "@/components/venda/SacolaSheet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { api } from "@/lib/api/client";
import { toNumber } from "@/lib/utils/format";
import type { Produto } from "@/types/api";

type Cart = Record<string, number>;
const EMPTY_PRODUCTS: Produto[] = [];
const DIACRITICS = /\p{M}/gu;

export function SalesModePage() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<Cart>({});
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [sacolaOpen, setSacolaOpen] = useState(false);
  const [search, setSearch] = useState("");

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
  const stockReady = !currentDay || resumoQuery.isSuccess;

  const producedByProduct = useMemo(() => {
    const map: Cart = {};
    currentDay?.itens_producao?.forEach((item) => {
      map[item.produto_id] = item.quantidade_produzida;
    });
    return map;
  }, [currentDay]);

  const availableByProduct = useMemo(() => {
    const map: Cart = { ...producedByProduct };
    resumoQuery.data?.produtos?.forEach((produto) => {
      const produced = produto.quantidade_produzida ?? producedByProduct[produto.produto_id] ?? 0;
      const remaining = produto.quantidade_sobra ?? produced - (produto.quantidade_vendida ?? 0);
      map[produto.produto_id] = Math.max(0, Math.trunc(remaining || 0));
    });
    return map;
  }, [producedByProduct, resumoQuery.data]);

  const cartItems = useMemo(
    () =>
      products
        .map((produto) => {
          const quantidade = cart[produto.id] || 0;
          return {
            produto,
            quantidade,
            availableQuantity: availableByProduct[produto.id] || 0,
            subtotal: quantidade * toNumber(produto.preco_atual?.preco_venda)
          };
        })
        .filter((item) => item.quantidade > 0),
    [availableByProduct, cart, products]
  );
  const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantidade, 0);
  const hasStockIssue = cartItems.some((item) => item.quantidade > item.availableQuantity);

  const filteredProducts = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return products;
    return products.filter((produto) => normalize(produto.nome).includes(term));
  }, [products, search]);

  const registerSale = useMutation({
    mutationFn: () => {
      if (!currentDay || !stockReady || hasStockIssue || !cartItems.length) {
        throw new Error("Revise a sacola: a quantidade nao pode passar da producao disponivel.");
      }

      return api.vendas.create({
        dia_de_venda_id: currentDay!.id,
        tipo_entrada: "manual",
        itens: cartItems.map((item) => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade
        }))
      });
    },
    onSuccess: (sale) => {
      setCart({});
      setSacolaOpen(false);
      setConfirmation(`Venda registrada: ${sale.itens?.length || itemCount} item(ns).`);
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      window.setTimeout(() => setConfirmation(null), 2600);
    }
  });

  function addProduct(produto: Produto) {
    if (!produto.preco_atual || !stockReady) return;

    setCart((current) => {
      const currentQuantity = current[produto.id] || 0;
      const availableQuantity = availableByProduct[produto.id] || 0;
      if (currentQuantity >= availableQuantity) return current;

      return { ...current, [produto.id]: currentQuantity + 1 };
    });
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
  const showSearch = products.length >= 6;
  const registerDisabled = !currentDay || !cartItems.length || currentDay.situacao !== "aberto" || !stockReady || hasStockIssue;

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[var(--sales-max-width)] gap-4 px-3.5 py-3 sm:px-6 lg:py-7">
      {loading ? <LoadingState label="Preparando a venda" /> : null}
      {error ? <ErrorState message={error instanceof Error ? error.message : "Erro ao carregar a venda."} /> : null}
      {currentDay && resumoQuery.isLoading ? <LoadingState label="Conferindo producao disponivel" /> : null}
      {currentDay && resumoQuery.error instanceof Error ? (
        <ErrorState message={`Nao foi possivel conferir a producao disponivel: ${resumoQuery.error.message}`} />
      ) : null}

      {!loading && !error && !currentDay ? (
        <EmptyState
          title="Nenhum dia de venda aberto"
          description="Abra um dia para começar a registrar as vendas de hoje."
          action={
            <Link
              to="/abrir-dia"
              className="mt-1 inline-flex min-h-14 items-center justify-center gap-2 rounded-bakeryLg bg-bakery-brand px-7 text-lg font-black text-white shadow-button transition hover:bg-bakery-dark active:scale-[0.98]"
            >
              <CalendarPlus className="h-6 w-6" />
              Abrir dia
            </Link>
          }
        />
      ) : null}

      {currentDay ? (
        <>
          <CardDiaAtual dia={currentDay} resumo={resumoQuery.data} />

          {confirmation ? (
            <div className="flex items-center gap-3 rounded-bakeryLg bg-bakery-successSoft p-4 text-bakery-success ring-1 ring-bakery-success/20">
              <CheckCircle2 className="h-7 w-7 shrink-0" />
              <p className="text-lg font-black">{confirmation}</p>
            </div>
          ) : null}

          {products.length ? (
            <section className="grid gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-2xl font-black text-bakery-ink">O que você vai vender?</h2>
                {itemCount ? <span className="text-sm font-bold text-bakery-muted">{itemCount} na sacola</span> : null}
              </div>

              {showSearch ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-bakery-muted" />
                  <input
                    type="text"
                    inputMode="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar pão, bolo, salgado..."
                    aria-label="Buscar produto"
                    className="min-h-14 w-full rounded-bakeryLg border-none bg-white pl-12 pr-12 text-base font-semibold text-bakery-ink shadow-soft ring-1 ring-bakery-border placeholder:font-medium placeholder:text-bakery-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-bakery-brand/40"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Limpar busca"
                      className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-bakery-cream text-bakery-muted transition active:scale-95"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              {filteredProducts.length ? (
                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((produto) => (
                    <CardProduto
                      key={produto.id}
                      produto={produto}
                      quantidade={cart[produto.id] || 0}
                      availableQuantity={availableByProduct[produto.id] || 0}
                      stockReady={stockReady}
                      onAdd={addProduct}
                      onRemove={removeProduct}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title="Nenhum produto encontrado" description="Não achamos nada com esse nome. Tente escrever de outro jeito." />
              )}
            </section>
          ) : (
            <EmptyState title="Nenhum produto cadastrado ainda" description="Cadastre os produtos para começar a vender." />
          )}

          {itemCount ? <div className="h-24" aria-hidden /> : null}

          <BarraCarrinho
            itemCount={itemCount}
            total={total}
            submitting={registerSale.isPending}
            disabled={registerDisabled}
            onOpen={() => setSacolaOpen(true)}
            onSubmit={() => registerSale.mutate()}
          />

          <SacolaSheet
            open={sacolaOpen}
            onClose={() => setSacolaOpen(false)}
            cartItems={cartItems}
            total={total}
            submitting={registerSale.isPending}
            error={registerSale.error instanceof Error ? registerSale.error.message : null}
            disabled={registerDisabled}
            onAdd={addProduct}
            onRemove={removeProduct}
            onClear={() => setCart({})}
            onSubmit={() => registerSale.mutate()}
          />
        </>
      ) : null}
    </div>
  );
}

function normalize(value: string) {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}
