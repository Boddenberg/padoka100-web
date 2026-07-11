import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Keyboard as KeyboardIcon, Mic, PartyPopper, X } from "lucide-react-native";
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
  formatUnitIssue,
  guidedItems,
  hasRecipeData,
  ingredientCostOk,
  isConfirmedSession,
  isDiscardedSession,
  isGenericPendencia,
  missingPurchaseCount,
  phaseFromSession,
  readStoredPhase,
  readStoredSessionId,
  sessionId,
  simulatedIngredients,
  storeSessionId,
  storeStoredPhase,
  unitMismatchIssues,
  type CusteioPhase,
  type IngredienteCusteado
} from "@/lib/custeio";
import { formatCurrency, todayInputValue, toNumber } from "@/lib/format";
import { haptics } from "@/lib/haptics";
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
        motivo_preco: "Custo calculado pelo assistente",
        // Selo estruturado de IA — o catálogo lê VersaoDePreco.origem pra mostrar o pill.
        origem: "ia"
      }),
    onSuccess: (response) => {
      haptics.success();
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
      haptics.light();
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
  // Custo por ingrediente (mesma ordem do rascunho) que o backend já calculou —
  // fonte de verdade do "pronto" verde e de quais medidas não fecharam.
  const simIngredientes = simulatedIngredients(session?.custo_simulado);
  const unitIssues = unitMismatchIssues(session?.custo_simulado);
  // Pendências do backend para o Resultado: substituímos o texto genérico
  // ("os ingredientes pendentes") por avisos que nomeiam o item e a medida.
  const backendPendencias = guidedItems(session?.pendencias);
  const pendencias =
    unitIssues.length > 0
      ? [...unitIssues.map(formatUnitIssue), ...backendPendencias.filter((texto) => !isGenericPendencia(texto))]
      : backendPendencias;
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
  // O custo pode estar completo mesmo sem preço no rascunho: o backend reusa o
  // preço salvo do insumo (compras anteriores). Se ele já libera a confirmação,
  // não pedimos preço de novo.
  const custoResolvido = Boolean(session?.pode_confirmar);
  const missingPrices = missingPurchaseCount(ingredientes);
  const incompleteHint =
    !custoResolvido && missingPrices > 0
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

  // A seta do topo volta UMA etapa por vez; só sai para o catálogo a partir da
  // primeira etapa (ou quando já confirmou / fora do fluxo).
  function handleBack() {
    if (boot === "ready" && !confirmed) {
      if (phase === "resultado") return goToPhase("precos");
      if (phase === "precos") return goToPhase("receita");
    }
    router.back();
  }

  // --- Render. ----------------------------------------------------------------
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <ProductPhoto url={product?.url_imagem_principal} name={product?.nome || "Produto"} size={52} rounded={radius.lg} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {productName}
            </Text>
            <AgentTag />
          </View>
          {/* Saída rápida do fluxo inteiro (volta ao catálogo). A seta ‹ navega
              entre etapas; o X fecha tudo. */}
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <X size={18} color={colors.muted} />
          </Pressable>
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

            {phase === "resultado" ? (
              <ResultPhase
                confirmed={confirmed}
                productName={productName}
                session={session}
                precoVenda={precoVenda}
                incompleteHint={incompleteHint}
                pendencias={pendencias}
                hasUnitIssues={unitIssues.length > 0}
                acceptPending={confirmSession.isPending}
                acceptError={confirmSession.error instanceof Error ? confirmSession.error.message : null}
                redoPending={restartSession.isPending}
                redoError={restartSession.error instanceof Error ? restartSession.error.message : null}
                onAccept={() => confirmSession.mutate(true)}
                onRedo={() =>
                  confirmDestructive(
                    "Refazer o cálculo",
                    "Você vai perder todo o custo calculado até agora e recomeçar do zero.",
                    "Refazer",
                    () => restartSession.mutate()
                  )
                }
                onBackToCatalog={() => router.back()}
              />
            ) : (
              <>
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
                    simIngredientes={simIngredientes}
                    custosAdicionais={custosAdicionais}
                    priceResolved={custoResolvido}
                    onEditIngrediente={(index) => setSheet({ kind: "ingrediente-preco", index })}
                    onEditExtra={(index) => setSheet({ kind: "extra", index })}
                    onAddExtra={() => setSheet({ kind: "extra", index: null })}
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
  simIngredientes,
  custosAdicionais,
  priceResolved,
  onEditIngrediente,
  onEditExtra,
  onAddExtra,
  onSeeResult
}: {
  ingredientes: IngredienteRascunho[];
  simIngredientes: IngredienteCusteado[];
  custosAdicionais: CustoAdicionalRascunho[];
  priceResolved: boolean;
  onEditIngrediente: (index: number) => void;
  onEditExtra: (index: number) => void;
  onAddExtra: () => void;
  onSeeResult: () => void;
}) {
  return (
    <>
      <SectionTitle text="Preço de cada item" />
      <Text style={styles.sectionHint}>
        {priceResolved
          ? "Já aproveitei os preços que você salvou em compras anteriores. Toque num item só se quiser atualizar o preço."
          : "Toque em cada ingrediente e diga quanto comprou e quanto pagou."}
      </Text>
      {ingredientes.map((ingrediente, index) => (
        <IngredientRow
          key={`${ingrediente.nome || "ingrediente"}-${index}`}
          ingrediente={ingrediente}
          phase="precos"
          priceResolved={priceResolved}
          // Só marca "pronto" verde se o backend realmente fechou o custo do item.
          costOk={simIngredientes.length > 0 ? ingredientCostOk(simIngredientes[index]) : undefined}
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
  hasUnitIssues,
  acceptPending,
  acceptError,
  redoPending,
  redoError,
  onAccept,
  onRedo,
  onBackToCatalog
}: {
  confirmed: boolean;
  productName: string;
  session: SessaoCusteio | null;
  precoVenda: number | null;
  incompleteHint?: string;
  pendencias: string[];
  hasUnitIssues: boolean;
  acceptPending: boolean;
  acceptError: string | null;
  redoPending: boolean;
  redoError: string | null;
  onAccept: () => void;
  onRedo: () => void;
  onBackToCatalog: () => void;
}) {
  if (confirmed) {
    return (
      <>
        <View style={[styles.celebration, shadows.soft]}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.celebrationBadge}>
            <PartyPopper size={26} color="#fff" />
          </LinearGradient>
          <Text style={styles.celebrationTitle}>Custo aceito!</Text>
          <Text style={styles.celebrationHint}>
            Guardei o custo em {productName} com a marca “calculado com IA”. Agora cada venda já sabe quanto custou.
          </Text>
        </View>
        {session?.custo_simulado ? <CostSummaryCard custo={session.custo_simulado} precoVenda={precoVenda} confirmed /> : null}
        {redoError ? <StateText tone="error" text={redoError} /> : null}
        <Button title={redoPending ? "Preparando..." : "Refazer o cálculo"} tone="outline" disabled={redoPending} onPress={onRedo} />
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

      {acceptError ? <StateText tone="error" text={acceptError} /> : null}

      {podeConfirmar ? (
        <>
          <Button
            title={acceptPending ? "Salvando..." : "Aceitar este custo"}
            tone="success"
            icon={<BadgeCheck size={18} color="#fff" />}
            disabled={acceptPending}
            onPress={onAccept}
          />
          <Text style={styles.gateHint}>Ao aceitar, o custo entra em {productName} marcado como “calculado com IA”.</Text>
        </>
      ) : (
        <>
          <NoticeStack items={pendencias} tone="danger" />
          <Text style={styles.gateHint}>
            {hasUnitIssues
              ? "Acerte a medida dos itens acima e o custo fecha sozinho. Toque neles na etapa Preços — ou volte à Receita para trocar a medida usada."
              : "Ainda faltam dados para fechar o custo. Use a seta ↑ para voltar aos preços e completar os itens em laranja."}
          </Text>
        </>
      )}

      <Button title={redoPending ? "Preparando..." : "Refazer do zero"} tone="outline" disabled={redoPending} onPress={onRedo} />
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
  closeButton: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
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
