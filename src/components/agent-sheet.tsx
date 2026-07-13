import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Images, Mic, Send, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AGENT_NAME, AgentAvatar } from "@/components/agent";
import { Badge, Button, Card, Input, Sheet, StateText } from "@/components/ui";
import { api, createAudioForm, createIaPhotoForm, type NativeFile } from "@/lib/api";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import { pickImage } from "@/utils/media";
import { fixProductName } from "@/utils/text";
import type { DiaDeVenda, RespostaInterpretarVenda } from "@/types/api";

// Conversa com o Seu Pãozinho, disponível para qualquer tela do app.
// O backend interpreta comandos genéricos (venda, abrir dia, cadastro...);
// aqui só muda o convite e os exemplos conforme o contexto.
export type AgentPrompts = {
  idle: string;
  exampleVoice: string;
  exampleText: string;
};

// Quando a tela permite foto, diz ao agente o que ele vai ler: a lousa/folha
// de produção do dia (precisa do dia aberto) ou o cardápio para cadastrar.
export type AgentPhoto = {
  kind: "producao" | "cardapio";
  contexto?: string;
};

// A leitura de foto usa modelo de visão e pode demorar; o fetch não tem
// timeout, então corremos contra um relógio para não travar em "Lendo...".
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("A leitura demorou demais. Tente de novo com uma foto mais nítida.")), ms)
    )
  ]);
}

// Depois de qualquer comando confirmado, tudo pode ter mudado (dia, produtos,
// vendas, relatórios) — invalida em bloco para as telas se atualizarem sozinhas.
export function invalidateDay(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["dias"] });
  queryClient.invalidateQueries({ queryKey: ["produtos"] });
  queryClient.invalidateQueries({ queryKey: ["relatorios"] });
  queryClient.invalidateQueries({ queryKey: ["vendas"] });
}

export function AgentSheet({
  visible,
  onClose,
  day,
  initialText,
  autoRecord,
  onMessage,
  prompts,
  photo
}: {
  visible: boolean;
  onClose: () => void;
  day: DiaDeVenda | null;
  initialText: string;
  autoRecord: boolean;
  onMessage: (message: string) => void;
  prompts?: AgentPrompts;
  photo?: AgentPhoto;
}) {
  return (
    <Sheet
      visible={visible}
      title={AGENT_NAME}
      subtitle="Seu agente de IA da padaria"
      onClose={onClose}
      headerAccent={<AgentAvatar size={46} />}
    >
      {visible ? (
        <AgentConversation
          onClose={onClose}
          day={day}
          initialText={initialText}
          autoRecord={autoRecord}
          onMessage={onMessage}
          prompts={prompts}
          photo={photo}
        />
      ) : null}
    </Sheet>
  );
}

