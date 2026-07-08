import { LinearGradient } from "expo-linear-gradient";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Card, StateText } from "@/components/ui";
import { api } from "@/lib/api";
import { toNumber, todayInputValue } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";

type Mode = "week" | "month";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const CHART_HEIGHT = 130;

// Soma dias a uma data "YYYY-MM-DD" sem depender do fuso do aparelho.
function addDays(iso: string, amount: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// Valores redondos e por extenso: nada de casas decimais nem abreviações.
function wholeCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

interface ChartBar {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  isCurrent: boolean;
}

// Panorama do faturamento: número grande + comparação em palavras + barras.
// Pensado para leitura imediata: uma cor só, rótulo em cada barra, "hoje" marcado.
export function RevenuePanorama() {
  const [mode, setMode] = useState<Mode>("week");
  const today = todayInputValue();

  // Janela atual e anterior do mesmo tamanho (7 ou 28 dias) para comparar.
  const windowDays = mode === "week" ? 7 : 28;
  const currentStart = addDays(today, -(windowDays - 1));
  const previousStart = addDays(today, -(windowDays * 2 - 1));
  const previousEnd = addDays(today, -windowDays);

  const currentQuery = useQuery({
    queryKey: ["relatorios", "panorama", mode, currentStart, today],
    queryFn: () => api.relatorios.period(currentStart, today)
  });
  const previousQuery = useQuery({
    queryKey: ["relatorios", "panorama", mode, previousStart, previousEnd],
    queryFn: () => api.relatorios.period(previousStart, previousEnd)
  });

  const revenueByDay = useMemo(() => {
    const map: Record<string, number> = {};
    currentQuery.data?.dias?.forEach((day) => {
      const key = day.data_venda?.slice(0, 10);
      if (key) map[key] = (map[key] || 0) + toNumber(day.faturamento_bruto);
    });
    return map;
  }, [currentQuery.data]);

  const bars = useMemo<ChartBar[]>(() => {
    if (mode === "week") {
      return Array.from({ length: 7 }, (_, index) => {
        const date = addDays(today, index - 6);
        return {
          key: date,
          label: date === today ? "Hoje" : WEEKDAYS[weekdayOf(date)],
          sublabel: String(Number(date.slice(8, 10))),
          value: revenueByDay[date] || 0,
          isCurrent: date === today
        };
      });
    }
    return Array.from({ length: 4 }, (_, index) => {
      const start = addDays(today, index * 7 - 27);
      const end = addDays(today, index * 7 - 21);
      const value = Array.from({ length: 7 }, (_, offset) => revenueByDay[addDays(start, offset)] || 0).reduce(
        (sum, dayValue) => sum + dayValue,
        0
      );
      return {
        key: start,
        label: index === 3 ? "Esta semana" : `${Number(start.slice(8, 10))} a ${Number(end.slice(8, 10))}/${Number(end.slice(5, 7))}`,
        value,
        isCurrent: index === 3
      };
    });
  }, [mode, revenueByDay, today]);

  const total = toNumber(currentQuery.data?.faturamento_bruto);
  const previousTotal = toNumber(previousQuery.data?.faturamento_bruto);
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);
  const loading = currentQuery.isLoading || previousQuery.isLoading;

  return (
    <Card>
      <View style={styles.header}>
        <TrendingUp size={20} color={colors.brandDeep} />
        <Text style={styles.title}>Como estão as vendas</Text>
      </View>

      <View style={styles.modeRow}>
        <ModeChip label="Semana" active={mode === "week"} onPress={() => setMode("week")} />
        <ModeChip label="Mês" active={mode === "month"} onPress={() => setMode("month")} />
      </View>

      {currentQuery.error instanceof Error ? <StateText tone="error" text={currentQuery.error.message} /> : null}
      {loading ? <StateText text="Somando as vendas..." /> : null}

      {!loading && !(currentQuery.error instanceof Error) ? (
        <>
          <View>
            <Text style={styles.periodLabel}>{mode === "week" ? "Últimos 7 dias" : "Últimas 4 semanas"}</Text>
            <Text style={styles.total}>{wholeCurrency(total)}</Text>
            <ComparisonLine mode={mode} total={total} previousTotal={previousTotal} hasPrevious={!previousQuery.error} />
          </View>

          {total > 0 ? (
            <View style={styles.chartArea}>
              {bars.map((bar) => (
                <View key={bar.key} style={styles.column}>
                  <Text style={styles.barValue} numberOfLines={1} adjustsFontSizeToFit>
                    {bar.value > 0 ? wholeCurrency(bar.value).replace(/ /g, "") : ""}
                  </Text>
                  <View style={styles.barTrack}>
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
                  <Text style={[styles.barLabel, bar.isCurrent && styles.barLabelCurrent]} numberOfLines={1} adjustsFontSizeToFit>
                    {bar.label}
                  </Text>
                  {bar.sublabel ? <Text style={styles.barSublabel}>{bar.sublabel}</Text> : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🥖</Text>
              <Text style={styles.emptyText}>
                {mode === "week" ? "Ainda não há vendas nos últimos 7 dias." : "Ainda não há vendas nas últimas 4 semanas."}
              </Text>
            </View>
          )}
        </>
      ) : null}
    </Card>
  );
}

// Frase de comparação com o período anterior, em linguagem do dia a dia.
function ComparisonLine({
  mode,
  total,
  previousTotal,
  hasPrevious
}: {
  mode: Mode;
  total: number;
  previousTotal: number;
  hasPrevious: boolean;
}) {
  if (!hasPrevious || (total === 0 && previousTotal === 0)) return null;

  const difference = total - previousTotal;
  const periodName = mode === "week" ? "que na semana anterior" : "que no mês anterior";

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
        {wholeCurrency(Math.abs(difference))} a {up ? "mais" : "menos"} {periodName}
      </Text>
    </View>
  );
}

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeChip, active && styles.modeChipActive]}>
      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
    </Pressable>
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
  modeRow: {
    flexDirection: "row",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    padding: 5
  },
  modeChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radius.pill
  },
  modeChipActive: {
    backgroundColor: colors.brand,
    ...shadows.brand
  },
  modeChipText: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  modeChipTextActive: {
    color: "#fff"
  },
  periodLabel: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  total: {
    color: colors.ink,
    fontSize: 40,
    fontFamily: fonts.display,
    letterSpacing: -1
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2
  },
  comparisonText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 6
  },
  column: {
    flex: 1,
    alignItems: "center",
    gap: 4
  },
  barValue: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: fonts.bodyBold
  },
  barTrack: {
    height: CHART_HEIGHT,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end"
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
  barLabel: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  barLabelCurrent: {
    color: colors.brandDeep
  },
  barSublabel: {
    marginTop: -2,
    color: colors.muted,
    fontSize: 11,
    fontFamily: fonts.body
  },
  emptyBox: {
    alignItems: "center",
    gap: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceGlow,
    padding: 22
  },
  emptyEmoji: {
    fontSize: 30
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    textAlign: "center"
  }
});
