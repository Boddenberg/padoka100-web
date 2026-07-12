import { LinearGradient } from "expo-linear-gradient";
import { Sparkles } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";

export const AGENT_NAME = "Seu Pãozinho";

// O Pãozinho falando: rostinho + balão de fala + as ações que ele oferece.
// É assim que o app conversa com a pessoa — o agente é o anfitrião do app,
// não um botão de microfone escondido.
export function AgentSays({ text, children, size = 46 }: { text: string; children?: ReactNode; size?: number }) {
  return (
    <View style={[styles.says, shadows.soft]}>
      <View style={styles.saysRow}>
        <AgentAvatar size={size} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{text}</Text>
        </View>
      </View>
      {children ? <View style={styles.saysActions}>{children}</View> : null}
    </View>
  );
}

// Avatar do agente de IA da padaria: pãozinho num círculo com brilho tech.
export function AgentAvatar({ size = 48 }: { size?: number }) {
  const badgeSize = Math.max(18, Math.round(size * 0.42));

  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={gradients.agent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, shadows.agent]}
      >
        <Text style={{ fontSize: size * 0.52 }}>🥐</Text>
      </LinearGradient>
      <View style={[styles.sparkleBadge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
        <Sparkles size={badgeSize * 0.62} color={colors.agentDeep} fill={colors.agentDeep} />
      </View>
    </View>
  );
}

export function AgentTag() {
  return (
    <View style={styles.tag}>
      <Sparkles size={12} color={colors.agentDeep} />
      <Text style={styles.tagText}>Agente IA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  says: {
    gap: 10,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface,
    padding: 14
  },
  saysRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  bubble: {
    flex: 1,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    backgroundColor: colors.agentSoft,
    padding: 12
  },
  bubbleText: {
    color: colors.agentDeep,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.bodyBold
  },
  saysActions: {
    gap: 8
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center"
  },
  sparkleBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: colors.agentSoft
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: colors.agentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  tagText: {
    color: colors.agentDeep,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.6
  }
});
