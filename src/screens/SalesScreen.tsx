import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { Ban, CalendarDays, CheckCircle2, ChevronRight, Mic, ReceiptText, Search, Send, Sparkles } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AGENT_NAME, AgentAvatar, AgentTag } from "@/components/agent";
import { Badge, Button, Card, Field, Input, Page, ProductPhoto, Sheet, StateText, Stepper } from "@/components/ui";
import { api, createAudioForm, type NativeFile } from "@/lib/api";
import { formatCurrency, formatDate, toNumber, todayInputValue } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import type { DiaDeVenda, Produto, RespostaInterpretarVenda, Venda } from "@/types/api";

type Cart = Record<string, number>;
type ActiveSheet = "open-day" | "production" | "close-day" | "sales" | "ai" | null;

const DIACRITICS = /\p{M}/gu;
const EMPTY_PRODUCTS: Produto[] = [];

export function SalesScreen() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<Cart>({});
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [aiInitialText, setAiInitialText] = useState("");
  const [aiAutoRecord, setAiAutoRecord] = useState(false);

  const currentDayQuery = useQuery({ queryKey: ["dias", "atual"], queryFn: api.dias.current });
  const productsQuery = useQuery({ queryKey: ["produtos", "ativos"], queryFn: () => api.produtos.list(true) });
  const resumoQuery = useQuery({
    queryKey: ["relatorios", "dia", currentDayQuery.data?.id],
    queryFn: () => api.relatorios.day(currentDayQuery.data!.id),
    enabled: Boolean(currentDayQuery.data?.id)
  });

  const products = productsQuery.data || EMPTY_PRODUCTS;
  const currentDay = currentDayQuery.data || null;
  const stockReady = !currentDay || resumoQuery.isSuccess;

  const availableByProduct = useMemo(() => {
    const map: Cart = {};
    currentDay?.itens_producao?.forEach((item) => {
      map[item.produto_id] = item.quantidade_produzida;
    });
    resumoQuery.data?.produtos?.forEach((produto) => {
      const produced = produto.quantidade_produzida ?? map[produto.produto_id] ?? 0;
      const remaining = produto.quantidade_sobra ?? produced - (produto.quantidade_vendida ?? 0);
      map[produto.produto_id] = Math.max(0, Math.trunc(remaining || 0));
    });
    return map;
  }, [currentDay, resumoQuery.data]);

  const filteredProducts = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return products;
    return products.filter((produto) => normalize(produto.nome).includes(term));
  }, [products, search]);

  const cartItems = useMemo(
    () =>
      products
        .map((produto) => {
          const quantidade = cart[produto.id] || 0;
          return {
            produto,
            quantidade,
            availableQuantity: availableByProduct[produto.id] || 0,
            subtotal: quantidade * toNumber(produto.preco_atual?.preco_venda)
          };
        })
        .filter((item) => item.quantidade > 0),
    [availableByProduct, cart, products]
  );

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantidade, 0);
  const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const hasStockIssue = cartItems.some((item) => item.quantidade > item.availableQuantity);

  const registerSale = useMutation({
    mutationFn: () => {
      if (!currentDay || !stockReady || hasStockIssue || !cartItems.length) {
        throw new Error("Revise a sacola antes de registrar a venda.");
      }
      return api.vendas.create({
        dia_de_venda_id: currentDay.id,
        tipo_entrada: "manual",
        itens: cartItems.map((item) => ({ produto_id: item.produto.id, quantidade: item.quantidade }))
      });
    },
    onSuccess: (sale) => {
      setCart({});
      setMessage(`Venda registrada: ${sale.itens?.length || itemCount} item(ns).`);
      invalidateDay(queryClient);
    }
  });

  // A barra Registrar surge embaixo do dedo no primeiro "+": segura os
  // toques dela por um instante para não registrar venda sem querer.
  const [cartBarGuard, setCartBarGuard] = useState(false);
  const guardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function armCartBarGuard() {
    if (guardTimer.current) clearTimeout(guardTimer.current);
    setCartBarGuard(true);
    guardTimer.current = setTimeout(() => setCartBarGuard(false), 900);
  }

  useEffect(
    () => () => {
      if (guardTimer.current) clearTimeout(guardTimer.current);
    },
    []
  );

  function addProduct(produto: Produto) {
    if (!produto.preco_atual || !stockReady) return;
    if (itemCount === 0) armCartBarGuard();
    setCart((current) => {
      const currentQuantity = current[produto.id] || 0;
      const availableQuantity = availableByProduct[produto.id] || 0;
      if (currentQuantity >= availableQuantity) return current;
      return { ...current, [produto.id]: currentQuantity + 1 };
    });
  }

  function removeProduct(produtoId: string) {
    setCart((current) => {
      const next = { ...current };
      const value = (next[produtoId] || 0) - 1;
      if (value <= 0) delete next[produtoId];
      else next[produtoId] = value;
      return next;
    });
  }

  function openAgent(options?: { text?: string; record?: boolean }) {
    setAiInitialText(options?.text || "");
    setAiAutoRecord(Boolean(options?.record));
    setSheet("ai");
  }

  const loading = currentDayQuery.isLoading || productsQuery.isLoading;
  const error = currentDayQuery.error || productsQuery.error || resumoQuery.error;
  const saleDisabled = !currentDay || !itemCount || currentDay.situacao !== "aberto" || !stockReady || hasStockIssue;

  return (
    <>
      <Page title="Venda" subtitle="Toque nos produtos ou fale com o agente.">
        {loading ? <StateText text="Preparando a venda..." /> : null}
        {error instanceof Error ? <StateText tone="error" text={error.message} /> : null}
        {message ? (
          <View style={styles.toast}>
            <CheckCircle2 size={20} color={colors.success} />
            <Text style={styles.toastText}>{message}</Text>
          </View>
        ) : null}

        {currentDay ? (
          <DayHero
            day={currentDay}
            sold={resumoQuery.data?.total_vendido}
            produced={resumoQuery.data?.total_produzido}
            revenue={resumoQuery.data?.faturamento_bruto}
            onProduction={() => setSheet("production")}
            onSales={() => setSheet("sales")}
            onClose={() => setSheet("close-day")}
          />
        ) : !loading ? (
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.heroGreeting}>{getGreeting()}</Text>
            <Text style={styles.heroTitle}>Bora começar o dia de venda?</Text>
            <Text style={styles.heroMuted}>Registre a produção de hoje e venda com um toque.</Text>
            <Button title="Abrir dia de venda" onPress={() => setSheet("open-day")} />
          </LinearGradient>
        ) : null}

        {!loading ? (
          <AgentBanner
            hint={
              currentDay
                ? "“Busca, venda, o que precisar: fala ou escreve!”"
                : "“Posso abrir o dia com a produção: fala ou escreve!”"
            }
            search={search}
            onSearchChange={setSearch}
            onSpeak={() => openAgent({ record: true })}
            onAsk={() => {
              if (search.trim()) {
                openAgent({ text: search.trim() });
                setSearch("");
              }
            }}
          />
        ) : null}

        {currentDay ? (
          <>
            {filteredProducts.length ? (
              <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                numColumns={2}
                columnWrapperStyle={styles.productRow}
                renderItem={({ item }) => (
                  <ProductTile
                    product={item}
                    quantity={cart[item.id] || 0}
                    available={availableByProduct[item.id] || 0}
                    onAdd={() => addProduct(item)}
                    onRemove={() => removeProduct(item.id)}
                  />
                )}
              />
            ) : (
              <StateText text="Nenhum produto encontrado." />
            )}
          </>
        ) : null}
      </Page>

      {itemCount ? (
        <View
          pointerEvents={cartBarGuard ? "none" : "auto"}
          style={[styles.cartBar, shadows.floating, cartBarGuard && styles.cartBarGuarded]}
        >
          <View style={styles.cartInfo}>
            <View style={styles.cartCountBubble}>
              <Text style={styles.cartCountText}>{itemCount}</Text>
            </View>
            <Text style={styles.cartTotal}>{formatCurrency(total)}</Text>
          </View>
          <Button
            title={registerSale.isPending ? "Registrando..." : "Registrar"}
            disabled={saleDisabled || registerSale.isPending}
            onPress={() => registerSale.mutate()}
          />
        </View>
      ) : null}

      <OpenDaySheet visible={sheet === "open-day"} onClose={() => setSheet(null)} products={products} />
      <ProductionSheet visible={sheet === "production"} onClose={() => setSheet(null)} day={currentDay} products={products} />
      <CloseDaySheet visible={sheet === "close-day"} onClose={() => setSheet(null)} day={currentDay} />
      <SalesListSheet visible={sheet === "sales"} onClose={() => setSheet(null)} day={currentDay} />
      <AgentSheet
        visible={sheet === "ai"}
        onClose={() => setSheet(null)}
        day={currentDay}
        initialText={aiInitialText}
        autoRecord={aiAutoRecord}
        onMessage={setMessage}
      />
    </>
  );
}

