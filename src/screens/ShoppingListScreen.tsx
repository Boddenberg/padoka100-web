import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { router as appRouter, useRouter } from "expo-router";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  ListChecks,
  Mic,
  Send,
  Share2,
  ShoppingCart,
  Sparkles,
  TriangleAlert
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AGENT_NAME, AgentAvatar } from "@/components/agent";
import { Button, EmptyState, Input, Money, ProductPhoto, Screen, SectionTitle, Sheet, Skeleton, StateText } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { hasAccess } from "@/lib/access";
import { api, createAudioForm, createIaPhotoForm, type NativeFile } from "@/lib/api";
import { guidedItems, ingredientEmoji } from "@/lib/custeio";
import { formatCurrency, formatDate, todayInputValue, toNumber } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import { pickImage } from "@/utils/media";
import { fixProductName } from "@/utils/text";
import type { Produto } from "@/types/api";
import type { ListaCompra, ListaCompraItem } from "@/types/custeio";

type Step = "montar" | "resultado";

// A leitura de foto usa modelo de visão e pode demorar; corremos contra um
// relógio para o botão não travar em "Lendo...".
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("A leitura demorou demais. Tente com uma foto mais nítida.")), ms))
  ]);
}

const MARGENS = [0, 5, 10, 15];

// Número "bonito": tira zeros à toa ("5.50" → "5,5"), pt-BR.
function formatQty(value: number | string | null | undefined) {
  const n = toNumber(value);
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

// A lista salva pode vir como array puro ou embrulhada.
function normalizeLists(raw: unknown): ListaCompra[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") {
    for (const key of ["listas", "listas_compras", "items", "dados", "results", "data"]) {
      const value = (raw as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        list = value;
        break;
      }
    }
  }
  return list.filter((item): item is ListaCompra => Boolean(item) && typeof item === "object");
}

