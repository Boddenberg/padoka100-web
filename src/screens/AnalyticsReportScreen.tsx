import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Info,
  Lightbulb,
  Minus,
  PackageOpen,
  Receipt,
  Share2,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { Sheet, StateText } from "@/components/ui";
import { api, friendlyErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/settings";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import type {
  AnalyticsComparison,
  AnalyticsDailyPoint,
  AnalyticsProduct,
  AnalyticsReport,
  AnalyticsReportContent
} from "@/types/api";

type HelpContent = {
  title: string;
  description: string;
  example?: string;
};

const HELP = {
  faturamento: {
    title: "Faturamento",
    description: "É todo o dinheiro que entrou com as vendas no período, antes de descontar custos e despesas.",
    example: "Se foram feitas 10 vendas de R$ 20, o faturamento foi de R$ 200."
  },
  lucro: {
    title: "Lucro estimado",
    description: "É o que sobra do faturamento depois de descontar os custos dos produtos que você cadastrou. Chamamos de estimado porque custos não cadastrados não entram na conta.",
    example: "Faturou R$ 200 e os produtos custaram R$ 80: o lucro estimado é R$ 120."
  },
  ticket: {
    title: "Ticket médio",
    description: "É quanto cada venda rendeu, em média. Ele ajuda a entender o tamanho habitual de uma compra.",
    example: "R$ 300 de faturamento em 10 vendas dá um ticket médio de R$ 30."
  },
  eficiencia: {
    title: "Eficiência de venda",
    description: "Mostra qual porcentagem do que foi produzido realmente foi vendida.",
    example: "Produziu 100 unidades e vendeu 80: a eficiência foi de 80%."
  },
  sobras: {
    title: "Sobras",
    description: "São as unidades produzidas que não foram vendidas até o fechamento do dia.",
    example: "Produziu 50 pães e vendeu 45: sobraram 5 unidades, ou 10% da produção."
  },
  produtoLider: {
    title: "Produto líder",
    description: "É o produto que mais trouxe faturamento no período — não necessariamente o que teve o maior número de unidades vendidas.",
    example: "Um bolo pode vender menos unidades que o pão, mas liderar por ter preço maior."
  },
  horarioForte: {
    title: "Horário forte",
    description: "É a hora do dia que concentrou o maior faturamento registrado no período.",
    example: "Se as vendas entre 17h e 18h trouxeram mais dinheiro, 17h aparece como horário forte."
  },
  evolucao: {
    title: "Evolução do faturamento",
    description: "A linha liga o faturamento de cada dia e mostra quando as vendas subiram ou caíram. As linhas horizontais ajudam a comparar os valores, e os balões destacam os maiores picos."
  },
  participacao: {
    title: "Participação nas vendas",
    description: "Cada fatia mostra quanto um produto representou do faturamento total. Quanto maior a fatia, maior a contribuição daquele produto para o dinheiro que entrou."
  },
  comparacao: {
    title: "Comparação de períodos",
    description: "Compara o período escolhido com outro período anterior de mesmo tamanho, mostrando o que aumentou, diminuiu ou ficou estável."
  },
  producao: {
    title: "Venda e sobra",
    description: "Compara tudo o que foi produzido com o que foi vendido e o que terminou como sobra. Serve para ajustar a quantidade produzida nos próximos dias."
  },
  ranking: {
    title: "Ranking de produtos",
    description: "Ordena os produtos pelo faturamento e também mostra unidades vendidas, participação nas vendas e sobras."
  },
  qualidade: {
    title: "Qualidade da leitura",
    description: "Indica quanto dos dados necessários estava preenchido. Mais dias registrados e mais produtos com custo cadastrado tornam as conclusões mais confiáveis."
  }
} satisfies Record<string, HelpContent>;

const PIE_COLORS = [colors.brand, colors.agent, colors.success, colors.warning, colors.danger, colors.muted];

export function AnalyticsReportScreen({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const query = useQuery({
    queryKey: ["analytics-reports", reportId],
    queryFn: () => api.analyticsReports.get(reportId),
    refetchInterval: (current) => {
      const status = current.state.data?.status;
      return status === "na_fila" || status === "processando" ? 3000 : false;
    }
  });
  const report = query.data;
  const exportUrl = resolveMediaUrl(report?.url_exportacao);
  const chartWidth = Math.min(Math.max(width - 64, 270), 680);

  async function openPdf() {
    if (!exportUrl) return;
    await Linking.openURL(exportUrl);
  }

  async function shareReport() {
    if (!report || !exportUrl) return;
    try {
      const webNavigator = globalThis.navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (Platform.OS === "web" && webNavigator.share) {
        await webNavigator.share({ title: report.titulo || "Raio-X da Padoka", url: exportUrl });
        return;
      }
      await Share.share({
        title: report.titulo || "Raio-X da Padoka",
        message: `${report.titulo || "Meu Raio-X da Padoka"}\n${exportUrl}`,
        url: exportUrl
      });
    } catch {
      Alert.alert("Não foi possível compartilhar", "Você ainda pode abrir o PDF e enviá-lo pelo aplicativo que preferir.");
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.topSafe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]} accessibilityLabel="Voltar">
            <ArrowLeft size={21} color={colors.ink} />
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={styles.topEyebrow}>PADOKA ANALYTICS</Text>
            <Text style={styles.topTitle} numberOfLines={1}>{report?.titulo || "Raio-X do negócio"}</Text>
          </View>
          {report?.status === "pronto" ? (
            <View style={styles.topActions}>
              <Pressable onPress={shareReport} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]} accessibilityLabel="Compartilhar relatório">
                <Share2 size={20} color={colors.ink} />
              </Pressable>
              <Pressable onPress={openPdf} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]} accessibilityLabel="Abrir PDF">
                <Download size={20} color={colors.ink} />
              </Pressable>
            </View>
          ) : <View style={styles.topPlaceholder} />}
        </View>
      </SafeAreaView>

      {query.isLoading ? (
        <View style={styles.centerState}><StateText text="Abrindo seu relatório..." /></View>
      ) : query.error ? (
        <View style={styles.centerState}><StateText tone="error" text={friendlyErrorMessage(query.error)} /></View>
      ) : report?.status === "na_fila" || report?.status === "processando" ? (
        <ProcessingReport report={report} />
      ) : report?.status === "falhou" ? (
        <FailedReport report={report} onBack={() => router.back()} />
      ) : report?.conteudo ? (
        <ReadyReport report={report} content={report.conteudo} chartWidth={chartWidth} onPdf={openPdf} onShare={shareReport} />
      ) : (
        <View style={styles.centerState}><StateText tone="error" text="O conteúdo deste relatório ainda não está disponível." /></View>
      )}
    </View>
  );
}

