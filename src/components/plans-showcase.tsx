import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { BadgeCheck, Check, Croissant, Mail, MessageCircle, Sparkles, Star, TrendingUp } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Sheet, StateText } from "@/components/ui";
import { useFontMultiplier } from "@/lib/font-scale";
import { isAdminPlan, planRank, PLANOS, UPGRADE_EMAIL, UPGRADE_WHATSAPP, type PlanoCatalogo } from "@/lib/plans";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import type { UsuarioPerfil } from "@/types/api";

// Vitrine de planos do perfil: mostra a escadinha Básico → Analítico → IA,
// marca o plano atual e convida para o upgrade. Admin não vê (não faz upgrade).
// Enquanto não existe pagamento no app, o CTA abre um pedido para a equipe
// Padoka via WhatsApp/e-mail (canais em src/lib/plans.ts).
export function PlansShowcase({ user }: { user: UsuarioPerfil }) {
  const scale = useFontMultiplier();
  const [pedido, setPedido] = useState<PlanoCatalogo | null>(null);

  if (isAdminPlan(user)) return null;

  const rank = planRank(user.plano);
  const isTop = rank >= PLANOS.length - 1;
  const recomendado = isTop ? null : PLANOS[rank + 1].id;

  return (
    <View style={styles.section}>
      {/* Chamada da vitrine: o único hero colorido da tela. */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Sparkles size={64} color="rgba(255,255,255,0.16)" style={styles.heroSparkleBig} />
        <Sparkles size={26} color="rgba(255,255,255,0.32)" style={styles.heroSparkleSmall} />
        <Text style={[styles.heroEyebrow, { fontSize: 12 * scale }]}>PLANOS PADOKA</Text>
        <Text style={[styles.heroTitle, { fontSize: 24 * scale }]}>
          {isTop ? "Você está no topo! 🎉" : "Faça sua padaria render mais"}
        </Text>
        <Text style={[styles.heroSubtitle, { fontSize: 14 * scale }]}>
          {isTop
            ? "Seu plano libera tudo o que a Padoka oferece, incluindo a IA."
            : "Relatórios, custo na mão e inteligência artificial trabalhando pra você."}
        </Text>
      </LinearGradient>

      {PLANOS.map((plano) => {
        const card = (
          <PlanCard
            key={plano.id}
            plano={plano}
            atual={plano.id === (user.plano || "basico")}
            incluido={planRank(plano.id) < rank}
            destaque={plano.id === recomendado}
            onQuero={planRank(plano.id) > rank ? () => setPedido(plano) : undefined}
          />
        );
        return plano.id === recomendado ? (
          <GlowRing key={plano.id} label="Recomendado pra você">
            {card}
          </GlowRing>
        ) : (
          card
        );
      })}

      <Text style={[styles.footnote, { fontSize: 13 * scale }]}>
        A ativação é feita com a equipe Padoka — rapidinho e sem burocracia.
      </Text>

      <UpgradeSheet plano={pedido} user={user} onClose={() => setPedido(null)} />
    </View>
  );
}

const PLAN_ICON = {
  basico: Croissant,
  analitico: TrendingUp,
  ia: Sparkles
} as const;

function PlanCard({
  plano,
  atual,
  incluido,
  destaque,
  onQuero
}: {
  plano: PlanoCatalogo;
  atual: boolean;
  incluido: boolean;
  destaque: boolean;
  onQuero?: () => void;
}) {
  const scale = useFontMultiplier();
  // O plano IA é a única superfície escura do app: gradiente violeta, tom que
  // o app inteiro já usa para tudo que é inteligência artificial.
  const dark = plano.id === "ia";
  const Icon = PLAN_ICON[plano.id];

  const inkColor = dark ? "#fff" : colors.ink;
  const mutedColor = dark ? "rgba(255,255,255,0.78)" : colors.muted;

  const body = (
    <>
      <View style={styles.planHeader}>
        <View style={[styles.planIcon, dark ? styles.planIconDark : null]}>
          <Icon size={24} color={dark ? "#fff" : colors.brandDeep} />
        </View>
        <View style={styles.planHeaderText}>
          <Text style={[styles.planName, { color: inkColor, fontSize: 21 * scale }]}>{plano.nome}</Text>
          <Text style={[styles.planSlogan, { color: mutedColor, fontSize: 14 * scale }]}>{plano.slogan}</Text>
        </View>
        {atual ? <Pill dark={dark} icon={<BadgeCheck size={14} color={dark ? "#fff" : colors.success} />} text="Seu plano" tone="good" /> : null}
        {incluido ? <Pill dark={dark} text="Incluído" tone="neutral" /> : null}
      </View>

      <PlanPrice preco={plano.precoMensal} dark={dark} />

      {plano.heranca ? (
        <Text style={[styles.inheritance, { color: mutedColor, fontSize: 14 * scale }]}>{plano.heranca}</Text>
      ) : null}
      <View style={styles.benefits}>
        {plano.beneficios.map((beneficio) => (
          <View key={beneficio} style={styles.benefitRow}>
            <View style={[styles.benefitCheck, dark ? styles.benefitCheckDark : null]}>
              <Check size={14} color={dark ? "#fff" : colors.success} strokeWidth={3.5} />
            </View>
            <Text style={[styles.benefitText, { color: inkColor, fontSize: 15 * scale }]}>{beneficio}</Text>
          </View>
        ))}
      </View>

      {onQuero ? (
        dark ? (
          // CTA claro sobre o card violeta: contraste máximo, convite máximo.
          <Pressable onPress={onQuero} style={({ pressed }) => [styles.ctaLight, pressed && styles.pressed]}>
            <Sparkles size={18} color={colors.agentDeep} />
            <Text style={[styles.ctaLightText, { fontSize: 15 * scale }]}>Quero o plano {plano.nome}</Text>
          </Pressable>
        ) : (
          <Button title={`Quero o plano ${plano.nome}`} onPress={onQuero} />
        )
      ) : null}
    </>
  );

  if (dark) {
    return (
      <LinearGradient
        colors={gradients.agent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.planCard, styles.planCardDark, destaque ? null : shadows.agent]}
      >
        {body}
      </LinearGradient>
    );
  }

  return <View style={[styles.planCard, styles.planCardLight, atual ? styles.planCardAtual : null]}>{body}</View>;
}

