import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowLeft, BadgeCheck, Camera, Keyboard as KeyboardIcon, Mic, PartyPopper } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgentAvatar, AgentTag, AGENT_NAME } from "@/components/agent";
import {
  AddRowButton,
  AgentBubble,
  CostSummaryCard,
  ExtraCostRow,
  IngredientRow,
  NoticeStack,
  ProgressTrail,
  QuestionCard,
  ReceitaCard
} from "@/components/custos/session-view";
import {
  ConfirmSheet,
  ExtraCostSheet,
  IngredienteSheet,
  ReceitaSheet,
  TextComposerSheet
} from "@/components/custos/session-sheets";
import { Button, Screen, SectionTitle, Skeleton, StateText, ProductPhoto } from "@/components/ui";
import { api, ApiError, createCusteioFileForm, type NativeFile } from "@/lib/api";
import {
  clearStoredSessionId,
  guidedItems,
  isConfirmedSession,
  isDiscardedSession,
  pendingIngredientCount,
  readStoredSessionId,
  sessionId,
  stepForAction,
  storeSessionId
} from "@/lib/custeio";
import { formatCurrency, todayInputValue, toNumber } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import { pickImage } from "@/utils/media";
import { fixProductName } from "@/utils/text";
import type { CustoAdicionalRascunho, IngredienteRascunho, RascunhoCusteio, ReceitaRascunho, SessaoCusteio } from "@/types/custeio";

type BootState = "loading" | "none" | "ready" | "unavailable";

type ActiveSheet =
  | { kind: "texto"; pergunta: string | null }
  | { kind: "receita" }
  | { kind: "ingrediente"; index: number | null }
  | { kind: "extra"; index: number | null }
  | { kind: "confirmar" }
  | null;

// Alert.alert com botões não funciona no navegador; lá usamos o confirm nativo.
function confirmDestructive(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    const webConfirm = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    if (!webConfirm || webConfirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Voltar", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm }
  ]);
}