function DayHero({
  day,
  sold,
  produced,
  revenue,
  onProduction,
  onSales,
  onClose
}: {
  day: DiaDeVenda;
  sold?: number;
  produced?: number;
  revenue?: string;
  onProduction: () => void;
  onSales: () => void;
  onClose: () => void;
}) {
  const isOpen = day.situacao === "aberto";
  const progress = produced && produced > 0 ? Math.min(100, Math.round(((sold || 0) / produced) * 100)) : 0;

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroPill}>
          <View style={[styles.dot, { backgroundColor: isOpen ? "#4ade80" : "#fbbf24" }]} />
          <Text style={styles.heroPillText}>{isOpen ? "Dia aberto" : "Dia fechado"}</Text>
        </View>
        <View style={styles.heroPill}>
          <CalendarDays size={14} color="rgba(255,255,255,0.75)" />
          <Text style={styles.heroPillText}>{formatDate(day.data_venda)}</Text>
        </View>
      </View>

      <View>
        <Text style={styles.heroGreeting}>{getGreeting()}</Text>
        <Text style={styles.heroTitle}>{day.nome_local_no_momento || "Venda de hoje"}</Text>
      </View>

      <View>
        <Text style={styles.heroMuted}>Vendas de hoje</Text>
        <Text style={styles.heroRevenue}>{formatCurrency(revenue)}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.heroMuted}>
          {sold ?? 0} de {produced ?? 0} itens vendidos · {progress}%
        </Text>
      </View>

      <View style={styles.heroActions}>
        <HeroChip label="Produção" onPress={onProduction} />
        <HeroChip label="Vendas do dia" onPress={onSales} />
        {isOpen ? <HeroChip label="Fechar dia" onPress={onClose} /> : null}
      </View>
    </LinearGradient>
  );
}

function HeroChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.heroChip, pressed && styles.pressed]}>
      <Text style={styles.heroChipText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </Text>
    </Pressable>
  );
}

// Card do agente com a entrada embutida: a pessoa escolhe entre
// falar (mic) ou escrever (caixa de texto) sem sair do card.
function AgentBanner({
  hint,
  search,
  onSearchChange,
  onSpeak,
  onAsk
}: {
  hint: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSpeak: () => void;
  onAsk: () => void;
}) {
  return (
    <View style={[styles.agentBanner, shadows.soft]}>
      <View style={styles.agentBannerHeader}>
        <AgentAvatar size={52} />
        <View style={styles.agentBannerText}>
          <AgentTag />
          <Text style={styles.agentName}>{AGENT_NAME}</Text>
          <Text style={styles.agentHint}>{hint}</Text>
        </View>
      </View>

      <View style={styles.agentInputRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.muted} />
          <Input
            placeholder="Busque ou peça qualquer ação..."
            value={search}
            onChangeText={onSearchChange}
            style={styles.searchInput}
            returnKeyType="send"
            onSubmitEditing={onAsk}
          />
        </View>
        <Pressable onPress={onSpeak} style={({ pressed }) => pressed && styles.pressed}>
          <LinearGradient colors={gradients.agent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.micButton, shadows.agent]}>
            <Mic color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      {search.trim() ? (
        <Pressable onPress={onAsk} style={({ pressed }) => [styles.askAgentChip, pressed && styles.pressed]}>
          <Sparkles size={16} color={colors.agentDeep} />
          <Text style={styles.askAgentText} numberOfLines={1}>
            Pedir pro {AGENT_NAME}: “{search.trim()}”
          </Text>
          <ChevronRight size={16} color={colors.agentDeep} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ProductTile({
  product,
  quantity,
  available,
  onAdd,
  onRemove
}: {
  product: Produto;
  quantity: number;
  available: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const disabled = !product.preco_atual || available <= 0;
  const remaining = Math.max(0, available - quantity);

  return (
    <Pressable onPress={onAdd} disabled={disabled} style={[styles.product, shadows.soft, quantity > 0 && styles.productSelected, disabled && styles.disabledProduct]}>
      <View style={styles.productPhoto}>
        <ProductPhoto url={product.url_imagem_principal} name={product.nome} size="fill" rounded={0} />
        {quantity > 0 ? (
          <View style={styles.productBadge}>
            <Text style={styles.productBadgeText}>{quantity}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.productBody}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.nome}
        </Text>
        <Text style={styles.price}>{formatCurrency(product.preco_atual?.preco_venda)}</Text>
        <Text style={styles.stock}>{available <= 0 ? "Esgotado" : `Restante: ${remaining}`}</Text>
        <Stepper value={quantity} onIncrement={onAdd} onDecrement={onRemove} canAdd={!disabled && remaining > 0} size="sm" />
      </View>
    </Pressable>
  );
}

// Editor de produção compartilhado: só botões de mais/menos, sem digitar.
function ProductionEditor({
  products,
  quantities,
  onChange
}: {
  products: Produto[];
  quantities: Cart;
  onChange: (produtoId: string, value: number) => void;
}) {
  return (
    <>
      {products.map((produto) => {
        const quantity = quantities[produto.id] || 0;
        return (
          <View key={produto.id} style={styles.productionRow}>
            <ProductPhoto url={produto.url_imagem_principal} name={produto.nome} size={48} />
            <Text style={styles.productionName} numberOfLines={2}>
              {produto.nome}
            </Text>
            <Stepper
              value={quantity}
              onIncrement={() => onChange(produto.id, quantity + 1)}
              onDecrement={() => onChange(produto.id, Math.max(0, quantity - 1))}
            />
          </View>
        );
      })}
    </>
  );
}

function OpenDaySheet({ visible, onClose, products }: { visible: boolean; onClose: () => void; products: Produto[] }) {
  return (
    <Sheet visible={visible} title="Abrir dia" subtitle="Quantos itens você preparou hoje?" onClose={onClose}>
      {visible ? <OpenDayForm onClose={onClose} products={products} /> : null}
    </Sheet>
  );
}

function OpenDayForm({ onClose, products }: { onClose: () => void; products: Produto[] }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Cart>({});

  const createDay = useMutation({
    mutationFn: () =>
      api.dias.create({
        data_venda: todayInputValue(),
        observacoes: notes || null,
        itens_producao: products
          .map((produto) => ({ produto_id: produto.id, quantidade_produzida: Number(quantities[produto.id] || 0) }))
          .filter((item) => item.quantidade_produzida > 0)
      }),
    onSuccess: () => {
      onClose();
      invalidateDay(queryClient);
    }
  });

  return (
    <>
      <ProductionEditor
        products={products}
        quantities={quantities}
        onChange={(produtoId, value) => setQuantities((current) => ({ ...current, [produtoId]: value }))}
      />
      <Field label="Observações">
        <Input value={notes} onChangeText={setNotes} placeholder="Opcional" />
      </Field>
      {createDay.error instanceof Error ? <StateText tone="error" text={createDay.error.message} /> : null}
      <Button title={createDay.isPending ? "Abrindo..." : "Abrir dia"} disabled={createDay.isPending} onPress={() => createDay.mutate()} />
    </>
  );
}

function ProductionSheet({
  visible,
  onClose,
  day,
  products
}: {
  visible: boolean;
  onClose: () => void;
  day: DiaDeVenda | null;
  products: Produto[];
}) {
  return (
    <Sheet visible={visible} title="Produção do dia" subtitle="Ajuste com os botões de mais e menos." onClose={onClose}>
      {visible ? <ProductionForm onClose={onClose} day={day} products={products} /> : null}
    </Sheet>
  );
}

function ProductionForm({ onClose, day, products }: { onClose: () => void; day: DiaDeVenda | null; products: Produto[] }) {
  const queryClient = useQueryClient();
  // Começa da produção já registrada no dia.
  const [quantities, setQuantities] = useState<Cart>(() => {
    const initial: Cart = {};
    day?.itens_producao?.forEach((item) => {
      initial[item.produto_id] = item.quantidade_produzida;
    });
    return initial;
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!day) throw new Error("Não há dia aberto.");
      const produced: Cart = {};
      day.itens_producao?.forEach((item) => {
        produced[item.produto_id] = item.quantidade_produzida;
      });
      const changed = products.filter((produto) => (quantities[produto.id] || 0) !== (produced[produto.id] || 0));
      if (!changed.length) return;
      await Promise.all(
        changed.map((produto) =>
          api.dias.saveProductionItem(day.id, { produto_id: produto.id, quantidade_produzida: quantities[produto.id] || 0 })
        )
      );
    },
    onSuccess: () => {
      onClose();
      invalidateDay(queryClient);
    }
  });

  return (
    <>
      <ProductionEditor
        products={products}
        quantities={quantities}
        onChange={(produtoId, value) => setQuantities((current) => ({ ...current, [produtoId]: value }))}
      />
      {save.error instanceof Error ? <StateText tone="error" text={save.error.message} /> : null}
      <Button title={save.isPending ? "Salvando..." : "Salvar produção"} disabled={save.isPending} onPress={() => save.mutate()} />
    </>
  );
}

function CloseDaySheet({ visible, onClose, day }: { visible: boolean; onClose: () => void; day: DiaDeVenda | null }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const closeDay = useMutation({
    mutationFn: () => {
      if (!day) throw new Error("Não há dia aberto.");
      return api.dias.close(day.id, notes);
    },
    onSuccess: () => {
      onClose();
      invalidateDay(queryClient);
    }
  });
  return (
    <Sheet visible={visible} title="Fechar dia" subtitle="Como foi a venda de hoje?" onClose={onClose}>
      <Field label="Observações">
        <Input value={notes} onChangeText={setNotes} placeholder="Opcional" />
      </Field>
      {closeDay.error instanceof Error ? <StateText tone="error" text={closeDay.error.message} /> : null}
      <Button title={closeDay.isPending ? "Fechando..." : "Fechar dia"} tone="danger" disabled={closeDay.isPending} onPress={() => closeDay.mutate()} />
    </Sheet>
  );
}

function SalesListSheet({ visible, onClose, day }: { visible: boolean; onClose: () => void; day: DiaDeVenda | null }) {
  const queryClient = useQueryClient();
  const salesQuery = useQuery({
    queryKey: ["vendas", "dia", day?.id],
    queryFn: () => api.vendas.listByDay(day!.id),
    enabled: visible && Boolean(day?.id)
  });
  const cancelSale = useMutation({
    mutationFn: (sale: Venda) => api.vendas.cancel(sale.id, "Cancelada pelo app"),
    onSuccess: () => {
      salesQuery.refetch();
      invalidateDay(queryClient);
    }
  });

  const sales = salesQuery.data || [];
  const dayTotal = sales
    .filter((sale) => sale.situacao !== "cancelada")
    .reduce((sum, sale) => sum + saleTotal(sale), 0);

  return (
    <Sheet visible={visible} title="Vendas do dia" subtitle={sales.length ? `${sales.length} venda(s) · ${formatCurrency(dayTotal)}` : undefined} onClose={onClose}>
      {salesQuery.isLoading ? <StateText text="Carregando vendas..." /> : null}
      {salesQuery.error instanceof Error ? <StateText tone="error" text={salesQuery.error.message} /> : null}
      {!salesQuery.isLoading && !sales.length ? <StateText text="Nenhuma venda registrada ainda." /> : null}

      {sales.map((sale) => {
        const cancelled = sale.situacao === "cancelada";
        const itemsLabel = (sale.itens || [])
          .map((item) => `${item.quantidade}x ${item.nome_produto_no_momento}`)
          .join(" · ");

        return (
          <View key={sale.id} style={[styles.saleRow, shadows.soft, cancelled && styles.saleRowCancelled]}>
            <View style={[styles.saleIcon, cancelled && { backgroundColor: colors.dangerSoft }]}>
              <ReceiptText size={20} color={cancelled ? colors.danger : colors.brandDeep} />
            </View>
            <View style={styles.saleInfo}>
              <View style={styles.saleTopRow}>
                <Text style={[styles.saleTotal, cancelled && styles.saleTotalCancelled]}>{formatCurrency(saleTotal(sale))}</Text>
                <Badge text={cancelled ? "cancelada" : sale.tipo_entrada === "manual" ? "manual" : "IA"} tone={cancelled ? "danger" : sale.tipo_entrada === "manual" ? "good" : "agent"} />
              </View>
              <Text style={styles.saleItems} numberOfLines={2}>
                {itemsLabel || `${sale.itens?.length || 0} item(ns)`}
              </Text>
              <Text style={styles.saleTime}>{formatTime(sale.ocorrido_em)}</Text>
            </View>
            {!cancelled ? (
              <Pressable
                onPress={() =>
                  Alert.alert("Cancelar venda", `Cancelar a venda de ${formatCurrency(saleTotal(sale))}?`, [
                    { text: "Voltar", style: "cancel" },
                    { text: "Cancelar venda", style: "destructive", onPress: () => cancelSale.mutate(sale) }
                  ])
                }
                disabled={cancelSale.isPending}
                style={({ pressed }) => [styles.saleCancelButton, pressed && styles.pressed]}
              >
                <Ban size={18} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </Sheet>
  );
}

function AgentSheet({
  visible,
  onClose,
  day,
  initialText,
  autoRecord,
  onMessage
}: {
  visible: boolean;
  onClose: () => void;
  day: DiaDeVenda | null;
  initialText: string;
  autoRecord: boolean;
  onMessage: (message: string) => void;
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
        <AgentConversation onClose={onClose} day={day} initialText={initialText} autoRecord={autoRecord} onMessage={onMessage} />
      ) : null}
    </Sheet>
  );
}

function AgentConversation({
  onClose,
  day,
  initialText,
  autoRecord,
  onMessage
}: {
  onClose: () => void;
  day: DiaDeVenda | null;
  initialText: string;
  autoRecord: boolean;
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<RespostaInterpretarVenda | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const interpret = useMutation({
    mutationFn: (command: string) => api.ia.interpretCommand({ texto: command, dia_de_venda_id: day?.id, permitir_fallback: true }),
    onSuccess: setResult
  });
  const upload = useMutation({
    mutationFn: (file: NativeFile) => api.ia.transcribeAudio(createAudioForm(file, day?.id)),
    onSuccess: (response) => {
      setText(response.transcricao);
      setResult(response.interpretacao || null);
    }
  });
  const confirm = useMutation({
    mutationFn: () => api.ia.confirmCommand(result!.interacao_ia_id),
    onSuccess: (response) => {
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

  const busy = interpret.isPending || upload.isPending;

  return (
    <>
      <View style={styles.agentBubble}>
        <Text style={styles.agentBubbleText}>
          {recorderState.isRecording
            ? "Tô ouvindo... pode falar!"
            : busy
              ? "Pensando aqui..."
              : result
                ? result.mensagem_assistente
                : day
                  ? "Me fala o que vendeu — por voz ou por texto — que eu monto a sacola e registro."
                  : "O dia ainda não foi aberto. Me fala a produção de hoje que eu abro pra você!"}
        </Text>
      </View>

      <Pressable onPress={toggleRecording} disabled={upload.isPending} style={({ pressed }) => pressed && styles.pressed}>
        <LinearGradient
          colors={recorderState.isRecording ? (["#ff5252", "#d81b43"] as const) : gradients.agent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.recordButton, recorderState.isRecording ? styles.recordButtonActive : shadows.agent]}
        >
          <Mic size={30} color="#fff" />
          <Text style={styles.recordText}>
            {recorderState.isRecording ? "Gravando... toque para parar" : upload.isPending ? "Enviando áudio..." : "Toque e fala"}
          </Text>
          {!recorderState.isRecording ? (
            <Text style={styles.recordHint}>
              {day ? "Ex: “vende 2 pães de queijo e 1 café”" : "Ex: “abre o dia com 20 pães de queijo”"}
            </Text>
          ) : null}
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
          placeholder={day ? "Ex: vende 2 pães de queijo" : "Ex: abre o dia com 20 pães"}
          style={styles.commandInput}
          returnKeyType="send"
          onSubmitEditing={() => text.trim() && interpret.mutate(text.trim())}
        />
        <Pressable
          onPress={() => text.trim() && interpret.mutate(text.trim())}
          disabled={!text.trim() || interpret.isPending}
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

      {interpret.error instanceof Error ? <StateText tone="error" text={interpret.error.message} /> : null}
      {upload.error instanceof Error ? <StateText tone="error" text={upload.error.message} /> : null}

      {result ? (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Sparkles size={16} color={colors.agentDeep} />
            <Text style={styles.resultTitle}>Entendi assim:</Text>
          </View>
          {result.itens?.map((item) => (
            <View key={`${item.produto_id}-${item.nome_produto}`} style={styles.resultRow}>
              <Text style={styles.resultItem}>
                {item.quantidade}x {item.nome_produto}
              </Text>
              <Badge text={`${Math.round(item.confianca * 100)}%`} tone={item.confianca >= 0.75 ? "good" : "warn"} />
            </View>
          ))}
          {result.itens_nao_identificados?.length ? (
            <StateText tone="error" text={`Não identifiquei: ${result.itens_nao_identificados.join(", ")}`} />
          ) : null}
          {result.mensagem_confirmacao ? <StateText text={result.mensagem_confirmacao} /> : null}
          <Button
            title={confirm.isPending ? "Confirmando..." : "Confirmar"}
            tone="success"
            disabled={!result.interacao_ia_id || confirm.isPending}
            onPress={() => confirm.mutate()}
          />
          {confirm.error instanceof Error ? <StateText tone="error" text={confirm.error.message} /> : null}
        </Card>
      ) : null}
    </>
  );
}

function invalidateDay(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["dias"] });
  queryClient.invalidateQueries({ queryKey: ["produtos"] });
  queryClient.invalidateQueries({ queryKey: ["relatorios"] });
  queryClient.invalidateQueries({ queryKey: ["vendas"] });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia!";
  if (hour < 18) return "Boa tarde!";
  return "Boa noite!";
}

function saleTotal(sale: Venda) {
  return (sale.itens || []).reduce((sum, item) => sum + toNumber(item.valor_total_venda), 0);
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
    padding: 14
  },
  toastText: {
    flex: 1,
    color: colors.success,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  hero: {
    gap: 16,
    borderRadius: radius.xl,
    padding: 20,
    ...shadows.floating
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  heroPillText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4
  },
  heroGreeting: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontFamily: fonts.body
  },
  heroTitle: {
    marginTop: 2,
    color: "#fff",
    fontSize: 26,
    fontFamily: fonts.display,
    letterSpacing: -0.4
  },
  heroMuted: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: fonts.body
  },
  heroRevenue: {
    marginVertical: 4,
    color: "#fff",
    fontSize: 38,
    fontFamily: fonts.display,
    letterSpacing: -1
  },
  progressTrack: {
    height: 10,
    marginBottom: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: "#fff"
  },
  heroActions: {
    flexDirection: "row",
    gap: 6
  },
  heroChip: {
    flex: 1,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 10
  },
  heroChipText: {
    color: "#fff",
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  agentBanner: {
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.agentSoft,
    backgroundColor: colors.surface,
    padding: 14
  },
  agentBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  agentBannerText: {
    flex: 1,
    gap: 3
  },
  agentName: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.display
  },
  agentHint: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.body
  },
  agentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingLeft: 16
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 10
  },
  micButton: {
    height: 52,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill
  },
  askAgentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.agentSoft,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  askAgentText: {
    flex: 1,
    color: colors.agentDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  productRow: {
    gap: 12,
    marginBottom: 12
  },
  product: {
    flex: 1,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface
  },
  productSelected: {
    borderColor: colors.brand
  },
  disabledProduct: {
    opacity: 0.55
  },
  productPhoto: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceWarm
  },
  productBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    minWidth: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandDeep,
    paddingHorizontal: 8
  },
  productBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: fonts.display
  },
  productBody: {
    gap: 6,
    padding: 12
  },
  productName: {
    minHeight: 36,
    color: colors.ink,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold,
    lineHeight: 18
  },
  price: {
    color: colors.ink,
    fontSize: 19,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  stock: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  productionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10
  },
  productionName: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  cartBar: {
    position: "absolute",
    right: 16,
    bottom: 20,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: radius.pill,
    backgroundColor: "#2a1a10",
    padding: 10,
    paddingLeft: 18
  },
  cartBarGuarded: {
    opacity: 0.7
  },
  cartInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  cartCountBubble: {
    minWidth: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    paddingHorizontal: 8
  },
  cartCountText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: fonts.display
  },
  cartTotal: {
    color: "#fff",
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: -0.4
  },
  saleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  saleRowCancelled: {
    opacity: 0.65
  },
  saleIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft
  },
  saleInfo: {
    flex: 1,
    gap: 3
  },
  saleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  saleTotal: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  saleTotalCancelled: {
    textDecorationLine: "line-through",
    color: colors.muted
  },
  saleItems: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  },
  saleTime: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  saleCancelButton: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft
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
