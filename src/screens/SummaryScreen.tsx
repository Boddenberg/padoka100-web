import { ArrowDownRight, ArrowUpRight, CalendarDays, Minus, TrendingUp } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { RangeCalendar } from "@/components/calendar";
import { AiAnalysisCard } from "@/components/resumo/ai-analysis";
import { DaySummarySheet } from "@/components/resumo/day-summary-sheet";
import { PeriodChart } from "@/components/resumo/period-chart";
import { Badge, Card, Money, Page, SectionTitle, Skeleton, StateText } from "@/components/ui";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatWholeCurrency, toNumber, todayInputValue } from "@/lib/format";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import { addDays, describePeriod, diffDays, startOfMonth } from "@/utils/dates";
import { eventTimestamp, humanizeEventDetail, humanizeEventTitle } from "@/utils/events";

// Ordem da tela (README): 1. Faturamento do período · 2. Período ·
// 3. Gráfico · 4. Análise com IA · 5. Histórico.
export function SummaryScreen() {
  const today = todayInputValue();
  const [start, setStart] = useState(addDays(today, -6));
  const [end, setEnd] = useState(today);
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const HISTORY_PREVIEW = 6;

  const periodQuery = useQuery({
    queryKey: ["relatorios", "periodo", start, end],
    queryFn: () => api.relatorios.period(start, end),
    enabled: Boolean(start && end),
    // Se o servidor ainda não respondeu (ex.: endpoint indisponível/404),
    // segue tentando sozinho a cada 6s em vez de travar num erro seco.
    refetchInterval: (query) => (query.state.status === "error" ? 6000 : false)
  });

  // Período anterior do mesmo tamanho, para a frase de comparação.
  const span = diffDays(start, end) + 1;
  const previousStart = addDays(start, -span);
  const previousEnd = addDays(start, -1);
  const previousQuery = useQuery({
    queryKey: ["relatorios", "periodo", previousStart, previousEnd],
    queryFn: () => api.relatorios.period(previousStart, previousEnd),
    enabled: Boolean(start && end)
  });

  const historyQuery = useQuery({
    queryKey: ["historico", "timeline"],
    queryFn: () => api.historico.timeline({ limite: 40 })
  });
  // Todos os dias de venda já registrados: pontinhos do calendário e
  // mapa data → id para abrir o resumo do dia.
  const salesDaysQuery = useQuery({ queryKey: ["dias", "lista"], queryFn: () => api.dias.list() });

  const dayIdByDate = useMemo(() => {
    const map = new Map<string, string>();
    salesDaysQuery.data?.forEach((day) => {
      if (day.data_venda) map.set(day.data_venda.slice(0, 10), day.id);
    });
    return map;
  }, [salesDaysQuery.data]);

  const markedDays = useMemo(() => new Set(dayIdByDate.keys()), [dayIdByDate]);

  const totals = periodQuery.data;
  const periodLabel = describePeriod(start, end, today);

  // Puxar-para-recarregar: refaz todas as buscas do resumo (recupera de erro).
  const refreshing = periodQuery.isRefetching || historyQuery.isRefetching || salesDaysQuery.isRefetching;
  const onRefresh = () => {
    periodQuery.refetch();
    previousQuery.refetch();
    historyQuery.refetch();
    salesDaysQuery.refetch();
  };

  function setPeriod(nextStart: string, nextEnd: string) {
    setStart(nextStart);
    setEnd(nextEnd);
  }

  return (
    <>
      <Page title="Resumo" subtitle="Faturamento, período, gráfico e histórico." onRefresh={onRefresh} refreshing={refreshing}>
        {/* 1. Faturamento do período: o destaque principal da tela. */}
        <Card>
          <View style={styles.revenueHeader}>
            <TrendingUp size={20} color={colors.brandDeep} />
            <Text style={styles.revenueLabel}>Faturamento do período</Text>
          </View>
          {periodQuery.isLoading ? (
            <>
              <Skeleton height={44} width="65%" rounded={radius.md} />
              <View style={styles.metricsGrid}>
                <Skeleton height={64} rounded={radius.md} style={styles.metricSkeleton} />
                <Skeleton height={64} rounded={radius.md} style={styles.metricSkeleton} />
                <Skeleton height={64} rounded={radius.md} style={styles.metricSkeleton} />
              </View>
            </>
          ) : null}
          {periodQuery.error && !totals ? (
            <View style={styles.retryBox}>
              <Text style={styles.retryEmoji}>⏳</Text>
              <Text style={styles.retryText}>
                Estamos buscando o faturamento do período. Assim que o servidor responder, os números aparecem aqui sozinhos.
              </Text>
            </View>
          ) : null}
          {totals ? (
            <>
              <Money value={totals.faturamento_bruto} size={40} />
              <Badge text={periodLabel} tone="good" />
              <ComparisonLine
                total={toNumber(totals.faturamento_bruto)}
                previousTotal={toNumber(previousQuery.data?.faturamento_bruto)}
                hasPrevious={!previousQuery.error && !previousQuery.isLoading}
              />
              <View style={styles.metricsGrid}>
                <Metric label="Lucro" value={formatCurrency(totals.lucro_estimado)} highlight />
                <Metric label="Vendido" value={String(totals.total_vendido ?? 0)} />
                <Metric label="Restante" value={String(totals.total_sobra ?? 0)} />
              </View>
            </>
          ) : null}
        </Card>

        {/* 2. Período: atalhos + calendário (sem datas futuras). */}
        <Card>
          <View style={styles.rangeHeader}>
            <Text style={styles.rangeLabel}>Período</Text>
            <Badge text={periodLabel} tone="neutral" />
          </View>
          <View style={styles.presetRow}>
            <PresetChip label="Hoje" active={start === today && end === today} onPress={() => setPeriod(today, today)} />
            <PresetChip
              label="7 dias"
              active={start === addDays(today, -6) && end === today}
              onPress={() => setPeriod(addDays(today, -6), today)}
            />
            <PresetChip
              label="Mês"
              active={start === startOfMonth(today) && end === today}
              onPress={() => setPeriod(startOfMonth(today), today)}
            />
          </View>
          <RangeCalendar
            start={start}
            end={end}
            marked={markedDays}
            onChange={setPeriod}
            onDayOpen={(day) => {
              const dayId = dayIdByDate.get(day);
              if (dayId) setOpenDayId(dayId);
            }}
          />
        </Card>

        {/* 3. Gráfico de vendas do período selecionado. */}
        <PeriodChart dias={totals?.dias} start={start} end={end} today={today} loading={periodQuery.isLoading} />

        {/* 4. Análise com IA do período selecionado. */}
        <AiAnalysisCard start={start} end={end} />

        {/* Dias do período, cada um abre o próprio resumo. */}
        {totals?.dias?.length ? <SectionTitle text="Dias do período" /> : null}
        {(totals?.dias || []).map((day) => (
          <Pressable
            key={day.dia_de_venda_id}
            onPress={() => setOpenDayId(day.dia_de_venda_id)}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Card>
              <View style={styles.dayHeader}>
                <View style={styles.dayIcon}>
                  <CalendarDays size={18} color={colors.brandDeep} />
                </View>
                <View style={styles.dayInfo}>
                  <Text style={styles.dayTitle}>{formatDate(day.data_venda)}</Text>
                  <Text style={styles.muted}>{day.nome_local || "Sem local"}</Text>
                </View>
                <Badge
                  text={day.situacao === "aberto" ? "Aberto" : "Fechado"}
                  tone={day.situacao === "aberto" ? "good" : "neutral"}
                />
              </View>
              <View style={styles.dayNumbers}>
                <Text style={styles.dayRevenue}>{formatCurrency(day.faturamento_bruto)}</Text>
                <Text style={styles.muted}>lucro {formatCurrency(day.lucro_estimado)}</Text>
              </View>
            </Card>
          </Pressable>
        ))}

        {/* 5. Histórico em linguagem humana: começa curto, expande sob demanda. */}
        <SectionTitle text="Histórico" />
        {historyQuery.isLoading ? <StateText text="Carregando histórico..." /> : null}
        {historyQuery.error instanceof Error ? <StateText tone="error" text={historyQuery.error.message} /> : null}
        {(showAllHistory ? historyQuery.data : historyQuery.data?.slice(0, HISTORY_PREVIEW))?.map((event) => {
          const detail = humanizeEventDetail(event);
          return (
            <View key={event.id} style={styles.eventRow}>
              <View style={styles.eventDot} />
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{humanizeEventTitle(event)}</Text>
                <Text style={styles.muted}>
                  {detail ? `${detail} · ${formatDate(eventTimestamp(event))}` : formatDate(eventTimestamp(event))}
                </Text>
              </View>
            </View>
          );
        })}
        {(historyQuery.data?.length || 0) > HISTORY_PREVIEW ? (
          <Pressable onPress={() => setShowAllHistory((value) => !value)} style={({ pressed }) => [styles.historyToggle, pressed && styles.pressed]}>
            <Text style={styles.historyToggleText}>
              {showAllHistory ? "Mostrar menos" : `Ver mais ${(historyQuery.data?.length || 0) - HISTORY_PREVIEW} do histórico`}
            </Text>
          </Pressable>
        ) : null}
      </Page>

      <DaySummarySheet visible={Boolean(openDayId)} dayId={openDayId} onClose={() => setOpenDayId(null)} />
    </>
  );
}