export function ProductCostScreen({ produtoId }: { produtoId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["produtos", "todos"], queryFn: () => api.produtos.list(false) });
  const product = productsQuery.data?.find((item) => item.id === produtoId) || null;
  const productName = product ? fixProductName(product.nome) : "seu produto";
  const precoVenda = product?.preco_atual ? toNumber(product.preco_atual.preco_venda) : null;

  const [boot, setBoot] = useState<BootState>("loading");
  const [session, setSession] = useState<SessaoCusteio | null>(null);
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const sid = sessionId(session);

  const applySession = useCallback(
    (next: SessaoCusteio) => {
      setSession(next);
      const id = sessionId(next);
      if (id) void storeSessionId(produtoId, id);
    },
    [produtoId]
  );

  // Retoma a sessão guardada do produto; sem sessão válida, começa do zero.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await readStoredSessionId(produtoId);
        if (!stored) {
          if (!cancelled) setBoot("none");
          return;
        }
        const remote = await api.custos.assistente.obterSessao(stored);
        if (cancelled) return;
        if (!remote || isDiscardedSession(remote)) {
          await clearStoredSessionId(produtoId);
          if (!cancelled) setBoot("none");
          return;
        }
        setSession(remote);
        setBoot("ready");
      } catch {
        if (!cancelled) {
          await clearStoredSessionId(produtoId);
          setBoot("none");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [produtoId]);

  const createSession = useMutation({
    mutationFn: () =>
      api.custos.assistente.criarSessao({
        produto_id: produtoId,
        contexto: `Usuário quer calcular o custo de ${productName}`
      }),
    onSuccess: (response) => {
      applySession(response);
      setBoot("ready");
    },
    onError: (error) => {
      // Backend de produção pode ainda não ter o assistente publicado.
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) setBoot("unavailable");
    }
  });

  const sendText = useMutation({
    mutationFn: ({ texto, contexto }: { texto: string; contexto?: string | null }) =>
      api.custos.assistente.enviarTexto(sid || "", { texto, contexto }),
    onSuccess: (response) => {
      applySession(response);
      setSheet(null);
    }
  });

  const sendFile = useMutation({
    mutationFn: ({ file, tipo }: { file: NativeFile; tipo: "audio" | "imagem" }) =>
      api.custos.assistente.enviarArquivo(sid || "", createCusteioFileForm(file, tipo)),
    onSuccess: applySession
  });

  const patchDraft = useMutation({
    mutationFn: (payload: { rascunho: RascunhoCusteio; observacao?: string; modo?: "mesclar" | "substituir" }) =>
      api.custos.assistente.corrigirRascunho(sid || "", {
        modo: payload.modo || "mesclar",
        observacao: payload.observacao || null,
        rascunho: payload.rascunho
      }),
    onSuccess: (response) => {
      applySession(response);
      setSheet(null);
    }
  });

  const confirmSession = useMutation({
    mutationFn: (atualizarPreco: boolean) =>
      api.custos.assistente.confirmar(sid || "", {
        permitir_pendencias: false,
        atualizar_preco_custo_produto: atualizarPreco,
        vigente_desde: todayInputValue(),
        motivo_preco: "Custo calculado pelo assistente"
      }),
    onSuccess: (response) => {
      applySession(response);
      setSheet(null);
      // O custo vigente do produto pode ter mudado.
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });

  const discardSession = useMutation({
    mutationFn: () => api.custos.assistente.descartar(sid || ""),
    onSuccess: async () => {
      await clearStoredSessionId(produtoId);
      setSession(null);
      setBoot("none");
    }
  });

  // Recomeço depois de confirmar: limpa a sessão antiga e cria outra.
  const restartSession = useMutation({
    mutationFn: async () => {
      await clearStoredSessionId(produtoId);
      return api.custos.assistente.criarSessao({
        produto_id: produtoId,
        contexto: `Usuário quer recalcular o custo de ${productName}`
      });
    },
    onSuccess: applySession
  });

  // --- Gravação de áudio (mesmo padrão da tela de vendas). -----------------
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

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
        sendFile.mutate({ file: { uri: recorder.uri, name: `custo-${Date.now()}.m4a`, type: "audio/mp4" }, tipo: "audio" });
      }
      return;
    }
    await startRecording();
  }

  function choosePhoto() {
    const doPick = async (source: "camera" | "gallery") => {
      try {
        setMediaError(null);
        const file = await pickImage(source, "custo");
        if (file) sendFile.mutate({ file, tipo: "imagem" });
      } catch (error) {
        setMediaError(error instanceof Error ? error.message : "Não foi possível escolher a foto.");
      }
    };
    if (Platform.OS === "web") {
      void doPick("gallery");
      return;
    }
    Alert.alert("Foto para o assistente", "Nota fiscal, recibo ou print de preço.", [
      { text: "Tirar foto", onPress: () => void doPick("camera") },
      { text: "Galeria / print", onPress: () => void doPick("gallery") },
      { text: "Cancelar", style: "cancel" }
    ]);
  }

  // --- Edições do rascunho. -------------------------------------------------
  const rascunho = session?.rascunho || {};
  const ingredientes = rascunho.ingredientes || [];
  const custosAdicionais = rascunho.custos_adicionais || [];

  function saveReceita(receita: ReceitaRascunho) {
    patchDraft.mutate({ rascunho: { receita }, observacao: "Usuário ajustou a receita pela tela" });
  }

  function saveIngrediente(index: number | null, item: IngredienteRascunho) {
    const list = [...ingredientes];
    if (index === null) list.push(item);
    else list[index] = item;
    patchDraft.mutate({ rascunho: { ingredientes: list }, observacao: "Usuário ajustou ingredientes pela tela" });
  }

  function removeIngrediente(index: number) {
    // Remoção troca o rascunho inteiro para o item sumir de verdade.
    const next: RascunhoCusteio = { ...rascunho, ingredientes: ingredientes.filter((_, i) => i !== index) };
    patchDraft.mutate({ rascunho: next, modo: "substituir", observacao: "Usuário removeu um ingrediente" });
  }

  function saveExtra(index: number | null, item: CustoAdicionalRascunho) {
    const list = [...custosAdicionais];
    if (index === null) list.push(item);
    else list[index] = item;
    patchDraft.mutate({ rascunho: { custos_adicionais: list }, observacao: "Usuário ajustou custos extras pela tela" });
  }

  function removeExtra(index: number) {
    const next: RascunhoCusteio = { ...rascunho, custos_adicionais: custosAdicionais.filter((_, i) => i !== index) };
    patchDraft.mutate({ rascunho: next, modo: "substituir", observacao: "Usuário removeu um custo extra" });
  }

  // --- Estado derivado para a tela. -----------------------------------------
  const confirmed = isConfirmedSession(session);
  const step = confirmed ? 4 : stepForAction(session?.proxima_acao);
  const perguntas = guidedItems(session?.perguntas);
  const pendencias = guidedItems(session?.pendencias);
  const avisos = guidedItems(session?.avisos);
  const hasDraft = Boolean(rascunho.receita) || ingredientes.length > 0 || custosAdicionais.length > 0;
  const thinking = sendText.isPending || sendFile.isPending || patchDraft.isPending;
  const entryCount = session?.entradas?.length || 0;
  const pendingCount = pendingIngredientCount(ingredientes);
  const incompleteHint =
    pendingCount > 0
      ? `Faltam ${pendingCount} ${pendingCount === 1 ? "item" : "itens"} em laranja para eu fechar a conta.`
      : undefined;

  const sendError =
    (sendFile.error instanceof Error ? sendFile.error.message : null) ||
    (sendText.error instanceof Error && !sheet ? sendText.error.message : null) ||
    mediaError;

  const agentMessage = recorderState.isRecording
    ? "Tô ouvindo... me conta da receita!"
    : confirmed
      ? `Custo confirmado e guardado em ${productName}! 🎉`
      : step === 3
        ? "Fechei a conta! 🎉 Confere os números aí embaixo e toca em Confirmar."
        : step === 2
          ? perguntas.length > 0
            ? "Boa! Só faltam alguns detalhes. Me responde aqui embaixo: 👇"
            : "Quase lá! Dá uma olhada nas pendências aqui embaixo."
          : `Me conta como você faz ${productName}: os ingredientes, quanto pagou em cada um e quantas unidades a receita rende. Pode falar do seu jeito!`;

  // --- Render. ----------------------------------------------------------------
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <ProductPhoto url={product?.url_imagem_principal} name={product?.nome || "Produto"} size={52} rounded={radius.lg} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {productName}
            </Text>
            <AgentTag />
          </View>
        </View>

        {boot === "loading" || productsQuery.isLoading ? (
          <View style={styles.skeletons}>
            <Skeleton height={40} rounded={radius.lg} />
            <Skeleton height={90} rounded={radius.xl} />
            <Skeleton height={160} rounded={radius.xl} />
          </View>
        ) : boot === "unavailable" ? (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableEmoji}>🔧</Text>
            <Text style={styles.unavailableTitle}>O assistente de custos ainda não chegou neste servidor.</Text>
            <Text style={styles.unavailableHint}>Tente de novo mais tarde — o resto do app segue funcionando normalmente.</Text>
            <Button title="Voltar" tone="soft" onPress={() => router.back()} />
          </View>
        ) : boot === "none" ? (
          <WelcomeView
            productName={productName}
            currentCost={product?.preco_atual ? toNumber(product.preco_atual.preco_custo) : 0}
            pending={createSession.isPending}
            errorText={
              createSession.error instanceof Error && !(createSession.error instanceof ApiError && createSession.error.status === 404)
                ? createSession.error.message
                : null
            }
            onStart={() => createSession.mutate()}
          />
        ) : (
          <>
            <ProgressTrail step={step} />
            <AgentBubble message={agentMessage} thinking={thinking && !sheet} />

            {confirmed ? (
              <>
                <View style={[styles.celebration, shadows.soft]}>
                  <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.celebrationBadge}>
                    <PartyPopper size={26} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.celebrationTitle}>Custo confirmado!</Text>
                  <Text style={styles.celebrationHint}>
                    Agora cada venda de {productName} já sabe quanto custou para ser feita.
                  </Text>
                </View>
                {session?.custo_simulado ? (
                  <CostSummaryCard custo={session.custo_simulado} precoVenda={precoVenda} confirmed />
                ) : null}
                {restartSession.error instanceof Error ? <StateText tone="error" text={restartSession.error.message} /> : null}
                <Button
                  title={restartSession.isPending ? "Preparando..." : "Calcular de novo"}
                  tone="outline"
                  disabled={restartSession.isPending}
                  onPress={() => restartSession.mutate()}
                />
                <Button title="Voltar ao catálogo" tone="soft" onPress={() => router.back()} />
              </>
            ) : (
              <>
                {perguntas.map((pergunta) => (
                  <QuestionCard key={pergunta} question={pergunta} onAnswer={() => setSheet({ kind: "texto", pergunta })} />
                ))}
                <NoticeStack items={pendencias} tone="danger" />

                <InputDock
                  recording={recorderState.isRecording}
                  busy={thinking}
                  uploading={sendFile.isPending}
                  onMic={() => void toggleRecording()}
                  onWrite={() => setSheet({ kind: "texto", pergunta: null })}
                  onPhoto={choosePhoto}
                />
                {sendError ? <StateText tone="error" text={sendError} /> : null}
                {entryCount > 0 ? (
                  <Text style={styles.entryCount}>
                    {entryCount === 1 ? "1 recado enviado" : `${entryCount} recados enviados`} para {AGENT_NAME}
                  </Text>
                ) : null}

                {hasDraft ? (
                  <>
                    <SectionTitle text="O que já anotei" />
                    <Text style={styles.sectionHint}>
                      {pendingCount > 0
                        ? "Toque nos itens marcados como “revisar” para completar preço e medida."
                        : "Tudo pronto! Confira os itens abaixo antes de confirmar."}
                    </Text>
                    <ReceitaCard rascunho={rascunho} onEdit={() => setSheet({ kind: "receita" })} />
                    {ingredientes.map((ingrediente, index) => (
                      <IngredientRow
                        key={`${ingrediente.nome || "ingrediente"}-${index}`}
                        ingrediente={ingrediente}
                        onEdit={() => setSheet({ kind: "ingrediente", index })}
                      />
                    ))}
                    <AddRowButton label="Adicionar ingrediente" onPress={() => setSheet({ kind: "ingrediente", index: null })} />
                    {custosAdicionais.map((custo, index) => (
                      <ExtraCostRow
                        key={`${custo.nome || custo.tipo || "custo"}-${index}`}
                        custo={custo}
                        onEdit={() => setSheet({ kind: "extra", index })}
                      />
                    ))}
                    <AddRowButton label="Adicionar embalagem, gás..." onPress={() => setSheet({ kind: "extra", index: null })} />
                  </>
                ) : (
                  <Pressable onPress={() => setSheet({ kind: "ingrediente", index: null })} style={({ pressed }) => [pressed && styles.pressed]}>
                    <Text style={styles.manualLink}>Prefiro preencher os ingredientes na mão</Text>
                  </Pressable>
                )}

                <NoticeStack items={avisos} tone="warn" />

                {session?.custo_simulado && hasDraft ? (
                  <CostSummaryCard custo={session.custo_simulado} precoVenda={precoVenda} incompleteHint={incompleteHint} />
                ) : null}

                {session?.pode_confirmar ? (
                  <Button
                    title="Confirmar custo"
                    tone="success"
                    icon={<BadgeCheck size={18} color="#fff" />}
                    onPress={() => setSheet({ kind: "confirmar" })}
                  />
                ) : null}

                {discardSession.error instanceof Error ? <StateText tone="error" text={discardSession.error.message} /> : null}
                <Pressable
                  onPress={() =>
                    confirmDestructive(
                      "Começar de novo",
                      "Tudo o que o assistente anotou nesta sessão será descartado.",
                      "Descartar",
                      () => discardSession.mutate()
                    )
                  }
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={styles.discardLink}>
                    {discardSession.isPending ? "Descartando..." : "Descartar e começar de novo"}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>

      <TextComposerSheet
        visible={sheet?.kind === "texto"}
        pergunta={sheet?.kind === "texto" ? sheet.pergunta : null}
        onClose={() => setSheet(null)}
        onSend={(texto, contexto) => sendText.mutate({ texto, contexto })}
        pending={sendText.isPending}
        errorText={sendText.error instanceof Error ? sendText.error.message : null}
      />
      <ReceitaSheet
        visible={sheet?.kind === "receita"}
        receita={rascunho.receita || null}
        onClose={() => setSheet(null)}
        onSave={saveReceita}
        pending={patchDraft.isPending}
        errorText={patchDraft.error instanceof Error ? patchDraft.error.message : null}
      />
      <IngredienteSheet
        visible={sheet?.kind === "ingrediente"}
        ingrediente={sheet?.kind === "ingrediente" && sheet.index !== null ? ingredientes[sheet.index] || null : null}
        onClose={() => setSheet(null)}
        onSave={(item) => saveIngrediente(sheet?.kind === "ingrediente" ? sheet.index : null, item)}
        onRemove={
          sheet?.kind === "ingrediente" && sheet.index !== null
            ? () => removeIngrediente(sheet.index as number)
            : null
        }
        pending={patchDraft.isPending}
        errorText={patchDraft.error instanceof Error ? patchDraft.error.message : null}
      />
      <ExtraCostSheet
        visible={sheet?.kind === "extra"}
        custo={sheet?.kind === "extra" && sheet.index !== null ? custosAdicionais[sheet.index] || null : null}
        onClose={() => setSheet(null)}
        onSave={(item) => saveExtra(sheet?.kind === "extra" ? sheet.index : null, item)}
        onRemove={sheet?.kind === "extra" && sheet.index !== null ? () => removeExtra(sheet.index as number) : null}
        pending={patchDraft.isPending}
        errorText={patchDraft.error instanceof Error ? patchDraft.error.message : null}
      />
      <ConfirmSheet
        visible={sheet?.kind === "confirmar"}
        custo={session?.custo_simulado || null}
        precoVenda={precoVenda}
        onClose={() => setSheet(null)}
        onConfirm={(atualizarPreco) => confirmSession.mutate(atualizarPreco)}
        pending={confirmSession.isPending}
        errorText={confirmSession.error instanceof Error ? confirmSession.error.message : null}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Boas-vindas: explica a mágica em três passos e cria a sessão.
// ---------------------------------------------------------------------------

function WelcomeView({
  productName,
  currentCost,
  pending,
  errorText,
  onStart
}: {
  productName: string;
  currentCost: number;
  pending: boolean;
  errorText: string | null;
  onStart: () => void;
}) {
  return (
    <View style={styles.welcome}>
      <View style={[styles.welcomeCard, shadows.soft]}>
        <AgentAvatar size={72} />
        <Text style={styles.welcomeTitle}>Quanto custa fazer {productName}?</Text>
        <Text style={styles.welcomeText}>
          Me conta a receita — falando, escrevendo ou mandando a foto do recibo — que eu calculo o custo de cada unidade e
          mostro quanto sobra de lucro.
        </Text>
        {currentCost > 0 ? (
          <Text style={styles.welcomeCurrentCost}>Custo cadastrado hoje: {formatCurrency(currentCost)} por unidade</Text>
        ) : null}
      </View>

      <View style={styles.welcomeSteps}>
        <WelcomeStep emoji="🎤" text="Você me conta a receita do seu jeito" />
        <WelcomeStep emoji="🧾" text="Eu monto as contas e pergunto o que faltar" />
        <WelcomeStep emoji="✅" text="Você confere, confirma e o custo entra no produto" />
      </View>

      {errorText ? <StateText tone="error" text={errorText} /> : null}
      <Button title={pending ? "Chamando o assistente..." : `Começar com ${AGENT_NAME}`} tone="agent" disabled={pending} onPress={onStart} />
    </View>
  );
}

function WelcomeStep({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.welcomeStep}>
      <Text style={styles.welcomeStepEmoji}>{emoji}</Text>
      <Text style={styles.welcomeStepText}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dock de entrada: falar (grande, pulsando ao gravar), escrever e foto.
// ---------------------------------------------------------------------------

function InputDock({
  recording,
  busy,
  uploading,
  onMic,
  onWrite,
  onPhoto
}: {
  recording: boolean;
  busy: boolean;
  uploading: boolean;
  onMic: () => void;
  onWrite: () => void;
  onPhoto: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!recording) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  return (
    <View style={styles.dock}>
      <Pressable onPress={onMic} disabled={uploading} style={({ pressed }) => [pressed && styles.pressed]}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <LinearGradient
            colors={recording ? (["#ff5252", "#d81b43"] as const) : gradients.agent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.micButton, shadows.agent]}
          >
            <Mic size={28} color="#fff" />
            <Text style={styles.micText}>
              {recording ? "Gravando... toque para parar" : uploading ? "Enviando..." : "Toque e fala a receita"}
            </Text>
            {!recording && !uploading ? (
              <Text style={styles.micHint}>Ex: “usei 800g de farinha, o pacote de 5kg custou 22 reais”</Text>
            ) : null}
          </LinearGradient>
        </Animated.View>
      </Pressable>

      <View style={styles.dockRow}>
        <Pressable onPress={busy ? undefined : onWrite} style={({ pressed }) => [styles.dockAction, pressed && styles.pressed]}>
          <KeyboardIcon size={19} color={colors.agentDeep} />
          <Text style={styles.dockActionText}>Escrever</Text>
        </Pressable>
        <Pressable onPress={busy ? undefined : onPhoto} style={({ pressed }) => [styles.dockAction, pressed && styles.pressed]}>
          <Camera size={19} color={colors.agentDeep} />
          <Text style={styles.dockActionText}>Foto ou print</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92
  },
  scroll: {
    flexGrow: 1,
    gap: 16,
    padding: 16,
    paddingBottom: 48
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  backButton: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm
  },
  headerInfo: {
    flex: 1,
    gap: 4
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 21,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  skeletons: {
    gap: 14
  },
  unavailable: {
    alignItems: "center",
    gap: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceGlow,
    padding: 24
  },
  unavailableEmoji: {
    fontSize: 40
  },
  unavailableTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.bodyBold,
    textAlign: "center"
  },
  unavailableHint: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.body,
    textAlign: "center",
    marginBottom: 6
  },
  welcome: {
    gap: 16
  },
  welcomeCard: {
    alignItems: "center",
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 22
  },
  welcomeTitle: {
    color: colors.ink,
    fontSize: 23,
    fontFamily: fonts.display,
    letterSpacing: -0.4,
    textAlign: "center"
  },
  welcomeText: {
    color: colors.muted,
    fontSize: 15.5,
    lineHeight: 23,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  welcomeCurrentCost: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  welcomeSteps: {
    gap: 10
  },
  welcomeStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceGlow,
    paddingHorizontal: 15,
    paddingVertical: 12
  },
  welcomeStepEmoji: {
    fontSize: 22
  },
  welcomeStepText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: fonts.bodyBold
  },
  dock: {
    gap: 10
  },
  micButton: {
    alignItems: "center",
    gap: 4,
    borderRadius: radius.xl,
    paddingHorizontal: 18,
    paddingVertical: 18
  },
  micText: {
    color: "#fff",
    fontSize: 16.5,
    fontFamily: fonts.bodyBold
  },
  micHint: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12.5,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  dockRow: {
    flexDirection: "row",
    gap: 10
  },
  dockAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface
  },
  dockActionText: {
    color: colors.agentDeep,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  },
  entryCount: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  sectionHint: {
    marginTop: -6,
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: fonts.body
  },
  manualLink: {
    color: colors.agentDeep,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold,
    textAlign: "center",
    paddingVertical: 6,
    textDecorationLine: "underline"
  },
  celebration: {
    alignItems: "center",
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20
  },
  celebrationBadge: {
    height: 56,
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill
  },
  celebrationTitle: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  celebrationHint: {
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  discardLink: {
    color: colors.danger,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    textAlign: "center",
    paddingVertical: 8
  }
});
