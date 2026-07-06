import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Form";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, todayInputValue } from "@/lib/utils/format";
import type { ResumoDoDia, ResumoDoPeriodo } from "@/types/api";

export function ReportsPanel() {
  const today = todayInputValue();
  const [dataInicio, setDataInicio] = useState(today);
  const [dataFim, setDataFim] = useState(today);

  const currentDayQuery = useQuery({
    queryKey: ["dias", "atual"],
    queryFn: api.dias.current
  });
  const daySummaryQuery = useQuery({
    queryKey: ["relatorios", "dia", currentDayQuery.data?.id],
    queryFn: () => api.relatorios.day(currentDayQuery.data!.id),
    enabled: Boolean(currentDayQuery.data?.id)
  });
  const periodQuery = useQuery({
    queryKey: ["relatorios", "periodo", dataInicio, dataFim],
    queryFn: () => api.relatorios.period(dataInicio, dataFim),
    enabled: Boolean(dataInicio && dataFim)
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
        <SummaryCard
          title="Dia atual"
          icon={<BarChart3 className="h-5 w-5 text-bakery-brand" />}
          loading={currentDayQuery.isLoading || daySummaryQuery.isLoading}
          error={currentDayQuery.error || daySummaryQuery.error}
          summary={daySummaryQuery.data}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-bakery-brand" />
              <h2 className="text-xl font-black text-bakery-ink">Periodo</h2>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Inicio">
                <Input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} />
              </Field>
              <Field label="Fim">
                <Input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} />
              </Field>
            </div>
            {periodQuery.isLoading ? <LoadingState label="Carregando periodo" /> : null}
            {periodQuery.error instanceof Error ? <ErrorState message={periodQuery.error.message} /> : null}
            {periodQuery.data ? <PeriodSummary summary={periodQuery.data} /> : null}
          </CardContent>
        </Card>
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  loading,
  error,
  summary
}: {
  title: string;
  icon: ReactNode;
  loading: boolean;
  error: unknown;
  summary?: ResumoDoDia;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-xl font-black text-bakery-ink">{title}</h2>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingState label="Carregando resumo" /> : null}
        {error instanceof Error ? <ErrorState message={error.message} /> : null}
        {summary ? <DaySummary summary={summary} /> : !loading ? <EmptyState title="Sem dia atual" /> : null}
      </CardContent>
    </Card>
  );
}

function DaySummary({ summary }: { summary: ResumoDoDia }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-bakery-muted">{formatDate(summary.data_venda)}</p>
          <h3 className="text-xl font-black text-bakery-ink">{summary.nome_local || "Sem local"}</h3>
        </div>
        <StatusBadge tone={summary.situacao === "aberto" ? "good" : "warn"}>{summary.situacao}</StatusBadge>
      </div>
      <Metrics summary={summary} />
      <div className="grid gap-2">
        {(summary.produtos || []).map((produto) => (
          <div key={produto.produto_id} className="grid grid-cols-[1fr_auto] gap-3 rounded-bakeryLg bg-bakery-creamStrong/60 p-3">
            <div>
              <p className="font-black text-bakery-ink">{produto.nome_produto}</p>
              <p className="text-sm font-semibold text-bakery-muted">
                {produto.quantidade_vendida || 0}/{produto.quantidade_produzida || 0} vendidos
              </p>
            </div>
            <strong className="text-bakery-success">{formatCurrency(produto.faturamento_bruto)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeriodSummary({ summary }: { summary: ResumoDoPeriodo }) {
  return (
    <div className="grid gap-4">
      <Metrics summary={summary} />
      <div className="grid gap-2">
        {(summary.dias || []).map((day) => (
          <div key={day.dia_de_venda_id} className="grid grid-cols-[1fr_auto] gap-3 rounded-bakeryLg bg-bakery-creamStrong/60 p-3">
            <div>
              <p className="font-black text-bakery-ink">{formatDate(day.data_venda)}</p>
              <p className="text-sm font-semibold text-bakery-muted">{day.nome_local || "Sem local"}</p>
            </div>
            <strong>{formatCurrency(day.faturamento_bruto)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metrics({ summary }: { summary: ResumoDoDia | ResumoDoPeriodo }) {
  const metrics = [
    ["Produzido", summary.total_produzido || 0],
    ["Vendido", summary.total_vendido || 0],
    ["Sobra", summary.total_sobra || 0],
    ["Faturamento", formatCurrency(summary.faturamento_bruto)],
    ["Custo", formatCurrency(summary.custo_estimado)],
    ["Lucro", formatCurrency(summary.lucro_estimado)]
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-bakeryLg bg-bakery-creamStrong/60 p-3">
          <p className="text-sm font-bold text-bakery-muted">{label}</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight tabular-nums text-bakery-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}