function AgentConversation({
  onClose,
  day,
  initialText,
  autoRecord,
  onMessage,
  prompts,
  photo
}: {
  onClose: () => void;
  day: DiaDeVenda | null;
  initialText: string;
  autoRecord: boolean;
  onMessage: (message: string) => void;
  prompts?: AgentPrompts;
  photo?: AgentPhoto;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<RespostaInterpretarVenda | null>(null);
  // Recado quando a confirmação não pôde ser aplicada (sucesso: false).
  const [confirmNotice, setConfirmNotice] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const idleHint =
    prompts?.idle ??
    (day
      ? "Me fala o que vendeu — por voz ou por texto — que eu monto a sacola e registro."
      : "O dia ainda não foi aberto. Me fala a produção de hoje que eu abro pra você!");
  const exampleVoice = prompts?.exampleVoice ?? (day ? "Ex: “vende 2 pães de queijo e 1 café”" : "Ex: “abre o dia com 20 pães de queijo”");
  const exampleText = prompts?.exampleText ?? (day ? "Ex: vende 2 pães de queijo" : "Ex: abre o dia com 20 pães");

  const interpret = useMutation({
    mutationFn: (command: string) => api.ia.interpretCommand({ texto: command, dia_de_venda_id: day?.id, permitir_fallback: true }),
    onSuccess: (response) => {
      setConfirmNotice(null);
      setResult(response);
    }
  });
  const upload = useMutation({
    mutationFn: (file: NativeFile) => api.ia.transcribeAudio(createAudioForm(file, day?.id)),
    onSuccess: (response) => {
      setText(response.transcricao);
      setResult(response.interpretacao || null);
    }
  });
  // Foto (lousa de produção ou cardápio): interpreta e cai no mesmo
  // "Entendi assim" para a pessoa revisar antes de confirmar.
  const photoUpload = useMutation({
    mutationFn: async (source: "camera" | "gallery") => {
      if (!photo) return null;
      // Documento inteiro (sem recorte 4:3), para não perder itens da folha.
      const file = await pickImage(source, photo.kind, { allowsEditing: false });
      if (!file) return null;
      const form = createIaPhotoForm(file, {
        diaDeVendaId: photo.kind === "producao" ? day?.id : undefined,
        contexto: photo.contexto
      });
      const request = photo.kind === "cardapio" ? api.ia.importMenuPhoto(form) : api.ia.importProductionPhoto(form);
      return withTimeout(request, 90000);
    },
    onSuccess: (response) => {
      if (!response) return;
      setConfirmNotice(null);
      setResult(response);
    }
  });
  const confirm = useMutation({
    mutationFn: () => api.ia.confirmCommand(result!.interacao_ia_id),
    onSuccess: (response) => {
      // A API pode responder sem erro HTTP mas sem conseguir aplicar:
      // nesse caso o sheet fica aberto com o recado amigável.
      if (response.sucesso === false) {
        const detail =
          response.mensagem_assistente ||
          (typeof response.resultado?.mensagem === "string" ? response.resultado.mensagem : null);
        setConfirmNotice(detail || "Não consegui aplicar o comando. Tente pedir de novo.");
        return;
      }
      onMessage(response.mensagem_assistente || `${AGENT_NAME} resolveu pra você!`);
      onClose();
      invalidateDay(queryClient);
    }
  });

  // Ao abrir: interpreta o texto vindo da busca ou já começa a gravar.
  useEffect(() => {
    if (initialText) {
      interpret.mutate(initialText);
    } else if (autoRecord) {
      void startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microfone", "Permissão para usar o microfone foi negada.");
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      Alert.alert("Áudio", error instanceof Error ? error.message : "Não foi possível gravar.");
    }
  }

  async function toggleRecording() {
    if (recorderState.isRecording) {
      await recorder.stop();
      if (recorder.uri) {
        upload.mutate({ uri: recorder.uri, name: `venda-${Date.now()}.m4a`, type: "audio/mp4" });
      }
      return;
    }
    await startRecording();
  }

  const busy = interpret.isPending || upload.isPending || photoUpload.isPending;
  const reviewing = Boolean(result);

  // Itens estruturados só aparecem em algumas ações (venda/produção). No
  // cadastro por cardápio, o resumo vem em mensagem_confirmacao.
  const items = result?.itens ?? [];
  const acao = result?.acao ?? "";
  const reviewTitle =
    acao === "criar_produtos"
      ? "Vou cadastrar estes produtos:"
      : acao.includes("produc")
        ? "Produção que eu li:"
        : "Confira antes de confirmar:";
  const confirmLabel = confirm.isPending
    ? "Confirmando..."
    : acao === "criar_produtos"
      ? "Cadastrar todos"
      : acao.includes("produc")
        ? "Confirmar produção"
        : "Confirmar";

  const loadingText = photoUpload.isPending
    ? photo?.kind === "cardapio"
      ? "Lendo o cardápio... isso leva alguns segundos."
      : "Lendo a foto... isso leva alguns segundos."
    : upload.isPending
      ? "Ouvindo o seu áudio..."
      : "Só um instante...";

  return (
    <>
      <View style={styles.agentBubble}>
        <Text style={styles.agentBubbleText}>
          {recorderState.isRecording
            ? "Tô ouvindo... pode falar!"
            : busy
              ? loadingText
              : result?.mensagem_assistente
                ? result.mensagem_assistente
                : reviewing
                  ? "Confere pra mim e toque em confirmar."
                  : idleHint}
        </Text>
      </View>

      {/* Ocupado: um cartão de progresso claro (a leitura de foto demora). */}
      {busy && !recorderState.isRecording ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.agentDeep} />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      ) : null}

      {/* Resultado pronto: a revisão sobe para o topo, impossível de não ver. */}
      {reviewing ? (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Sparkles size={16} color={colors.agentDeep} />
            <Text style={styles.resultTitle}>{reviewTitle}</Text>
          </View>
          {items.map((item) => (
            <View key={`${item.produto_id}-${item.nome_produto}`} style={styles.resultRow}>
              <Text style={styles.resultItem}>
                {Number(item.quantidade) > 0 ? `${item.quantidade}x ` : ""}
                {fixProductName(item.nome_produto)}
              </Text>
              {Number.isFinite(item.confianca) ? (
                <Badge text={`${Math.round(item.confianca * 100)}%`} tone={item.confianca >= 0.75 ? "good" : "warn"} />
              ) : null}
            </View>
          ))}
          {result?.itens_nao_identificados?.length ? (
            <StateText tone="error" text={`Não consegui identificar: ${result.itens_nao_identificados.join(", ")}`} />
          ) : null}
          {result?.mensagem_confirmacao ? <Text style={styles.reviewMessage}>{result.mensagem_confirmacao}</Text> : null}
          <Button
            title={confirmLabel}
            tone="success"
            disabled={!result?.interacao_ia_id || confirm.isPending}
            onPress={() => confirm.mutate()}
          />
          <Button
            title="Descartar e tentar de novo"
            tone="soft"
            disabled={confirm.isPending}
            onPress={() => {
              setResult(null);
              setConfirmNotice(null);
            }}
          />
          {confirmNotice ? <StateText tone="error" text={confirmNotice} /> : null}
          {confirm.error instanceof Error ? <StateText tone="error" text={confirm.error.message} /> : null}
        </Card>
      ) : null}

      {/* Entradas: só aparecem quando não há revisão em andamento. */}
      {!reviewing ? (
        <>
          <Pressable onPress={toggleRecording} disabled={busy} style={({ pressed }) => pressed && styles.pressed}>
            <LinearGradient
              colors={recorderState.isRecording ? (["#ff5252", "#d81b43"] as const) : gradients.agent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.recordButton, recorderState.isRecording ? styles.recordButtonActive : shadows.agent]}
            >
              <Mic size={30} color="#fff" />
              <Text style={styles.recordText}>
                {recorderState.isRecording ? "Gravando... toque para parar" : "Toque e fala"}
              </Text>
              {!recorderState.isRecording ? <Text style={styles.recordHint}>{exampleVoice}</Text> : null}
            </LinearGradient>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>ou escreva</Text>
            <View style={styles.orLine} />
          </View>

          <View style={styles.commandRow}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder={exampleText}
              style={styles.commandInput}
              returnKeyType="send"
              onSubmitEditing={() => text.trim() && interpret.mutate(text.trim())}
            />
            <Pressable
              onPress={() => text.trim() && interpret.mutate(text.trim())}
              disabled={!text.trim() || busy}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <LinearGradient
                colors={text.trim() ? gradients.agent : ([colors.border, colors.border] as const)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButton}
              >
                <Send size={20} color={text.trim() ? "#fff" : colors.muted} />
              </LinearGradient>
            </Pressable>
          </View>

          {photo ? (
            <>
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>ou envie uma foto</Text>
                <View style={styles.orLine} />
              </View>
              <View style={styles.photoRow}>
                <Pressable
                  onPress={() => photoUpload.mutate("camera")}
                  disabled={busy}
                  style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
                >
                  <Camera size={20} color={colors.agentDeep} />
                  <Text style={styles.photoButtonText}>Fotografar</Text>
                </Pressable>
                <Pressable
                  onPress={() => photoUpload.mutate("gallery")}
                  disabled={busy}
                  style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
                >
                  <Images size={20} color={colors.agentDeep} />
                  <Text style={styles.photoButtonText}>Galeria</Text>
                </Pressable>
              </View>
              <Text style={styles.photoHint}>
                {photo.kind === "cardapio"
                  ? "Foto do cardápio: eu leio os itens e os preços pra cadastrar."
                  : "Foto da lousa ou folha: eu leio a produção do dia."}
              </Text>
            </>
          ) : null}

          {interpret.error instanceof Error ? <StateText tone="error" text={interpret.error.message} /> : null}
          {upload.error instanceof Error ? <StateText tone="error" text={upload.error.message} /> : null}
          {photoUpload.error instanceof Error ? <StateText tone="error" text={photoUpload.error.message} /> : null}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92
  },
  agentBubble: {
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    backgroundColor: colors.agentSoft,
    padding: 14
  },
  agentBubbleText: {
    color: colors.agentDeep,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    lineHeight: 21
  },
  recordButton: {
    alignItems: "center",
    gap: 6,
    borderRadius: radius.xl,
    padding: 22
  },
  recordButtonActive: {
    shadowColor: "#d81b43",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface,
    padding: 16
  },
  loadingText: {
    flex: 1,
    color: colors.agentDeep,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.bodyBold
  },
  reviewMessage: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.body
  },
  recordText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.bodyBold
  },
  recordHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12.5,
    fontFamily: fonts.body
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border
  },
  orText: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  commandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  photoRow: {
    flexDirection: "row",
    gap: 10
  },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface
  },
  photoButtonText: {
    color: colors.agentDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  photoHint: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  commandInput: {
    flex: 1
  },
  sendButton: {
    height: 52,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill
  },
  resultCard: {
    borderColor: colors.agentSoft,
    borderWidth: 1.5
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  resultTitle: {
    color: colors.agentDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceGlow,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12
  },
  resultItem: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  }
});
