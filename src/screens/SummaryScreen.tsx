import { ArrowDownRight, ArrowUpRight, CalendarDays, Minus, TrendingUp } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { RangeCalendar } from "@/components/calendar";
import { AnalyticsReportHub } from "@/components/analytics/report-hub";
import { AiAnalysisCard } from "@/components/resumo/ai-analysis";
import { DaySummarySheet } from "@/components/resumo/day-summary-sheet";
import { PeriodChart } from "@/components/resumo/period-chart";
import { Badge, Button, Card, Money, Page, SectionTitle, Skeleton, StateText } from "@/components/ui";
import { useProgressivePeriod } from "@/hooks/use-progressive-period";
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
  const [visibleDayLimit, setVisibleDayLimit] = useState(31);
  const HISTORY_PREVIEW = 6;

  // O mês mais recente aparece primeiro. Os demais entram um a um, sempre pela
  // rota compacta; nenhuma resposta contém as vendas ou os itens brutos.
  const progressivePeriod = useProgressivePeriod(start, end);

  // A comparação só começa depois que o período atual terminou, evitando duas
  // leituras grandes concorrentes.
  const span = diffDays(start, end) + 1;
  const previousStart = addDays(start, -span);
  const previousEnd = addDays(start, -1);
  const previousPeriod = useProgressivePeriod(previousStart, previousEnd, {
    enabled: progressivePeriod.isComplete,
    includeDays: false
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
  // Dia único selecionado que teve venda: habilita o botão de resumo do dia.
  const selectedDayId = start === end ? dayIdByDate.get(start) : undefined;

  const totals = progressivePeriod.data;
  const cardTotals = totals;
  const cardLoading = !cardTotals && progressivePeriod.isLoading;
  const cardError = !cardTotals && Boolean(progressivePeriod.error);
  const previousFaturamento = toNumber(previousPeriod.data?.faturamento_bruto);
  const hasPrevious = previousPeriod.isComplete;
  const periodLabel = describePeriod(start, end, today);
  const daysNewestFirst = useMemo(
    () => [...(totals?.dias || [])].sort((first, second) => second.data_venda.localeCompare(first.data_venda)),
    [totals?.dias]
  );
  const visibleDays = daysNewestFirst.slice(0, visibleDayLimit);

  // Puxar-para-recarregar: refaz todas as buscas do resumo (recupera de erro).
  const refreshing = historyQuery.isRefetching || salesDaysQuery.isRefetching;
  const onRefresh = () => {
    progressivePeriod.reload();
    historyQuery.refetch();
    salesDaysQuery.refetch();
  };

  function setPeriod(nextStart: string, nextEnd: string) {
    setVisibleDayLimit(31);
    setStart(nextStart);
    setEnd(nextEnd);
  }

  return (
    <>
      <Page title="Analytics" subtitle="Entenda o que aconteceu e decida o próximo passo." onRefresh={onRefresh} refreshing={refreshing}>
        {/* 1. Faturamento do período: o destaque principal da tela. */}
        <Card>
          <View style={styles.revenueHeader}>
            <TrendingUp size={20} color={colors.brandDeep} />
            <Text style={styles.revenueLabel}>Faturamento do período</Text>
          </View>
          {cardLoading ? (
            <>
              <Skeleton height={44} width="65%" rounded={radius.md} />
              <View style={styles.metricsGrid}>
                <Skeleton height={64} rounded={radius.md} style={styles.metricSkeleton} />
                <Skeleton height={64} rounded={radius.md} style={styles.metricSkeleton} />
                <Skeleton height={64} rounded={radius.md} style={styles.metricSkeleton} />
              </View>
            </>
          ) : null}
          {cardError ? (
            <View style={styles.retryBox}>
              <Text style={styles.retryEmoji}>⏳</Text>
              <Text style={styles.retryText}>
                Estamos buscando o faturamento do período. Assim que o servidor responder, os números aparecem aqui sozinhos.
              </Text>
            </View>
          ) : null}
          {cardTotals ? (
            <>
              <Money value={cardTotals.faturamento_bruto} size={40} />
              <Badge
                text={
                  progressivePeriod.isComplete
                    ? periodLabel
                    : `Parcial · ${progressivePeriod.loadedChunks} de ${progressivePeriod.totalChunks} meses`
                }
                tone={progressivePeriod.isComplete ? "good" : "neutral"}
              />
              <ComparisonLine
                total={toNumber(cardTotals.faturamento_bruto)}
                previousTotal={previousFaturamento}
                hasPrevious={hasPrevious}
              />
              <View style={styles.metricsGrid}>
                <Metric label="Lucro" value={formatCurrency(cardTotals.lucro_estimado)} highlight />
                <Metric label="Vendido" value={String(cardTotals.total_vendido ?? 0)} />
                <Metric label="Restante" value={String(cardTotals.total_sobra ?? 0)} />
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
          <RangeCalendar start={start} end={end} marked={markedDays} onChange={setPeriod} />
          {/* Um único dia com venda selecionado → botão claro para o resumo dele,
              sem abrir por acidente durante a escolha do período. */}
          {start === end && selectedDayId ? (
            <Button
              title={`Ver resumo do dia ${formatDate(start)}`}
              tone="soft"
              onPress={() => setOpenDayId(selectedDayId)}
            />
          ) : null}
        </Card>

        {progressivePeriod.totalChunks > 1 ? (
          <ProgressiveLoadState
            loaded={progressivePeriod.loadedChunks}
            total={progressivePeriod.totalChunks}
            current={progressivePeriod.currentChunk}
            complete={progressivePeriod.isComplete}
            error={progressivePeriod.error}
            onRetry={progressivePeriod.reload}
          />
        ) : null}

        <AnalyticsReportHub start={start} end={end} />

        {/* 3. Gráfico de vendas do período selecionado. */}
        <PeriodChart
          dias={totals?.dias}
          start={start}
          end={end}
          today={today}
          loading={progressivePeriod.isLoading && !totals}
        />

        {/* 4. Análise com IA do período selecionado. */}
        <AiAnalysisCard start={start} end={end} />

        {/* Dias do período, cada um abre o próprio resumo. */}
        {daysNewestFirst.length ? <SectionTitle text="Dias do período" /> : null}
        {visibleDays.map((day) => (
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
        {daysNewestFirst.length > visibleDayLimit ? (
          <Button
            title={`Mostrar mais ${Math.min(31, daysNewestFirst.length - visibleDayLimit)} dias`}
            tone="soft"
            onPress={() => setVisibleDayLimit((current) => current + 31)}
          />
        ) : null}

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

function ProgressiveLoadState({
  loaded,
  total,
  current,
  complete,
  error,
  onRetry
}: {
  loaded: number;
  total: number;
  current?: { start: string; end: string };
  complete: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const percentage = Math.round((loaded / Math.max(total, 1)) * 100);
  return (
    <Card>
      <View style={styles.progressHeader}>
        <View style={styles.progressCopy}>
          <Text style={styles.progressTitle}>
            {complete ? "Período completo" : error ? "Carregamento pausado" : "Carregando sem pesar"}
          </Text>
          <Text style={styles.muted}>
            {complete
              ? `${total} etapas mensais carregadas com segurança.`
              : `${loaded} de ${total} etapas prontas${current ? ` · agora ${formatDate(current.start)} a ${formatDate(current.end)}` : ""}`}
          </Text>
        </View>
        <Badge text={`${percentage}%`} tone={complete ? "good" : "neutral"} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(percentage, 3)}%` as `${number}%` }]} />
      </View>
      {error ? (
        <>
          <StateText tone="error" text="Uma etapa não respondeu. O que já carregou continua visível." />
          <Button title="Continuar carregamento" tone="soft" onPress={onRetry} />
        </>
      ) : null}
    </Card>
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
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  progressCopy: {
    flex: 1,
    gap: 2
  },
  progressTitle: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.display
  },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.brand
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
