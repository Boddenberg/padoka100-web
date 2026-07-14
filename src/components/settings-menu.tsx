import { Compass, MessageSquare, Settings } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCoach } from "@/components/coach/coach-tour";
import { ReportSheet } from "@/components/report-sheet";
import { Sheet } from "@/components/ui";
import { useFontScale, type FontLevel } from "@/lib/font-scale";
import { colors, fonts, radius } from "@/lib/theme";

const FONT_OPTIONS: { level: FontLevel; label: string; sample: number }[] = [
  { level: "normal", label: "Normal", sample: 16 },
  { level: "grande", label: "Grande", sample: 19 },
  { level: "maior", label: "Maior", sample: 23 }
];

// Engrenagem no topo: abre as preferências do app (por ora, tamanho do texto).
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { level, setLevel } = useFontScale();
  const coach = useCoach();

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Settings size={20} color={colors.ink} />
      </Pressable>

      <Sheet visible={open} title="Preferências" subtitle="Ajuste o app do seu jeito" onClose={() => setOpen(false)}>
        <Text style={styles.groupTitle}>Tamanho do texto</Text>
        <Text style={styles.groupHint}>Deixe as letras maiores se ficar mais confortável de ler.</Text>
        <View style={styles.options}>
          {FONT_OPTIONS.map((option) => {
            const active = option.level === level;
            return (
              <Pressable
                key={option.level}
                onPress={() => setLevel(option.level)}
                style={[styles.option, active && styles.optionActive]}
              >
                <Text style={[styles.optionSample, { fontSize: option.sample }, active && styles.optionTextActive]}>Aa</Text>
                <Text style={[styles.optionLabel, active && styles.optionTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.groupTitle}>Ajuda</Text>
        <Text style={styles.groupHint}>Quer relembrar onde fica cada coisa? Refaça o passeio guiado.</Text>
        <Pressable
          onPress={() => {
            // Fecha as Preferências e reabre o passeio na tela de Venda.
            setOpen(false);
            coach.replaySalesTour();
          }}
          style={({ pressed }) => [styles.tourButton, pressed && styles.pressed]}
        >
          <Compass size={20} color={colors.brandDeep} />
          <Text style={styles.tourButtonText}>Ver tutorial de novo</Text>
        </Pressable>

        <Text style={styles.groupTitle}>Fale com a gente</Text>
        <Text style={styles.groupHint}>Encontrou um erro, teve dificuldade ou tem uma ideia? Conte pra gente.</Text>
        <Pressable
          onPress={() => {
            // Fecha as Preferências e abre o formulário de report.
            setOpen(false);
            setReportOpen(true);
          }}
          style={({ pressed }) => [styles.tourButton, pressed && styles.pressed]}
        >
          <MessageSquare size={20} color={colors.brandDeep} />
          <Text style={styles.tourButtonText}>Relatar um problema</Text>
        </Pressable>
      </Sheet>

      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} contexto="Venda" />
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9
  },
  iconButton: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  groupTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.display
  },
  groupHint: {
    marginTop: -6,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body
  },
  options: {
    flexDirection: "row",
    gap: 10
  },
  option: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  optionActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  optionSample: {
    color: colors.ink,
    fontFamily: fonts.display
  },
  optionLabel: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  optionTextActive: {
    color: colors.brandDeep
  },
  tourButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surfaceWarm
  },
  tourButtonText: {
    color: colors.brandDeep,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  }
});
