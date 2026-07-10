import { useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clearApiCalls, getApiCalls, subscribeApiCalls, type ApiDebugEntry } from "@/lib/api-debug";

// DEBUG TEMPORÁRIO: overlay no cantinho que mostra, para cada chamada da API, a
// rota e a quantidade de caracteres que a resposta teve. É provisório — para
// remover, apague este componente, src/lib/api-debug.ts e as referências a eles
// em src/lib/api.ts e app/_layout.tsx.

function useApiCalls(): ApiDebugEntry[] {
  return useSyncExternalStore(subscribeApiCalls, getApiCalls, getApiCalls);
}

const STATUS_COLOR = (status: number) => {
  if (status >= 500) return "#ff7a7a";
  if (status >= 400) return "#ffb454";
  if (status >= 200 && status < 300) return "#7ee787";
  return "#c9d1d9";
};

export function ApiDebugOverlay() {
  const insets = useSafeAreaInsets();
  const calls = useApiCalls();
  const [open, setOpen] = useState(true);

  const total = calls.reduce((sum, call) => sum + call.chars, 0);

  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <Pressable style={styles.badge} onPress={() => setOpen((value) => !value)}>
        <Text style={styles.badgeText}>
          API · {calls.length} · {total} chars {open ? "▾" : "▸"}
        </Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {calls.length === 0 ? (
              <Text style={styles.empty}>Sem chamadas ainda.</Text>
            ) : (
              calls.map((call) => (
                <View key={call.id} style={styles.row}>
                  <View style={styles.rowHead}>
                    <Text style={[styles.method, { color: STATUS_COLOR(call.status) }]}>{call.method}</Text>
                    <Text style={styles.chars}>{call.chars} chars</Text>
                  </View>
                  <Text style={styles.path} numberOfLines={1}>
                    {call.path}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          <Pressable style={styles.clear} onPress={clearApiCalls}>
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
    width: 240,
    maxHeight: 320,
    backgroundColor: "rgba(20,16,12,0.92)",
    borderRadius: 12,
    padding: 8
  },
  list: {
    flexGrow: 0
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
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  method: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  chars: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700"
  },
  path: {
    color: "#c9d1d9",
    fontSize: 10.5,
    marginTop: 1
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
