import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Keyboard as KeyboardIcon, Mic, PartyPopper } from "lucide-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  clearStoredPhase,
  clearStoredSessionId,
  finalidadeForPhase,
  guidedItems,
  hasRecipeData,
  isConfirmedSession,
  isDiscardedSession,
  missingPurchaseCount,
  phaseFromSession,
  readStoredPhase,
  readStoredSessionId,
  sessionId,
  storeSessionId,
  storeStoredPhase,
  type CusteioPhase
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
  | { kind: "ingrediente-receita"; index: number | null }
  | { kind: "ingrediente-preco"; index: number | null }
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
  const [phase, setPhase] = useState<CusteioPhase>("receita");
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

  const goToPhase = useCallback(
    (next: CusteioPhase) => {
      setPhase(next);
      void storeStoredPhase(produtoId, next);
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
        const [remote, storedPhase] = await Promise.all([
          api.custos.assistente.obterSessao(stored),
          readStoredPhase(produtoId)
        ]);
        if (cancelled) return;
        if (!remote || isDiscardedSession(remote)) {
          await Promise.all([clearStoredSessionId(produtoId), clearStoredPhase(produtoId)]);
          if (!cancelled) setBoot("none");
          return;
        }
        setSession(remote);
        setPhase(isConfirmedSession(remote) ? "resultado" : storedPhase || phaseFromSession(remote));
        setBoot("ready");
      } catch {
        if (!cancelled) {
          await Promise.all([clearStoredSessionId(produtoId), clearStoredPhase(produtoId)]);
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
      goToPhase("receita");
      setBoot("ready");
    },
    onError: (error) => {
      // Backend de produção pode ainda não ter o assistente publicado.
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) setBoot("unavailable");
    }
  });

  // Entradas de IA carregam a finalidade da etapa: receita não vira preço.
  const sendText = useMutation({
    mutationFn: ({ texto, contexto }: { texto: string; contexto?: string | null }) =>
      api.custos.assistente.enviarTexto(sid || "", { texto, contexto, finalidade: finalidadeForPhase(phase) }),
    onSuccess: (response) => {
      applySession(response);
      setSheet(null);
    }
  });

  const sendFile = useMutation({
    mutationFn: ({ file, tipo }: { file: NativeFile; tipo: "audio" | "imagem" }) =>
      api.custos.assistente.enviarArquivo(sid || "", createCusteioFileForm(file, tipo, { finalidade: finalidadeForPhase(phase) })),
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

  // Formulários manuais também carregam a finalidade da etapa (receita/compras),
  // como o contrato pede: o backend mescla por nome e não mistura receita com
  // preço. Enviamos só os campos daquela etapa.
  const sendForm = useMutation({
    mutationFn: ({ dados, finalidade }: { dados: Record<string, unknown>; finalidade: "receita" | "compras" | "completo" }) =>
      api.custos.assistente.enviarFormulario(sid || "", dados, finalidade),
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
      goToPhase("resultado");
      // O custo vigente do produto pode ter mudado.
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });

  const discardSession = useMutation({
    mutationFn: () => api.custos.assistente.descartar(sid || ""),
    onSuccess: async () => {
      await Promise.all([clearStoredSessionId(produtoId), clearStoredPhase(produtoId)]);
      setSession(null);
      setBoot("none");
    }
  });

  // Recomeço depois de confirmar: limpa a sessão antiga e cria outra.
  const restartSession = useMutation({
    mutationFn: async () => {
      await Promise.all([clearStoredSessionId(produtoId), clearStoredPhase(produtoId)]);
      return api.custos.assistente.criarSessao({
        produto_id: produtoId,
        contexto: `Usuário quer recalcular o custo de ${productName}`
      });
    },
    onSuccess: (response) => {
      applySession(response);
      goToPhase("receita");
    }
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
        // Nota/recibo/receita vão inteiros (sem recorte forçado) e com mais
        // qualidade, para o assistente conseguir ler os valores.
        const file = await pickImage(source, "custo", { allowsEditing: false, quality: 0.85 });
        if (file) sendFile.mutate({ file, tipo: "imagem" });
      } catch (error) {
        setMediaError(error instanceof Error ? error.message : "Não foi possível escolher a foto.");
      }
    };
    const label = phase === "receita" ? "Foto ou print da receita." : "Foto da nota, cupom ou preços do mercado.";
    if (Platform.OS === "web") {
      void doPick("gallery");
      return;
    }
    Alert.alert("Foto para o assistente", label, [
      { text: "Tirar foto", onPress: () => void doPick("camera") },
      { text: "Galeria / print", onPress: () => void doPick("gallery") },
      { text: "Cancelar", style: "cancel" }
    ]);
  }

  // --- Edições do rascunho. -------------------------------------------------
  const rascunho = session?.rascunho || {};
  const ingredientes = rascunho.ingredientes || [];
  const custosAdicionais = rascunho.custos_adicionais || [];

  // Receita e ingredientes vão pelo formulário com finalidade (o backend mescla
  // por nome e preserva os campos da outra etapa). O nome da receita é sempre
  // o nome do produto — cada produto tem uma receita só.
  function saveReceita(receita: ReceitaRascunho) {
    sendForm.mutate({ dados: { receita: { ...receita, nome: productName } }, finalidade: "receita" });
  }

  function saveIngredienteReceita(item: IngredienteRascunho) {
    sendForm.mutate({ dados: { ingredientes: [item] }, finalidade: "receita" });
  }

  function saveIngredientePreco(item: IngredienteRascunho) {
    sendForm.mutate({ dados: { ingredientes: [item] }, finalidade: "compras" });
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
  const step = confirmed ? 4 : phase === "receita" ? 1 : phase === "precos" ? 2 : 3;
  const pendencias = guidedItems(session?.pendencias);
  const thinking = sendText.isPending || sendFile.isPending || patchDraft.isPending || sendForm.isPending;
  // Estado de envio por tipo: a foto mostra "Enviando" no botão de foto, não no
  // microfone (era o que confundia).
  const audioUploading = sendFile.isPending && sendFile.variables?.tipo === "audio";
  const photoUploading = sendFile.isPending && sendFile.variables?.tipo === "imagem";

  const rendimentoOk = toNumber(rascunho.receita?.rendimento) > 0;
  const recipeReadyCount = ingredientes.filter(hasRecipeData).length;
  const canAdvanceToPrecos = rendimentoOk && recipeReadyCount > 0;
  // Receita "completa": rendimento + todos os ingredientes com quantidade usada.
  const recipeComplete = rendimentoOk && ingredientes.length > 0 && ingredientes.every(hasRecipeData);
  const missingPrices = missingPurchaseCount(ingredientes);
  const incompleteHint =
    missingPrices > 0
      ? `Faltam ${missingPrices} ${missingPrices === 1 ? "preço" : "preços"} para eu fechar a conta.`
      : undefined;

  const sendError =
    (sendFile.error instanceof Error ? sendFile.error.message : null) ||
    (sendText.error instanceof Error && !sheet ? sendText.error.message : null) ||
    mediaError;

  const agentMessage = recorderState.isRecording
    ? phase === "receita"
      ? "Tô ouvindo... me conta a receita!"
      : "Tô ouvindo... me diz os preços!"
    : confirmed
      ? `Custo confirmado e guardado em ${productName}! 🎉`
      : phase === "resultado"
        ? "Confere o custo aqui embaixo. Se estiver certo, é só confirmar. ✅"
        : phase === "precos"
          ? "Agora me diga quanto você comprou e pagou de cada item. 💰"
          : "Me conta os ingredientes, quanto de cada um você usa e quantas unidades rende. Os preços ficam pra próxima etapa.";

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

            {phase === "resultado" ? (
              <AgentBubble message={agentMessage} thinking={thinking && !sheet} />
            ) : null}

            {phase === "resultado" ? (
              <ResultPhase
                confirmed={confirmed}
                productName={productName}
                session={session}
                precoVenda={precoVenda}
                incompleteHint={incompleteHint}
                pendencias={pendencias}
                restartPending={restartSession.isPending}
                restartError={restartSession.error instanceof Error ? restartSession.error.message : null}
                onConfirm={() => setSheet({ kind: "confirmar" })}
                onRestart={() => restartSession.mutate()}
                onBackToPrecos={() => goToPhase("precos")}
                onBackToCatalog={() => router.back()}
              />
            ) : (
              <>
                <PhaseHeader phase={phase} message={agentMessage} thinking={thinking && !sheet} />

                <InputMethods
                  phase={phase}
                  recording={recorderState.isRecording}
                  busy={thinking}
                  audioUploading={audioUploading}
                  photoUploading={photoUploading}
                  onMic={() => void toggleRecording()}
                  onWrite={() => setSheet({ kind: "texto", pergunta: null })}
                  onPhoto={choosePhoto}
                />
                {sendError ? <StateText tone="error" text={sendError} /> : null}

                {phase === "receita" ? (
                  <RecipePhaseBody
                    rascunho={rascunho}
                    productName={productName}
                    ingredientes={ingredientes}
                    canAdvance={canAdvanceToPrecos}
                    recipeComplete={recipeComplete}
                    onEditReceita={() => setSheet({ kind: "receita" })}
                    onEditIngrediente={(index) => setSheet({ kind: "ingrediente-receita", index })}
                    onAddIngrediente={() => setSheet({ kind: "ingrediente-receita", index: null })}
                    onAdvance={() => goToPhase("precos")}
                  />
                ) : (
                  <PricePhaseBody
                    ingredientes={ingredientes}
                    custosAdicionais={custosAdicionais}
                    onEditIngrediente={(index) => setSheet({ kind: "ingrediente-preco", index })}
                    onEditExtra={(index) => setSheet({ kind: "extra", index })}
                    onAddExtra={() => setSheet({ kind: "extra", index: null })}
                    onBack={() => goToPhase("receita")}
                    onSeeResult={() => goToPhase("resultado")}
                  />
                )}

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
                  <Text style={styles.discardLink}>{discardSession.isPending ? "Descartando..." : "Descartar e começar de novo"}</Text>
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
        nomeReceita={productName}
        receita={rascunho.receita || null}
        onClose={() => setSheet(null)}
        onSave={saveReceita}
        pending={sendForm.isPending}
        errorText={sendForm.error instanceof Error ? sendForm.error.message : null}
      />
      <IngredienteSheet
        visible={sheet?.kind === "ingrediente-receita" || sheet?.kind === "ingrediente-preco"}
        mode={sheet?.kind === "ingrediente-preco" ? "preco" : "receita"}
        ingrediente={
          (sheet?.kind === "ingrediente-receita" || sheet?.kind === "ingrediente-preco") && sheet.index !== null
            ? ingredientes[sheet.index] || null
            : null
        }
        onClose={() => setSheet(null)}
        onSave={(item) => (sheet?.kind === "ingrediente-preco" ? saveIngredientePreco(item) : saveIngredienteReceita(item))}
        onRemove={
          sheet?.kind === "ingrediente-receita" && sheet.index !== null ? () => removeIngrediente(sheet.index as number) : null
        }
        pending={sendForm.isPending || patchDraft.isPending}
        errorText={
          sendForm.error instanceof Error
            ? sendForm.error.message
            : patchDraft.error instanceof Error
              ? patchDraft.error.message
              : null
        }
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
// Etapa 1 — Receita: ingredientes + quantidades usadas + rendimento.
// ---------------------------------------------------------------------------

function RecipePhaseBody({
  rascunho,
  productName,
  ingredientes,
  canAdvance,
  recipeComplete,
  onEditReceita,
  onEditIngrediente,
  onAddIngrediente,
  onAdvance
}: {
  rascunho: RascunhoCusteio;
  productName: string;
  ingredientes: IngredienteRascunho[];
  canAdvance: boolean;
  recipeComplete: boolean;
  onEditReceita: () => void;
  onEditIngrediente: (index: number) => void;
  onAddIngrediente: () => void;
  onAdvance: () => void;
}) {
  const hasDraft = Boolean(rascunho.receita) || ingredientes.length > 0;

  if (!hasDraft) {
    return (
      <Pressable onPress={onAddIngrediente} style={({ pressed }) => [pressed && styles.pressed]}>
        <Text style={styles.manualLink}>Prefiro preencher os ingredientes na mão</Text>
      </Pressable>
    );
  }

  return (
    <>
      <SectionTitle text="A receita" />
      <Text style={styles.sectionHint}>Aqui vai só o que entra na receita e quanto de cada um. Os preços são a próxima etapa.</Text>
      <ReceitaCard rascunho={rascunho} title={productName} onEdit={onEditReceita} />
      {ingredientes.map((ingrediente, index) => (
        <IngredientRow
          key={`${ingrediente.nome || "ingrediente"}-${index}`}
          ingrediente={ingrediente}
          phase="receita"
          onEdit={() => onEditIngrediente(index)}
        />
      ))}
      <AddRowButton label="Adicionar ingrediente" onPress={onAddIngrediente} />

      {/* Tudo pronto: chamada clara e verde para seguir. */}
      {recipeComplete ? (
        <View style={styles.readyCallout}>
          <Text style={styles.readyEmoji}>✅</Text>
          <Text style={styles.readyText}>Receita completa! Agora é só passar para os preços.</Text>
        </View>
      ) : null}

      <Button
        title="Avançar para os preços"
        tone={recipeComplete ? "success" : "agent"}
        icon={<ArrowRight size={18} color={canAdvance ? "#fff" : colors.muted} />}
        disabled={!canAdvance}
        onPress={onAdvance}
      />
      {!canAdvance ? (
        <Text style={styles.gateHint}>Informe o rendimento e ao menos um ingrediente para avançar.</Text>
      ) : !recipeComplete ? (
        <Text style={styles.gateHint}>Você pode completar os itens em laranja ou seguir para os preços.</Text>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Etapa 2 — Preços: quanto comprou e pagou de cada item + custos extras.
// ---------------------------------------------------------------------------

function PricePhaseBody({
  ingredientes,
  custosAdicionais,
  onEditIngrediente,
  onEditExtra,
  onAddExtra,
  onBack,
  onSeeResult
}: {
  ingredientes: IngredienteRascunho[];
  custosAdicionais: CustoAdicionalRascunho[];
  onEditIngrediente: (index: number) => void;
  onEditExtra: (index: number) => void;
  onAddExtra: () => void;
  onBack: () => void;
  onSeeResult: () => void;
}) {
  return (
    <>
      <SectionTitle text="Preço de cada item" />
      <Text style={styles.sectionHint}>Toque em cada ingrediente e diga quanto comprou e quanto pagou.</Text>
      {ingredientes.map((ingrediente, index) => (
        <IngredientRow
          key={`${ingrediente.nome || "ingrediente"}-${index}`}
          ingrediente={ingrediente}
          phase="precos"
          onEdit={() => onEditIngrediente(index)}
        />
      ))}

      <SectionTitle text="Outros custos" />
      <Text style={styles.sectionHint}>Embalagem, gás, energia, transporte... o que mais entra no bolso.</Text>
      {custosAdicionais.map((custo, index) => (
        <ExtraCostRow key={`${custo.nome || custo.tipo || "custo"}-${index}`} custo={custo} onEdit={() => onEditExtra(index)} />
      ))}
      <AddRowButton label="Adicionar embalagem, gás..." onPress={onAddExtra} />

      <Button title="Ver o resultado" tone="agent" icon={<ArrowRight size={18} color="#fff" />} onPress={onSeeResult} />
      <Pressable onPress={onBack} style={({ pressed }) => [styles.backLinkRow, pressed && styles.pressed]}>
        <ArrowLeft size={16} color={colors.muted} />
        <Text style={styles.backLinkText}>Voltar à receita</Text>
      </Pressable>
    </>
  );
}

// ---------------------------------------------------------------------------
// Etapa 3 — Resultado: revisar e confirmar, depois ficha final.
// ---------------------------------------------------------------------------

function ResultPhase({
  confirmed,
  productName,
  session,
  precoVenda,
  incompleteHint,
  pendencias,
  restartPending,
  restartError,
  onConfirm,
  onRestart,
  onBackToPrecos,
  onBackToCatalog
}: {
  confirmed: boolean;
  productName: string;
  session: SessaoCusteio | null;
  precoVenda: number | null;
  incompleteHint?: string;
  pendencias: string[];
  restartPending: boolean;
  restartError: string | null;
  onConfirm: () => void;
  onRestart: () => void;
  onBackToPrecos: () => void;
  onBackToCatalog: () => void;
}) {
  if (confirmed) {
    return (
      <>
        <View style={[styles.celebration, shadows.soft]}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.celebrationBadge}>
            <PartyPopper size={26} color="#fff" />
          </LinearGradient>
          <Text style={styles.celebrationTitle}>Custo confirmado!</Text>
          <Text style={styles.celebrationHint}>Agora cada venda de {productName} já sabe quanto custou para ser feita.</Text>
        </View>
        {session?.custo_simulado ? <CostSummaryCard custo={session.custo_simulado} precoVenda={precoVenda} confirmed /> : null}
        {restartError ? <StateText tone="error" text={restartError} /> : null}
        <Button title={restartPending ? "Preparando..." : "Calcular de novo"} tone="outline" disabled={restartPending} onPress={onRestart} />
        <Button title="Voltar ao catálogo" tone="soft" onPress={onBackToCatalog} />
      </>
    );
  }

  const podeConfirmar = Boolean(session?.pode_confirmar);

  return (
    <>
      <SectionTitle text="Resultado" />
      {session?.custo_simulado ? (
        <CostSummaryCard custo={session.custo_simulado} precoVenda={precoVenda} incompleteHint={incompleteHint} />
      ) : null}

      {podeConfirmar ? (
        <Button title="Confirmar custo" tone="success" icon={<BadgeCheck size={18} color="#fff" />} onPress={onConfirm} />
      ) : (
        <>
          <NoticeStack items={pendencias} tone="danger" />
          <Text style={styles.gateHint}>Ainda faltam dados para fechar o custo. Volte aos preços e complete os itens em laranja.</Text>
        </>
      )}

      <Pressable onPress={onBackToPrecos} style={({ pressed }) => [styles.backLinkRow, pressed && styles.pressed]}>
        <ArrowLeft size={16} color={colors.muted} />
        <Text style={styles.backLinkText}>Voltar aos preços</Text>
      </Pressable>
    </>
  );
}

// ---------------------------------------------------------------------------
// Boas-vindas: explica a jornada em três passos e cria a sessão.
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
          Vamos por partes: primeiro a receita, depois os preços do que você comprou. No fim eu mostro o custo de cada unidade
          e quanto sobra de lucro.
        </Text>
        {currentCost > 0 ? (
          <Text style={styles.welcomeCurrentCost}>Custo cadastrado hoje: {formatCurrency(currentCost)} por unidade</Text>
        ) : null}
      </View>

      <View style={styles.welcomeSteps}>
        <WelcomeStep number="1" emoji="🍞" title="A receita" text="Os ingredientes e quanto de cada um você usa" />
        <WelcomeStep number="2" emoji="💰" title="Os preços" text="Quanto comprou e pagou em cada item" />
        <WelcomeStep number="3" emoji="✅" title="O resultado" text="Confere o custo e confirma no produto" />
      </View>

      {errorText ? <StateText tone="error" text={errorText} /> : null}
      <Button title={pending ? "Chamando o assistente..." : `Começar com ${AGENT_NAME}`} tone="agent" disabled={pending} onPress={onStart} />
    </View>
  );
}

function WelcomeStep({ number, emoji, title, text }: { number: string; emoji: string; title: string; text: string }) {
  return (
    <View style={styles.welcomeStep}>
      <View style={styles.welcomeStepNumber}>
        <Text style={styles.welcomeStepNumberText}>{number}</Text>
      </View>
      <Text style={styles.welcomeStepEmoji}>{emoji}</Text>
      <View style={styles.welcomeStepBody}>
        <Text style={styles.welcomeStepTitle}>{title}</Text>
        <Text style={styles.welcomeStepText}>{text}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cabeçalho da etapa: deixa claríssimo em que passo o usuário está.
// ---------------------------------------------------------------------------

function PhaseHeader({ phase, message, thinking }: { phase: CusteioPhase; message: string; thinking: boolean }) {
  const step = phase === "receita" ? 1 : phase === "precos" ? 2 : 3;
  const title = phase === "receita" ? "A receita" : phase === "precos" ? "Os preços" : "Resultado";

  return (
    <View style={styles.phaseHeader}>
      <View style={styles.phaseChip}>
        <Text style={styles.phaseChipStep}>ETAPA {step} DE 3</Text>
        <View style={styles.phaseChipDot} />
        <Text style={styles.phaseChipTitle}>{title}</Text>
      </View>
      <AgentBubble message={message} thinking={thinking} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Entrada: três formas com o mesmo peso — falar, escrever ou foto. Cada uma
// mostra seu próprio "Enviando...", então a foto não aparece no microfone.
// ---------------------------------------------------------------------------

function InputMethods({
  phase,
  recording,
  busy,
  audioUploading,
  photoUploading,
  onMic,
  onWrite,
  onPhoto
}: {
  phase: CusteioPhase;
  recording: boolean;
  busy: boolean;
  audioUploading: boolean;
  photoUploading: boolean;
  onMic: () => void;
  onWrite: () => void;
  onPhoto: () => void;
}) {
  const recipe = phase === "receita";

  // Gravando: banner vermelho ocupa o lugar dos botões, sem ambiguidade.
  if (recording) {
    return (
      <Pressable onPress={onMic} style={({ pressed }) => [pressed && styles.pressed]}>
        <LinearGradient
          colors={["#ff5252", "#d81b43"] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.recBanner, shadows.agent]}
        >
          <View style={styles.recPulse}>
            <Mic size={22} color="#fff" />
          </View>
          <View style={styles.recBody}>
            <Text style={styles.recTitle}>Gravando... toque para parar</Text>
            <Text style={styles.recHint}>{recipe ? "Pode falar a receita" : "Pode falar os preços"}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <View style={styles.methods}>
      <Text style={styles.methodsTitle}>Como você quer contar?</Text>
      <View style={styles.methodsRow}>
        <MethodTile
          primary
          label="Falar"
          caption="por voz"
          icon={<Mic size={22} color="#fff" />}
          busy={audioUploading}
          disabled={busy && !audioUploading}
          onPress={onMic}
        />
        <MethodTile
          label="Escrever"
          caption="digitar"
          icon={<KeyboardIcon size={22} color={colors.agentDeep} />}
          busy={false}
          disabled={busy}
          onPress={onWrite}
        />
        <MethodTile
          label="Foto"
          caption={recipe ? "da receita" : "da nota"}
          icon={<Camera size={22} color={colors.agentDeep} />}
          busy={photoUploading}
          disabled={busy && !photoUploading}
          onPress={onPhoto}
        />
      </View>
      <Text style={styles.methodsFootnote}>Ou toque num item da lista abaixo para preencher você mesmo.</Text>
    </View>
  );
}

function MethodTile({
  primary,
  label,
  caption,
  icon,
  busy,
  disabled,
  onPress
}: {
  primary?: boolean;
  label: string;
  caption: string;
  icon: ReactNode;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.tile, pressed && !disabled ? styles.pressed : null, disabled && styles.tileDisabled]}
    >
      <View style={[styles.tileIcon, primary && styles.tileIconPrimary]}>
        {busy ? <ActivityIndicator size="small" color={primary ? "#fff" : colors.agentDeep} /> : icon}
      </View>
      <Text style={styles.tileLabel}>{busy ? "Enviando..." : label}</Text>
      {!busy ? <Text style={styles.tileCaption}>{caption}</Text> : null}
    </Pressable>
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
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  welcomeStepNumber: {
    height: 26,
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.agentSoft
  },
  welcomeStepNumberText: {
    color: colors.agentDeep,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  welcomeStepEmoji: {
    fontSize: 22
  },
  welcomeStepBody: {
    flex: 1
  },
  welcomeStepTitle: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  welcomeStepText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body
  },
  phaseHeader: {
    gap: 10
  },
  phaseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: colors.agentSoft,
    paddingHorizontal: 13,
    paddingVertical: 6
  },
  phaseChipStep: {
    color: colors.agentDeep,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.7
  },
  phaseChipDot: {
    height: 4,
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.agentDeep
  },
  phaseChipTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  },
  methods: {
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceGlow,
    padding: 14
  },
  methodsTitle: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  methodsRow: {
    flexDirection: "row",
    gap: 10
  },
  methodsFootnote: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fonts.body
  },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface,
    paddingVertical: 12
  },
  tileDisabled: {
    opacity: 0.45
  },
  tileIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.agentSoft
  },
  tileIconPrimary: {
    backgroundColor: colors.agentDeep
  },
  tileLabel: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  tileCaption: {
    color: colors.muted,
    fontSize: 11.5,
    fontFamily: fonts.body
  },
  recBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    padding: 16
  },
  recPulse: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  recBody: {
    flex: 1,
    gap: 2
  },
  recTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.bodyBold
  },
  recHint: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12.5,
    fontFamily: fonts.body
  },
  sectionHint: {
    marginTop: -6,
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: fonts.body
  },
  gateHint: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  readyCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  readyEmoji: {
    fontSize: 20
  },
  readyText: {
    flex: 1,
    color: colors.success,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  },
  backLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 42
  },
  backLinkText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
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
