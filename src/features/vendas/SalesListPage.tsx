import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Eye, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { Page } from "@/components/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import type { Venda } from "@/types/api";

export function SalesListPage() {
  const queryClient = useQueryClient();
  const [selectedDayId, setSelectedDayId] = useState("");
  const [selectedSale, setSelectedSale] = useState<Venda | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<Venda | null>(null);
  const [cancelReason, setCancelReason] = useState("");

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

  const cancelSale = useMutation({
    mutationFn: () => api.vendas.cancel(saleToCancel!.id, cancelReason),
    onSuccess: () => {
      setSaleToCancel(null);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    }
  });

  const total = useMemo(
    () =>
      (salesQuery.data || [])
        .filter((sale) => sale.situacao !== "cancelada")
        .flatMap((sale) => sale.itens || [])
        .reduce((sum, item) => sum + Number(item.valor_total_venda || 0), 0),
    [salesQuery.data]
  );

  return (
    <Page title="Vendas" eyebrow="Consulta">
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <Select value={effectiveSelectedDayId} onChange={(event) => setSelectedDayId(event.target.value)}>
            {(daysQuery.data || []).map((day) => (
              <option key={day.id} value={day.id}>
                {formatDate(day.data_venda)} - {day.nome_local_no_momento || "Sem local"} - {day.situacao}
              </option>
            ))}
          </Select>
          <StatusBadge tone="good">{formatCurrency(total)}</StatusBadge>
        </CardContent>
      </Card>

      {daysQuery.isLoading || salesQuery.isLoading ? <LoadingState label="Carregando vendas" /> : null}
      {daysQuery.error instanceof Error ? <ErrorState message={daysQuery.error.message} /> : null}
      {salesQuery.error instanceof Error ? <ErrorState message={salesQuery.error.message} /> : null}

      {salesQuery.data?.length ? (
        <div className="grid gap-3">
          {salesQuery.data.map((sale) => (
            <Card key={sale.id}>
              <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-red-600" />
                    <h2 className="text-lg font-black text-slate-950">{formatCurrency(saleTotal(sale))}</h2>
                    <StatusBadge tone={sale.situacao === "cancelada" ? "danger" : "good"}>{sale.situacao}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {formatDateTime(sale.ocorrido_em)} - {sale.itens?.length || 0} item(ns) - {sale.tipo_entrada}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setSelectedSale(sale)} icon={<Eye className="h-4 w-4" />}>
                    Ver
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={sale.situacao === "cancelada"}
                    onClick={() => setSaleToCancel(sale)}
                    icon={<Ban className="h-4 w-4" />}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !salesQuery.isLoading && effectiveSelectedDayId ? (
        <EmptyState title="Nenhuma venda neste dia" />
      ) : null}

      <Modal title="Detalhe da venda" open={Boolean(selectedSale)} onClose={() => setSelectedSale(null)}>
        {selectedSale ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge tone={selectedSale.situacao === "cancelada" ? "danger" : "good"}>{selectedSale.situacao}</StatusBadge>
              <strong className="text-2xl text-slate-950">{formatCurrency(saleTotal(selectedSale))}</strong>
            </div>
            <div className="grid gap-2">
              {(selectedSale.itens || []).map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="font-black text-slate-950">{item.nome_produto_no_momento}</p>
                    <p className="text-sm font-semibold text-slate-500">
                      {item.quantidade} x {formatCurrency(item.preco_venda_unitario_no_momento)}
                    </p>
                  </div>
                  <strong>{formatCurrency(item.valor_total_venda)}</strong>
                </div>
              ))}
            </div>
            {selectedSale.motivo_cancelamento ? (
              <div className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">
                {selectedSale.motivo_cancelamento}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal title="Cancelar venda" open={Boolean(saleToCancel)} onClose={() => setSaleToCancel(null)}>
        <div className="grid gap-4">
          <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Motivo" />
          <Button type="button" variant="danger" disabled={cancelSale.isPending} onClick={() => cancelSale.mutate()}>
            {cancelSale.isPending ? "Cancelando" : "Confirmar cancelamento"}
          </Button>
          {cancelSale.error instanceof Error ? <ErrorState message={cancelSale.error.message} /> : null}
        </div>
      </Modal>
    </Page>
  );
}

function saleTotal(sale: Venda) {
  return (sale.itens || []).reduce((sum, item) => sum + Number(item.valor_total_venda || 0), 0);
}