function PlanPrice({ preco, dark }: { preco: number | null; dark: boolean }) {
  const scale = useFontMultiplier();
  const mainColor = dark ? "#fff" : colors.ink;
  const sideColor = dark ? "rgba(255,255,255,0.75)" : colors.muted;

  if (preco === null) {
    return <Text style={[styles.priceFree, { fontSize: 24 * scale }]}>Grátis</Text>;
  }
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.pricePrefix, { color: sideColor, fontSize: 14 * scale }]}>R$</Text>
      <Text style={[styles.priceValue, { color: mainColor, fontSize: 34 * scale }]}>
        {preco.toFixed(2).replace(".", ",")}
      </Text>
      <Text style={[styles.priceSuffix, { color: sideColor, fontSize: 14 * scale }]}>/mês</Text>
    </View>
  );
}

function Pill({
  text,
  tone,
  dark,
  icon
}: {
  text: string;
  tone: "good" | "neutral";
  dark: boolean;
  icon?: React.ReactNode;
}) {
  const background = dark ? "rgba(255,255,255,0.22)" : tone === "good" ? colors.successSoft : colors.surfaceWarm;
  const color = dark ? "#fff" : tone === "good" ? colors.success : colors.muted;
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {icon}
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

// Anel de gradiente pulsante em volta do plano recomendado, com a flâmula
// "Recomendado pra você" flutuando no topo. É o único movimento da tela.
function GlowRing({ label, children }: { label: string; children: React.ReactNode }) {
  const glow = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.5, duration: 1100, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  return (
    <View style={styles.glowWrap}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.glowRing, { opacity: glow }]}>
        <LinearGradient
          colors={[gradients.brand[0], gradients.agent[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glowGradient}
        />
      </Animated.View>
      <View style={styles.glowInner}>{children}</View>
      <View style={styles.flag}>
        <Star size={13} color="#fff" fill="#fff" />
        <Text style={styles.flagText}>{label}</Text>
      </View>
    </View>
  );
}

// Pedido de upgrade: sem pagamento no app, o caminho é chamar a equipe.
function UpgradeSheet({
  plano,
  user,
  onClose
}: {
  plano: PlanoCatalogo | null;
  user: UsuarioPerfil;
  onClose: () => void;
}) {
  const scale = useFontMultiplier();
  const [linkError, setLinkError] = useState<string | null>(null);

  async function open(url: string) {
    try {
      setLinkError(null);
      await Linking.openURL(url);
    } catch {
      setLinkError("Não foi possível abrir. Tente pelo outro canal.");
    }
  }

  if (!plano) return null;

  const quem = user.nome?.trim() || user.email;
  const mensagem = `Olá! Sou ${quem} e quero ativar o plano ${plano.nome} na Padoka 100.`;
  const whatsappUrl = `https://wa.me/${UPGRADE_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
  const emailUrl = `mailto:${UPGRADE_EMAIL}?subject=${encodeURIComponent(`Quero o plano ${plano.nome} — Padoka 100`)}&body=${encodeURIComponent(mensagem)}`;

  return (
    <Sheet visible title={`Quero o plano ${plano.nome}`} subtitle={plano.slogan} onClose={onClose}>
      <PlanPrice preco={plano.precoMensal} dark={false} />
      <Text style={[styles.sheetNote, { fontSize: 15 * scale }]}>
        Chame a gente por aqui e a equipe Padoka libera o plano na sua conta rapidinho.
      </Text>
      {UPGRADE_WHATSAPP ? (
        <Button
          title="Chamar no WhatsApp"
          tone="success"
          icon={<MessageCircle size={18} color="#fff" />}
          onPress={() => open(whatsappUrl)}
        />
      ) : null}
      <Button title="Pedir por e-mail" icon={<Mail size={18} color="#fff" />} onPress={() => open(emailUrl)} />
      {linkError ? <StateText tone="error" text={linkError} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16
  },
  hero: {
    borderRadius: radius.xl,
    padding: 20,
    gap: 6,
    overflow: "hidden",
    ...shadows.brand
  },
  heroSparkleBig: {
    position: "absolute",
    right: -8,
    top: -10
  },
  heroSparkleSmall: {
    position: "absolute",
    right: 64,
    bottom: 14
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.bodyBold,
    letterSpacing: 2
  },
  heroTitle: {
    color: "#fff",
    fontFamily: fonts.display,
    letterSpacing: -0.4
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.92)",
    fontFamily: fonts.body,
    maxWidth: 300
  },
  planCard: {
    gap: 12,
    borderRadius: radius.xl,
    padding: 18
  },
  planCardLight: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.soft
  },
  planCardAtual: {
    borderWidth: 1.5,
    borderColor: colors.success
  },
  planCardDark: {
    borderWidth: 0
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  planHeaderText: {
    flex: 1
  },
  planIcon: {
    height: 46,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft
  },
  planIconDark: {
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  planName: {
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  planSlogan: {
    fontFamily: fonts.body
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3
  },
  pricePrefix: {
    fontFamily: fonts.bodyBold,
    marginBottom: 5
  },
  priceValue: {
    fontFamily: fonts.display,
    letterSpacing: -1,
    lineHeight: 38
  },
  priceSuffix: {
    fontFamily: fonts.body,
    marginBottom: 5
  },
  priceFree: {
    color: colors.success,
    fontFamily: fonts.display
  },
  inheritance: {
    fontFamily: fonts.bodyBold
  },
  benefits: {
    gap: 10
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  benefitCheck: {
    height: 24,
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft
  },
  benefitCheckDark: {
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  benefitText: {
    flex: 1,
    fontFamily: fonts.body
  },
  ctaLight: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    ...shadows.floating
  },
  ctaLightText: {
    color: colors.agentDeep,
    fontFamily: fonts.bodyBold
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  pillText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  glowWrap: {
    marginTop: 12
  },
  glowRing: {
    borderRadius: radius.xl + 4,
    ...shadows.agent
  },
  glowGradient: {
    flex: 1,
    borderRadius: radius.xl + 4
  },
  glowInner: {
    margin: 3
  },
  flag: {
    position: "absolute",
    top: -13,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandDeep,
    paddingHorizontal: 14,
    paddingVertical: 6,
    ...shadows.brand
  },
  flagText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  footnote: {
    color: colors.muted,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  sheetNote: {
    color: colors.ink,
    fontFamily: fonts.body
  }
});
