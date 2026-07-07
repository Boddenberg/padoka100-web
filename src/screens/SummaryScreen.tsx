import { CalendarDays, TrendingUp } from "lucide-react-native";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { RangeCalendar } from "@/components/calendar";
import { Badge, Card, Page, SectionTitle, StateText } from "@/components/ui";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, todayInputValue } from "@/lib/format";
import { colors, fonts, radius } from "@/lib/theme";

export function SummaryScreen() {
  const today = todayInputValue();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const periodQuery = useQuery({
    queryKey: ["relatorios", "periodo", start, end],
    queryFn: () => api.relatorios.period(start, end),
    enabled: Boolean(start && end)
  });
  const historyQuery = useQuery({
    queryKey: ["historico", "timeline"],
    queryFn: () => api.historico.timeline({ limite: 40 })
  });
  // Todos os dias de venda já registrados: viram os pontinhos do calendário.
  const salesDaysQuery = useQuery({ queryKey: ["dias", "lista"], queryFn: () => api.dias.list() });

  const markedDays = useMemo(() => {
    const set = new Set<string>();
    salesDaysQuery.data?.forEach((day) => {
      if (day.data_venda) set.add(day.data_venda.slice(0, 10));
    });
    return set;
  }, [salesDaysQuery.data]);

  const totals = periodQuery.data;
  const days = useMemo(() => totals?.dias || [], [totals]);

  return (
    <Page title="Resumo" subtitle="Faturamento, restantes e histórico recente.">
      <Card>
        <View style={styles.rangeHeader}>
          <Text style={styles.rangeLabel}>Período</Text>
          <Badge text={start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`} tone="good" />
        </View>
        <RangeCalendar
          start={start}
          end={end}
          marked={markedDays}
          onChange={(nextStart, nextEnd) => {
            setStart(nextStart);
            setEnd(nextEnd);
          }}
        />
      </Card>

      {periodQuery.isLoading ? <StateText text="Carregando resumo..." /> : null}
      {periodQuery.error instanceof Error ? <StateText tone="error" text={periodQuery.error.message} /> : null}

      {totals ? (
        <Card>
          <View style={styles.revenueHeader}>
            <TrendingUp size={20} color={colors.brandDeep} />
            <Text style={styles.revenueLabel}>Faturamento do período</Text>
          </View>
          <Text style={styles.total}>{formatCurrency(totals.faturamento_bruto)}</Text>
          <View style={styles.metricsGrid}>
            <Metric label="Lucro" value={formatCurrency(totals.lucro_estimado)} highlight />
            <Metric label="Vendido" value={String(totals.total_vendido ?? 0)} />
            <Metric label="Restante" value={String(totals.total_sobra ?? 0)} />
          </View>
        </Card>
      ) : null}

      {days.map((day) => (
        <Card key={day.dia_de_venda_id}>
          <View style={styles.dayHeader}>
            <View style={styles.dayIcon}>
              <CalendarDays size={18} color={colors.brandDeep} />
            </View>
            <View style={styles.dayInfo}>
              <Text style={styles.dayTitle}>{formatDate(day.data_venda)}</Text>
              <Text style={styles.muted}>{day.nome_local || "Sem local"}</Text>
            </View>
            <Badge text={day.situacao} tone={day.situacao === "aberto" ? "good" : "neutral"} />
          </View>
          <View style={styles.dayNumbers}>
            <Text style={styles.dayRevenue}>{formatCurrency(day.faturamento_bruto)}</Text>
            <Text style={styles.muted}>lucro {formatCurrency(day.lucro_estimado)}</Text>
          </View>
        </Card>
      ))}

      <SectionTitle text="Histórico" />
      {historyQuery.isLoading ? <StateText text="Carregando histórico..." /> : null}
      {historyQuery.error instanceof Error ? <StateText tone="error" text={historyQuery.error.message} /> : null}
      {historyQuery.data?.map((event) => (
        <View key={event.id} style={styles.eventRow}>
          <View style={styles.eventDot} />
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle}>{event.titulo}</Text>
            <Text style={styles.muted}>
              {event.tipo_evento} · {formatDate(event.criado_em)}
            </Text>
          </View>
        </View>
      ))}
    </Page>
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
  total: {
    color: colors.ink,
    fontSize: 36,
    fontFamily: fonts.display,
    letterSpacing: -1
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
  }
});