function ProcessingReport({ report }: { report: AnalyticsReport }) {
  return (
    <ScrollView contentContainerStyle={styles.processingPage} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={gradients.hero} style={styles.processingHero}>
        <View style={styles.processingHaloOuter}><View style={styles.processingHaloInner}><Sparkles size={38} color="#fff" /></View></View>
        <Text style={styles.processingEyebrow}>SEU RELATÓRIO ESTÁ A CAMINHO</Text>
        <Text style={styles.processingTitle}>{report.etapa}</Text>
        <Text style={styles.processingBody}>Pode continuar usando o aplicativo. Vamos colocar um aviso no sino quando tudo estiver pronto.</Text>
        <View style={styles.processingProgressTrack}><View style={[styles.processingProgressFill, { width: `${Math.max(report.progresso, 8)}%` }]} /></View>
        <Text style={styles.processingPercent}>{report.progresso}% concluído</Text>
      </LinearGradient>
      <View style={styles.processingSteps}>
        <ProcessStep done title="Solicitação recebida" text={`${formatDate(report.data_inicio)} a ${formatDate(report.data_fim)}`} />
        <ProcessStep done={report.progresso >= 30} title="Dados organizados" text="Vendas, produção, custos e sobras" />
        <ProcessStep done={report.progresso >= 62} title="Padrões encontrados" text="Comparações e oportunidades" />
        <ProcessStep done={report.progresso >= 100} title="Relatório finalizado" text="Visualização e PDF compartilhável" last />
      </View>
    </ScrollView>
  );
}

function ProcessStep({ done, title, text, last }: { done: boolean; title: string; text: string; last?: boolean }) {
  return (
    <View style={styles.processStep}>
      <View style={styles.processRail}>
        <View style={[styles.processDot, done && styles.processDotDone]}>{done ? <CheckCircle2 size={18} color="#fff" /> : <Clock3 size={17} color={colors.muted} />}</View>
        {!last ? <View style={[styles.processLine, done && styles.processLineDone]} /> : null}
      </View>
      <View style={styles.processCopy}><Text style={styles.processTitle}>{title}</Text><Text style={styles.processText}>{text}</Text></View>
    </View>
  );
}

function FailedReport({ report, onBack }: { report: AnalyticsReport; onBack: () => void }) {
  return (
    <View style={styles.centerState}>
      <View style={styles.failedIcon}><AlertTriangle size={30} color={colors.danger} /></View>
      <Text style={styles.failedTitle}>Este relatório não ficou pronto</Text>
      <Text style={styles.failedText}>{report.erro || "Tivemos uma instabilidade. Você já pode solicitar uma nova tentativa."}</Text>
      <Pressable onPress={onBack} style={({ pressed }) => [styles.backCta, pressed && styles.pressed]}><Text style={styles.backCtaText}>Voltar ao Analytics</Text></Pressable>
    </View>
  );
}

