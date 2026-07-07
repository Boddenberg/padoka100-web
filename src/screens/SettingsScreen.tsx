import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Field, Input, Page, StateText } from "@/components/ui";
import { api } from "@/lib/api";
import { apiUrls, getBaseUrl, readApiSettings, saveApiSettings, type ApiSettings } from "@/lib/settings";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import type { ApiEnvironment } from "@/types/api";

export function SettingsScreen() {
  const [settings, setSettings] = useState<ApiSettings>({ environment: "production", apiKey: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    readApiSettings().then(setSettings).catch(() => undefined);
  }, []);

  const save = useMutation({
    mutationFn: () => saveApiSettings(settings),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    }
  });
  const health = useMutation({
    mutationFn: () => api.health(settings)
  });

  function setEnvironment(environment: ApiEnvironment) {
    setSettings((current) => ({ ...current, environment }));
  }

  return (
    <Page title="Ajustes" subtitle="Ambiente, backend e API key local.">
      <Card>
        <Text style={styles.sectionTitle}>Ambiente</Text>
        <View style={styles.segment}>
          <SegmentButton
            label="Railway"
            active={settings.environment === "production"}
            onPress={() => setEnvironment("production")}
          />
          <SegmentButton label="Local" active={settings.environment === "local"} onPress={() => setEnvironment("local")} />
        </View>
        <Text style={styles.muted}>Backend atual: {getBaseUrl(settings.environment)}</Text>
        <Text style={styles.hint}>Local no celular geralmente precisa ser o IP da máquina na rede, não localhost.</Text>
      </Card>

      <Card>
        <Field label="API key">
          <Input value={settings.apiKey} onChangeText={(apiKey) => setSettings({ ...settings, apiKey })} secureTextEntry />
        </Field>
        <Button title={save.isPending ? "Salvando..." : "Salvar ajustes"} disabled={save.isPending} onPress={() => save.mutate()} />
        {saved ? <StateText tone="success" text="Ajustes salvos neste dispositivo." /> : null}
        {save.error instanceof Error ? <StateText tone="error" text={save.error.message} /> : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Teste de conexão</Text>
        <Button
          title={health.isPending ? "Testando..." : "Testar conexão"}
          tone="soft"
          disabled={health.isPending}
          onPress={() => health.mutate()}
        />
        {health.data ? <StateText tone="success" text={`Conectado: ${health.data.status || "ok"}`} /> : null}
        {health.error instanceof Error ? <StateText tone="error" text={health.error.message} /> : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>URLs configuradas</Text>
        <Text style={styles.muted}>Produção: {apiUrls.production}</Text>
        <Text style={styles.muted}>Local: {apiUrls.local}</Text>
      </Card>
    </Page>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display
  },
  segment: {
    flexDirection: "row",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    padding: 5
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingVertical: 11
  },
  segmentButtonActive: {
    backgroundColor: colors.brand,
    ...shadows.brand
  },
  segmentLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyBold
  },
  segmentLabelActive: {
    color: "#fff"
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  },
  hint: {
    color: colors.warning,
    fontSize: 13,
    fontFamily: fonts.body
  }
});
