import { LinearGradient } from "expo-linear-gradient";
import { Check, ChevronDown, ChevronRight, CircleAlert, MessageCircleQuestion, Pencil, Plus, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { AgentAvatar } from "@/components/agent";
import { Money } from "@/components/ui";
import {
  custoDetalhes,
  custoPorUnidade,
  custoTotal,
  extraCostEmoji,
  extraCostSubtitle,
  hasPurchaseData,
  hasRecipeData,
  ingredientEmoji,
  purchaseText,
  receitaPendingHint,
  recipeUsageText,
  type CusteioPhase
} from "@/lib/custeio";
import { formatCurrency, toNumber } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import type { CustoAdicionalRascunho, CustoSimulado, IngredienteRascunho, RascunhoCusteio } from "@/types/custeio";

// ---------------------------------------------------------------------------
// Trilha de progresso: contar → revisar → confirmar.
// ---------------------------------------------------------------------------

const STEPS = ["Receita", "Preços", "Resultado"] as const;

export function ProgressTrail({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <View style={styles.trail}>
      {STEPS.map((label, index) => {
        const number = index + 1;
        const done = step > number;
        const active = step === number;
        return (
          <View key={label} style={styles.trailStep}>
            {index > 0 ? <View style={[styles.trailLine, step > index && styles.trailLineDone]} /> : null}
            <View style={styles.trailNode}>
              {done || active ? (
                <LinearGradient
                  colors={gradients.agent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.trailCircle, active && shadows.agent]}
                >
                  {done ? <Check size={15} color="#fff" strokeWidth={3.5} /> : <Text style={styles.trailNumberActive}>{number}</Text>}
                </LinearGradient>
              ) : (
                <View style={[styles.trailCircle, styles.trailCircleIdle]}>
                  <Text style={styles.trailNumberIdle}>{number}</Text>
                </View>
              )}
              <Text style={[styles.trailLabel, (done || active) && styles.trailLabelActive]}>{label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Balão do agente com "digitando..." animado enquanto a IA pensa.
// ---------------------------------------------------------------------------

function TypingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 320, useNativeDriver: true })
        ])
      )
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.typingRow}>
      {dots.map((dot, index) => (
        <Animated.View key={index} style={[styles.typingDot, { opacity: dot }]} />
      ))}
    </View>
  );
}

