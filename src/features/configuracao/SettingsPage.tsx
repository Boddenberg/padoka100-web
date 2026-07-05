import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Server, ShieldCheck, Wifi } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { Page } from "@/components/ui/Page";
import { ErrorState } from "@/components/ui/StateBlocks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { getBackendTargetUrl, getBaseUrl, runtimeApiConfig, useApiSettings } from "@/lib/config/apiSettings";
import type { ApiEnvironment, HealthStatus } from "@/types/api";

const settingsSchema = z.object({
  environment: z.enum(["local", "production"]),
  apiKey: z.string().optional()
});

type SettingsForm = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { settings, saveSettings } = useApiSettings();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings
  });

  const selectedEnvironment = useWatch({ control: form.control, name: "environment" });
  const selectedApiKey = useWatch({ control: form.control, name: "apiKey" }) || "";

  function persist(values: SettingsForm) {
    saveSettings({
      environment: values.environment,
      apiKey: (values.apiKey || "").trim()
    });
    setSaved(true);
    queryClient.invalidateQueries();
    window.setTimeout(() => setSaved(false), 1800);
  }

  async function testConnection(values: SettingsForm) {
    setTesting(true);
    setError(null);
    setHealth(null);

    try {
      const response = await api.health({
        environment: values.environment as ApiEnvironment,
        apiKey: (values.apiKey || "").trim()
      });
      setHealth(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel testar a conexao.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Page title="Ajustes" eyebrow="Conexao">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-black text-bakery-ink">Conexao do app</h2>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={form.handleSubmit(persist)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ambiente">
                  <Select {...form.register("environment")}>
                    <option value="production">Producao</option>
                    <option value="local">Local</option>
                  </Select>
                </Field>

                <Field label="Chave de acesso" hint="Fica salva apenas neste navegador.">
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder="Cole a chave de acesso"
                    {...form.register("apiKey")}
                  />
                </Field>
              </div>

              <div className="grid gap-2 rounded-bakeryLg bg-bakery-cream p-3 text-sm font-semibold text-bakery-muted">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-bakery-brand" />
                  <span className="truncate">{getBaseUrl(selectedEnvironment)}</span>
                </div>
                <div className="grid gap-1 text-sm text-bakery-muted">
                  <span>Local: {runtimeApiConfig.localUrl}</span>
                  <span>Producao: {runtimeApiConfig.productionUrl}</span>
                  {selectedEnvironment === "production" && runtimeApiConfig.useProductionProxy ? (
                    <span>O frontend encaminha /health e /api/v1 para {getBackendTargetUrl("production")}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" icon={<Save className="h-4 w-4" />}>
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={testing}
                  onClick={form.handleSubmit(testConnection)}
                  icon={<Wifi className="h-4 w-4" />}
                >
                  {testing ? "Testando" : "Testar conexao"}
                </Button>
              </div>

              {saved ? (
                <div className="rounded-bakeryLg bg-bakery-successSoft p-3 text-sm font-bold text-bakery-success">
                  Configuracao salva.
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-black text-bakery-ink">Status</h2>
          </CardHeader>
          <CardContent className="grid gap-3">
            <StatusBadge tone={selectedApiKey.trim() ? "good" : "warn"}>
              {selectedApiKey.trim() ? "Chave salva" : "Sem chave"}
            </StatusBadge>

            {health ? (
              <div className="grid gap-3">
                <StatusRow label="Servidor" ok={health.status === "ok"} value={String(health.status || "sem status")} />
                <StatusRow label="Supabase" ok={Boolean(health.supabase_configured)} />
                <StatusRow label="OpenAI texto" ok={Boolean(health.openai_text_configured)} />
                <StatusRow label="OpenAI audio" ok={Boolean(health.openai_audio_configured)} />
                <StatusRow label="API key backend" ok={Boolean(health.api_key_configured)} />
              </div>
            ) : (
              <div className="grid gap-3 rounded-bakeryLg bg-bakery-cream p-4 text-sm font-semibold text-bakery-muted">
                <ShieldCheck className="h-6 w-6 text-bakery-brand" />
                Teste a conexao para ver o status do backend.
              </div>
            )}

            {error ? <ErrorState message={error} /> : null}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

function StatusRow({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-bakeryLg border border-bakery-border p-3">
      <span className="font-semibold text-bakery-muted">{label}</span>
      <StatusBadge tone={ok ? "good" : "warn"}>{value || (ok ? "Configurado" : "Pendente")}</StatusBadge>
    </div>
  );
}
