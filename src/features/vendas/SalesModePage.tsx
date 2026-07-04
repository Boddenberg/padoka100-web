import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Minus, Plus, RotateCcw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Page } from "@/components/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, productInitials, toNumber } from "@/lib/utils/format";
import { resolveMediaUrl } from "@/lib/utils/media";
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
    <Page
      title="Modo Venda"
      eyebrow="Primeira tela"
      action={
        <Link to="/configuracao" className="text-sm font-bold text-red-700 hover:text-red-800">
          Configuracao
        </Link>
      }
    >
      {loading ? <LoadingState label="Preparando venda" /> : null}
      {error ? <ErrorState message={error instanceof Error ? error.message : "Erro ao carregar venda."} /> : null}

      {!loading && !error && !currentDay ? (
        <EmptyState
          title="Nenhum dia aberto"
          description="Abra um dia de venda para registrar pedidos."
          action={
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-500 px-4 text-sm font-bold text-white shadow-soft hover:bg-red-600"
              to="/abrir-dia"
            >
              Abrir dia
            </Link>
          }
        />
      ) : null}

      {currentDay ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid gap-4">
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">Dia atual</p>
                  <h2 className="text-xl font-black text-slate-950">
                    {currentDay.nome_local_no_momento || "Local nao informado"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={currentDay.situacao === "aberto" ? "good" : "warn"}>{currentDay.situacao}</StatusBadge>
                  {resumoQuery.data ? (
                    <StatusBadge tone="neutral">
                      {resumoQuery.data.total_vendido || 0}/{resumoQuery.data.total_produzido || 0}
                    </StatusBadge>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {confirmation ? (
              <div className="flex items-center gap-3 rounded-lg bg-teal-50 p-4 text-teal-800 ring-1 ring-teal-100">
                <CheckCircle2 className="h-6 w-6" />
                <p className="text-lg font-black">{confirmation}</p>
              </div>
            ) : null}

            {products.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
                {products.map((produto) => (
                  <ProductTile key={produto.id} produto={produto} quantidade={cart[produto.id] || 0} onAdd={addProduct} />
                ))}
              </div>
            ) : (
              <EmptyState title="Sem produtos ativos" description="Cadastre produtos antes de vender." />
            )}
          </div>

          <CartPanel
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
    </Page>
  );
}

function ProductTile({
  produto,
  quantidade,
  onAdd
}: {
  produto: Produto;
  quantidade: number;
  onAdd: (produto: Produto) => void;
}) {
  const image = resolveMediaUrl(produto.url_imagem_principal);
  const buttonColor = produto.cor_botao || "#ef4444";
  const disabled = !produto.preco_atual;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAdd(produto)}
      className={cn(
        "relative grid min-h-44 overflow-hidden rounded-lg border bg-white text-left shadow-soft transition active:scale-[.99] disabled:opacity-55",
        quantidade ? "border-red-400 ring-4 ring-red-100" : "border-slate-200 hover:border-red-200"
      )}
    >
      <div className="h-24 bg-slate-100">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-3xl font-black text-white" style={{ backgroundColor: buttonColor }}>
            {productInitials(produto.nome)}
          </div>
        )}
      </div>
      <div className="grid gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-base font-black leading-tight text-slate-950">{produto.nome}</h3>
          {quantidade ? (
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-red-500 px-2 text-sm font-black text-white">
              {quantidade}
            </span>
          ) : null}
        </div>
        <p className="text-lg font-black text-teal-700">{formatCurrency(produto.preco_atual?.preco_venda)}</p>
        {!produto.preco_atual ? <span className="text-xs font-bold text-rose-700">Sem preco</span> : null}
      </div>
    </button>
  );
}

function CartPanel({
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
}: {
  cartItems: Array<{ produto: Produto; quantidade: number; subtotal: number }>;
  itemCount: number;
  total: number;
  submitting: boolean;
  error: string | null;
  disabled: boolean;
  onAdd: (produto: Produto) => void;
  onRemove: (produtoId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="xl:sticky xl:top-6 xl:self-start">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">Carrinho</p>
          <h2 className="text-2xl font-black text-slate-950">{formatCurrency(total)}</h2>
        </div>
        <StatusBadge tone={itemCount ? "good" : "neutral"}>{itemCount} itens</StatusBadge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {cartItems.length ? (
          <div className="grid gap-3">
            {cartItems.map((item) => (
              <div key={item.produto.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="font-black text-slate-950">{item.produto.nome}</p>
                  <p className="text-sm font-semibold text-slate-500">{formatCurrency(item.subtotal)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="icon" onClick={() => onRemove(item.produto.id)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-lg font-black">{item.quantidade}</span>
                  <Button type="button" variant="secondary" size="icon" onClick={() => onAdd(item.produto)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">Toque nos produtos para vender.</div>
        )}

        {error ? <ErrorState message={error} /> : null}

        <div className="grid gap-2">
          <Button
            type="button"
            size="lg"
            disabled={disabled || submitting}
            onClick={onSubmit}
            icon={<ShoppingBag className="h-5 w-5" />}
          >
            {submitting ? "Registrando" : "Registrar venda"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!cartItems.length || submitting}
            onClick={onClear}
            icon={<RotateCcw className="h-4 w-4" />}
          >
            Limpar carrinho
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