function buildShareText(lista: ListaCompra) {
  const linhas = (lista.itens || []).map(
    (item) => `• ${item.nome}: ${formatQty(item.quantidade_sugerida)} ${item.unidade_sugerida || ""}`.trim()
  );
  return [
    `🛒 ${lista.nome || "Lista de compras"}`,
    lista.data_referencia ? `Referência: ${formatDate(lista.data_referencia)}` : null,
    "",
    ...linhas,
    "",
    `Total estimado: ${formatCurrency(lista.total_estimado)}`
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function ShoppingListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canUseAgent = hasAccess(user, "ia.operacional");
  const [step, setStep] = useState<Step>("montar");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [margem, setMargem] = useState(10);
  const [lista, setLista] = useState<ListaCompra | null>(null);
  const [saved, setSaved] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planNotice, setPlanNotice] = useState<string | null>(null);

  const productsQuery = useQuery({ queryKey: ["produtos", "ativos"], queryFn: () => api.produtos.list(true) });
  const recipeQuery = useQuery({ queryKey: ["produtos-com-receita"], queryFn: () => api.custos.produtosComReceita() });
  const historyQuery = useQuery({ queryKey: ["listas-compras"], queryFn: api.custos.listaCompras.historico });

  const products = productsQuery.data || [];
  // Só dá para calcular a lista de quem tem receita COM ingredientes. Os demais
  // ficam numa seção à parte, com atalho para a jornada de custo/receita.
  const recipeIds = new Set(
    (recipeQuery.data || []).filter((item) => (item.total_ingredientes ?? 0) > 0).map((item) => item.produto_id)
  );
  const productsWithRecipe = products.filter((produto) => recipeIds.has(produto.id));
  const productsWithoutRecipe = products.filter((produto) => !recipeIds.has(produto.id));
  const selecionados = productsWithRecipe.filter((produto) => (quantities[produto.id] || 0) > 0);
  const savedLists = normalizeLists(historyQuery.data);

  // Voz/foto preenchem as quantidades dos produtos que TÊM receita; os demais
  // viram um recado para a pessoa cadastrar a receita antes.
  function applyPlan(map: Record<string, number>) {
    const semReceita: string[] = [];
    const aplicar: Record<string, number> = {};
    for (const [produtoId, quantidade] of Object.entries(map)) {
      if (recipeIds.has(produtoId)) aplicar[produtoId] = quantidade;
      else {
        const produto = products.find((item) => item.id === produtoId);
        if (produto) semReceita.push(fixProductName(produto.nome));
      }
    }
    if (Object.keys(aplicar).length > 0) {
      setQuantities((current) => ({ ...current, ...aplicar }));
      haptics.success();
    }
    setPlanNotice(
      semReceita.length > 0
        ? `Preenchi o que já tem receita. Ainda sem receita: ${semReceita.join(", ")}.`
        : Object.keys(aplicar).length > 0
          ? "Prontinho, preenchi as quantidades!"
          : "Não consegui identificar produtos com receita nessa fala."
    );
  }

  const buildItens = () => selecionados.map((produto) => ({ produto_id: produto.id, quantidade: quantities[produto.id] }));

  const gerar = useMutation({
    mutationFn: (salvar: boolean) =>
      api.custos.listaCompras.gerar({
        nome: `Produção de ${formatDate(todayInputValue())}`,
        data_referencia: todayInputValue(),
        margem_percentual: margem,
        salvar,
        itens: buildItens()
      }),
    onSuccess: (response, salvar) => {
      setLista(response);
      setSaved(Boolean(salvar));
      setStep("resultado");
    }
  });

  const openSaved = useMutation({
    mutationFn: (id: string) => api.custos.listaCompras.obter(id),
    onSuccess: (response) => {
      if (!response) return;
      setLista(response);
      setSaved(true);
      setStep("resultado");
    }
  });

  function setQuantity(produtoId: string, value: string) {
    const n = Math.max(0, Math.floor(Number(value.replace(/\D/g, "")) || 0));
    setQuantities((current) => ({ ...current, [produtoId]: n }));
  }

  async function share() {
    if (!lista) return;
    try {
      await Share.share({ message: buildShareText(lista) });
    } catch {
      // usuário cancelou ou share indisponível — ignora.
    }
  }

  function backToMontar() {
    setStep("montar");
    setSaved(false);
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        // iOS: rola sozinho até o campo focado (o teclado não cobre mais o
        // produto lá embaixo); no Android a janela já redimensiona.
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => (step === "resultado" ? backToMontar() : router.back())}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Lista de compras</Text>
            <Text style={styles.headerSubtitle}>Planeje a produção e veja o que comprar</Text>
          </View>
        </View>

        {step === "montar" ? (
          <MontarStep
            products={productsWithRecipe}
            productsWithoutRecipe={productsWithoutRecipe}
            loading={productsQuery.isLoading || recipeQuery.isLoading}
            error={productsQuery.error instanceof Error ? productsQuery.error.message : null}
            quantities={quantities}
            margem={margem}
            selectedCount={selecionados.length}
            pending={gerar.isPending}
            gerarError={gerar.error instanceof Error ? gerar.error.message : null}
            savedLists={savedLists}
            canUseAgent={canUseAgent}
            planNotice={planNotice}
            onSetMargem={setMargem}
            onSetQuantity={setQuantity}
            onCalcular={() => gerar.mutate(false)}
            onOpenSaved={(id) => openSaved.mutate(id)}
            onOpenPlan={() => {
              setPlanNotice(null);
              setPlanOpen(true);
            }}
            onOpenCost={(produtoId) => router.push(`/produto/${produtoId}/custos`)}
          />
        ) : lista ? (
          <ResultStep
            lista={lista}
            saved={saved}
            saving={gerar.isPending}
            saveError={gerar.error instanceof Error ? gerar.error.message : null}
            onSave={() => gerar.mutate(true)}
            onShare={share}
            onEdit={backToMontar}
          />
        ) : null}
      </ScrollView>

      <PlanProductionSheet visible={planOpen} onClose={() => setPlanOpen(false)} onApply={applyPlan} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Passo 1 — Montar: margem + produtos e quantidades.
// ---------------------------------------------------------------------------

function MontarStep({
  products,
  productsWithoutRecipe,
  loading,
  error,
  quantities,
  margem,
  selectedCount,
  pending,
  gerarError,
  savedLists,
  canUseAgent,
  planNotice,
  onSetMargem,
  onSetQuantity,
  onCalcular,
  onOpenSaved,
  onOpenPlan,
  onOpenCost
}: {
  products: Produto[];
  productsWithoutRecipe: Produto[];
  loading: boolean;
  error: string | null;
  quantities: Record<string, number>;
  margem: number;
  selectedCount: number;
  pending: boolean;
  gerarError: string | null;
  savedLists: ListaCompra[];
  canUseAgent: boolean;
  planNotice: string | null;
  onSetMargem: (value: number) => void;
  onSetQuantity: (produtoId: string, value: string) => void;
  onCalcular: () => void;
  onOpenSaved: (id: string) => void;
  onOpenPlan: () => void;
  onOpenCost: (produtoId: string) => void;
}) {
  return (
    <>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, shadows.floating]}>
        <View pointerEvents="none" style={styles.heroGlow} />
        <View style={styles.heroIcon}>
          <ShoppingCart size={24} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>O que você vai produzir?</Text>
        <Text style={styles.heroText}>Diga quantas unidades de cada produto e eu calculo o que precisa comprar, com o custo estimado.</Text>
      </LinearGradient>

      {/* Atalho para preencher tudo por voz ou foto — sem digitar campo a campo. */}
      {canUseAgent && products.length > 0 ? (
        <Pressable onPress={onOpenPlan} style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}>
          <AgentAvatar size={44} />
          <View style={styles.planInfo}>
            <Text style={styles.planTitle}>Preencher por voz ou foto</Text>
            <Text style={styles.planHint}>Fale ou fotografe a produção que o {AGENT_NAME} preenche as quantidades.</Text>
          </View>
          <ChevronRight size={18} color={colors.agentDeep} />
        </Pressable>
      ) : null}
      {planNotice ? <StateText tone="success" text={planNotice} /> : null}

      <SectionTitle text="Margem de segurança" />
      <Text style={styles.hint}>Uma folga para sobra ou perda. Aumenta as quantidades e o custo.</Text>
      <View style={styles.marginRow}>
        {MARGENS.map((value) => {
          const active = value === margem;
          return (
            <Pressable key={value} onPress={() => onSetMargem(value)} style={[styles.marginChip, active && styles.marginChipActive]}>
              <Text style={[styles.marginChipText, active && styles.marginChipTextActive]}>{value === 0 ? "Sem folga" : `+${value}%`}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle text="Produtos" />
      {loading ? (
        <View style={styles.skeletons}>
          <Skeleton height={68} rounded={radius.lg} />
          <Skeleton height={68} rounded={radius.lg} />
        </View>
      ) : null}
      {error ? <StateText tone="error" text={error} /> : null}
      {!loading && products.length === 0 && productsWithoutRecipe.length === 0 ? (
        <EmptyState
          emoji="🥖"
          title="Nenhum produto ativo"
          hint="Cadastre o que você vende para montar a lista de compras."
          actionLabel="Cadastrar produto"
          onAction={() => appRouter.push("/produtos?novo=1")}
        />
      ) : !loading && products.length === 0 ? (
        <EmptyState
          emoji="📋"
          title="Nenhum produto com receita ainda"
          hint="A lista de compras usa a receita para saber os insumos. Cadastre a receita de um produto abaixo para começar."
        />
      ) : null}
      {products.map((produto) => (
        <View key={produto.id} style={[styles.productRow, (quantities[produto.id] || 0) > 0 && styles.productRowActive]}>
          <ProductPhoto url={produto.url_imagem_principal} name={produto.nome} size={52} rounded={radius.lg} />
          <Text style={styles.productName} numberOfLines={2}>
            {fixProductName(produto.nome)}
          </Text>
          <Input
            value={quantities[produto.id] ? String(quantities[produto.id]) : ""}
            onChangeText={(value) => onSetQuantity(produto.id, value)}
            keyboardType="number-pad"
            placeholder="0"
            maxLength={5}
            style={styles.qtyInput}
          />
        </View>
      ))}

      {gerarError ? <StateText tone="error" text={gerarError} /> : null}
      {products.length > 0 ? (
        <>
          <Button
            title={pending ? "Calculando..." : "Calcular lista"}
            icon={<Sparkles size={18} color={selectedCount > 0 ? "#fff" : colors.muted} />}
            disabled={selectedCount === 0 || pending}
            onPress={onCalcular}
          />
          {selectedCount === 0 ? <Text style={styles.gateHint}>Informe a quantidade de pelo menos um produto.</Text> : null}
        </>
      ) : null}

      {/* Produtos sem receita: não dá para calcular insumos deles. Ficam aqui
          com atalho para a jornada de custo/receita. */}
      {productsWithoutRecipe.length > 0 ? (
        <>
          <SectionTitle text="Ainda sem receita" />
          <Text style={styles.hint}>Cadastre a receita para eu conseguir calcular os insumos e incluir na lista.</Text>
          {productsWithoutRecipe.map((produto) => (
            <Pressable
              key={produto.id}
              onPress={() => onOpenCost(produto.id)}
              style={({ pressed }) => [styles.noRecipeRow, pressed && styles.pressed]}
            >
              <ProductPhoto url={produto.url_imagem_principal} name={produto.nome} size={44} rounded={radius.lg} />
              <Text style={styles.noRecipeName} numberOfLines={2}>
                {fixProductName(produto.nome)}
              </Text>
              <View style={styles.noRecipeCta}>
                <Sparkles size={14} color={colors.agentDeep} />
                <Text style={styles.noRecipeCtaText}>Cadastrar receita</Text>
                <ChevronRight size={15} color={colors.agentDeep} />
              </View>
            </Pressable>
          ))}
        </>
      ) : null}

      {savedLists.length > 0 ? (
        <>
          <SectionTitle text="Listas salvas" />
          {savedLists.slice(0, 6).map((item) => (
            <Pressable
              key={item.id || item.nome}
              onPress={() => item.id && onOpenSaved(item.id)}
              style={({ pressed }) => [styles.savedRow, shadows.soft, pressed && styles.pressed]}
            >
              <View style={styles.savedIcon}>
                <ListChecks size={18} color={colors.brandDeep} />
              </View>
              <View style={styles.savedInfo}>
                <Text style={styles.savedName} numberOfLines={1}>
                  {item.nome || "Lista de compras"}
                </Text>
                <Text style={styles.savedMeta}>
                  {item.data_referencia ? formatDate(item.data_referencia) : ""} · {formatCurrency(item.total_estimado)}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Passo 2 — Resultado: total, pendências e itens de compra.
// ---------------------------------------------------------------------------

function ResultStep({
  lista,
  saved,
  saving,
  saveError,
  onSave,
  onShare,
  onEdit
}: {
  lista: ListaCompra;
  saved: boolean;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onShare: () => void;
  onEdit: () => void;
}) {
  const pendencias = guidedItems(lista.pendencias);
  const itens = lista.itens || [];

  return (
    <>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.totalCard, shadows.floating]}>
        <View pointerEvents="none" style={styles.heroGlow} />
        <Text style={styles.totalLabel}>Custo estimado da compra</Text>
        <Money value={lista.total_estimado} size={46} color="#fff" prefixColor="rgba(255,255,255,0.78)" />
        <View style={styles.totalBadges}>
          {lista.margem_percentual ? <TotalBadge text={`margem +${lista.margem_percentual}%`} /> : null}
          {lista.data_referencia ? <TotalBadge text={formatDate(lista.data_referencia)} /> : null}
          <TotalBadge text={`${itens.length} ${itens.length === 1 ? "item" : "itens"}`} />
        </View>
      </LinearGradient>

      {pendencias.length > 0 ? (
        <View style={styles.pendBox}>
          <View style={styles.pendHeader}>
            <TriangleAlert size={17} color={colors.warning} />
            <Text style={styles.pendTitle}>Alguns pontos de atenção</Text>
          </View>
          {pendencias.map((texto) => (
            <Text key={texto} style={styles.pendItem}>
              • {texto}
            </Text>
          ))}
        </View>
      ) : null}

      <SectionTitle text="O que comprar" />
      {itens.length === 0 ? (
        <EmptyState emoji="🛒" title="Nada a comprar" hint="Não achei ingredientes para essa produção." />
      ) : (
        itens.map((item, index) => <ShoppingItemCard key={`${item.insumo_id || item.nome}-${index}`} item={item} />)
      )}

      {saved ? (
        <View style={styles.savedBanner}>
          <Check size={17} color={colors.success} strokeWidth={3} />
          <Text style={styles.savedBannerText}>Lista salva no histórico!</Text>
        </View>
      ) : null}
      {saveError ? <StateText tone="error" text={saveError} /> : null}

      <Button title="Compartilhar lista" tone="soft" icon={<Share2 size={18} color={colors.ink} />} onPress={onShare} />
      {!saved ? (
        <Button title={saving ? "Salvando..." : "Salvar lista"} disabled={saving} onPress={onSave} />
      ) : null}
      <Pressable onPress={onEdit} style={({ pressed }) => [styles.editLink, pressed && styles.pressed]}>
        <Text style={styles.editLinkText}>Ajustar produção</Text>
      </Pressable>
    </>
  );
}

function TotalBadge({ text }: { text: string }) {
  return (
    <View style={styles.totalBadge}>
      <Text style={styles.totalBadgeText}>{text}</Text>
    </View>
  );
}

function ShoppingItemCard({ item }: { item: ListaCompraItem }) {
  const [showFrom, setShowFrom] = useState(false);
  const confirmado = (item.status || "").toUpperCase() === "CONFIRMADO";
  const contribuicoes = item.contribuicoes || [];

  // Preço por unidade usado no cálculo — é "o valor" por trás do custo estimado
  // (inclusive quando o backend reaproveita o preço de uma compra anterior).
  const precoUnitario = toNumber(item.custo_unitario_base);
  const unidadePreco = item.unidade_base || item.unidade_sugerida || "un";

  return (
    <View style={[styles.itemCard, shadows.soft]}>
      <View style={styles.itemTop}>
        <View style={styles.itemEmojiCircle}>
          <Text style={styles.itemEmoji}>{ingredientEmoji({ nome: item.nome })}</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.nome || "Ingrediente"}
          </Text>
          <Text style={styles.itemQty}>
            {formatQty(item.quantidade_sugerida)} {item.unidade_sugerida || ""}
          </Text>
          {precoUnitario > 0 ? (
            <Text style={styles.itemUnitPrice}>
              Preço usado: <Text style={styles.itemUnitPriceValue}>{formatCurrency(precoUnitario)}</Text>
              <Text style={styles.itemUnitPriceUnit}> / {unidadePreco}</Text>
            </Text>
          ) : null}
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemCost}>{formatCurrency(item.custo_estimado)}</Text>
          <View style={[styles.itemPill, { backgroundColor: confirmado ? colors.successSoft : colors.warningSoft }]}>
            <Text style={[styles.itemPillText, { color: confirmado ? colors.success : colors.warning }]}>
              {confirmado ? "estimado" : "revisar"}
            </Text>
          </View>
        </View>
      </View>

      {item.observacoes ? (
        <View style={styles.itemNote}>
          <Info size={13} color={colors.muted} />
          <Text style={styles.itemNoteText}>{item.observacoes}</Text>
        </View>
      ) : null}

      {contribuicoes.length > 0 ? (
        <Pressable onPress={() => setShowFrom((value) => !value)} style={({ pressed }) => [styles.fromToggle, pressed && styles.pressed]}>
          <ChevronDown size={14} color={colors.muted} style={showFrom ? styles.chevronUp : undefined} />
          <Text style={styles.fromToggleText}>
            {showFrom ? "esconder de onde vem" : `de ${contribuicoes.length} ${contribuicoes.length === 1 ? "produto" : "produtos"}`}
          </Text>
        </Pressable>
      ) : null}
      {showFrom
        ? contribuicoes.map((contribuicao, index) => (
            <Text key={`${contribuicao.produto_id || index}`} style={styles.fromItem}>
              • {contribuicao.produto || "Produto"} ({formatQty(contribuicao.quantidade_produto)} un)
            </Text>
          ))
        : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Planejar por voz/foto: fala ou fotografa a produção e o agente preenche as
// quantidades. Não registra nada — só devolve o mapa produto_id → quantidade.
// ---------------------------------------------------------------------------

function PlanProductionSheet({
  visible,
  onClose,
  onApply
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (map: Record<string, number>) => void;
}) {
  const [text, setText] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  function applyItems(itens?: { produto_id: string; quantidade: number }[] | null) {
    const map: Record<string, number> = {};
    (itens || []).forEach((item) => {
      const qty = Number(item.quantidade);
      if (item.produto_id && qty > 0) map[item.produto_id] = (map[item.produto_id] || 0) + qty;
    });
    onApply(map);
    setText("");
    onClose();
  }

  const interpret = useMutation({
    mutationFn: (texto: string) => api.ia.interpretCommand({ texto, permitir_fallback: true }),
    onSuccess: (response) => applyItems(response.itens)
  });
  const audio = useMutation({
    mutationFn: (file: NativeFile) => api.ia.transcribeAudio(createAudioForm(file)),
    onSuccess: (response) => applyItems(response.interpretacao?.itens)
  });
  const photo = useMutation({
    mutationFn: async (source: "camera" | "gallery") => {
      const file = await pickImage(source, "producao", { allowsEditing: false });
      if (!file) return null;
      return withTimeout(
        api.ia.importProductionPhoto(createIaPhotoForm(file, { contexto: "Produção planejada para a lista de compras" })),
        90000
      );
    },
    onSuccess: (response) => {
      if (response) applyItems(response.itens);
    }
  });

  const busy = interpret.isPending || audio.isPending || photo.isPending;

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
      if (recorder.uri) audio.mutate({ uri: recorder.uri, name: `producao-${Date.now()}.m4a`, type: "audio/mp4" });
      return;
    }
    await startRecording();
  }

  function choosePhoto() {
    if (Platform.OS === "web") {
      photo.mutate("gallery");
      return;
    }
    Alert.alert("Foto da produção", "Fotografe a lousa ou a folha da produção.", [
      { text: "Tirar foto", onPress: () => photo.mutate("camera") },
      { text: "Galeria", onPress: () => photo.mutate("gallery") },
      { text: "Cancelar", style: "cancel" }
    ]);
  }

  const error =
    (interpret.error instanceof Error ? interpret.error.message : null) ||
    (audio.error instanceof Error ? audio.error.message : null) ||
    (photo.error instanceof Error ? photo.error.message : null);

  return (
    <Sheet
      visible={visible}
      title={AGENT_NAME}
      subtitle="Me diga a produção que eu preencho"
      onClose={onClose}
      headerAccent={<AgentAvatar size={46} />}
    >
      <View style={styles.planBubble}>
        <Text style={styles.planBubbleText}>
          {recorderState.isRecording
            ? "Tô ouvindo... pode falar a produção!"
            : busy
              ? "Só um instante, tô entendendo..."
              : "Ex: “20 pães de queijo e 10 brioches”. Pode falar, escrever ou mandar a foto da produção."}
        </Text>
      </View>

      {busy && !recorderState.isRecording ? (
        <View style={styles.planLoading}>
          <ActivityIndicator color={colors.agentDeep} />
          <Text style={styles.planLoadingText}>Lendo a produção...</Text>
        </View>
      ) : (
        <>
          <Pressable onPress={() => void toggleRecording()} disabled={busy} style={({ pressed }) => pressed && styles.pressed}>
            <LinearGradient
              colors={recorderState.isRecording ? (["#ff5252", "#d81b43"] as const) : gradients.agent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.recordButton, shadows.agent]}
            >
              <Mic size={28} color="#fff" />
              <Text style={styles.recordText}>{recorderState.isRecording ? "Gravando... toque para parar" : "Toque e fala"}</Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.commandRow}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder="Ex: 20 pães de queijo"
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

          <Pressable onPress={choosePhoto} disabled={busy} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
            <Camera size={20} color={colors.agentDeep} />
            <Text style={styles.photoButtonText}>Foto da produção</Text>
          </Pressable>
        </>
      )}
      {error ? <StateText tone="error" text={error} /> : null}
    </Sheet>
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
    paddingBottom: 140
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface,
    padding: 12,
    ...shadows.soft
  },
  planInfo: {
    flex: 1,
    gap: 2
  },
  planTitle: {
    color: colors.ink,
    fontSize: 15.5,
    fontFamily: fonts.bodyBold
  },
  planHint: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fonts.body
  },
  planBubble: {
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    backgroundColor: colors.agentSoft,
    padding: 14
  },
  planBubbleText: {
    color: colors.agentDeep,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.bodyBold
  },
  planLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface,
    padding: 16
  },
  planLoadingText: {
    flex: 1,
    color: colors.agentDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  recordButton: {
    alignItems: "center",
    gap: 6,
    borderRadius: radius.xl,
    padding: 20
  },
  recordText: {
    color: "#fff",
    fontSize: 15.5,
    fontFamily: fonts.bodyBold
  },
  commandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
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
  photoButton: {
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
  noRecipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10
  },
  noRecipeName: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  },
  noRecipeCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.agentSoft,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  noRecipeCtaText: {
    color: colors.agentDeep,
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
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
    flex: 1
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 24,
    fontFamily: fonts.display,
    letterSpacing: -0.4
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.body
  },
  hero: {
    overflow: "hidden",
    gap: 8,
    borderRadius: radius.xl,
    padding: 20
  },
  heroGlow: {
    position: "absolute",
    top: -40,
    right: -30,
    height: 140,
    width: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  heroIcon: {
    height: 46,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  heroText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: fonts.body
  },
  hint: {
    marginTop: -8,
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: fonts.body
  },
  marginRow: {
    flexDirection: "row",
    gap: 8
  },
  marginChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  marginChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  marginChipText: {
    color: colors.muted,
    fontSize: 13.5,
    fontFamily: fonts.bodyBold
  },
  marginChipTextActive: {
    color: colors.brandDeep
  },
  skeletons: {
    gap: 12
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10
  },
  productRowActive: {
    borderColor: colors.brand,
    backgroundColor: colors.surfaceGlow
  },
  productName: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  qtyInput: {
    // Largura folgada para caber 4–5 dígitos sem cortar/quebrar, mesmo com a
    // fonte ampliada da acessibilidade.
    width: 100,
    minHeight: 48,
    textAlign: "center",
    paddingHorizontal: 8,
    fontFamily: fonts.display
  },
  gateHint: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body,
    textAlign: "center"
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  savedIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft
  },
  savedInfo: {
    flex: 1,
    gap: 2
  },
  savedName: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  savedMeta: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  },
  totalCard: {
    overflow: "hidden",
    gap: 6,
    borderRadius: radius.xl,
    padding: 20
  },
  totalLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  totalBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6
  },
  totalBadge: {
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 11,
    paddingVertical: 5
  },
  totalBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  pendBox: {
    gap: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    padding: 14
  },
  pendHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  pendTitle: {
    color: colors.warning,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  },
  pendItem: {
    color: colors.warning,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: fonts.body
  },
  itemCard: {
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 13
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  itemEmojiCircle: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm
  },
  itemEmoji: {
    fontSize: 22
  },
  itemInfo: {
    flex: 1,
    gap: 2
  },
  itemName: {
    color: colors.ink,
    fontSize: 15.5,
    fontFamily: fonts.bodyBold
  },
  itemQty: {
    color: colors.brandDeep,
    fontSize: 15,
    fontFamily: fonts.display,
    letterSpacing: -0.2
  },
  itemRight: {
    alignItems: "flex-end",
    gap: 4
  },
  itemCost: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  itemPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  itemPillText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold
  },
  itemUnitPrice: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.body
  },
  itemUnitPriceValue: {
    color: colors.ink,
    fontFamily: fonts.bodyBold
  },
  itemUnitPriceUnit: {
    color: colors.muted,
    fontFamily: fonts.bodyBold
  },
  itemNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceGlow,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  itemNoteText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fonts.bodyBold
  },
  fromToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start"
  },
  chevronUp: {
    transform: [{ rotate: "180deg" }]
  },
  fromToggleText: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  fromItem: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fonts.body
  },
  savedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 13,
    paddingVertical: 11
  },
  savedBannerText: {
    color: colors.success,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  },
  editLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42
  },
  editLinkText: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  }
});