// Frase de comparação com o período anterior, em linguagem do dia a dia.
function ComparisonLine({
  total,
  previousTotal,
  hasPrevious
}: {
  total: number;
  previousTotal: number;
  hasPrevious: boolean;
}) {
  if (!hasPrevious || (total === 0 && previousTotal === 0)) return null;

  const difference = total - previousTotal;

  if (Math.round(Math.abs(difference)) === 0) {
    return (
      <View style={styles.comparisonRow}>
        <Minus size={18} color={colors.muted} />
        <Text style={[styles.comparisonText, { color: colors.muted }]}>Igual ao período anterior</Text>
      </View>
    );
  }

  const up = difference > 0;
  return (
    <View style={styles.comparisonRow}>
      {up ? <ArrowUpRight size={18} color={colors.success} /> : <ArrowDownRight size={18} color={colors.danger} />}
      <Text style={[styles.comparisonText, { color: up ? colors.success : colors.danger }]}>
        {formatWholeCurrency(Math.abs(difference))} a {up ? "mais" : "menos"} que o período anterior
      </Text>
    </View>
  );
}

function PresetChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.presetChip, active && styles.presetChipActive]}>
      <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.metric, highlight && styles.metricHighlight]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, highlight && { color: colors.success }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92
  },
  revenueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  revenueLabel: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  metricSkeleton: {
    flex: 1
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  comparisonText: {
    fontSize: 15,
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
    backgroundColor: colors.surfaceWarm,
    padding: 12
  },
  metricHighlight: {
    backgroundColor: colors.successSoft
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  metricValue: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  rangeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  rangeLabel: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display
  },
  presetRow: {
    flexDirection: "row",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    padding: 5
  },
  presetChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: radius.pill
  },
  presetChipActive: {
    backgroundColor: colors.brand,
    ...shadows.brand
  },
  presetChipText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  presetChipTextActive: {
    color: "#fff"
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  dayIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft
  },
  dayInfo: {
    flex: 1
  },
  dayTitle: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.display
  },
  dayNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10
  },
  dayRevenue: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: -0.4
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
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
  retryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceGlow,
    padding: 14
  },
  retryEmoji: {
    fontSize: 24
  },
  retryText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body
  },
  historyToggle: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceWarm
  },
  historyToggleText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  }
});
