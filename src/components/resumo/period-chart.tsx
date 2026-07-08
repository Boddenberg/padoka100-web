import { LinearGradient } from "expo-linear-gradient";
import { BarChart3 } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { formatWholeCurrency, toNumber } from "@/lib/format";
import { colors, fonts, gradients } from "@/lib/theme";
import { addDays, diffDays, monthName, weekdayOf } from "@/utils/dates";
import type { ResumoDoDia } from "@/types/api";

// Alturas variadas para o esqueleto do gráfico enquanto os dados chegam.
const SKELETON_HEIGHTS = [58, 96, 42, 118, 74, 128, 62];

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const CHART_HEIGHT = 130;
// Espaço reservado para o rótulo em cima da barra mais alta.
const VALUE_SPACE = 22;

interface ChartBar {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  isToday: boolean;
}

// Gráfico do período selecionado. O valor de cada dia fica colado logo acima
// da própria barra: barra pequena, número embaixo perto dela; barra alta,
// número lá em cima junto dela.
export function PeriodChart({
  dias,
  start,
  end,
  today,
  loading
}: {
  dias: ResumoDoDia[] | undefined;
  start: string;
  end: string;
  today: string;
  loading?: boolean;
}) {
  const revenueByDay = useMemo(() => {
    const map: Record<string, number> = {};
    dias?.forEach((day) => {
      const key = day.data_venda?.slice(0, 10);
      if (key) map[key] = (map[key] || 0) + toNumber(day.faturamento_bruto);
    });
    return map;
  }, [dias]);

  const bars = useMemo<ChartBar[]>(() => {
    const span = diffDays(start, end) + 1;
    if (span <= 0) return [];

    // Até 2 semanas: uma barra por dia.
    if (span <= 14) {
      return Array.from({ length: span }, (_, index) => {
        const date = addDays(start, index);
        return {
          key: date,
          label: date === today ? "Hoje" : WEEKDAYS[weekdayOf(date)],
          sublabel: String(Number(date.slice(8, 10))),
          value: revenueByDay[date] || 0,
          isToday: date === today
        };
      });
    }

    // Até ~3 meses: uma barra por semana.
    if (span <= 98) {
      const weeks = Math.ceil(span / 7);
      return Array.from({ length: weeks }, (_, index) => {
        const weekStart = addDays(start, index * 7);
        const weekEnd = index === weeks - 1 ? end : addDays(weekStart, 6);
        const value = Array.from({ length: diffDays(weekStart, weekEnd) + 1 }, (_, offset) => {
          return revenueByDay[addDays(weekStart, offset)] || 0;
        }).reduce((sum, dayValue) => sum + dayValue, 0);
        return {
          key: weekStart,
          label: `${Number(weekStart.slice(8, 10))} a ${Number(weekEnd.slice(8, 10))}/${Number(weekEnd.slice(5, 7))}`,
          value,
          isToday: today >= weekStart && today <= weekEnd
        };
      });
    }

    // Períodos longos: uma barra por mês.
    const months: ChartBar[] = [];
    let cursor = `${start.slice(0, 7)}-01`;
    while (cursor.slice(0, 7) <= end.slice(0, 7)) {
      const monthKey = cursor.slice(0, 7);
      const value = Object.entries(revenueByDay)
        .filter(([date]) => date.slice(0, 7) === monthKey)
        .reduce((sum, [, dayValue]) => sum + dayValue, 0);
      months.push({
        key: monthKey,
        label: monthName(cursor).slice(0, 3),
        sublabel: cursor.slice(0, 4),
        value,
        isToday: today.slice(0, 7) === monthKey
      });
      cursor = `${monthKey}-28`;
      cursor = addDays(cursor, 7);
      cursor = `${cursor.slice(0, 7)}-01`;
    }
    return months;
  }, [start, end, revenueByDay, today]);

  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  const compact = bars.length > 8;

  return (
    <Card>
      <View style={styles.header}>
        <BarChart3 size={20} color={colors.brandDeep} />
        <Text style={styles.title}>Gráfico de vendas</Text>
      </View>

      {loading ? (
        <View style={styles.chartArea}>
          {SKELETON_HEIGHTS.map((height, index) => (
            <View key={`skeleton-${index}`} style={styles.column}>
              <View style={styles.barTrack}>
                <Skeleton height={height} width="78%" rounded={7} />
              </View>
              <Skeleton height={12} width="70%" rounded={6} />
            </View>
          ))}
        </View>
      ) : total > 0 ? (
        <View style={styles.chartArea}>
          {bars.map((bar) => (
            <View key={bar.key} style={styles.column}>
              {/* Valor e barra na mesma pilha, alinhados pela base: o número
                  acompanha a altura da própria barra. */}
              <View style={styles.barTrack}>
                {/* Trilho suave ao fundo mostra até onde a barra podia ir. */}
                <View pointerEvents="none" style={styles.rail} />
                {bar.value > 0 ? (
                  <Text
                    style={[styles.barValue, compact && styles.barValueCompact]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatWholeCurrency(bar.value).replace(/ | /g, "")}
                  </Text>
                ) : null}
                {bar.value > 0 ? (
                  <LinearGradient
                    colors={gradients.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[styles.bar, { height: Math.max(8, Math.round((bar.value / maxValue) * CHART_HEIGHT)) }]}
                  />
                ) : (
                  <View style={styles.barEmpty} />
                )}
              </View>
              <Text style={[styles.barLabel, bar.isToday && styles.barLabelToday]} numberOfLines={1} adjustsFontSizeToFit>
                {bar.label}
              </Text>
              {bar.sublabel ? <Text style={styles.barSublabel}>{bar.sublabel}</Text> : null}
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="Nenhuma venda nesse período" hint="Escolha outro período no calendário acima." />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginTop: 4
  },
  column: {
    flex: 1,
    alignItems: "center",
    gap: 4
  },
  barTrack: {
    height: CHART_HEIGHT + VALUE_SPACE,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3
  },
  rail: {
    position: "absolute",
    bottom: 0,
    height: CHART_HEIGHT,
    width: "78%",
    borderRadius: 7,
    backgroundColor: colors.surfaceGlow
  },
  bar: {
    width: "78%",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7
  },
  barEmpty: {
    height: 4,
    width: "78%",
    borderRadius: 2,
    backgroundColor: colors.border
  },
  barValue: {
    maxWidth: "100%",
    color: colors.ink,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  barValueCompact: {
    fontSize: 10
  },
  barLabel: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  barLabelToday: {
    color: colors.brandDeep
  },
  barSublabel: {
    marginTop: -2,
    color: colors.muted,
    fontSize: 11,
    fontFamily: fonts.body
  }
});
