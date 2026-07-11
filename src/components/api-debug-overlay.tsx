import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clearApiLog, useApiLog, type ApiLogEntry } from "@/lib/api-log";

const STATUS_COLOR = (entry: ApiLogEntry) => {
  if (entry.status === null) return "#ff7a7a";
  if (entry.status >= 500) return "#ff7a7a";
  if (entry.status >= 400) return "#ffb454";
  if (entry.status >= 200 && entry.status < 300) return "#7ee787";
  return "#c9d1d9";
};

function statusLabel(entry: ApiLogEntry) {
  return entry.status === null ? "rede" : String(entry.status);
}

function formatTime(at: number) {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function responseChars(entry: ApiLogEntry) {
  return entry.responseChars ?? entry.response.length;
}

export function ApiDebugOverlay() {
  const insets = useSafeAreaInsets();
  const calls = useApiLog();
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Overlay flutuante é ferramenta de desenvolvimento: nunca vai para produção
  // (admin usa o painel de Diagnóstico no fim do Perfil).
  if (!__DEV__) return null;

  const total = calls.reduce((sum, call) => sum + responseChars(call), 0);

  function toggleOpen() {
    setOpen((value) => {
      const next = !value;
      if (!next) setExpandedId(null);
      return next;
    });
  }

  function clear() {
    setExpandedId(null);
    clearApiLog();
  }

  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <Pressable style={styles.badge} onPress={toggleOpen}>
        <Text style={styles.badgeText}>
          API | {calls.length} | {total} chars {open ? "v" : ">"}
        </Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {calls.length === 0 ? (
              <Text style={styles.empty}>Sem chamadas ainda.</Text>
            ) : (
              calls.map((call) => {
                const expanded = expandedId === call.id;
                return (
                  <View key={call.id} style={[styles.row, expanded && styles.rowExpanded]}>
                    <Pressable
                      onPress={() => setExpandedId(expanded ? null : call.id)}
                      style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}
                    >
                      <View style={styles.rowHead}>
                        <Text style={[styles.method, { color: STATUS_COLOR(call) }]}>{call.method}</Text>
                        <Text style={[styles.status, { color: STATUS_COLOR(call) }]}>{statusLabel(call)}</Text>
                        <Text style={styles.chars}>{responseChars(call)} chars</Text>
                      </View>
                      <Text style={styles.path} numberOfLines={expanded ? 2 : 1}>
                        {call.path}
                      </Text>
                      <Text style={styles.meta}>
                        {call.durationMs}ms | {formatTime(call.at)}
                      </Text>
                    </Pressable>

                    {expanded ? (
                      <View style={styles.detail}>
                        <Text style={styles.detailLabel}>response</Text>
                        <Text selectable style={styles.code}>
                          {call.response || "(vazio)"}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
          <Pressable style={styles.clear} onPress={clear}>
            <Text style={styles.clearText}>limpar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 6,
    zIndex: 9999,
    alignItems: "flex-end"
  },
  badge: {
    backgroundColor: "rgba(20,16,12,0.88)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700"
  },
  panel: {
    marginTop: 6,
    width: 292,
    maxHeight: 430,
    backgroundColor: "rgba(20,16,12,0.94)",
    borderRadius: 12,
    padding: 8
  },
  list: {
    flexGrow: 0
  },
  listContent: {
    gap: 2
  },
  empty: {
    color: "#c9d1d9",
    fontSize: 11,
    padding: 6
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    paddingVertical: 5
  },
  rowExpanded: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 6
  },
  rowButton: {
    gap: 2
  },
  pressed: {
    opacity: 0.72
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  method: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  status: {
    minWidth: 28,
    fontSize: 10,
    fontWeight: "800"
  },
  chars: {
    marginLeft: "auto",
    color: "#fff",
    fontSize: 11,
    fontWeight: "700"
  },
  path: {
    color: "#c9d1d9",
    fontSize: 10.5,
    marginTop: 1
  },
  meta: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 9.5
  },
  detail: {
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.14)"
  },
  detailLabel: {
    color: "#ffb454",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  code: {
    marginTop: 4,
    color: "#f0f6fc",
    fontFamily: "monospace",
    fontSize: 10.5,
    lineHeight: 15
  },
  clear: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2
  },
  clearText: {
    color: "#ffb454",
    fontSize: 10,
    fontWeight: "700"
  }
});
