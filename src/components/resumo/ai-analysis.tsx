import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, Lightbulb, Sparkles, TrendingDown, TrendingUp } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { AGENT_NAME, AgentAvatar, AgentTag } from "@/components/agent";
import { Card, Input, StateText } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import type { RespostaAnaliseIA } from "@/types/api";

// Análise do período com IA: análise padrão do período selecionado +
// campo opcional de contexto ("ignore os pudins", "analise só abril"...).
// A resposta chega organizada em seções, nunca como bloco cru.
export function AiAnalysisCard({ start, end }: { start: string; end: string }) {
  const [context, setContext] = useState("");
  const [result, setResult] = useState<RespostaAnaliseIA | null>(null);

  const analyze = useMutation({
    mutationFn: () =>
      api.ia.analyzePeriod({
        data_inicio: start,
        data_fim: end,
        contexto: context.trim() || null
      }),
    onSuccess: setResult
  });

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AgentAvatar size={48} />
        <View style={styles.headerText}>
          <AgentTag />
          <Text style={styles.title}>Análise com IA</Text>
          <Text style={styles.hint}>O {AGENT_NAME} analisa as vendas do período selecionado.</Text>
        </View>
      </View>

      <Input
        value={context}
        onChangeText={setContext}
        placeholder="Contexto opcional. Ex: ignore os pudins"
        multiline
      />

      <Pressable
        onPress={() => analyze.mutate()}
        disabled={analyze.isPending}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <LinearGradient
          colors={gradients.agent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, shadows.agent]}
        >
          <Sparkles size={18} color="#fff" />
          <Text style={styles.buttonText}>{analyze.isPending ? "Analisando as vendas..." : "Gerar análise"}</Text>
        </LinearGradient>
      </Pressable>

      {analyze.error ? <StateText tone="error" text={analysisErrorMessage(analyze.error)} /> : null}

      {result ? (
        <View style={styles.result}>
          <View style={styles.summaryBubble}>
            <Text style={styles.summaryText}>{result.resumo}</Text>
          </View>

          <AnalysisSection
            title="Principais achados"
            icon={<Sparkles size={16} color={colors.agentDeep} />}
            items={result.principais_achados}
          />
          <AnalysisSection
            title="Mais venderam"
            icon={<TrendingUp size={16} color={colors.success} />}
            items={result.mais_venderam}
          />
          <AnalysisSection
            title="Mais sobraram"
            icon={<TrendingDown size={16} color={colors.warning} />}
            items={result.mais_sobraram}
          />
          <AnalysisSection
            title="Sugestões"
            icon={<Lightbulb size={16} color={colors.brandDeep} />}
            items={result.sugestoes}
          />
          <AnalysisSection
            title="Pontos de atenção"
            icon={<AlertTriangle size={16} color={colors.danger} />}
            items={result.pontos_atencao}
          />
        </View>
      ) : null}
    </Card>
  );
}

function AnalysisSection({ title, icon, items }: { title: string; icon: React.ReactNode; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {items.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.bulletRow}>
          <View style={styles.bullet} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// O endpoint de análise ainda não existe no backend: recado honesto.
function analysisErrorMessage(error: unknown) {
  if (error instanceof ApiError && [404, 405, 501].includes(error.status)) {
    return "O servidor ainda não gera análises com IA. Essa parte do sistema está em construção.";
  }
  return error instanceof Error ? error.message : "Não foi possível gerar a análise.";
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92
  },
  card: {
    borderColor: colors.agentSoft,
    borderWidth: 1.5
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  headerText: {
    flex: 1,
    gap: 3
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display
  },
  hint: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.body
  },
  button: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    paddingHorizontal: 20
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  result: {
    gap: 12
  },
  summaryBubble: {
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    backgroundColor: colors.agentSoft,
    padding: 14
  },
  summaryText: {
    color: colors.agentDeep,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    lineHeight: 21
  },
  section: {
    gap: 6
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingLeft: 4
  },
  bullet: {
    marginTop: 7,
    height: 6,
    width: 6,
    borderRadius: 3,
    backgroundColor: colors.agent
  },
  bulletText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.body,
    lineHeight: 20
  }
});
