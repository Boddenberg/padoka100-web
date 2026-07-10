import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { AlertTriangle, Lightbulb, LogIn, Sparkles, TrendingDown, TrendingUp } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { AGENT_NAME, AgentAvatar, AgentTag } from "@/components/agent";
import { Button, Card, Input, StateText } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { hasAccess, upgradeMessage } from "@/lib/access";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import { fixProductName } from "@/utils/text";
import type { RespostaAnaliseIA } from "@/types/api";

interface NormalizedAnalysis {
  summary: string | null;
  sections: { title: string; icon: React.ReactNode; items: string[] }[];
}

// Análise do período com IA. Análise padrão do período selecionado, ou
// específica quando a pessoa escreve uma pergunta. Exige login como dono.
export function AiAnalysisCard({ start, end }: { start: string; end: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const canUseAiAnalysis = hasAccess(user, "ia.analitica");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<NormalizedAnalysis | null>(null);

  const analyze = useMutation({
    mutationFn: async () => {
      const pergunta = question.trim();
      const response = pergunta
        ? await api.ia.analyzeSpecific({ data_inicio: start, data_fim: end, pergunta })
        : await api.ia.analyzeDefault({ data_inicio: start, data_fim: end });
      return normalizeAnalysis(response);
    },
    onSuccess: setResult
  });

  // O servidor pode exigir sessão de dono; nesse caso oferecemos o login.
  const needsLogin = analyze.error instanceof ApiError && [401, 403].includes(analyze.error.status);

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
        value={question}
        onChangeText={setQuestion}
        placeholder="Pergunta opcional. Ex: o que devo produzir menos?"
        multiline
        editable={canUseAiAnalysis}
      />

      {!canUseAiAnalysis ? <StateText text={upgradeMessage("ia.analitica")} /> : null}
      <Pressable
        onPress={() => canUseAiAnalysis && analyze.mutate()}
        disabled={!canUseAiAnalysis || analyze.isPending}
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
      {needsLogin ? (
        <Button title="Entrar como dono" tone="soft" icon={<LogIn size={18} color={colors.ink} />} onPress={() => router.push("/login")} />
      ) : null}

      {result ? (
        <View style={styles.result}>
          {result.summary ? (
            <View style={styles.summaryBubble}>
              <Text style={styles.summaryText}>{result.summary}</Text>
            </View>
          ) : null}
          {result.sections.map((section) => (
            <AnalysisSection key={section.title} title={section.title} icon={section.icon} items={section.items} />
          ))}
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

// A forma exata da resposta não está documentada; aproveita os campos
// estruturados quando existem e cai para o texto corrido quando não.
function normalizeAnalysis(response: RespostaAnaliseIA): NormalizedAnalysis {
  const summary =
    firstString(response.resumo, response.analise, response.texto, response.resposta, response.mensagem) || null;

  const sections = [
    { title: "Principais achados", icon: <Sparkles size={16} color={colors.agentDeep} />, items: toList(response.principais_achados) },
    { title: "Mais venderam", icon: <TrendingUp size={16} color={colors.success} />, items: toList(response.mais_venderam) },
    { title: "Mais sobraram", icon: <TrendingDown size={16} color={colors.warning} />, items: toList(response.mais_sobraram) },
    { title: "Sugestões", icon: <Lightbulb size={16} color={colors.brandDeep} />, items: toList(response.sugestoes) },
    { title: "Pontos de atenção", icon: <AlertTriangle size={16} color={colors.danger} />, items: toList(response.pontos_atencao) }
  ].filter((section) => section.items.length > 0);

  return { summary, sections };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item && typeof item === "object" ? summarizeObject(item) : String(item)))
    .filter((item): item is string => Boolean(item && item.trim()));
}

// Objetos das listas da análise (ex.: { produto, quantidade_vendida,
// faturamento } ou { produto, quantidade_sobra }) viram uma linha legível.
function summarizeObject(item: object) {
  const record = item as Record<string, unknown>;
  const rawName = record["produto"] || record["nome_produto"] || record["nome"];
  if (typeof rawName !== "string") return null;
  const name = fixProductName(rawName);

  const details: string[] = [];
  // O backend manda totalVendido/totalSobrando; aceitamos as duas convenções.
  const sold = record["quantidade_vendida"] ?? record["totalVendido"];
  const leftover = record["quantidade_sobra"] ?? record["totalSobrando"];
  const revenue = record["faturamento"] ?? record["faturamento_bruto"];
  const generic = record["quantidade"] ?? record["total"] ?? record["valor"];

  if (typeof sold === "number") details.push(`${sold} vendidos`);
  if (typeof leftover === "number") details.push(`${leftover} sobraram`);
  if (revenue != null && revenue !== "") details.push(formatCurrency(revenue as string));
  if (!details.length && generic != null) details.push(String(generic));

  return details.length ? `${name} — ${details.join(" · ")}` : name;
}

function analysisErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if ([401, 403].includes(error.status)) return "Este servidor pede login de dono para analisar. Entre para continuar.";
    if ([404, 405, 501].includes(error.status)) return "Este servidor ainda não gera análises com IA. Atualize o backend.";
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
