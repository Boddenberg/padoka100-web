import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { Page } from "@/components/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/utils/format";

export function HistoryPage() {
  const [filters, setFilters] = useState({ dia_de_venda_id: "", tipo_entidade: "", entidade_id: "", limite: 100 });
  const [applied, setApplied] = useState(filters);

  const daysQuery = useQuery({
    queryKey: ["dias", "lista-historico"],
    queryFn: () => api.dias.list()
  });
  const timelineQuery = useQuery({
    queryKey: ["historico", applied],
    queryFn: () =>
      api.historico.timeline({
        dia_de_venda_id: applied.dia_de_venda_id || undefined,
        tipo_entidade: applied.tipo_entidade || undefined,
        entidade_id: applied.entidade_id || undefined,
        limite: applied.limite
      })
  });

  return (
    <Page title="Historico" eyebrow="Linha do tempo">
      <Card>
        <CardContent>
          <form
            className="grid gap-3 lg:grid-cols-[1fr_12rem_1fr_8rem_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(filters);
            }}
          >
            <Field label="Dia">
              <Select
                value={filters.dia_de_venda_id}
                onChange={(event) => setFilters({ ...filters, dia_de_venda_id: event.target.value })}
              >
                <option value="">Todos</option>
                {(daysQuery.data || []).map((day) => (
                  <option key={day.id} value={day.id}>
                    {formatDate(day.data_venda)} - {day.nome_local_no_momento || "Sem local"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={filters.tipo_entidade} onChange={(event) => setFilters({ ...filters, tipo_entidade: event.target.value })}>
                <option value="">Todos</option>
                <option value="produto">Produto</option>
                <option value="local">Local</option>
                <option value="dia_de_venda">Dia</option>
                <option value="venda">Venda</option>
                <option value="interacao_ia">IA</option>
              </Select>
            </Field>
            <Field label="Entidade ID">
              <Input value={filters.entidade_id} onChange={(event) => setFilters({ ...filters, entidade_id: event.target.value })} />
            </Field>
            <Field label="Limite">
              <Input
                type="number"
                min={1}
                max={500}
                value={filters.limite}
                onChange={(event) => setFilters({ ...filters, limite: Number(event.target.value || 100) })}
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" icon={<Search className="h-4 w-4" />}>
                Filtrar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {timelineQuery.isLoading ? <LoadingState label="Carregando historico" /> : null}
      {timelineQuery.error instanceof Error ? <ErrorState message={timelineQuery.error.message} /> : null}
      {timelineQuery.data?.length ? (
        <div className="grid gap-3">
          {timelineQuery.data.map((event) => (
            <Card key={event.id}>
              <CardContent className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-black text-bakery-ink">{event.titulo}</h2>
                  <StatusBadge tone="neutral">{event.tipo_evento}</StatusBadge>
                </div>
                <p className="text-sm font-semibold text-bakery-muted">
                  {event.tipo_entidade} - {formatDateTime(event.criado_em)}
                </p>
                {Object.keys(event.detalhes || {}).length ? (
                  <pre className="max-h-40 overflow-auto rounded-bakeryLg bg-bakery-ink p-3 text-xs text-white">
                    {JSON.stringify(event.detalhes, null, 2)}
                  </pre>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !timelineQuery.isLoading ? (
        <EmptyState title="Nenhum evento encontrado" />
      ) : null}
    </Page>
  );
}