export function AgentBubble({ message, thinking }: { message: string; thinking?: boolean }) {
  return (
    <View style={styles.agentRow}>
      <AgentAvatar size={46} />
      <View style={styles.agentBubble}>
        {thinking ? <TypingDots /> : <Text style={styles.agentBubbleText}>{message}</Text>}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Perguntas guiadas (violeta, tocáveis) e pendências/avisos.
// ---------------------------------------------------------------------------

export function QuestionCard({ question, onAnswer }: { question: string; onAnswer: () => void }) {
  return (
    <Pressable onPress={onAnswer} style={({ pressed }) => [styles.questionCard, shadows.soft, pressed && styles.pressed]}>
      <View style={styles.questionIcon}>
        <MessageCircleQuestion size={20} color={colors.agentDeep} />
      </View>
      <View style={styles.questionBody}>
        <Text style={styles.questionText}>{question}</Text>
        <Text style={styles.questionHint}>Toque para responder</Text>
      </View>
      <ChevronRight size={18} color={colors.agentDeep} />
    </Pressable>
  );
}

function PendingRow({ text }: { text: string }) {
  return (
    <View style={styles.noticeRow}>
      <CircleAlert size={17} color={colors.danger} />
      <Text style={[styles.noticeText, { color: colors.danger }]}>{text}</Text>
    </View>
  );
}

function WarningRow({ text }: { text: string }) {
  return (
    <View style={[styles.noticeRow, { backgroundColor: colors.warningSoft }]}>
      <TriangleAlert size={17} color={colors.warning} />
      <Text style={[styles.noticeText, { color: colors.warning }]}>{text}</Text>
    </View>
  );
}

// Pilha de avisos que recolhe quando há muitos: a tela não vira um paredão
// vermelho. Mostra os 3 primeiros e revela o resto sob demanda.
export function NoticeStack({ items, tone }: { items: string[]; tone: "danger" | "warn" }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const Row = tone === "danger" ? PendingRow : WarningRow;
  const limit = 3;
  const visible = expanded ? items : items.slice(0, limit);
  const hidden = items.length - limit;

  return (
    <View style={styles.noticeStack}>
      {visible.map((text) => (
        <Row key={text} text={text} />
      ))}
      {items.length > limit ? (
        <Pressable onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [styles.noticeToggle, pressed && styles.pressed]}>
          <ChevronDown size={16} color={colors.muted} style={expanded ? styles.noticeChevronUp : undefined} />
          <Text style={styles.noticeToggleText}>
            {expanded ? "Mostrar menos" : `Ver mais ${hidden} ${hidden === 1 ? "detalhe" : "detalhes"}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cards do rascunho: receita, ingredientes e outros custos.
// ---------------------------------------------------------------------------

// Pílula de status legível (melhor que um pontinho para o público idoso):
// "pronto" em verde, ou o motivo em laranja quando falta algo.
function StatusPill({ confirmed }: { confirmed: boolean }) {
  if (confirmed) {
    return (
      <View style={[styles.statusPill, { backgroundColor: colors.successSoft }]}>
        <Check size={12} color={colors.success} strokeWidth={3} />
        <Text style={[styles.statusPillText, { color: colors.success }]}>pronto</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusPill, { backgroundColor: colors.warningSoft }]}>
      <Text style={[styles.statusPillText, { color: colors.warning }]}>revisar</Text>
    </View>
  );
}

export function ReceitaCard({ rascunho, title, onEdit }: { rascunho: RascunhoCusteio; title?: string; onEdit: () => void }) {
  const receita = rascunho.receita;
  const rendimento = receita?.rendimento;
  const hasYield = toNumber(rendimento) > 0;
  const hint = receitaPendingHint(receita);

  return (
    <Pressable onPress={onEdit} style={({ pressed }) => [styles.draftCard, shadows.soft, pressed && styles.pressed]}>
      <Text style={styles.draftEmoji}>🍞</Text>
      <View style={styles.draftBody}>
        <Text style={styles.draftTitle} numberOfLines={2}>
          {title || receita?.nome || "Receita"}
        </Text>
        <Text style={styles.draftSubtitle}>
          {hasYield ? `Rende ${rendimento} ${receita?.unidade_rendimento || "unidades"}` : "Toque para informar quanto rende"}
        </Text>
        {hint ? <Text style={styles.draftHint}>{hint}</Text> : null}
      </View>
      <View style={styles.draftMeta}>
        <StatusPill confirmed={hasYield} />
        <Pencil size={17} color={colors.muted} />
      </View>
    </Pressable>
  );
}

// A prontidão e a legenda do ingrediente dependem da etapa: na receita conta a
// quantidade usada; nos preços, quanto comprou/pagou.
export function IngredientRow({
  ingrediente,
  phase,
  onEdit
}: {
  ingrediente: IngredienteRascunho;
  phase: CusteioPhase;
  onEdit: () => void;
}) {
  const recipePhase = phase === "receita";
  const ready = recipePhase ? hasRecipeData(ingrediente) : hasPurchaseData(ingrediente);

  const subtitle = recipePhase
    ? recipeUsageText(ingrediente) || "Toque para informar a quantidade usada"
    : purchaseText(ingrediente, formatCurrency) || recipeUsageText(ingrediente) || "Toque para informar o preço";
  const hint = ready ? null : recipePhase ? "Toque para informar a quantidade usada" : "Toque para informar quanto pagou";

  return (
    <Pressable onPress={onEdit} style={({ pressed }) => [styles.draftCard, shadows.soft, pressed && styles.pressed]}>
      <Text style={styles.draftEmoji}>{ingredientEmoji(ingrediente)}</Text>
      <View style={styles.draftBody}>
        <Text style={styles.draftTitle} numberOfLines={2}>
          {ingrediente.nome || "Ingrediente"}
        </Text>
        <Text style={styles.draftSubtitle}>{subtitle}</Text>
        {hint ? <Text style={styles.draftHint}>{hint}</Text> : null}
      </View>
      <View style={styles.draftMeta}>
        <StatusPill confirmed={ready} />
        <Pencil size={17} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export function ExtraCostRow({ custo, onEdit }: { custo: CustoAdicionalRascunho; onEdit: () => void }) {
  return (
    <Pressable onPress={onEdit} style={({ pressed }) => [styles.draftCard, shadows.soft, pressed && styles.pressed]}>
      <Text style={styles.draftEmoji}>{extraCostEmoji(custo)}</Text>
      <View style={styles.draftBody}>
        <Text style={styles.draftTitle} numberOfLines={2}>
          {custo.nome || custo.tipo || "Custo"}
        </Text>
        <Text style={styles.draftSubtitle}>{extraCostSubtitle(custo, formatCurrency)}</Text>
      </View>
      <View style={styles.draftMeta}>
        <StatusPill confirmed={toNumber(custo.valor) > 0} />
        <Pencil size={17} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export function AddRowButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}>
      <Plus size={17} color={colors.agentDeep} strokeWidth={3} />
      <Text style={styles.addRowText}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Card do custo simulado: número grande, barra de margem e frase amigável.
// ---------------------------------------------------------------------------

export function CostSummaryCard({
  custo,
  precoVenda,
  confirmed,
  incompleteHint
}: {
  custo: CustoSimulado;
  precoVenda: number | null;
  confirmed?: boolean;
  incompleteHint?: string;
}) {
  const unidade = custoPorUnidade(custo);
  const total = custoTotal(custo);
  const detalhes = custoDetalhes(custo);
  const scale = useRef(new Animated.Value(0.96)).current;

  // Sem custo real ainda (faltam preços/medidas): mostramos um estado calmo
  // em vez de "R$ 0,00" com festa de lucro, que fica esquisito.
  const incomplete = !confirmed && (unidade === null || unidade <= 0) && (total === null || total <= 0);

  // Entrada suave sempre que o custo muda de valor.
  useEffect(() => {
    scale.setValue(0.96);
    Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, [unidade, total, scale]);

  if (incomplete) {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[styles.costCard, styles.costCardDraft, shadows.soft]}>
          <Text style={[styles.costLabel, { color: colors.muted }]}>Custo por unidade</Text>
          <View style={styles.incompleteRow}>
            <Text style={styles.incompleteEmoji}>🧮</Text>
            <Text style={styles.incompleteText}>
              {incompleteHint || "Assim que os preços e as medidas estiverem completos, mostro o custo e o lucro por aqui."}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  const lucro = precoVenda !== null && unidade !== null ? precoVenda - unidade : null;
  const margem = lucro !== null && precoVenda ? Math.round((lucro / precoVenda) * 100) : null;
  const costShare = precoVenda && unidade !== null ? Math.max(0, Math.min(1, unidade / precoVenda)) : null;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {confirmed ? (
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.costCard, shadows.floating]}>
          <CostSummaryContent light unidade={unidade} total={total} detalhes={detalhes} lucro={lucro} margem={margem} costShare={costShare} precoVenda={precoVenda} />
        </LinearGradient>
      ) : (
        <View style={[styles.costCard, styles.costCardDraft, shadows.soft]}>
          <CostSummaryContent unidade={unidade} total={total} detalhes={detalhes} lucro={lucro} margem={margem} costShare={costShare} precoVenda={precoVenda} />
        </View>
      )}
    </Animated.View>
  );
}

function CostSummaryContent({
  light,
  unidade,
  total,
  detalhes,
  lucro,
  margem,
  costShare,
  precoVenda
}: {
  light?: boolean;
  unidade: number | null;
  total: number | null;
  detalhes: { nome: string; valor: number }[];
  lucro: number | null;
  margem: number | null;
  costShare: number | null;
  precoVenda: number | null;
}) {
  const ink = light ? "#fff" : colors.ink;
  const soft = light ? "rgba(255,255,255,0.78)" : colors.muted;

  return (
    <>
      <Text style={[styles.costLabel, { color: soft }]}>{light ? "Custo confirmado por unidade" : "Custo simulado por unidade"}</Text>
      <Money value={unidade ?? 0} size={44} color={ink} prefixColor={soft} />
      {total !== null && total > 0 ? (
        <Text style={[styles.costTotalText, { color: soft }]}>Receita completa: {formatCurrency(total)}</Text>
      ) : null}

      {detalhes.length > 0 ? (
        <View style={[styles.costDetails, { borderTopColor: light ? "rgba(255,255,255,0.25)" : colors.border }]}>
          {detalhes.map((item) => (
            <View key={item.nome} style={styles.costDetailRow}>
              <Text style={[styles.costDetailName, { color: soft }]}>{item.nome}</Text>
              <Text style={[styles.costDetailValue, { color: ink }]}>{formatCurrency(item.valor)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {costShare !== null && lucro !== null && lucro >= 0 ? (
        <View style={styles.marginBlock}>
          <View style={[styles.marginBar, { backgroundColor: light ? "rgba(255,255,255,0.28)" : colors.successSoft }]}>
            <View style={[styles.marginBarCost, { flex: costShare, backgroundColor: light ? "rgba(51,35,26,0.45)" : colors.brand }]} />
            <View style={{ flex: 1 - costShare }} />
          </View>
          <Text style={[styles.marginText, { color: ink }]}>
            Vendendo a {formatCurrency(precoVenda || 0)}, sobra {formatCurrency(lucro)} por unidade
            {margem !== null ? ` (${margem}% de lucro) 🎉` : ""}
          </Text>
        </View>
      ) : null}
      {lucro !== null && lucro < 0 ? (
        <Text style={[styles.marginText, { color: light ? "#fff" : colors.danger }]}>
          Atenção: o custo passou do preço de venda ({formatCurrency(precoVenda || 0)}). Vale rever o preço. 😬
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92
  },
  trail: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center"
  },
  trailStep: {
    flexDirection: "row",
    alignItems: "center"
  },
  trailNode: {
    alignItems: "center",
    gap: 5,
    width: 82
  },
  trailLine: {
    height: 3,
    width: 26,
    marginTop: 16,
    marginHorizontal: -22,
    borderRadius: 2,
    backgroundColor: colors.border
  },
  trailLineDone: {
    backgroundColor: colors.agent
  },
  trailCircle: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill
  },
  trailCircleIdle: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border
  },
  trailNumberActive: {
    color: "#fff",
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  trailNumberIdle: {
    color: colors.muted,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  trailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  trailLabelActive: {
    color: colors.agentDeep
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10
  },
  agentBubble: {
    flex: 1,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 6,
    backgroundColor: colors.agentSoft,
    padding: 14
  },
  agentBubbleText: {
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 23,
    fontFamily: fonts.body
  },
  typingRow: {
    flexDirection: "row",
    gap: 5,
    paddingVertical: 6
  },
  typingDot: {
    height: 9,
    width: 9,
    borderRadius: 5,
    backgroundColor: colors.agentDeep
  },
  questionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface,
    padding: 13
  },
  questionIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.agentSoft
  },
  questionBody: {
    flex: 1,
    gap: 2
  },
  questionText: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  questionHint: {
    color: colors.agentDeep,
    fontSize: 12.5,
    fontFamily: fonts.body
  },
  noticeStack: {
    gap: 8
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 13,
    paddingVertical: 11
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  noticeToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 40,
    alignSelf: "center",
    paddingHorizontal: 14
  },
  noticeChevronUp: {
    transform: [{ rotate: "180deg" }]
  },
  noticeToggleText: {
    color: colors.muted,
    fontSize: 13.5,
    fontFamily: fonts.bodyBold
  },
  draftCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 13
  },
  draftEmoji: {
    fontSize: 26
  },
  draftBody: {
    flex: 1,
    gap: 2
  },
  draftTitle: {
    color: colors.ink,
    fontSize: 15.5,
    fontFamily: fonts.bodyBold
  },
  draftSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  },
  draftHint: {
    marginTop: 2,
    color: colors.warning,
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  draftMeta: {
    alignItems: "flex-end",
    gap: 8
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  statusPillText: {
    fontSize: 11.5,
    fontFamily: fonts.bodyBold
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 46,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.agent
  },
  addRowText: {
    color: colors.agentDeep,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  },
  costCard: {
    gap: 8,
    borderRadius: radius.xl,
    padding: 18
  },
  costCardDraft: {
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface
  },
  incompleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 2
  },
  incompleteEmoji: {
    fontSize: 30
  },
  incompleteText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: fonts.bodyBold
  },
  costLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  costTotalText: {
    fontSize: 14,
    fontFamily: fonts.body
  },
  costDetails: {
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4
  },
  costDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  costDetailName: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: fonts.body,
    textTransform: "capitalize"
  },
  costDetailValue: {
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  marginBlock: {
    gap: 8,
    marginTop: 6
  },
  marginBar: {
    flexDirection: "row",
    height: 14,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  marginBarCost: {
    borderTopLeftRadius: radius.pill,
    borderBottomLeftRadius: radius.pill
  },
  marginText: {
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: fonts.bodyBold
  }
});
