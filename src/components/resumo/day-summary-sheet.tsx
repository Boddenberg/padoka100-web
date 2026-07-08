import { CalendarDays, PencilLine } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { EditDayFlow } from "@/components/resumo/edit-day-flow";
import { Badge, Button, Money, ProductPhoto, SectionTitle, Sheet, StateText } from "@/components/ui";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors, fonts, radius } from "@/lib/theme";
import { eventTimestamp, humanizeEventDetail, humanizeEventTitle } from "@/utils/events";
import { fixProductName } from "@/utils/text";

// Resumo completo de um dia (aberto ou fechado): status, faturamento,
// produtos com produzido/vendido/sobra e a linha do tempo daquele dia.
// Dias fechados ganham o modo de correção retroativa.
export function DaySummarySheet({
  visible,
  dayId,
  onClose
}: {
  visible: boolean;
  dayId: string | null;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);

  // Cada dia aberto no sheet começa fora do modo de edição.
  useEffect(() => {
    setEditing(false);
  }, [dayId, visible]);

  const resumoQuery = useQuery({
    queryKey: ["relatorios", "dia", dayId],
    queryFn: () => api.relatorios.day(dayId!),
    enabled: visible && Boolean(dayId)
  });
  const historyQuery = useQuery({
    queryKey: ["historico", "dia", dayId],
    queryFn: () => api.historico.timeline({ dia_de_venda_id: dayId!, limite: 60 }),
    enabled: visible && Boolean(dayId)
  });

  const resumo = resumoQuery.data;
  const produtos = resumo?.produtos || [];
  const soldOutCount = produtos.filter(
    (produto) => (produto.quantidade_produzida ?? 0) > 0 && (produto.quantidade_sobra ?? 0) === 0
  ).length;
  const leftoverCount = produtos.filter((produto) => (produto.quantidade_sobra ?? 0) > 0).length;
  const isOpen = resumo?.situacao === "aberto";

  return (
    <Sheet
      visible={visible}
      title={
        editing
          ? `Corrigir dia ${resumo ? formatDate(resumo.data_venda) : ""}`.trim()
          : resumo
            ? `Resumo do dia ${formatDate(resumo.data_venda)}`
            : "Resumo do dia"
      }
      subtitle={editing ? "Correção retroativa" : resumo?.nome_local ? fixProductName(resumo.nome_local) : undefined}
      onClose={onClose}
    >
      {resumoQuery.isLoading ? <StateText text="Carregando o dia..." /> : null}
      {resumoQuery.error instanceof Error ? <StateText tone="error" text={resumoQuery.error.message} /> : null}

      {resumo && editing ? (
        <EditDayFlow resumo={resumo} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
      ) : null}

      {resumo && !editing ? (
        <>
          <View style={styles.statusRow}>
            <Badge text={isOpen ? "Dia aberto" : "Dia fechado"} tone={isOpen ? "good" : "neutral"} />
            <View style={styles.dateChip}>
              <CalendarDays size={14} color={colors.muted} />
              <Text style={styles.dateChipText}>{formatDate(resumo.data_venda)}</Text>
            </View>
          </View>

          <View style={styles.revenueBox}>
            <Text style={styles.revenueLabel}>Faturamento</Text>
            <Money value={resumo.faturamento_bruto} size={32} />
          </View>

          <View style={styles.metricsGrid}>
            <Metric label="Itens vendidos" value={String(resumo.total_vendido ?? 0)} />
            <Metric label="Com sobra" value={String(leftoverCount)} />
            <Metric label="Esgotados" value={String(soldOutCount)} />
          </View>

          {produtos.length ? <SectionTitle text="Produtos do dia" /> : null}
          {produtos.map((produto) => {
            const produced = produto.quantidade_produzida ?? 0;
            const sold = produto.quantidade_vendida ?? 0;
            const left = produto.quantidade_sobra ?? Math.max(0, produced - sold);
            const soldOut = produced > 0 && left === 0;

            return (
              <View key={produto.produto_id} style={styles.productRow}>
                <ProductPhoto url={produto.url_imagem_produto} name={produto.nome_produto} size={52} />
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{fixProductName(produto.nome_produto)}</Text>
                  <Text style={styles.productNumbers}>
                    Produzido: {produced} · Vendido: {sold} · Sobrou: {left}
                  </Text>
                  {soldOut ? <Badge text="Esgotado" tone="warn" /> : null}
                </View>
                <Text style={styles.productRevenue}>{formatCurrency(produto.faturamento_bruto)}</Text>
              </View>
            );
          })}

          {!isOpen ? (
            <Button
              title="Corrigir informações"
              tone="soft"
              icon={<PencilLine size={18} color={colors.ink} />}
              onPress={() => setEditing(true)}
            />
          ) : null}

          <SectionTitle text="Histórico do dia" />
          {historyQuery.isLoading ? <StateText text="Carregando histórico..." /> : null}
          {historyQuery.error instanceof Error ? <StateText tone="error" text={historyQuery.error.message} /> : null}
          {!historyQuery.isLoading && !historyQuery.data?.length ? (
            <StateText text="Nenhum evento registrado nesse dia." />
          ) : null}
          {historyQuery.data?.map((event) => {
            const detail = humanizeEventDetail(event);
            return (
              <View key={event.id} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{humanizeEventTitle(event)}</Text>
                  <Text style={styles.eventDetail}>
                    {detail ? `${detail} · ${formatTime(eventTimestamp(event))}` : formatTime(eventTimestamp(event))}
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      ) : null}
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  dateChipText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  revenueBox: {
    gap: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceWarm,
    padding: 16
  },
  revenueLabel: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 8
  },
  metric: {
    flex: 1,
    gap: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceGlow,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  metricValue: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  productInfo: {
    flex: 1,
    gap: 4
  },
  productName: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  productNumbers: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  },
  productRevenue: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.display
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 4
  },
  eventDot: {
    marginTop: 6,
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: colors.brand
  },
  eventInfo: {
    flex: 1,
    gap: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12
  },
  eventTitle: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  eventDetail: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  }
});
