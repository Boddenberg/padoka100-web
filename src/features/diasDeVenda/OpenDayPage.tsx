import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, DoorClosed, Minus, Plus, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Page } from "@/components/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { formatDate, todayInputValue } from "@/lib/utils/format";
import type { Produto } from "@/types/api";

const openDaySchema = z.object({
  data_venda: z.string().min(1, "Informe a data."),
  local_id: z.string().optional(),
  nome_local: z.string().optional(),
  observacoes: z.string().optional()
});

type OpenDayForm = z.infer<typeof openDaySchema>;
type QuantityMap = Record<string, number>;

export function OpenDayPage() {
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<QuantityMap>({});
  const [closeNotes, setCloseNotes] = useState("");
  const form = useForm<OpenDayForm>({
    resolver: zodResolver(openDaySchema),
    defaultValues: {
      data_venda: todayInputValue(),
      local_id: "",
      nome_local: "",
      observacoes: ""
    }
  });

  const currentDayQuery = useQuery({
    queryKey: ["dias", "atual"],
    queryFn: api.dias.current
  });
  const productsQuery = useQuery({
    queryKey: ["produtos", "ativos"],
    queryFn: () => api.produtos.list(true)
  });
  const locationsQuery = useQuery({
    queryKey: ["locais", "ativos"],
    queryFn: () => api.locais.list(true)
  });

  const products = productsQuery.data || [];
  const currentDay = currentDayQuery.data;
  const productionByProduct = useMemo(() => {
    const map: QuantityMap = {};
    currentDay?.itens_producao?.forEach((item) => {
      map[item.produto_id] = item.quantidade_produzida;
    });
    return map;
  }, [currentDay]);

  const visibleQuantities = currentDay ? { ...productionByProduct, ...quantities } : quantities;

  const createDay = useMutation({
    mutationFn: (values: OpenDayForm) =>
      api.dias.create({
        data_venda: values.data_venda,
        local_id: values.local_id || null,
        nome_local: values.local_id ? null : values.nome_local || null,
        observacoes: values.observacoes || null,
        itens_producao: buildProductionItems(products, visibleQuantities, true)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    }
  });

  const saveProduction = useMutation({
    mutationFn: async () => {
      if (!currentDay) return;
      const items = buildProductionItems(products, visibleQuantities, false);
      await Promise.all(items.map((item) => api.dias.saveProductionItem(currentDay.id, item)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    }
  });

  const closeDay = useMutation({
    mutationFn: () => api.dias.close(currentDay!.id, closeNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    }
  });

  const loading = currentDayQuery.isLoading || productsQuery.isLoading || locationsQuery.isLoading;

  return (
    <Page title="Abrir Dia" eyebrow="Producao">
      {loading ? <LoadingState label="Carregando dia" /> : null}
      {currentDayQuery.error || productsQuery.error || locationsQuery.error ? (
        <ErrorState
          message={
            (currentDayQuery.error || productsQuery.error || locationsQuery.error) instanceof Error
              ? ((currentDayQuery.error || productsQuery.error || locationsQuery.error) as Error).message
              : "Erro ao carregar dados."
          }
        />
      ) : null}

      {!loading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-bakery-ink">
                  {currentDay ? `Dia ${formatDate(currentDay.data_venda)}` : "Novo dia de venda"}
                </h2>
                <p className="text-sm font-semibold text-bakery-muted">
                  {currentDay?.nome_local_no_momento || "Selecione o local e a producao inicial."}
                </p>
              </div>
              {currentDay ? (
                <StatusBadge tone={currentDay.situacao === "aberto" ? "good" : "warn"}>{currentDay.situacao}</StatusBadge>
              ) : null}
            </CardHeader>
            <CardContent>
              {!currentDay ? (
                <form className="grid gap-4" onSubmit={form.handleSubmit((values) => createDay.mutate(values))}>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Data" error={form.formState.errors.data_venda?.message}>
                      <Input type="date" {...form.register("data_venda")} />
                    </Field>
                    <Field label="Local salvo">
                      <Select {...form.register("local_id")}>
                        <option value="">Digitar local</option>
                        {(locationsQuery.data || []).map((local) => (
                          <option key={local.id} value={local.id}>
                            {local.nome}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Nome local">
                      <Input placeholder="Feira, evento, rua..." {...form.register("nome_local")} />
                    </Field>
                  </div>
                  <Field label="Observacoes">
                    <Textarea {...form.register("observacoes")} />
                  </Field>
                  <ProductionEditor products={products} quantities={visibleQuantities} onChange={setQuantities} />
                  <Button type="submit" disabled={createDay.isPending} icon={<CalendarCheck className="h-4 w-4" />}>
                    {createDay.isPending ? "Abrindo" : "Abrir dia"}
                  </Button>
                  {createDay.error instanceof Error ? <ErrorState message={createDay.error.message} /> : null}
                </form>
              ) : (
                <div className="grid gap-4">
                  <ProductionEditor products={products} quantities={visibleQuantities} onChange={setQuantities} />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      disabled={saveProduction.isPending || currentDay.situacao !== "aberto"}
                      onClick={() => saveProduction.mutate()}
                      icon={<Save className="h-4 w-4" />}
                    >
                      {saveProduction.isPending ? "Salvando" : "Salvar producao"}
                    </Button>
                  </div>
                  {saveProduction.error instanceof Error ? <ErrorState message={saveProduction.error.message} /> : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-black text-bakery-ink">Fechamento</h2>
            </CardHeader>
            <CardContent className="grid gap-4">
              {currentDay ? (
                <>
                  <div className="rounded-bakeryLg bg-bakery-cream p-4">
                    <p className="text-sm font-bold text-bakery-muted">Aberto em</p>
                    <p className="text-xl font-black text-bakery-ink">{formatDate(currentDay.data_venda)}</p>
                  </div>
                  <Field label="Observacoes finais">
                    <Textarea value={closeNotes} onChange={(event) => setCloseNotes(event.target.value)} />
                  </Field>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={closeDay.isPending || currentDay.situacao !== "aberto"}
                    onClick={() => closeDay.mutate()}
                    icon={<DoorClosed className="h-4 w-4" />}
                  >
                    {closeDay.isPending ? "Fechando" : "Fechar dia"}
                  </Button>
                  {closeDay.error instanceof Error ? <ErrorState message={closeDay.error.message} /> : null}
                </>
              ) : (
                <EmptyState title="Nenhum dia aberto" description="O fechamento aparece depois de abrir o dia." />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </Page>
  );
}

function ProductionEditor({
  products,
  quantities,
  onChange
}: {
  products: Produto[];
  quantities: QuantityMap;
  onChange: (next: QuantityMap) => void;
}) {
  if (!products.length) {
    return <EmptyState title="Sem produtos ativos" description="Cadastre produtos antes de definir producao." />;
  }

  function setProductQuantity(produtoId: string, value: number) {
    onChange({
      ...quantities,
      [produtoId]: Math.max(0, Math.trunc(value || 0))
    });
  }

  return (
    <div className="grid gap-3">
      {products.map((produto) => {
        const quantity = quantities[produto.id] ?? 0;

        return (
          <div
            key={produto.id}
            className="grid gap-3 rounded-bakeryLg border border-bakery-border bg-white p-3 shadow-soft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="truncate font-black text-bakery-ink">{produto.nome}</p>
              <p className="text-sm font-semibold text-bakery-muted">{produto.preco_atual ? "Produto ativo" : "Sem preco atual"}</p>
            </div>
            <div className="grid grid-cols-[3rem_minmax(4rem,5rem)_3rem] items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={quantity <= 0}
                onClick={() => setProductQuantity(produto.id, quantity - 1)}
                aria-label={`Diminuir quantidade produzida de ${produto.nome}`}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(event) => setProductQuantity(produto.id, Number(event.target.value || 0))}
                aria-label={`Quantidade produzida de ${produto.nome}`}
                className="text-center"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => setProductQuantity(produto.id, quantity + 1)}
                aria-label={`Aumentar quantidade produzida de ${produto.nome}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildProductionItems(products: Produto[], quantities: QuantityMap, onlyPositive: boolean) {
  return products
    .map((produto) => ({
      produto_id: produto.id,
      quantidade_produzida: Math.max(0, Math.trunc(quantities[produto.id] || 0))
    }))
    .filter((item) => (onlyPositive ? item.quantidade_produzida > 0 : true));
}
