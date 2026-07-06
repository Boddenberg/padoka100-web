import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "@/lib/theme";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {children}
    </SafeAreaView>
  );
}

export function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </Screen>
  );
}

export function Card({ children, style }: ViewProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  disabled,
  tone = "brand"
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "brand" | "dark" | "light" | "danger" | "success";
}) {
  const backgroundColor =
    tone === "dark"
      ? colors.ink
      : tone === "light"
        ? colors.surfaceStrong
        : tone === "danger"
          ? colors.danger
          : tone === "success"
            ? colors.success
            : colors.brand;
  const textColor = tone === "light" ? colors.ink : "#fff";

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 }
      ]}
    >
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
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
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

export function StateText({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" | "success" }) {
  return (
    <Text style={[styles.stateText, tone === "error" && styles.errorText, tone === "success" && styles.successText]}>
      {text}
    </Text>
  );
}

export function Sheet({
  visible,
  title,
  onClose,
  children
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  page: {
    gap: 16,
    padding: 16,
    paddingBottom: 112
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600"
  },
  card: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 14
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 18
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "900"
  },
  field: {
    gap: 6
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600"
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  errorText: {
    color: colors.danger
  },
  successText: {
    color: colors.success
  },
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(36,33,31,0.42)"
  },
  sheet: {
    maxHeight: "90%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.bg
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16
  },
  sheetTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  closeButton: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong
  },
  sheetBody: {
    gap: 14,
    padding: 16,
    paddingTop: 0
  }
});