function ReadyReport({ report, content, chartWidth, onPdf, onShare }: { report: AnalyticsReport; content: AnalyticsReportContent; chartWidth: number; onPdf: () => void; onShare: () => void }) {
  const indicators = content.indicadores;
  const bestProduct = content.rankings.mais_vendidos[0];
  const peakHour = useMemo(() => [...content.horarios].sort((a, b) => b.faturamento - a.faturamento)[0], [content.horarios]);
  const [help, setHelp] = useState<HelpContent | null>(null);
  const openHelp = (contentHelp: HelpContent) => setHelp(contentHelp);
  return (
    <>
      <ScrollView contentContainerStyle={styles.reportScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.reportPage}>
        <LinearGradient colors={["#2d160e", "#74321f", "#d65425"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reportHero}>
          <View style={styles.reportHeroOrb} />
          <View style={styles.reportHeroTop}>
            <View style={styles.reportTypePill}><Sparkles size={14} color="#ffd8c1" /><Text style={styles.reportTypeText}>{report.tipo === "ia" ? "RELATÓRIO COM IA" : "RELATÓRIO ANALYTICS"}</Text></View>
            <Text style={styles.reportVersion}>RAIO-X · V{content.versao}</Text>
          </View>
          <Text style={styles.reportHeroEyebrow}>O RETRATO DO SEU NEGÓCIO</Text>
          <Text style={styles.reportHeroTitle}>{formatDate(content.periodo.inicio)} a {formatDate(content.periodo.fim)}</Text>
          <Text style={styles.reportHeroBody}>{content.periodo.dias_com_operacao} dias com operação · {content.qualidade_dados.produtos_analisados} produtos analisados</Text>
          <View style={styles.reportHeroRevenue}>
            <View style={styles.reportHeroLabelRow}>
              <Text style={styles.reportHeroLabel}>FATURAMENTO</Text>
              <InfoButton label="Entenda o faturamento" onPress={() => openHelp(HELP.faturamento)} inverse />
            </View>
            <Text style={styles.reportHeroMoney}>{formatCurrency(indicators.faturamento)}</Text>
          </View>
          <ComparisonSentence comparison={content.comparacao.faturamento} />
        </LinearGradient>

        <SectionHeading eyebrow="VISÃO GERAL" title="Seis números para entender o período" subtitle="O essencial antes de entrar nos detalhes." />
        <View style={styles.kpiGrid}>
          <KpiCard icon={<Receipt size={19} color={colors.success} />} label="Lucro estimado" value={formatCurrency(indicators.lucro_estimado)} note={`${formatPercent(indicators.margem_percentual)} de margem`} tone="green" help={HELP.lucro} onHelp={openHelp} />
          <KpiCard icon={<ShoppingBag size={19} color={colors.brandDeep} />} label="Ticket médio" value={formatCurrency(indicators.ticket_medio)} note={`${indicators.quantidade_vendas} vendas`} tone="orange" help={HELP.ticket} onHelp={openHelp} />
          <KpiCard icon={<Target size={19} color={colors.agentDeep} />} label="Eficiência" value={formatPercent(indicators.eficiencia_venda_percentual)} note={`${indicators.unidades_vendidas} de ${indicators.unidades_produzidas} un.`} tone="purple" help={HELP.eficiencia} onHelp={openHelp} />
          <KpiCard icon={<PackageOpen size={19} color={colors.warning} />} label="Sobras" value={`${indicators.unidades_sobrando} un.`} note={`${formatPercent(indicators.indice_sobra_percentual)} da produção`} tone="yellow" help={HELP.sobras} onHelp={openHelp} />
          <KpiCard icon={<Trophy size={19} color={colors.brandDeep} />} label="Produto líder" value={bestProduct?.nome || "Sem vendas"} note={bestProduct ? `${bestProduct.vendido} unidades` : "Registre mais dias"} tone="orange" compact help={HELP.produtoLider} onHelp={openHelp} />
          <KpiCard icon={<Clock3 size={19} color={colors.success} />} label="Horário forte" value={peakHour ? `${String(peakHour.hora).padStart(2, "0")}h` : "Sem padrão"} note={peakHour ? `${peakHour.vendas} vendas` : "Mais dados ajudam"} tone="green" help={HELP.horarioForte} onHelp={openHelp} />
        </View>

        <SectionHeading eyebrow="EVOLUÇÃO" title="Como o faturamento se movimentou" subtitle="Cada ponto representa um dia com operação." help={HELP.evolucao} onHelp={openHelp} />
        <View style={styles.chartCard}><RevenueChart data={content.serie_diaria} width={chartWidth} /></View>

        <SectionHeading eyebrow="PARTICIPAÇÃO NAS VENDAS" title="De onde veio o faturamento" subtitle="Cada fatia representa a contribuição de um produto nas vendas." help={HELP.participacao} onHelp={openHelp} />
        <View style={styles.pieCard}><SalesPieChart products={content.produtos} /></View>

        <SectionHeading eyebrow="COMPARAÇÃO" title="O que mudou de um período para o outro" help={HELP.comparacao} onHelp={openHelp} />
        <View style={styles.comparisonGrid}>
          <ComparisonCard label="Faturamento" comparison={content.comparacao.faturamento} format="money" />
          <ComparisonCard label="Lucro estimado" comparison={content.comparacao.lucro} format="money" />
          <ComparisonCard label="Unidades vendidas" comparison={content.comparacao.unidades_vendidas} format="number" />
          <ComparisonCard label="Ticket médio" comparison={content.comparacao.ticket_medio} format="money" />
        </View>

        <SectionHeading eyebrow="PRODUÇÃO" title="Venda e sobra, lado a lado" subtitle="Uma leitura rápida do aproveitamento da produção." help={HELP.producao} onHelp={openHelp} />
        <View style={styles.efficiencyCard}>
          <Donut value={indicators.eficiencia_venda_percentual} />
          <View style={styles.efficiencyCopy}>
            <Text style={styles.efficiencyTitle}>Eficiência de venda</Text>
            <Text style={styles.efficiencyBody}>De {indicators.unidades_produzidas} unidades disponíveis, {indicators.unidades_vendidas} foram vendidas e {indicators.unidades_sobrando} ficaram de sobra.</Text>
            <View style={styles.miniStats}>
              <MiniStat label="Reaproveitadas" value={indicators.sobras_reaproveitadas} color={colors.success} />
              <MiniStat label="Descartadas" value={indicators.sobras_descartadas} color={colors.danger} />
            </View>
          </View>
        </View>

        <SectionHeading eyebrow="PRODUTOS" title="Quem puxou o resultado" subtitle="Ranking por faturamento, com participação e eficiência." help={HELP.ranking} onHelp={openHelp} />
        <View style={styles.rankingCard}><ProductRanking products={content.produtos.slice(0, 8)} /></View>

        {content.desempenho_semana.length ? <><SectionHeading eyebrow="RITMO DA SEMANA" title="Dias que merecem atenção" /><View style={styles.weekCard}><WeekBars data={content.desempenho_semana} /></View></> : null}

        {content.ia ? <AiReading reading={content.ia} /> : null}

        <SectionHeading eyebrow="PRÓXIMOS PASSOS" title="O que vale testar agora" subtitle="Sugestões simples, baseadas nos números deste relatório." />
        <View style={styles.actionsCard}>
          {content.oportunidades.map((item, index) => <ActionRow key={`${item.impacto}-${index}`} index={index + 1} title={item.titulo} text={item.descricao} />)}
          {!content.oportunidades.length ? <Text style={styles.emptyInsight}>Registre mais dias para receber oportunidades específicas.</Text> : null}
        </View>

        {content.alertas.length ? <><SectionHeading eyebrow="PONTOS DE ATENÇÃO" title="Sinais para acompanhar" /><View style={styles.alertsCard}>{content.alertas.map((item, index) => <View key={`${item.titulo}-${index}`} style={styles.alertRow}><View style={styles.alertIcon}><AlertTriangle size={18} color={colors.danger} /></View><View style={styles.alertCopy}><Text style={styles.alertTitle}>{item.titulo}</Text><Text style={styles.alertText}>{item.descricao}</Text></View></View>)}</View></> : null}

        <SectionHeading eyebrow="CONFIANÇA" title="Qualidade desta leitura" help={HELP.qualidade} onHelp={openHelp} />
        <View style={styles.qualityCard}>
          <View style={styles.qualityTop}><View><Text style={styles.qualityScore}>{content.qualidade_dados.score}<Text style={styles.qualityOver}>/100</Text></Text><Text style={styles.qualityLevel}>Base {content.qualidade_dados.nivel}</Text></View><FileText size={31} color={colors.brandDeep} /></View>
          <View style={styles.qualityTrack}><View style={[styles.qualityFill, { width: `${content.qualidade_dados.score}%` }]} /></View>
          <Text style={styles.qualityText}>{content.qualidade_dados.mensagem}</Text>
          <Text style={styles.qualityMeta}>{content.qualidade_dados.dias_analisados} dias · {formatPercent(content.qualidade_dados.cobertura_custos_percentual)} dos produtos vendidos com custo</Text>
        </View>

        <LinearGradient colors={gradients.glow} style={styles.exportCard}>
          <View style={styles.exportIcon}><FileText size={26} color={colors.brandDeep} /></View>
          <Text style={styles.exportTitle}>Leve este Raio-X com você</Text>
          <Text style={styles.exportBody}>O PDF mantém os gráficos, indicadores e recomendações para você guardar ou compartilhar.</Text>
          <View style={styles.exportButtons}>
            <Pressable onPress={onPdf} style={({ pressed }) => [styles.primaryExport, pressed && styles.pressed]}><Download size={18} color="#fff" /><Text style={styles.primaryExportText}>Abrir PDF</Text></Pressable>
            <Pressable onPress={onShare} style={({ pressed }) => [styles.secondaryExport, pressed && styles.pressed]}><Share2 size={18} color={colors.brandDeep} /><Text style={styles.secondaryExportText}>Compartilhar</Text></Pressable>
          </View>
        </LinearGradient>

        <View style={styles.methodology}><Text style={styles.methodologyTitle}>Como calculamos</Text>{content.metodologia.map((item, index) => <Text key={index} style={styles.methodologyText}>• {item}</Text>)}</View>
        </View>
      </ScrollView>
      <Sheet
        visible={Boolean(help)}
        title={help?.title || "Entenda este dado"}
        subtitle="Explicado de um jeito simples"
        onClose={() => setHelp(null)}
        headerAccent={<View style={styles.helpHeaderIcon}><Info size={21} color={colors.brandDeep} /></View>}
      >
        <Text style={styles.helpDescription}>{help?.description}</Text>
        {help?.example ? (
          <View style={styles.helpExample}>
            <Lightbulb size={20} color={colors.warning} />
            <View style={styles.helpExampleCopy}>
              <Text style={styles.helpExampleLabel}>EXEMPLO SIMPLES</Text>
              <Text style={styles.helpExampleText}>{help.example}</Text>
            </View>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

function InfoButton({ label, onPress, inverse }: { label: string; onPress: () => void; inverse?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre uma explicação simples"
      style={({ pressed }) => [styles.infoButton, inverse && styles.infoButtonInverse, pressed && styles.infoButtonPressed]}
    >
      <Info size={14} color={inverse ? "#fff" : colors.brandDeep} />
    </Pressable>
  );
}

function SectionHeading({ eyebrow, title, subtitle, help, onHelp }: { eyebrow: string; title: string; subtitle?: string; help?: HelpContent; onHelp?: (help: HelpContent) => void }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {help && onHelp ? <InfoButton label={`Entenda: ${title}`} onPress={() => onHelp(help)} /> : null}
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function ComparisonSentence({ comparison }: { comparison: AnalyticsComparison }) {
  if (comparison.variacao_percentual == null) return <Text style={styles.heroComparison}>Primeira base comparável registrada.</Text>;
  const up = comparison.diferenca > 0;
  const equal = comparison.diferenca === 0;
  return <View style={styles.heroComparisonRow}>{equal ? <Minus size={16} color="#fff" /> : up ? <ArrowUpRight size={16} color="#b9f6d9" /> : <ArrowDownRight size={16} color="#ffd0ca" />}<Text style={styles.heroComparison}>{equal ? "Mesmo resultado do período anterior" : `${formatPercent(Math.abs(comparison.variacao_percentual))} ${up ? "acima" : "abaixo"} do período anterior`}</Text></View>;
}

function KpiCard({ icon, label, value, note, tone, compact, help, onHelp }: { icon: React.ReactNode; label: string; value: string; note: string; tone: "green" | "orange" | "purple" | "yellow"; compact?: boolean; help: HelpContent; onHelp: (help: HelpContent) => void }) {
  return <View style={[styles.kpiCard, styles[`kpi_${tone}`]]}><View style={styles.kpiHeader}>{icon}<Text style={styles.kpiLabel}>{label}</Text><InfoButton label={`Entenda: ${label}`} onPress={() => onHelp(help)} /></View><Text style={[styles.kpiValue, compact && styles.kpiValueCompact]} numberOfLines={compact ? 2 : 1}>{value}</Text><Text style={styles.kpiNote}>{note}</Text></View>;
}

function RevenueChart({ data, width }: { data: AnalyticsDailyPoint[]; width: number }) {
  const height = 254;
  const padLeft = 57;
  const padRight = 18;
  const padTop = 38;
  const padBottom = 36;
  if (!data.length) return <View style={[styles.chartEmpty, { width }]}><Text style={styles.chartEmptyTitle}>Ainda sem movimento neste período</Text><Text style={styles.chartEmptyText}>As vendas aparecem aqui conforme você registra os dias.</Text></View>;
  const max = Math.max(...data.map((item) => item.faturamento), 1);
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const points = data.map((item, index) => ({
    x: data.length === 1 ? padLeft + innerWidth / 2 : padLeft + (innerWidth * index) / (data.length - 1),
    y: padTop + innerHeight - (item.faturamento / max) * innerHeight
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const baseline = padTop + innerHeight;
  const area = `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
  const labels = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const sortedIndexes = data.map((_, index) => index).sort((a, b) => data[b].faturamento - data[a].faturamento);
  const peakIndexes = sortedIndexes.reduce<number[]>((selected, index) => {
    if (selected.length >= 2 || data[index].faturamento <= 0) return selected;
    if (!selected.some((selectedIndex) => Math.abs(points[selectedIndex].x - points[index].x) < 82)) selected.push(index);
    return selected;
  }, []);
  const peak = data[sortedIndexes[0]];
  const average = data.reduce((sum, item) => sum + item.faturamento, 0) / data.length;

  return (
    <View style={[styles.revenueChart, { width }]}>
      <Svg
        width={width}
        height={height}
        accessibilityRole="image"
        accessibilityLabel={`Evolução do faturamento em ${data.length} dias. Maior pico de ${formatCurrency(peak.faturamento)}.`}
      >
        <Defs><SvgGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.brand} stopOpacity="0.28" /><Stop offset="1" stopColor={colors.brand} stopOpacity="0.02" /></SvgGradient></Defs>
        {yTicks.map((tick) => {
          const y = padTop + innerHeight - tick * innerHeight;
          return (
            <G key={tick}>
              <Line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke={tick === 0 ? colors.muted : colors.border} strokeWidth={tick === 0 ? 1.3 : 1} />
              <SvgText x={padLeft - 7} y={y + 3} fill={colors.muted} fontSize={8.5} fontFamily={fonts.bodyBold} textAnchor="end">{formatAxisCurrency(max * tick)}</SvgText>
            </G>
          );
        })}
        <Path d={area} fill="url(#chartFill)" />
        <Path d={line} fill="none" stroke={colors.brandDeep} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r={peakIndexes.includes(index) ? 5 : 3} fill={colors.surface} stroke={colors.brandDeep} strokeWidth={2} />)}
        {peakIndexes.map((index) => {
          const point = points[index];
          const labelX = Math.max(padLeft + 39, Math.min(point.x, width - padRight - 39));
          const labelY = Math.max(20, point.y - 22);
          return (
            <G key={`peak-${index}`}>
              <Line x1={point.x} y1={point.y - 5} x2={labelX} y2={labelY + 2} stroke={colors.brandDeep} strokeWidth={1} />
              <Rect x={labelX - 39} y={labelY - 15} width={78} height={19} rx={9.5} fill={colors.ink} />
              <SvgText x={labelX} y={labelY - 2} fill="#fff" fontSize={8.5} fontFamily={fonts.bodyBold} textAnchor="middle">{formatAxisCurrency(data[index].faturamento)}</SvgText>
            </G>
          );
        })}
        {labels.map((index) => {
          const anchor = index === 0 ? "start" : index === data.length - 1 ? "end" : "middle";
          return <SvgText key={`date-${index}`} x={points[index].x} y={height - 10} fill={colors.muted} fontSize={9.5} fontFamily={fonts.bodyBold} textAnchor={anchor}>{formatDate(data[index].data).slice(0, 5)}</SvgText>;
        })}
      </Svg>
      <View style={styles.chartSummary}>
        <View style={styles.chartSummaryItem}><Text style={styles.chartSummaryLabel}>MAIOR PICO</Text><Text style={styles.chartSummaryValue}>{formatCurrency(peak.faturamento)}</Text><Text style={styles.chartSummaryHint}>{formatDate(peak.data)}</Text></View>
        <View style={styles.chartSummaryDivider} />
        <View style={styles.chartSummaryItem}><Text style={styles.chartSummaryLabel}>MÉDIA POR DIA</Text><Text style={styles.chartSummaryValue}>{formatCurrency(average)}</Text><Text style={styles.chartSummaryHint}>{data.length} dias analisados</Text></View>
      </View>
    </View>
  );
}

function pieSlicePath(cx: number, cy: number, radiusValue: number, startAngle: number, endAngle: number) {
  const startX = cx + radiusValue * Math.cos(startAngle);
  const startY = cy + radiusValue * Math.sin(startAngle);
  const endX = cx + radiusValue * Math.cos(endAngle);
  const endY = cy + radiusValue * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${radiusValue} ${radiusValue} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function SalesPieChart({ products }: { products: AnalyticsProduct[] }) {
  const positive = [...products].filter((product) => product.faturamento > 0).sort((a, b) => b.faturamento - a.faturamento);
  const total = positive.reduce((sum, product) => sum + product.faturamento, 0);
  if (!total) return <View style={styles.pieEmpty}><ShoppingBag size={28} color={colors.muted} /><Text style={styles.chartEmptyTitle}>Ainda sem vendas para dividir</Text><Text style={styles.chartEmptyText}>As fatias aparecem quando houver faturamento por produto.</Text></View>;

  const mainProducts = positive.slice(0, 5);
  const otherValue = positive.slice(5).reduce((sum, product) => sum + product.faturamento, 0);
  const entries = [
    ...mainProducts.map((product) => ({ label: product.nome, value: product.faturamento })),
    ...(otherValue > 0 ? [{ label: "Outros produtos", value: otherValue }] : [])
  ];
  let cursor = -Math.PI / 2;
  const slices = entries.map((entry, index) => {
    const startAngle = cursor;
    const endAngle = cursor + (entry.value / total) * Math.PI * 2;
    cursor = endAngle;
    return { ...entry, startAngle, endAngle, color: PIE_COLORS[index % PIE_COLORS.length], percent: entry.value / total * 100 };
  });
  const size = 176;
  const radiusValue = 82;

  return (
    <View style={styles.pieLayout}>
      <View style={styles.pieVisual}>
        <Svg width={size} height={size} accessibilityRole="image" accessibilityLabel={`Gráfico de pizza das vendas, total de ${formatCurrency(total)}.`}>
          {slices.map((slice) => slice.percent > 99.99
            ? <Circle key={slice.label} cx={size / 2} cy={size / 2} r={radiusValue} fill={slice.color} stroke={colors.surface} strokeWidth={2} />
            : <Path key={slice.label} d={pieSlicePath(size / 2, size / 2, radiusValue, slice.startAngle, slice.endAngle)} fill={slice.color} stroke={colors.surface} strokeWidth={2} />)}
        </Svg>
        <Text style={styles.pieCaption}>Total {formatCurrency(total)}</Text>
      </View>
      <View style={styles.pieLegend}>
        {slices.map((slice) => (
          <View key={slice.label} style={styles.pieLegendRow}>
            <View style={[styles.pieLegendDot, { backgroundColor: slice.color }]} />
            <View style={styles.pieLegendCopy}>
              <Text style={styles.pieLegendName} numberOfLines={1}>{slice.label}</Text>
              <Text style={styles.pieLegendValue}>{formatCurrency(slice.value)}</Text>
            </View>
            <Text style={styles.pieLegendPercent}>{formatPercent(slice.percent)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ComparisonCard({ label, comparison, format }: { label: string; comparison: AnalyticsComparison; format: "money" | "number" }) {
  const positive = comparison.diferenca > 0;
  const equal = comparison.diferenca === 0;
  const value = format === "money" ? formatCurrency(comparison.atual) : String(Math.round(comparison.atual));
  const diff = format === "money" ? formatCurrency(Math.abs(comparison.diferenca)) : String(Math.round(Math.abs(comparison.diferenca)));
  return <View style={styles.comparisonCard}><Text style={styles.comparisonLabel}>{label}</Text><Text style={styles.comparisonValue}>{value}</Text><View style={[styles.comparisonPill, positive ? styles.comparisonPositive : equal ? styles.comparisonNeutral : styles.comparisonNegative]}>{positive ? <ArrowUpRight size={14} color={colors.success} /> : equal ? <Minus size={14} color={colors.muted} /> : <ArrowDownRight size={14} color={colors.danger} />}<Text style={[styles.comparisonPillText, { color: positive ? colors.success : equal ? colors.muted : colors.danger }]}>{comparison.variacao_percentual == null ? "nova base" : equal ? "sem mudança" : `${diff} ${positive ? "a mais" : "a menos"}`}</Text></View></View>;
}

function Donut({ value }: { value: number }) {
  const size = 130;
  const stroke = 14;
  const radiusValue = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const safeValue = Math.max(0, Math.min(value, 100));
  return <View style={styles.donutWrap}><Svg width={size} height={size}><Circle cx={size / 2} cy={size / 2} r={radiusValue} stroke={colors.brandSoft} strokeWidth={stroke} fill="none" /><Circle cx={size / 2} cy={size / 2} r={radiusValue} stroke={colors.success} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference * safeValue / 100} ${circumference}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /></Svg><View style={styles.donutCenter}><Text style={styles.donutValue}>{Math.round(safeValue)}%</Text><Text style={styles.donutLabel}>vendido</Text></View></View>;
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) { return <View style={styles.miniStat}><View style={[styles.miniDot, { backgroundColor: color }]} /><Text style={styles.miniText}><Text style={styles.miniValue}>{value}</Text> {label}</Text></View>; }

function ProductRanking({ products }: { products: AnalyticsProduct[] }) {
  const max = Math.max(...products.map((item) => item.faturamento), 1);
  if (!products.length) return <Text style={styles.emptyInsight}>Ainda não há produtos vendidos neste período.</Text>;
  return <>{products.map((product, index) => <View key={product.produto_id || `${product.nome}-${index}`} style={styles.productRow}><View style={styles.productRank}><Text style={styles.productRankText}>{index + 1}</Text></View><View style={styles.productBody}><View style={styles.productTop}><Text style={styles.productName} numberOfLines={1}>{product.nome}</Text><Text style={styles.productRevenue}>{formatCurrency(product.faturamento)}</Text></View><View style={styles.productTrack}><LinearGradient colors={index === 0 ? gradients.brand : [colors.brandSoft, colors.brand] as const} style={[styles.productFill, { width: `${Math.max(5, product.faturamento / max * 100)}%` }]} /></View><Text style={styles.productMeta}>{product.vendido} vendidos · {formatPercent(product.participacao_percentual)} do faturamento · {product.sobra} sobras</Text></View></View>)}</>;
}

function WeekBars({ data }: { data: AnalyticsReportContent["desempenho_semana"] }) {
  const max = Math.max(...data.map((item) => item.media_faturamento), 1);
  return <View style={styles.weekBars}>{data.map((item) => <View key={item.dia} style={styles.weekItem}><Text style={styles.weekValue}>{formatCompactCurrency(item.media_faturamento)}</Text><View style={styles.weekTrack}><LinearGradient colors={gradients.brand} style={[styles.weekFill, { height: `${Math.max(7, item.media_faturamento / max * 100)}%` }]} /></View><Text style={styles.weekLabel}>{item.dia.slice(0, 3)}</Text></View>)}</View>;
}

function AiReading({ reading }: { reading: NonNullable<AnalyticsReportContent["ia"]> }) {
  return <LinearGradient colors={["#2f1559", "#5d2ca7", "#7d4ed0"]} style={styles.aiCard}><View style={styles.aiTop}><View style={styles.aiIcon}><Sparkles size={21} color="#fff" /></View><View style={styles.aiTitleCopy}><Text style={styles.aiEyebrow}>LEITURA ESTRATÉGICA</Text><Text style={styles.aiTitle}>O Pãozinho analisou seus números</Text></View></View><Text style={styles.aiSummary}>{reading.resumo}</Text>{reading.principais_achados.length ? <View style={styles.aiBlock}><Text style={styles.aiBlockTitle}>O que mais chamou atenção</Text>{reading.principais_achados.map((item, index) => <View key={index} style={styles.aiBullet}><View style={styles.aiBulletDot} /><Text style={styles.aiBulletText}>{item}</Text></View>)}</View> : null}{reading.acoes_recomendadas.length ? <View style={styles.aiBlock}><Text style={styles.aiBlockTitle}>Ações sugeridas</Text>{reading.acoes_recomendadas.map((item, index) => <View key={index} style={styles.aiAction}><Text style={styles.aiActionNumber}>{index + 1}</Text><Text style={styles.aiBulletText}>{item}</Text></View>)}</View> : null}{reading.limitacao ? <Text style={styles.aiLimitation}>{reading.limitacao}</Text> : null}</LinearGradient>;
}

function ActionRow({ index, title, text }: { index: number; title: string; text: string }) { return <View style={styles.actionRow}><View style={styles.actionNumber}><Text style={styles.actionNumberText}>{index}</Text></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionText}>{text}</Text></View><Lightbulb size={19} color={colors.warning} /></View>; }

function formatPercent(value: number | null | undefined) { return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`; }
function formatCompactCurrency(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(value || 0); }
function formatAxisCurrency(value: number) { return formatCompactCurrency(value).replace(/\u00a0/g, " "); }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topSafe: { backgroundColor: colors.surface },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  topBar: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: Platform.OS === "web" ? 6 : 0 },
  topButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 21, backgroundColor: colors.surfaceGlow },
  topCopy: { flex: 1, gap: 1 }, topEyebrow: { color: colors.brandDeep, fontSize: 9, letterSpacing: 1, fontFamily: fonts.bodyBold }, topTitle: { color: colors.ink, fontSize: 15, fontFamily: fonts.display },
  topActions: { flexDirection: "row", gap: 7 }, topPlaceholder: { width: 42 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  processingPage: { flexGrow: 1, alignItems: "center", gap: 20, padding: 20 },
  processingHero: { width: "100%", maxWidth: 650, alignItems: "center", gap: 12, overflow: "hidden", borderRadius: radius.xl, padding: 28, ...shadows.floating },
  processingHaloOuter: { width: 112, height: 112, alignItems: "center", justifyContent: "center", borderRadius: 56, backgroundColor: "rgba(255,255,255,0.12)" },
  processingHaloInner: { width: 78, height: 78, alignItems: "center", justifyContent: "center", borderRadius: 39, backgroundColor: "rgba(255,255,255,0.2)" },
  processingEyebrow: { color: "rgba(255,255,255,0.76)", fontSize: 10, letterSpacing: 1.2, fontFamily: fonts.bodyBold },
  processingTitle: { color: "#fff", textAlign: "center", fontSize: 26, lineHeight: 31, fontFamily: fonts.display },
  processingBody: { maxWidth: 470, color: "rgba(255,255,255,0.9)", textAlign: "center", fontSize: 15, lineHeight: 22, fontFamily: fonts.body },
  processingProgressTrack: { width: "100%", height: 10, overflow: "hidden", borderRadius: 5, backgroundColor: "rgba(255,255,255,0.18)" },
  processingProgressFill: { height: "100%", borderRadius: 5, backgroundColor: "#fff" }, processingPercent: { color: "#fff", fontSize: 13, fontFamily: fonts.bodyBold },
  processingSteps: { width: "100%", maxWidth: 590, borderRadius: radius.xl, backgroundColor: colors.surface, padding: 22, ...shadows.soft },
  processStep: { minHeight: 76, flexDirection: "row", gap: 13 }, processRail: { width: 34, alignItems: "center" },
  processDot: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: colors.surfaceWarm }, processDotDone: { backgroundColor: colors.success },
  processLine: { flex: 1, width: 2, backgroundColor: colors.border }, processLineDone: { backgroundColor: colors.successSoft }, processCopy: { flex: 1, gap: 3, paddingTop: 4 },
  processTitle: { color: colors.ink, fontSize: 15, fontFamily: fonts.bodyBold }, processText: { color: colors.muted, fontSize: 13, fontFamily: fonts.body },
  failedIcon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 32, backgroundColor: colors.dangerSoft }, failedTitle: { color: colors.ink, textAlign: "center", fontSize: 23, fontFamily: fonts.display }, failedText: { maxWidth: 430, color: colors.muted, textAlign: "center", fontSize: 15, lineHeight: 22, fontFamily: fonts.body },
  backCta: { borderRadius: radius.pill, backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 12 }, backCtaText: { color: "#fff", fontSize: 14, fontFamily: fonts.bodyBold },
  reportScroll: { paddingBottom: 40 }, reportPage: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 14, padding: 18 },
  reportHero: { overflow: "hidden", gap: 10, borderRadius: radius.xl, padding: 24, ...shadows.floating }, reportHeroOrb: { position: "absolute", right: -75, bottom: -90, width: 230, height: 230, borderRadius: 115, backgroundColor: "rgba(255,194,151,0.14)" },
  reportHeroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, reportTypePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.13)", paddingHorizontal: 10, paddingVertical: 6 }, reportTypeText: { color: "#ffe2d0", fontSize: 9.5, letterSpacing: 0.6, fontFamily: fonts.bodyBold }, reportVersion: { color: "rgba(255,255,255,0.54)", fontSize: 9.5, fontFamily: fonts.bodyBold },
  reportHeroEyebrow: { marginTop: 10, color: "#ffbea1", fontSize: 10, letterSpacing: 1.3, fontFamily: fonts.bodyBold }, reportHeroTitle: { color: "#fff", fontSize: 28, lineHeight: 32, fontFamily: fonts.display }, reportHeroBody: { color: "rgba(255,255,255,0.72)", fontSize: 13.5, fontFamily: fonts.body },
  reportHeroRevenue: { gap: 2, marginTop: 12 }, reportHeroLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 }, reportHeroLabel: { color: "rgba(255,255,255,0.68)", fontSize: 10, letterSpacing: 0.9, fontFamily: fonts.bodyBold }, reportHeroMoney: { color: "#fff", fontSize: 39, letterSpacing: -1.3, fontFamily: fonts.display },
  heroComparisonRow: { flexDirection: "row", alignItems: "center", gap: 5 }, heroComparison: { color: "rgba(255,255,255,0.86)", fontSize: 13, fontFamily: fonts.bodyBold },
  sectionHeading: { gap: 3, marginTop: 10, paddingHorizontal: 2 }, sectionEyebrow: { color: colors.brandDeep, fontSize: 10, letterSpacing: 1.1, fontFamily: fonts.bodyBold }, sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 }, sectionTitle: { flex: 1, color: colors.ink, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, fontFamily: fonts.display }, sectionSubtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 19, fontFamily: fonts.body },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, kpiCard: { width: "48%", flexGrow: 1, minWidth: 145, gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 15, ...shadows.soft }, kpi_green: { backgroundColor: "#f0faf5" }, kpi_orange: { backgroundColor: colors.surfaceGlow }, kpi_purple: { backgroundColor: "#f7f2ff" }, kpi_yellow: { backgroundColor: "#fff9e9" },
  kpiHeader: { flexDirection: "row", alignItems: "center", gap: 6 }, kpiLabel: { flex: 1, color: colors.muted, fontSize: 12, fontFamily: fonts.bodyBold }, kpiValue: { color: colors.ink, fontSize: 21, letterSpacing: -0.5, fontFamily: fonts.display }, kpiValueCompact: { minHeight: 49, fontSize: 18, lineHeight: 22 }, kpiNote: { color: colors.muted, fontSize: 11.5, fontFamily: fonts.body },
  infoButton: { width: 27, height: 27, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.brandSoft, borderRadius: 14, backgroundColor: colors.surface }, infoButtonInverse: { borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.13)" }, infoButtonPressed: { opacity: 0.65, transform: [{ scale: 0.94 }] },
  chartCard: { alignItems: "center", overflow: "hidden", borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surface, paddingVertical: 14, ...shadows.soft }, revenueChart: { gap: 4 }, chartSummary: { flexDirection: "row", alignItems: "stretch", gap: 14, marginHorizontal: 15, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 4, paddingTop: 13, paddingBottom: 5 }, chartSummaryItem: { flex: 1, gap: 1 }, chartSummaryDivider: { width: 1, backgroundColor: colors.border }, chartSummaryLabel: { color: colors.brandDeep, fontSize: 8.5, letterSpacing: 0.8, fontFamily: fonts.bodyBold }, chartSummaryValue: { color: colors.ink, fontSize: 15, fontFamily: fonts.display }, chartSummaryHint: { color: colors.muted, fontSize: 10.5, fontFamily: fonts.body }, chartLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 }, chartLabelItem: { gap: 1 }, chartLabelDate: { color: colors.muted, fontSize: 10, fontFamily: fonts.bodyBold }, chartLabelValue: { color: colors.ink, fontSize: 10, fontFamily: fonts.bodyBold }, chartEmpty: { height: 190, alignItems: "center", justifyContent: "center", gap: 5 }, chartEmptyTitle: { color: colors.ink, fontSize: 16, fontFamily: fonts.display }, chartEmptyText: { maxWidth: 300, color: colors.muted, textAlign: "center", fontSize: 13, fontFamily: fonts.body },
  pieCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surface, padding: 18, ...shadows.soft }, pieLayout: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 22 }, pieVisual: { alignItems: "center", gap: 5 }, pieCaption: { color: colors.ink, fontSize: 12, fontFamily: fonts.bodyBold }, pieLegend: { flex: 1, minWidth: 210, maxWidth: 390, gap: 9 }, pieLegendRow: { flexDirection: "row", alignItems: "center", gap: 8 }, pieLegendDot: { width: 11, height: 11, borderRadius: 6 }, pieLegendCopy: { flex: 1, gap: 1 }, pieLegendName: { color: colors.ink, fontSize: 12.5, fontFamily: fonts.bodyBold }, pieLegendValue: { color: colors.muted, fontSize: 10.5, fontFamily: fonts.body }, pieLegendPercent: { minWidth: 45, textAlign: "right", color: colors.ink, fontSize: 12, fontFamily: fonts.display }, pieEmpty: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 7 },
  comparisonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, comparisonCard: { width: "48%", flexGrow: 1, minWidth: 145, gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 15 }, comparisonLabel: { color: colors.muted, fontSize: 12, fontFamily: fonts.bodyBold }, comparisonValue: { color: colors.ink, fontSize: 21, fontFamily: fonts.display }, comparisonPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 3, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 }, comparisonPositive: { backgroundColor: colors.successSoft }, comparisonNegative: { backgroundColor: colors.dangerSoft }, comparisonNeutral: { backgroundColor: colors.surfaceWarm }, comparisonPillText: { fontSize: 10.5, fontFamily: fonts.bodyBold },
  efficiencyCard: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 22, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surface, padding: 20, ...shadows.soft }, donutWrap: { width: 130, height: 130, alignItems: "center", justifyContent: "center" }, donutCenter: { position: "absolute", alignItems: "center" }, donutValue: { color: colors.ink, fontSize: 26, fontFamily: fonts.display }, donutLabel: { color: colors.muted, fontSize: 10, fontFamily: fonts.bodyBold }, efficiencyCopy: { flex: 1, minWidth: 210, gap: 6 }, efficiencyTitle: { color: colors.ink, fontSize: 19, fontFamily: fonts.display }, efficiencyBody: { color: colors.muted, fontSize: 13.5, lineHeight: 20, fontFamily: fonts.body }, miniStats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }, miniStat: { flexDirection: "row", alignItems: "center", gap: 5 }, miniDot: { width: 8, height: 8, borderRadius: 4 }, miniText: { color: colors.muted, fontSize: 11.5, fontFamily: fonts.body }, miniValue: { color: colors.ink, fontFamily: fonts.bodyBold },
  rankingCard: { gap: 15, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surface, padding: 17, ...shadows.soft }, productRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, productRank: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.brandSoft }, productRankText: { color: colors.brandDeep, fontSize: 12, fontFamily: fonts.display }, productBody: { flex: 1, gap: 6 }, productTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, productName: { flex: 1, color: colors.ink, fontSize: 14, fontFamily: fonts.bodyBold }, productRevenue: { color: colors.ink, fontSize: 13, fontFamily: fonts.display }, productTrack: { height: 8, overflow: "hidden", borderRadius: 4, backgroundColor: colors.surfaceWarm }, productFill: { height: "100%", borderRadius: 4 }, productMeta: { color: colors.muted, fontSize: 10.5, fontFamily: fonts.body },
  weekCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surface, padding: 18, ...shadows.soft }, weekBars: { height: 190, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", gap: 7 }, weekItem: { flex: 1, alignItems: "center", gap: 6 }, weekValue: { color: colors.muted, fontSize: 8.5, fontFamily: fonts.bodyBold }, weekTrack: { width: "72%", height: 125, justifyContent: "flex-end", overflow: "hidden", borderRadius: 8, backgroundColor: colors.surfaceWarm }, weekFill: { width: "100%", borderRadius: 8 }, weekLabel: { color: colors.ink, fontSize: 10.5, fontFamily: fonts.bodyBold },
  aiCard: { gap: 14, overflow: "hidden", borderRadius: radius.xl, padding: 22, ...shadows.agent }, aiTop: { flexDirection: "row", alignItems: "center", gap: 11 }, aiIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)" }, aiTitleCopy: { flex: 1, gap: 2 }, aiEyebrow: { color: "#d9c7ff", fontSize: 9.5, letterSpacing: 1, fontFamily: fonts.bodyBold }, aiTitle: { color: "#fff", fontSize: 19, fontFamily: fonts.display }, aiSummary: { color: "rgba(255,255,255,0.92)", fontSize: 15, lineHeight: 22, fontFamily: fonts.body }, aiBlock: { gap: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)", paddingTop: 13 }, aiBlockTitle: { color: "#fff", fontSize: 14, fontFamily: fonts.bodyBold }, aiBullet: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, aiBulletDot: { width: 7, height: 7, marginTop: 6, borderRadius: 4, backgroundColor: "#ffbb86" }, aiBulletText: { flex: 1, color: "rgba(255,255,255,0.86)", fontSize: 13, lineHeight: 19, fontFamily: fonts.body }, aiAction: { flexDirection: "row", alignItems: "flex-start", gap: 9 }, aiActionNumber: { width: 23, height: 23, textAlign: "center", textAlignVertical: "center", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.16)", color: "#fff", fontSize: 11, lineHeight: 23, fontFamily: fonts.bodyBold }, aiLimitation: { color: "rgba(255,255,255,0.55)", fontSize: 10.5, fontFamily: fonts.body },
  actionsCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surface, paddingHorizontal: 17, ...shadows.soft }, actionRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 16 }, actionNumber: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.brandSoft }, actionNumberText: { color: colors.brandDeep, fontSize: 13, fontFamily: fonts.display }, actionCopy: { flex: 1, gap: 3 }, actionTitle: { color: colors.ink, fontSize: 14.5, fontFamily: fonts.bodyBold }, actionText: { color: colors.muted, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.body }, emptyInsight: { color: colors.muted, textAlign: "center", fontSize: 13, fontFamily: fonts.body, padding: 20 },
  alertsCard: { gap: 11 }, alertRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: radius.lg, backgroundColor: colors.dangerSoft, padding: 14 }, alertIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "rgba(255,255,255,0.65)" }, alertCopy: { flex: 1, gap: 2 }, alertTitle: { color: colors.danger, fontSize: 14, fontFamily: fonts.bodyBold }, alertText: { color: colors.ink, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.body },
  qualityCard: { gap: 11, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.surface, padding: 18, ...shadows.soft }, qualityTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, qualityScore: { color: colors.ink, fontSize: 31, fontFamily: fonts.display }, qualityOver: { color: colors.muted, fontSize: 14 }, qualityLevel: { color: colors.brandDeep, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7, fontFamily: fonts.bodyBold }, qualityTrack: { height: 9, overflow: "hidden", borderRadius: 5, backgroundColor: colors.brandSoft }, qualityFill: { height: "100%", borderRadius: 5, backgroundColor: colors.brand }, qualityText: { color: colors.ink, fontSize: 13, lineHeight: 19, fontFamily: fonts.body }, qualityMeta: { color: colors.muted, fontSize: 11, fontFamily: fonts.bodyBold },
  exportCard: { alignItems: "center", gap: 8, borderRadius: radius.xl, padding: 22 }, exportIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: colors.brandSoft }, exportTitle: { color: colors.ink, textAlign: "center", fontSize: 21, fontFamily: fonts.display }, exportBody: { maxWidth: 500, color: colors.muted, textAlign: "center", fontSize: 13.5, lineHeight: 20, fontFamily: fonts.body }, exportButtons: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 9, marginTop: 5 }, primaryExport: { flex: 1, minWidth: 140, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: radius.pill, backgroundColor: colors.brand, padding: 13 }, primaryExportText: { color: "#fff", fontSize: 13, fontFamily: fonts.bodyBold }, secondaryExport: { flex: 1, minWidth: 140, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: colors.brandSoft, borderRadius: radius.pill, backgroundColor: colors.surface, padding: 13 }, secondaryExportText: { color: colors.brandDeep, fontSize: 13, fontFamily: fonts.bodyBold },
  methodology: { gap: 5, padding: 8 }, methodologyTitle: { color: colors.ink, fontSize: 14, fontFamily: fonts.bodyBold }, methodologyText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, fontFamily: fonts.body },
  helpHeaderIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.brandSoft }, helpDescription: { color: colors.ink, fontSize: 16, lineHeight: 24, fontFamily: fonts.body }, helpExample: { flexDirection: "row", alignItems: "flex-start", gap: 11, borderRadius: radius.lg, backgroundColor: colors.warningSoft, padding: 15 }, helpExampleCopy: { flex: 1, gap: 3 }, helpExampleLabel: { color: colors.warning, fontSize: 9.5, letterSpacing: 0.8, fontFamily: fonts.bodyBold }, helpExampleText: { color: colors.ink, fontSize: 14, lineHeight: 20, fontFamily: fonts.body }
});
