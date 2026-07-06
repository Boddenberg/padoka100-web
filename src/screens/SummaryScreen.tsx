import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Field, Input, Page, StateText } from "@/components/ui";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, todayInputValue } from "@/lib/format";
import { colors } from "@/lib/theme";

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

  const totals = periodQuery.data;
  const days = useMemo(() => totals?.dias || [], [totals]);

  return (
    <Page title="Resumo" subtitle="Faturamento, sobras e histórico recente.">
      <Card>
        <View style={styles.filters}>
          <Field label="Início">
            <Input value={start} onChangeText={setStart} placeholder="AAAA-MM-DD" />
          </Field>
          <Field label="Fim">
            <Input value={end} onChangeText={setEnd} placeholder="AAAA-MM-DD" />
          </Field>
        </View>
        <Button title="Atualizar" onPress={() => periodQuery.refetch()} />
      </Card>

      {periodQuery.isLoading ? <StateText text="Carregando resumo..." /> : null}
      {periodQuery.error instanceof Error ? <StateText tone="error" text={periodQuery.error.message} /> : null}

      {totals ? (
        <Card>
          <Text style={styles.total}>{formatCurrency(totals.faturamento_bruto)}</Text>
          <Text style={styles.muted}>Lucro estimado: {formatCurrency(totals.lucro_estimado)}</Text>
          <Text style={styles.muted}>Vendido: {totals.total_vendido ?? 0} · Sobra: {totals.total_sobra ?? 0}</Text>
        </Card>
      ) : null}

      {days.map((day) => (
        <Card key={day.dia_de_venda_id}>
          <Text style={styles.title}>{formatDate(day.data_venda)}</Text>
          <Text style={styles.muted}>{day.nome_local || "Sem local"} · {day.situacao}</Text>
          <Text style={styles.muted}>{formatCurrency(day.faturamento_bruto)} · lucro {formatCurrency(day.lucro_estimado)}</Text>
        </Card>
      ))}

      <Text style={styles.sectionTitle}>Histórico</Text>
      {historyQuery.isLoading ? <StateText text="Carregando histórico..." /> : null}
      {historyQuery.error instanceof Error ? <StateText tone="error" text={historyQuery.error.message} /> : null}
      {historyQuery.data?.map((event) => (
        <Card key={event.id}>
          <Text style={styles.title}>{event.titulo}</Text>
          <Text style={styles.muted}>{event.tipo_evento} · {formatDate(event.criado_em)}</Text>
        </Card>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  filters: {
    gap: 10
  },
  total: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900"
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  muted: {
    color: colors.muted,
    fontWeight: "700"
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  }
});
