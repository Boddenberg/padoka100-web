import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CalendarPlus, CheckCircle2, Mic, Search, X } from "lucide-react";
import { BarraCarrinho } from "@/components/venda/BarraCarrinho";
import { CardDiaAtual } from "@/components/venda/CardDiaAtual";
import { CardProduto } from "@/components/venda/CardProduto";
import { SacolaSheet } from "@/components/venda/SacolaSheet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { CloseDaySheet } from "@/features/diasDeVenda/CloseDaySheet";
import { EditProductionSheet } from "@/features/diasDeVenda/EditProductionSheet";
import { OpenDaySheet } from "@/features/diasDeVenda/OpenDaySheet";
import { AiSaleSheet } from "@/features/ia/AiSaleSheet";
import { VendasDoDiaSheet } from "@/features/vendas/VendasDoDiaSheet";
import { api } from "@/lib/api/client";
import { toNumber } from "@/lib/utils/format";
import type { Produto } from "@/types/api";

type Cart = Record<string, number>;
type ActiveSheet = "sacola" | "abrir-dia" | "producao" | "fechar-dia" | "vendas" | "ia" | null;

const EMPTY_PRODUCTS: Produto[] = [];
const DIACRITICS = /\p{M}/gu;

export function SalesModePage() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<Cart>({});
  const [confirmation, setConfirmation] = useState<string | null>(null);
  // Rotas antigas (/abrir-dia, /vendas, /ia) redirecionam com ?sheet= para abrir o fluxo certo.
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(() => {
    const sheet = new URLSearchParams(window.location.search).get("sheet");
    return sheet === "abrir-dia" || sheet === "vendas" || sheet === "ia" ? sheet : null;
  });
  const [aiAutoRecord, setAiAutoRecord] = useState(false);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.has("sheet")) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

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
        throw new Error("Revise a sacola: a quantidade não pode passar da produção disponível.");
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
      setActiveSheet(null);
      showConfirmation(`Venda registrada: ${sale.itens?.length || itemCount} item(ns).`);
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    }
  });

  function showConfirmation(message: string) {
    setConfirmation(message);
    window.setTimeout(() => setConfirmation(null), 2600);
  }

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

  function openAiSheet(autoRecord: boolean) {
    setAiAutoRecord(autoRecord);
    setActiveSheet("ia");
  }

  function closeSheet() {
    setActiveSheet(null);
  }

  const loading = currentDayQuery.isLoading || productsQuery.isLoading;
  const error = currentDayQuery.error || productsQuery.error;
  const showSearch = products.length >= 6;
  const registerDisabled = !currentDay || !cartItems.length || currentDay.situacao !== "aberto" || !stockReady || hasStockIssue;

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[var(--sales-max-width)] gap-4 px-3.5 py-3 sm:px-6 lg:py-7">
      {loading ? <LoadingState label="Preparando a venda" /> : null}
      {error ? <ErrorState message={error instanceof Error ? error.message : "Erro ao carregar a venda."} /> : null}
      {currentDay && resumoQuery.isLoading ? <LoadingState label="Conferindo produção disponível" /> : null}
      {currentDay && resumoQuery.error instanceof Error ? (
        <ErrorState message={`Não foi possível conferir a produção disponível: ${resumoQuery.error.message}`} />
      ) : null}

      {!loading && !error && !currentDay ? (
        <section className="grid justify-items-start gap-5 overflow-hidden rounded-bakeryXl bg-gradient-to-br from-[#26262a] to-[#18181b] p-6 text-white shadow-floating sm:p-8">
          <div>
            <p className="text-sm font-semibold text-white/60">{getGreeting()}</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Bora começar o dia de venda?
            </h1>
            <p className="mt-2 max-w-md text-base font-semibold text-white/60">
              Registre a produção de hoje e comece a vender com um toque.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveSheet("abrir-dia")}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-bakery-brand px-7 text-lg font-bold text-white shadow-button transition hover:bg-bakery-dark active:scale-[0.98]"
          >
            <CalendarPlus className="h-6 w-6" />
            Abrir dia
          </button>
        </section>
      ) : null}

      {currentDay ? (
        <>
          <CardDiaAtual
            dia={currentDay}
            resumo={resumoQuery.data}
            onEditProduction={() => setActiveSheet("producao")}
            onOpenSales={() => setActiveSheet("vendas")}
            onCloseDay={currentDay.situacao === "aberto" ? () => setActiveSheet("fechar-dia") : undefined}
          />

          {confirmation ? (
            <div className="flex items-center gap-3 rounded-bakeryLg bg-bakery-successSoft p-4 text-bakery-success">
              <CheckCircle2 className="h-7 w-7 shrink-0" />
              <p className="text-lg font-extrabold">{confirmation}</p>
            </div>
          ) : null}

          {products.length ? (
            <section className="grid gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-2xl font-extrabold tracking-tight text-bakery-ink">O que você vai vender?</h2>
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
                    className="min-h-14 w-full rounded-full border border-bakery-border bg-white pl-12 pr-14 text-base font-semibold text-bakery-ink shadow-soft placeholder:font-medium placeholder:text-bakery-muted focus:outline-none focus-visible:border-bakery-ink focus-visible:ring-4 focus-visible:ring-bakery-ink/10"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Limpar busca"
                      className="absolute right-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-bakery-creamStrong text-bakery-muted transition active:scale-95"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openAiSheet(true)}
                      aria-label="Falar a venda com a IA"
                      className="absolute right-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-bakery-brand text-white shadow-button transition active:scale-95"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openAiSheet(true)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full bg-bakery-ink px-5 text-sm font-bold text-white transition hover:bg-black active:scale-[0.98]"
                >
                  <Mic className="h-4 w-4" />
                  Falar a venda
                </button>
              )}

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
            onOpen={() => setActiveSheet("sacola")}
            onSubmit={() => registerSale.mutate()}
          />

          <SacolaSheet
            open={activeSheet === "sacola"}
            onClose={closeSheet}
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

          <EditProductionSheet open={activeSheet === "producao"} onClose={closeSheet} dia={currentDay} />
          <CloseDaySheet open={activeSheet === "fechar-dia"} onClose={closeSheet} dia={currentDay} />
        </>
      ) : null}

      <OpenDaySheet open={activeSheet === "abrir-dia"} onClose={closeSheet} />
      <VendasDoDiaSheet open={activeSheet === "vendas"} onClose={closeSheet} />
      <AiSaleSheet
        open={activeSheet === "ia"}
        onClose={() => {
          setAiAutoRecord(false);
          closeSheet();
        }}
        currentDayId={currentDay?.id || null}
        autoStartRecording={aiAutoRecord}
        onSaleCreated={showConfirmation}
      />
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia!";
  if (hour < 18) return "Boa tarde!";
  return "Boa noite!";
}

function normalize(value: string) {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}
