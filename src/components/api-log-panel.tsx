import { ChevronDown, Share2, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/ui";
import { isAdmin } from "@/lib/access";
import { clearApiLog, useApiLog, type ApiLogEntry } from "@/lib/api-log";
import { colors, fonts, radius } from "@/lib/theme";
import { useAuth } from "@/contexts/auth";

const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

// Cor do selo de status: verde (2xx), laranja (4xx), vermelho (5xx / falha de rede).
function statusTone(entry: ApiLogEntry) {
  if (entry.status === null) return { bg: colors.dangerSoft, fg: colors.danger, label: "rede" };
  if (entry.ok) return { bg: colors.successSoft, fg: colors.success, label: String(entry.status) };
  if (entry.status >= 500) return { bg: colors.dangerSoft, fg: colors.danger, label: String(entry.status) };
  return { bg: colors.warningSoft, fg: colors.warning, label: String(entry.status) };
}

function formatTime(at: number) {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Painel de Diagnóstico exibido no fim do Perfil: lista as últimas chamadas ao
// servidor e deixa abrir cada uma para ver o corpo enviado e a resposta crua.
// Em produção só existe para contas admin; em dev aparece sempre.
export function ApiLogPanel() {
  const { user } = useAuth();
  const entries = useApiLog();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);

  if (!__DEV__ && !isAdmin(user)) return null;

  const shown = onlyErrors ? entries.filter((entry) => !entry.ok) : entries;

  async function shareEntry(entry: ApiLogEntry) {
    const text = [
      `${entry.method} ${entry.path}`,
      `status: ${entry.status ?? "sem resposta (rede)"} · ${entry.durationMs}ms · ${formatTime(entry.at)}`,
      entry.request ? `\n— enviado —\n${entry.request}` : "",
      `\n— resposta —\n${entry.response}`
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await Share.share({ message: text });
    } catch {
      // usuário cancelou o compartilhamento.
    }
  }

  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Diagnóstico</Text>
          <Text style={styles.subtitle}>Últimas chamadas ao servidor e o que voltou.</Text>
        </View>
        {entries.length > 0 ? (
          <Pressable
            onPress={() => {
              setExpanded(null);
              clearApiLog();
            }}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <Trash2 size={15} color={colors.muted} />
            <Text style={styles.clearText}>Limpar</Text>
          </Pressable>
        ) : null}
      </View>

      {entries.length > 0 ? (
        <View style={styles.filterRow}>
          <FilterChip label="Todas" active={!onlyErrors} onPress={() => setOnlyErrors(false)} />
          <FilterChip label="Só erros" active={onlyErrors} onPress={() => setOnlyErrors(true)} />
        </View>
      ) : null}

      {shown.length === 0 ? (
        <Text style={styles.empty}>
          {entries.length === 0 ? "Nenhuma chamada ainda. Use o app e volte aqui." : "Nenhum erro por enquanto. 🎉"}
        </Text>
      ) : (
        shown.map((entry) => {
          const tone = statusTone(entry);
          const open = expanded === entry.id;
          return (
            <View key={entry.id} style={styles.entry}>
              <Pressable
                onPress={() => setExpanded(open ? null : entry.id)}
                style={({ pressed }) => [styles.entryHead, pressed && styles.pressed]}
              >
                <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.statusText, { color: tone.fg }]}>{tone.label}</Text>
                </View>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryPath} numberOfLines={open ? undefined : 1}>
                    <Text style={styles.method}>{entry.method} </Text>
                    {entry.path}
                  </Text>
                  <Text style={styles.entryMeta}>
                    {entry.durationMs}ms · {entry.responseChars.toLocaleString("pt-BR")} caracteres · {formatTime(entry.at)}
                  </Text>
                </View>
                <ChevronDown size={16} color={colors.muted} style={open ? styles.chevronUp : undefined} />
              </Pressable>

              {open ? (
                <View style={styles.detail}>
                  {entry.request ? (
                    <>
                      <Text style={styles.detailLabel}>Enviado</Text>
                      <Text style={styles.code}>{entry.request}</Text>
                    </>
                  ) : null}
                  <Text style={styles.detailLabel}>Resposta · {entry.responseChars.toLocaleString("pt-BR")} caracteres</Text>
                  <Text style={styles.code}>{entry.response || "(vazio)"}</Text>
                  <Pressable onPress={() => shareEntry(entry)} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
                    <Share2 size={15} color={colors.brandDeep} />
                    <Text style={styles.shareText}>Compartilhar</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </Card>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  headerText: {
    flex: 1
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm
  },
  clearText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  filterRow: {
    flexDirection: "row",
    gap: 8
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  filterChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  filterChipTextActive: {
    color: colors.brandDeep
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body
  },
  entry: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  entryHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12
  },
  statusPill: {
    minWidth: 46,
    alignItems: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  statusText: {
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  entryInfo: {
    flex: 1,
    gap: 2
  },
  entryPath: {
    color: colors.ink,
    fontSize: 13.5,
    fontFamily: fonts.body
  },
  method: {
    color: colors.brandDeep,
    fontFamily: fonts.bodyBold
  },
  entryMeta: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  chevronUp: {
    transform: [{ rotate: "180deg" }]
  },
  detail: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceGlow,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 11.5,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  code: {
    color: colors.ink,
    fontSize: 12.5,
    fontFamily: mono,
    lineHeight: 18
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surface
  },
  shareText: {
    color: colors.brandDeep,
    fontSize: 13.5,
    fontFamily: fonts.bodyBold
  }
});
