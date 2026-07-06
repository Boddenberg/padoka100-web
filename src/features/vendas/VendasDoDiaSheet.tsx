import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ChevronRight, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import type { Venda } from "@/types/api";

type SheetView = { mode: "list" } | { mode: "detail"; sale: Venda } | { mode: "cancel"; sale: Venda };

interface VendasDoDiaSheetProps {
  open: boolean;
  onClose: () => void;
}

export function VendasDoDiaSheet({ open, onClose }: VendasDoDiaSheetProps) {
  const [view, setView] = useState<SheetView>({ mode: "list" });

  function handleClose() {
    setView({ mode: "list" });
    onClose();
  }

  const title = view.mode === "list" ? "Vendas do dia" : view.mode === "detail" ? "Detalhe da venda" : "Cancelar venda";

  return (
    <Modal
      title={title}
      open={open}
      onClose={handleClose}
      size="lg"
      onBack={view.mode !== "list" ? () => setView({ mode: "list" }) : undefined}
    >
      {open ? <SheetContent view={view} onViewChange={setView} /> : null}
    </Modal>
  );
}

function SheetContent({ view, onViewChange }: { view: SheetView; onViewChange: (view: SheetView) => void }) {
  const [selectedDayId, setSelectedDayId] = useState("");

  const daysQuery = useQuery({
    queryKey: ["dias", "lista"],
    queryFn: () => api.dias.list()
  });

  const effectiveSelectedDayId = selectedDayId || daysQuery.data?.[0]?.id || "";

  const salesQuery = useQuery({
    queryKey: ["vendas", "por-dia", effectiveSelectedDayId],
    queryFn: () => api.vendas.listByDay(effectiveSelectedDayId),
    enabled: Boolean(effectiveSelectedDayId)
  });

  const total = useMemo(
    () =>
      (salesQuery.data || [])
        .filter((sale) => sale.situacao !== "cancelada")
        .flatMap((sale) => sale.itens || [])
        .reduce((sum, item) => sum + Number(item.valor_total_venda || 0), 0),
    [salesQuery.data]
  );

  if (view.mode === "detail") {
    return <SaleDetail sale={view.sale} />;
  }

  if (view.mode === "cancel") {
    return <SaleCancel sale={view.sale} onDone={() => onViewChange({ mode: "list" })} />;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <Select value={effectiveSelectedDayId} onChange={(event) => setSelectedDayId(event.target.value)}>
          {(daysQuery.data || []).map((day) => (
            <option key={day.id} value={day.id}>
              {formatDate(day.data_venda)} · {day.nome_local_no_momento || "Sem local"} · {day.situacao}
            </option>
          ))}
        </Select>
        <StatusBadge tone="good">{formatCurrency(total)}</StatusBadge>
      </div>

      {daysQuery.isLoading || salesQuery.isLoading ? <LoadingState label="Carregando vendas" /> : null}
      {daysQuery.error instanceof Error ? <ErrorState message={daysQuery.error.message} /> : null}
      {salesQuery.error instanceof Error ? <ErrorState message={salesQuery.error.message} /> : null}

      {salesQuery.data?.length ? (
        <div className="grid divide-y divide-bakery-border/70">
          {salesQuery.data.map((sale) => (
            <div key={sale.id} className="flex items-center gap-3 py-3">
              <button
                type="button"
                onClick={() => onViewChange({ mode: "detail", sale })}
                className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:scale-[0.99]"
                aria-label="Ver detalhe da venda"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bakery-creamStrong text-bakery-ink">
                  <ReceiptText className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg font-extrabold tabular-nums text-bakery-ink">{formatCurrency(saleTotal(sale))}</strong>
                    <StatusBadge tone={sale.situacao === "cancelada" ? "danger" : "good"}>{sale.situacao}</StatusBadge>
                  </span>
                  <span className="block truncate text-sm font-semibold text-bakery-muted">
                    {formatDateTime(sale.ocorrido_em)} · {sale.itens?.length || 0} item(ns) · {sale.tipo_entrada}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-bakery-muted" />
              </button>
              <button
                type="button"
                disabled={sale.situacao === "cancelada"}
                onClick={() => onViewChange({ mode: "cancel", sale })}
                aria-label="Cancelar venda"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bakery-dangerSoft text-bakery-danger transition active:scale-95 disabled:opacity-40"
              >
                <Ban className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      ) : !salesQuery.isLoading && effectiveSelectedDayId ? (
        <EmptyState title="Nenhuma venda neste dia" />
      ) : null}
    </div>
  );
}

function SaleDetail({ sale }: { sale: Venda }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge tone={sale.situacao === "cancelada" ? "danger" : "good"}>{sale.situacao}</StatusBadge>
        <strong className="text-2xl font-extrabold tracking-tight tabular-nums text-bakery-ink">
          {formatCurrency(saleTotal(sale))}
        </strong>
      </div>
      <div className="grid gap-2">
        {(sale.itens || []).map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-bakeryLg bg-bakery-creamStrong/60 p-3">
            <div>
              <p className="font-bold text-bakery-ink">{item.nome_produto_no_momento}</p>
              <p className="text-sm font-semibold text-bakery-muted">
                {item.quantidade} x {formatCurrency(item.preco_venda_unitario_no_momento)}
              </p>
            </div>
            <strong className="tabular-nums">{formatCurrency(item.valor_total_venda)}</strong>
          </div>
        ))}
      </div>
      {sale.motivo_cancelamento ? (
        <div className="rounded-bakeryLg bg-bakery-dangerSoft p-3 text-sm font-semibold text-bakery-danger">
          {sale.motivo_cancelamento}
        </div>
      ) : null}
    </div>
  );
}

function SaleCancel({ sale, onDone }: { sale: Venda; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const cancelSale = useMutation({
    mutationFn: () => api.vendas.cancel(sale.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      queryClient.invalidateQueries({ queryKey: ["dias"] });
      onDone();
    }
  });

  return (
    <div className="grid gap-4">
      <div className="rounded-bakeryLg bg-bakery-creamStrong/60 p-4">
        <p className="text-sm font-semibold text-bakery-muted">Venda de {formatDateTime(sale.ocorrido_em)}</p>
        <p className="text-xl font-extrabold tabular-nums text-bakery-ink">{formatCurrency(saleTotal(sale))}</p>
      </div>
      <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo do cancelamento" />
      <Button type="button" variant="danger" size="lg" disabled={cancelSale.isPending} onClick={() => cancelSale.mutate()}>
        {cancelSale.isPending ? "Cancelando..." : "Confirmar cancelamento"}
      </Button>
      {cancelSale.error instanceof Error ? <ErrorState message={cancelSale.error.message} /> : null}
    </div>
  );
}

function saleTotal(sale: Venda) {
  return (sale.itens || []).reduce((sum, item) => sum + Number(item.valor_total_venda || 0), 0);
}
