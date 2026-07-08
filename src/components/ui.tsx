import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Minus, Plus, X } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { resolveMediaUrl } from "@/lib/settings";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {children}
    </SafeAreaView>
  );
}

export function Page({
  title,
  subtitle,
  greeting,
  children
}: {
  title: string;
  subtitle?: string;
  greeting?: string;
  children: ReactNode;
}) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.pageScroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Tocar em qualquer área vazia fecha o teclado. */}
        <Pressable style={styles.page} onPress={Keyboard.dismiss} accessible={false}>
          <View>
            {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonTone = "brand" | "agent" | "soft" | "danger" | "success" | "outline";

export function Button({
  title,
  onPress,
  disabled,
  tone = "brand",
  icon,
  style
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: ButtonTone;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // Tons com gradiente ganham brilho; os demais são chapados e quentes.
  const gradient = tone === "brand" ? gradients.brand : tone === "agent" ? gradients.agent : null;

  const flatBackground =
    tone === "soft" ? colors.surfaceWarm : tone === "danger" ? colors.danger : tone === "success" ? colors.success : "transparent";
  const textColor = tone === "soft" ? colors.ink : tone === "outline" ? colors.brandDeep : "#fff";

  const content = (
    <>
      {icon}
      <Text style={[styles.buttonText, { color: disabled ? colors.muted : textColor }]}>{title}</Text>
    </>
  );

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [pressed && !disabled ? styles.pressed : null, style]}
    >
      {gradient && !disabled ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, tone === "brand" ? shadows.brand : shadows.agent]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.button,
            { backgroundColor: disabled ? colors.border : flatBackground },
            tone === "outline" && !disabled ? styles.buttonOutline : null
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      // "OK/Concluído" no teclado fecha em vez de quebrar linha.
      returnKeyType={props.multiline ? undefined : "done"}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function StateText({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" | "success" }) {
  return (
    <Text style={[styles.stateText, tone === "error" && styles.errorText, tone === "success" && styles.successText]}>
      {text}
    </Text>
  );
}

export function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

export function Badge({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "good" | "warn" | "danger" | "agent" }) {
  const palette = {
    neutral: { background: colors.surfaceWarm, text: colors.muted },
    good: { background: colors.successSoft, text: colors.success },
    warn: { background: colors.warningSoft, text: colors.warning },
    danger: { background: colors.dangerSoft, text: colors.danger },
    agent: { background: colors.agentSoft, text: colors.agentDeep }
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{text}</Text>
    </View>
  );
}

// Stepper de mais/menos usado na venda e na produção: sem digitação.
export function Stepper({
  value,
  onIncrement,
  onDecrement,
  canAdd = true,
  size = "md"
}: {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  canAdd?: boolean;
  size?: "sm" | "md";
}) {
  const buttonSize = size === "sm" ? 34 : 42;

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={value > 0 ? onDecrement : undefined}
        style={({ pressed }) => [
          styles.stepperButton,
          { height: buttonSize, width: buttonSize, opacity: value > 0 ? (pressed ? 0.7 : 1) : 0.35 }
        ]}
      >
        <Minus size={size === "sm" ? 16 : 20} color={colors.brandDeep} strokeWidth={3} />
      </Pressable>
      <Text style={[styles.stepperValue, size === "sm" && { fontSize: 16 }]}>{value}</Text>
      <Pressable onPress={canAdd ? onIncrement : undefined} style={({ pressed }) => [pressed && canAdd ? styles.pressed : null]}>
        <LinearGradient
          colors={canAdd ? gradients.brand : ([colors.border, colors.border] as const)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.stepperButtonAdd, { height: buttonSize, width: buttonSize }]}
        >
          <Plus size={size === "sm" ? 16 : 20} color={canAdd ? "#fff" : colors.muted} strokeWidth={3} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// Foto do produto com fallback simpático quando não há imagem.
export function ProductPhoto({
  url,
  name,
  size = 64,
  rounded = radius.md
}: {
  url?: string | null;
  name: string;
  size?: number | "fill";
  rounded?: number;
}) {
  const resolved = resolveMediaUrl(url);
  const dimensions =
    size === "fill"
      ? ({ width: "100%", height: "100%" } as const)
      : ({ width: size, height: size } as const);

  if (!resolved) {
    return (
      <View style={[styles.photoFallback, dimensions, { borderRadius: rounded }]}>
        <Text style={size === "fill" || size >= 56 ? styles.photoEmoji : styles.photoEmojiSmall}>🥖</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolved }}
      style={[dimensions, { borderRadius: rounded, backgroundColor: colors.surfaceWarm }]}
      contentFit="cover"
      transition={180}
    />
  );
}

export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  headerAccent
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  headerAccent?: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            // Primeiro toque fora fecha o teclado; o seguinte fecha o sheet.
            if (Keyboard.isVisible()) Keyboard.dismiss();
            else onClose();
          }}
        />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            {headerAccent}
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.sheetBodyScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.sheetBody} onPress={Keyboard.dismiss} accessible={false}>
              {children}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  pageScroll: {
    flexGrow: 1
  },
  page: {
    flexGrow: 1,
    gap: 16,
    padding: 16,
    paddingBottom: 132
  },
  greeting: {
    marginBottom: 2,
    color: colors.brandDeep,
    fontSize: 17,
    fontFamily: fonts.bodyBold
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontFamily: fonts.display,
    letterSpacing: -0.5
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 15,
    fontFamily: fonts.body
  },
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 16,
    ...shadows.soft
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
  buttonOutline: {
    borderWidth: 2,
    borderColor: colors.brand
  },
  buttonText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92
  },
  field: {
    gap: 6
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.body
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  errorText: {
    color: colors.danger
  },
  successText: {
    color: colors.success
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    padding: 4
  },
  stepperButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.soft
  },
  stepperButtonAdd: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill
  },
  stepperValue: {
    minWidth: 34,
    textAlign: "center",
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display
  },
  photoFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm
  },
  photoEmoji: {
    fontSize: 30
  },
  photoEmojiSmall: {
    fontSize: 20
  },
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(35, 20, 10, 0.5)"
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    backgroundColor: colors.bg
  },
  handle: {
    alignSelf: "center",
    marginTop: 10,
    height: 5,
    width: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.border
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    paddingBottom: 10
  },
  sheetHeaderText: {
    flex: 1
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  sheetSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  },
  closeButton: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm
  },
  sheetBodyScroll: {
    flexGrow: 1
  },
  sheetBody: {
    flexGrow: 1,
    gap: 14,
    padding: 16,
    paddingTop: 6,
    paddingBottom: 28
  }
});
