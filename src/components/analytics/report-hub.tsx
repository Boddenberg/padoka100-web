import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { CheckCircle2, ChevronRight, Clock3, FileText, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, StateText } from "@/components/ui";
import { api, friendlyErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import type { AnalyticsReport } from "@/types/api";

const STATUS_LABEL: Record<AnalyticsReport["status"], string> = {
  na_fila: "Na fila",
  processando: "Preparando",
  pronto: "Pronto",
  falhou: "Tentar novamente"
};

function isRunning(report: AnalyticsReport) {
  return report.status === "na_fila" || report.status === "processando";
}

export function AnalyticsReportHub({ start, end }: { start: string; end: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const availability = useQuery({
    queryKey: ["analytics-reports", "availability"],
    queryFn: () => api.analyticsReports.availability()
  });
  const reports = useQuery({
    queryKey: ["analytics-reports", "list"],
    queryFn: () => api.analyticsReports.list(12),
    refetchInterval: (query) => (query.state.data?.some(isRunning) ? 3500 : false)
  });
  const create = useMutation({
    mutationFn: () => api.analyticsReports.create({ data_inicio: start, data_fim: end }),
    onSuccess: async (report) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["analytics-reports"] }),
        queryClient.invalidateQueries({ queryKey: ["notificacoes"] })
      ]);
      router.push(`/relatorio/${report.id}`);
    }
  });

  const allReports = reports.data || [];
  const active = allReports.find(isRunning);
  const history = allReports.filter((item) => !isRunning(item)).slice(0, 3);
  const type = availability.data?.tipo || "analytics";
  const canCreate = availability.data?.pode_solicitar ?? true;
  const nextDate = availability.data?.proxima_solicitacao_em;
  const buttonTitle = active
    ? "Acompanhar preparação"
    : type === "ia"
      ? "Gerar Raio-X com IA"
      : "Gerar Raio-X do período";

  const handlePrimary = () => {
    if (active) {
      router.push(`/relatorio/${active.id}`);
      return;
    }
    create.mutate();
  };

  return (
    <View style={styles.wrapper}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Sparkles size={22} color="#fff" />
          </View>
          <View style={styles.planPill}>
            <Text style={styles.planPillText}>{type === "ia" ? "COM INTELIGÊNCIA ARTIFICIAL" : "ANALYTICS"}</Text>
          </View>
        </View>
        <Text style={styles.heroEyebrow}>NOVO · RAIO-X DO NEGÓCIO</Text>
        <Text style={styles.heroTitle}>Uma leitura completa da sua padoka.</Text>
        <Text style={styles.heroBody}>
          Vendas, produção, sobras, margens e oportunidades reunidas em um relatório bonito, simples e compartilhável.
        </Text>
        <View style={styles.heroFacts}>
          <View style={styles.heroFact}>
            <Clock3 size={15} color="#fff" />
            <Text style={styles.heroFactText}>Você pode sair da tela</Text>
          </View>
          <View style={styles.heroFact}>
            <FileText size={15} color="#fff" />
            <Text style={styles.heroFactText}>PDF incluso</Text>
          </View>
        </View>
        <Button
          title={create.isPending ? "Enviando solicitação..." : buttonTitle}
          tone="soft"
          disabled={create.isPending || (!active && !canCreate)}
          onPress={handlePrimary}
          style={styles.heroButton}
          icon={active ? <Clock3 size={18} color={colors.ink} /> : <Sparkles size={18} color={colors.ink} />}
        />
        <Text style={styles.periodText}>
          Período escolhido: {formatDate(start)} a {formatDate(end)}
        </Text>
      </LinearGradient>

      {active ? (
        <Pressable onPress={() => router.push(`/relatorio/${active.id}`)} style={({ pressed }) => [styles.progressCard, pressed && styles.pressed]}>
          <View style={styles.progressHeader}>
            <View style={styles.progressIcon}>
              <Clock3 size={18} color={colors.brandDeep} />
            </View>
            <View style={styles.progressCopy}>
              <Text style={styles.progressTitle}>{active.etapa}</Text>
              <Text style={styles.progressHint}>Vamos avisar quando estiver pronto.</Text>
            </View>
            <Text style={styles.progressNumber}>{active.progresso}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient colors={gradients.brand} style={[styles.progressFill, { width: `${Math.max(active.progresso, 8)}%` }]} />
          </View>
        </Pressable>
      ) : null}

      {!active && !canCreate ? (
        <View style={styles.cooldownCard}>
          <CheckCircle2 size={20} color={colors.success} />
          <View style={styles.cooldownCopy}>
            <Text style={styles.cooldownTitle}>Seu relatório desta semana já foi gerado</Text>
            <Text style={styles.cooldownText}>
              {nextDate ? `Uma nova solicitação fica disponível em ${formatDate(nextDate)}.` : availability.data?.motivo}
            </Text>
          </View>
        </View>
      ) : null}

      {create.error ? <StateText tone="error" text={friendlyErrorMessage(create.error)} /> : null}
      {reports.error && !reports.data ? <StateText tone="error" text={friendlyErrorMessage(reports.error)} /> : null}

      {history.length ? (
        <View style={styles.historyBlock}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Relatórios recentes</Text>
            <Badge text={`${allReports.length}`} tone="neutral" />
          </View>
          {history.map((report) => (
            <Pressable
              key={report.id}
              onPress={() => (report.status === "pronto" ? router.push(`/relatorio/${report.id}`) : undefined)}
              style={({ pressed }) => [styles.historyRow, pressed && report.status === "pronto" && styles.pressed]}
            >
              <View style={[styles.historyIcon, report.status === "falhou" && styles.historyIconError]}>
                <FileText size={18} color={report.status === "falhou" ? colors.danger : colors.brandDeep} />
              </View>
              <View style={styles.historyCopy}>
                <Text style={styles.historyRowTitle}>{report.titulo || `Relatório de ${formatDate(report.data_inicio)}`}</Text>
                <Text style={styles.historyRowMeta}>
                  {formatDate(report.data_inicio)} a {formatDate(report.data_fim)} · {STATUS_LABEL[report.status]}
                </Text>
              </View>
              {report.status === "pronto" ? <ChevronRight size={20} color={colors.muted} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  hero: { overflow: "hidden", gap: 11, borderRadius: radius.xl, padding: 22, ...shadows.floating },
  glowOne: { position: "absolute", top: -80, right: -55, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(255,255,255,0.12)" },
  glowTwo: { position: "absolute", bottom: -100, left: -50, width: 210, height: 210, borderRadius: 105, backgroundColor: "rgba(255,210,162,0.13)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)" },
  planPill: { borderRadius: radius.pill, backgroundColor: "rgba(47,20,44,0.25)", paddingHorizontal: 11, paddingVertical: 6 },
  planPillText: { color: "#fff", fontSize: 10, letterSpacing: 0.55, fontFamily: fonts.bodyBold },
  heroEyebrow: { marginTop: 4, color: "rgba(255,255,255,0.8)", fontSize: 11, letterSpacing: 1.1, fontFamily: fonts.bodyBold },
  heroTitle: { maxWidth: 430, color: "#fff", fontSize: 28, lineHeight: 31, letterSpacing: -0.8, fontFamily: fonts.display },
  heroBody: { maxWidth: 500, color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 21, fontFamily: fonts.body },
  heroFacts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroFact: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 10, paddingVertical: 6 },
  heroFactText: { color: "#fff", fontSize: 12, fontFamily: fonts.bodyBold },
  heroButton: { marginTop: 3 },
  periodText: { textAlign: "center", color: "rgba(255,255,255,0.76)", fontSize: 12, fontFamily: fonts.bodyBold },
  progressCard: { gap: 11, borderWidth: 1, borderColor: colors.brandSoft, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 15, ...shadows.soft },
  progressHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.brandSoft },
  progressCopy: { flex: 1, gap: 1 },
  progressTitle: { color: colors.ink, fontSize: 15, fontFamily: fonts.bodyBold },
  progressHint: { color: colors.muted, fontSize: 12.5, fontFamily: fonts.body },
  progressNumber: { color: colors.brandDeep, fontSize: 17, fontFamily: fonts.display },
  progressTrack: { overflow: "hidden", height: 8, borderRadius: 4, backgroundColor: colors.brandSoft },
  progressFill: { height: "100%", borderRadius: 4 },
  cooldownCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: radius.lg, backgroundColor: colors.successSoft, padding: 15 },
  cooldownCopy: { flex: 1, gap: 2 },
  cooldownTitle: { color: colors.success, fontSize: 15, fontFamily: fonts.bodyBold },
  cooldownText: { color: colors.ink, fontSize: 13, lineHeight: 18, fontFamily: fonts.body },
  historyBlock: { gap: 8 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3 },
  historyTitle: { color: colors.ink, fontSize: 18, fontFamily: fonts.display },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 13 },
  historyIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.brandSoft },
  historyIconError: { backgroundColor: colors.dangerSoft },
  historyCopy: { flex: 1, gap: 2 },
  historyRowTitle: { color: colors.ink, fontSize: 14, fontFamily: fonts.bodyBold },
  historyRowMeta: { color: colors.muted, fontSize: 12, fontFamily: fonts.body }
});
