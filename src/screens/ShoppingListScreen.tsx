import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Info,
  ListChecks,
  Share2,
  ShoppingCart,
  Sparkles,
  TriangleAlert
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Input, Money, ProductPhoto, Screen, SectionTitle, Skeleton, StateText } from "@/components/ui";
import { api } from "@/lib/api";
import { guidedItems, ingredientEmoji } from "@/lib/custeio";
import { formatCurrency, formatDate, todayInputValue, toNumber } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import { fixProductName } from "@/utils/text";
import type { Produto } from "@/types/api";
import type { ListaCompra, ListaCompraItem } from "@/types/custeio";

type Step = "montar" | "resultado";

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
  const [step, setStep] = useState<Step>("montar");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [margem, setMargem] = useState(10);
  const [lista, setLista] = useState<ListaCompra | null>(null);
  const [saved, setSaved] = useState(false);

  const productsQuery = useQuery({ queryKey: ["produtos", "ativos"], queryFn: () => api.produtos.list(true) });
  const historyQuery = useQuery({ queryKey: ["listas-compras"], queryFn: api.custos.listaCompras.historico });

  const products = productsQuery.data || [];
  const selecionados = products.filter((produto) => (quantities[produto.id] || 0) > 0);
  const savedLists = normalizeLists(historyQuery.data);

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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
            products={products}
            loading={productsQuery.isLoading}
            error={productsQuery.error instanceof Error ? productsQuery.error.message : null}
            quantities={quantities}
            margem={margem}
            selectedCount={selecionados.length}
            pending={gerar.isPending}
            gerarError={gerar.error instanceof Error ? gerar.error.message : null}
            savedLists={savedLists}
            onSetMargem={setMargem}
            onSetQuantity={setQuantity}
            onCalcular={() => gerar.mutate(false)}
            onOpenSaved={(id) => openSaved.mutate(id)}
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
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Passo 1 — Montar: margem + produtos e quantidades.
// ---------------------------------------------------------------------------

function MontarStep({
  products,
  loading,
  error,
  quantities,
  margem,
  selectedCount,
  pending,
  gerarError,
  savedLists,
  onSetMargem,
  onSetQuantity,
  onCalcular,
  onOpenSaved
}: {
  products: Produto[];
  loading: boolean;
  error: string | null;
  quantities: Record<string, number>;
  margem: number;
  selectedCount: number;
  pending: boolean;
  gerarError: string | null;
  savedLists: ListaCompra[];
  onSetMargem: (value: number) => void;
  onSetQuantity: (produtoId: string, value: string) => void;
  onCalcular: () => void;
  onOpenSaved: (id: string) => void;
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
      {!loading && products.length === 0 ? (
        <EmptyState emoji="🥖" title="Nenhum produto ativo" hint="Cadastre produtos no catálogo para montar a lista." />
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
            style={styles.qtyInput}
          />
        </View>
      ))}

      {gerarError ? <StateText tone="error" text={gerarError} /> : null}
      <Button
        title={pending ? "Calculando..." : "Calcular lista"}
        icon={<Sparkles size={18} color={selectedCount > 0 ? "#fff" : colors.muted} />}
        disabled={selectedCount === 0 || pending}
        onPress={onCalcular}
      />
      {selectedCount === 0 ? <Text style={styles.gateHint}>Informe a quantidade de pelo menos um produto.</Text> : null}

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
    width: 74,
    minHeight: 48,
    textAlign: "center",
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
