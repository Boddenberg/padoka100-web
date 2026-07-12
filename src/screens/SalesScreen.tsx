import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ban, CalendarDays, CheckCircle2, ChevronRight, Mic, ReceiptText, Search, Send, Sparkles } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AGENT_NAME, AgentAvatar, AgentTag } from "@/components/agent";
import { CoachAnchor, useCoach, type CoachStep } from "@/components/coach/coach-tour";
import { NotificationsButton } from "@/components/notifications";
import { SettingsButton } from "@/components/settings-menu";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Money,
  Page,
  ProductPhoto,
  Sheet,
  Skeleton,
  StateText,
  Stepper
} from "@/components/ui";
import { api, ApiError, createAudioForm, friendlyErrorMessage, type NativeFile } from "@/lib/api";
import { hasAccess, upgradeMessage } from "@/lib/access";
import { formatCurrency, formatDate, toNumber, todayInputValue } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import { useAuth } from "@/contexts/auth";
import { hasSeenSalesTour, markSalesTourSeen } from "@/lib/onboarding";
import { haptics } from "@/lib/haptics";
import { getGreeting } from "@/utils/greeting";
import { fixProductName } from "@/utils/text";
import type {
  DecisaoSobraRequest,
  DiaDeVenda,
  Produto,
  RespostaDecidirSobras,
  RespostaInterpretarVenda,
  Venda
} from "@/types/api";

type Cart = Record<string, number>;
type ActiveSheet = "open-day" | "production" | "close-day" | "sales" | "ai" | null;

const DIACRITICS = /\p{M}/gu;
const EMPTY_PRODUCTS: Produto[] = [];

export function SalesScreen() {
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const coach = useCoach();
  const canUseOperationalAi = hasAccess(user, "ia.operacional");
  const insets = useSafeAreaInsets();
  const [cart, setCart] = useState<Cart>({});
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
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

  // Puxar-para-recarregar: refaz dia atual, produtos e resumo (recupera de erro).
  const refreshing = currentDayQuery.isRefetching || productsQuery.isRefetching || resumoQuery.isRefetching;
  const onRefresh = () => {
    currentDayQuery.refetch();
    productsQuery.refetch();
    // refetch() atropela o `enabled`: sem dia aberto, buscaria
    // /relatorios/dias/undefined/resumo e estouraria um 422 na tela.
    if (currentDayQuery.data?.id) resumoQuery.refetch();
  };

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

  // A aba Venda não é catálogo: só entram os produtos que participam do dia.
  // Quem entrou e esgotou continua na tela; quem nunca entrou não aparece.
  const dayProducts = useMemo(() => {
    const participating = new Set<string>();
    currentDay?.itens_producao?.forEach((item) => {
      if (item.quantidade_produzida > 0) participating.add(item.produto_id);
    });
    resumoQuery.data?.produtos?.forEach((produto) => {
      const entered =
        produto.participou_da_venda ??
        ((produto.quantidade_produzida ?? 0) > 0 ||
          (produto.quantidade_sobra_aproveitada ?? 0) > 0 ||
          (produto.quantidade_vendida ?? 0) > 0);
      if (entered) participating.add(produto.produto_id);
    });
    return products.filter((produto) => participating.has(produto.id));
  }, [currentDay, resumoQuery.data, products]);

  const filteredProducts = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return dayProducts;
    return dayProducts.filter((produto) => normalize(produto.nome).includes(term));
  }, [dayProducts, search]);

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
      haptics.success();
      setCart({});
      setMessage(`Venda registrada: ${sale.itens?.length || itemCount} item(ns).`);
      invalidateDay(queryClient);
    },
    onError: () => haptics.error()
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

  // O recado de sucesso se despede sozinho.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [message]);

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
    if (!canUseOperationalAi) {
      setAccessNotice(upgradeMessage("ia.operacional"));
      return;
    }
    setAccessNotice(null);
    setAiInitialText(options?.text || "");
    setAiAutoRecord(Boolean(options?.record));
    setSheet("ai");
  }

  const loading = currentDayQuery.isLoading || productsQuery.isLoading;
  const error = currentDayQuery.error || productsQuery.error || resumoQuery.error;
  const saleDisabled = !currentDay || !itemCount || currentDay.situacao !== "aberto" || !stockReady || hasStockIssue;

  // Primeiro uso de verdade: nada cadastrado ainda. A Venda vira o guia —
  // ninguém precisa adivinhar que o cadastro mora em outra aba.
  const isFirstRun = !loading && !currentDay && productsQuery.isSuccess && products.length === 0;

  // Passeio guiado de primeiro acesso (coach marks). Os passos se adaptam ao
  // estado da tela: sem dia aberto não há produtos para destacar, então esse
  // passo é omitido (e o próprio tour pula qualquer alvo que não encontrar).
  const tourStateRef = useRef({ hasDay: false, hasProducts: false });
  tourStateRef.current = { hasDay: Boolean(currentDay), hasProducts: filteredProducts.length > 0 };

  const buildTourSteps = (): CoachStep[] => {
    const { hasDay, hasProducts } = tourStateRef.current;
    const steps: CoachStep[] = [
      {
        emoji: "👋",
        title: "Bem-vindo(a) ao Padoka 100%!",
        body: "Vou te mostrar rapidinho onde fica cada coisa. É um passo de cada vez — toque em “Próximo”."
      },
      {
        target: "coach-hero",
        emoji: "🌅",
        title: hasDay ? "O seu dia de venda" : "Comece o seu dia aqui",
        body: hasDay
          ? "Aqui aparece o total vendido de hoje. Toque nos botões para ver a produção, as vendas e para fechar o dia."
          : "Toque em “Começar o dia” e diga quanto você preparou. Depois é só vender."
      },
      {
        target: "coach-agent",
        emoji: "🎤",
        title: "Fale ou escreva",
        body: `Toque no microfone e fale, por exemplo, “vende 2 pães de queijo”. O ${AGENT_NAME} registra pra você. Aqui também dá para buscar um produto.`
      }
    ];
    if (hasDay && hasProducts) {
      steps.push({
        target: "coach-products",
        emoji: "🥖",
        title: "Toque para vender",
        body: "Toque no produto para colocar na sacola. Use os botões “+” e “−” para ajustar a quantidade.",
        maxSpotlightHeight: 260
      });
    }
    steps.push({
      region: "tabs",
      cornerRadius: 26,
      emoji: "🧭",
      title: "Tudo à mão aqui embaixo",
      body: "Venda, Produtos, Resumo e Perfil. Toque nos ícones para trocar de tela."
    });
    steps.push({
      emoji: "✅",
      title: "Prontinho!",
      body: "Você pode rever este passeio quando quiser, em Preferências (a engrenagem no topo). Boas vendas! 🥐"
    });
    return steps;
  };

  // Primeiro login: abre o passeio uma única vez, e SÓ quando a sessão está
  // comprovadamente válida — produtos carregados com sucesso significa que o
  // token funcionou. Sem essa trava, um 401 logo após restaurar a sessão salva
  // (que assume "logado" por um instante) fazia o tour disparar já na tela de
  // login, apontando para alvos que não existem mais.
  const coachRef = useRef(coach);
  coachRef.current = coach;
  const tourStartedRef = useRef(false);
  const canStartTour = status === "signed-in" && Boolean(user?.id) && productsQuery.isSuccess && !loading;

  useEffect(() => {
    if (tourStartedRef.current || !canStartTour || !user?.id) return;
    const userId = user.id;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    void hasSeenSalesTour(userId).then((seen) => {
      if (cancelled || seen) return;
      // Pausa curta deixa o layout assentar antes de medir os alvos.
      timer = setTimeout(() => {
        if (cancelled) return;
        tourStartedRef.current = true;
        coach.startTour(buildTourSteps(), {
          onFinish: () => markSalesTourSeen(userId),
          onSkip: () => markSalesTourSeen(userId)
        });
      }, 700);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canStartTour, user?.id]);

  // Sessão caiu (ex.: 401 → logout) ou saiu da Venda: encerra o passeio na hora,
  // para o overlay nunca sobrar órfão sobre a tela de login.
  useEffect(() => {
    if (status !== "signed-in") coachRef.current.stop();
  }, [status]);
  useEffect(() => () => coachRef.current.stop(), []);

  // "Rever tutorial" (Preferências): reabre o passeio ignorando o histórico.
  useEffect(() => {
    if (coach.replayNonce === 0) return;
    const timer = setTimeout(() => coach.startTour(buildTourSteps()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.replayNonce]);

  return (
    <>
      <Page
        greeting={getGreeting(user?.nome)}
        title="Venda"
        subtitle={isFirstRun ? "Vamos deixar tudo pronto para a primeira venda." : `Toque para vender ou fale com o ${AGENT_NAME}.`}
        onRefresh={onRefresh}
        refreshing={refreshing}
        headerRight={
          <>
            <NotificationsButton />
            <SettingsButton />
          </>
        }
      >
        {loading ? (
          <View style={styles.skeletonStack}>
            <Skeleton height={210} rounded={radius.xl} />
            <Skeleton height={130} rounded={radius.xl} />
            <View style={styles.skeletonRow}>
              <View style={styles.skeletonTile}>
                <Skeleton height={215} rounded={radius.xl} />
              </View>
              <View style={styles.skeletonTile}>
                <Skeleton height={215} rounded={radius.xl} />
              </View>
            </View>
          </View>
        ) : null}
        {error ? <StateText tone="error" text={friendlyErrorMessage(error)} /> : null}
        {message ? <SuccessToast message={message} /> : null}

        {currentDay ? (
          <CoachAnchor name="coach-hero">
            <DayHero
              day={currentDay}
              sold={resumoQuery.data?.total_vendido}
              produced={resumoQuery.data?.total_disponivel ?? resumoQuery.data?.total_produzido}
              revenue={resumoQuery.data?.faturamento_bruto ?? resumoQuery.data?.faturamento_total}
              onProduction={() => setSheet("production")}
              onSales={() => setSheet("sales")}
              onClose={() => setSheet("close-day")}
            />
          </CoachAnchor>
        ) : isFirstRun ? (
          <CoachAnchor name="coach-hero">
            <FirstStepsCard onCreateProduct={() => router.push("/catalogo?novo=1")} />
          </CoachAnchor>
        ) : !loading ? (
          <CoachAnchor name="coach-hero">
            <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View pointerEvents="none" style={styles.heroGlowOne} />
              <View pointerEvents="none" style={styles.heroGlowTwo} />
              <Text style={styles.heroTitle}>Bora começar o dia?</Text>
              <Text style={styles.heroMuted}>Diga o que você preparou hoje e venda com um toque. Dá para produzir mais depois.</Text>
              <Button title="Começar o dia" onPress={() => setSheet("open-day")} />
            </LinearGradient>
          </CoachAnchor>
        ) : null}

        {!loading && !isFirstRun ? (
          <CoachAnchor name="coach-agent">
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
          </CoachAnchor>
        ) : null}
        {!loading && accessNotice ? <StateText text={accessNotice} /> : null}

        {currentDay ? (
          <CoachAnchor name="coach-products">
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
              <EmptyState
                emoji="🧺"
                title={dayProducts.length ? "Nenhum produto encontrado" : "Nenhum produto na venda de hoje"}
                hint={
                  dayProducts.length
                    ? "Tente outro nome na busca."
                    : "Diga o que você produziu e os produtos aparecem aqui para vender."
                }
                actionLabel={dayProducts.length ? undefined : "Registrar produção"}
                onAction={dayProducts.length ? undefined : () => setSheet("production")}
              />
            )}
          </CoachAnchor>
        ) : null}
      </Page>

      {itemCount ? (
        <View
          pointerEvents={cartBarGuard ? "none" : "auto"}
          style={[styles.cartBar, shadows.floating, { bottom: 76 + insets.bottom }, cartBarGuard && styles.cartBarGuarded]}
        >
          <View style={styles.cartInfo}>
            <View style={styles.cartCountBubble}>
              <Text style={styles.cartCountText}>{itemCount}</Text>
            </View>
            <Text style={styles.cartTotal}>{formatCurrency(total)}</Text>
          </View>
          <Button
            title={registerSale.isPending ? "Registrando..." : "Registrar venda"}
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
      <View pointerEvents="none" style={styles.heroGlowOne} />
      <View pointerEvents="none" style={styles.heroGlowTwo} />
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
        <Text style={styles.heroTitle}>{day.nome_local_no_momento || "Venda de hoje"}</Text>
      </View>

      <View>
        <Text style={styles.heroMuted}>Vendas de hoje</Text>
        <View style={styles.heroRevenueRow}>
          <Money value={revenue} size={38} color="#fff" prefixColor="rgba(255,255,255,0.75)" />
        </View>
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

// Primeiro acesso: a sequência real de uso vira o guia dentro do cartão
// da madrugada. Só o passo 1 é possível agora — os próximos ficam à meia-luz.
function FirstStepsCard({ onCreateProduct }: { onCreateProduct: () => void }) {
  const steps = [
    { title: "Cadastre o que você vende", hint: "Nome e preço já bastam para começar." },
    { title: "Comece o dia", hint: "Diga quantos de cada um você preparou." },
    { title: "Venda com um toque", hint: "Toque no produto e pronto: venda registrada." }
  ];

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View pointerEvents="none" style={styles.heroGlowOne} />
      <View pointerEvents="none" style={styles.heroGlowTwo} />
      <Text style={styles.heroTitle}>Sua padoca começa aqui</Text>
      <Text style={styles.heroMuted}>Três passos e a primeira venda sai do forno:</Text>
      <View style={styles.stepList}>
        {steps.map((step, index) => (
          <View key={step.title} style={[styles.stepRow, index > 0 && styles.stepRowNext]}>
            <View style={[styles.stepNumber, index === 0 && styles.stepNumberActive]}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepHint}>{step.hint}</Text>
            </View>
          </View>
        ))}
      </View>
      <Button title="Cadastrar produto" onPress={onCreateProduct} />
    </LinearGradient>
  );
}

// Recado de sucesso que entra deslizando e some sozinho.
function SuccessToast({ message }: { message: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }]
        }
      ]}
    >
      <CheckCircle2 size={20} color={colors.success} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
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
            placeholder="Busque ou peça ao Pãozinho"
            value={search}
            onChangeText={onSearchChange}
            style={styles.searchInput}
            returnKeyType="send"
            onSubmitEditing={onAsk}
          />
        </View>
        <Pressable
          onPress={onSpeak}
          accessibilityRole="button"
          accessibilityLabel={`Falar com o ${AGENT_NAME}`}
          style={({ pressed }) => pressed && styles.pressed}
        >
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
  const soldOut = available <= 0;
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
        {soldOut ? (
          <View style={styles.soldOutOverlay}>
            <Text style={styles.soldOutText}>Esgotado</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.productBody}>
        <Text style={styles.productName} numberOfLines={2}>
          {fixProductName(product.nome)}
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
              {fixProductName(produto.nome)}
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
    <Sheet visible={visible} title="Começar o dia" subtitle="Quantos itens você preparou hoje?" onClose={onClose}>
      {visible ? <OpenDayForm onClose={onClose} products={products} /> : null}
    </Sheet>
  );
}

function OpenDayForm({ onClose, products }: { onClose: () => void; products: Produto[] }) {
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Cart>({});
  // Sobras do dia anterior aguardando a decisão do usuário.
  const [pendingLeftovers, setPendingLeftovers] = useState<RespostaDecidirSobras | null>(null);
  const [leftoverUse, setLeftoverUse] = useState<Cart>({});

  const startDay = useMutation({
    mutationFn: async (decisoes?: DecisaoSobraRequest[]) => {
      const itens_producao = products
        .map((produto) => ({ produto_id: produto.id, quantidade_produzida: Number(quantities[produto.id] || 0) }))
        .filter((item) => item.quantidade_produzida > 0);
      try {
        return await api.dias.startToday({
          data_venda: todayInputValue(),
          itens_producao,
          ...(decisoes ? { decisoes_sobra: decisoes } : {})
        });
      } catch (error) {
        // Backend antigo (produção) ainda não tem "iniciar-hoje": abre o dia
        // pelo endpoint clássico para não travar a venda.
        if (error instanceof ApiError && error.status === 404) {
          return api.dias.create({ data_venda: todayInputValue(), itens_producao });
        }
        throw error;
      }
    },
    onSuccess: (response) => {
      // Só a ação "decidir_sobras" abre a etapa de sobras. As demais
      // (dia_iniciado / dia_atual_aberto) já iniciaram o dia — fecha e recarrega.
      if ("acao" in response && response.acao === "decidir_sobras") {
        setPendingLeftovers(response);
        const initial: Cart = {};
        response.sobras_pendentes.forEach((sobra) => {
          initial[sobra.produto_id] = sobra.quantidade_sugerida_para_usar;
        });
        setLeftoverUse(initial);
        return;
      }
      onClose();
      invalidateDay(queryClient);
    }
  });

  if (pendingLeftovers) {
    return (
      <>
        <View style={styles.leftoverNotice}>
          <Text style={styles.leftoverNoticeText}>{pendingLeftovers.mensagem}</Text>
        </View>
        <Text style={styles.leftoverGuide}>
          Escolha quais sobras de ontem quer reaproveitar e quanto usar de cada uma. Deixe em 0 as que não quiser aproveitar.
        </Text>
        {pendingLeftovers.sobras_pendentes.map((sobra) => {
          const use = leftoverUse[sobra.produto_id] ?? 0;
          return (
            <View key={sobra.produto_id} style={styles.productionRow}>
              <View style={styles.leftoverInfo}>
                <Text style={styles.productionName} numberOfLines={2}>
                  {fixProductName(sobra.nome_produto)}
                </Text>
                <Text style={[styles.leftoverHint, use === 0 && styles.leftoverHintOff]}>
                  {use === 0 ? `Sobraram ${sobra.quantidade_sobra} · não vou reaproveitar` : `Reaproveitar ${use} de ${sobra.quantidade_sobra}`}
                </Text>
              </View>
              <Stepper
                value={use}
                onIncrement={() =>
                  setLeftoverUse((current) => ({
                    ...current,
                    [sobra.produto_id]: Math.min(sobra.quantidade_sobra, use + 1)
                  }))
                }
                onDecrement={() =>
                  setLeftoverUse((current) => ({ ...current, [sobra.produto_id]: Math.max(0, use - 1) }))
                }
                canAdd={use < sobra.quantidade_sobra}
              />
            </View>
          );
        })}
        {startDay.error instanceof Error ? <StateText tone="error" text={startDay.error.message} /> : null}
        <Button
          title={startDay.isPending ? "Começando..." : "Confirmar sobras e começar o dia"}
          disabled={startDay.isPending}
          onPress={() =>
            startDay.mutate(
              pendingLeftovers.sobras_pendentes.map((sobra) => ({
                produto_id: sobra.produto_id,
                quantidade_usada_hoje: leftoverUse[sobra.produto_id] ?? 0
              }))
            )
          }
        />
        <Button title="Voltar" tone="soft" onPress={() => setPendingLeftovers(null)} />
      </>
    );
  }

  if (!products.length) {
    return (
      <EmptyState
        emoji="🥖"
        title="Nenhum produto cadastrado"
        hint="Cadastre o que você vende para poder começar o dia."
        actionLabel="Cadastrar produto"
        onAction={() => {
          onClose();
          router.push("/catalogo?novo=1");
        }}
      />
    );
  }

  return (
    <>
      <ProductionEditor
        products={products}
        quantities={quantities}
        onChange={(produtoId, value) => setQuantities((current) => ({ ...current, [produtoId]: value }))}
      />
      {startDay.error instanceof Error ? <StateText tone="error" text={startDay.error.message} /> : null}
      <Button title={startDay.isPending ? "Começando..." : "Começar o dia"} disabled={startDay.isPending} onPress={() => startDay.mutate(undefined)} />
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
          .map((item) => `${item.quantidade}x ${fixProductName(item.nome_produto_no_momento)}`)
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
  // Recado quando a confirmação não pôde ser aplicada (sucesso: false).
  const [confirmNotice, setConfirmNotice] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

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
                {item.quantidade}x {fixProductName(item.nome_produto)}
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
          {confirmNotice ? <StateText tone="error" text={confirmNotice} /> : null}
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
    overflow: "hidden",
    ...shadows.floating
  },
  // Brasas no céu de madrugada: o brilho do forno é a única luz quente.
  heroGlowOne: {
    position: "absolute",
    top: -70,
    right: -50,
    height: 200,
    width: 200,
    borderRadius: 100,
    backgroundColor: "rgba(240,140,30,0.20)"
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: -90,
    left: -60,
    height: 220,
    width: 220,
    borderRadius: 110,
    backgroundColor: "rgba(240,140,30,0.10)"
  },
  stepList: {
    gap: 14,
    marginVertical: 2
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  // Passos futuros ficam à meia-luz: dá para ler, mas o agora é o passo 1.
  stepRowNext: {
    opacity: 0.55
  },
  stepNumber: {
    height: 30,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)"
  },
  stepNumberActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand
  },
  stepNumberText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: fonts.display
  },
  stepBody: {
    flex: 1,
    gap: 2
  },
  stepTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.bodyBold
  },
  stepHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body
  },
  heroRevenueRow: {
    marginVertical: 4
  },
  skeletonStack: {
    gap: 16
  },
  skeletonRow: {
    flexDirection: "row",
    gap: 12
  },
  skeletonTile: {
    flex: 1
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
    // O forno acende conforme vende: barra em âmbar, não branca.
    backgroundColor: "#f08c1e"
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
  soldOutOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(51, 35, 26, 0.45)"
  },
  soldOutText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    borderRadius: radius.pill,
    backgroundColor: "rgba(51, 35, 26, 0.75)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: "hidden"
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
  leftoverNotice: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.warningSoft,
    backgroundColor: colors.surfaceGlow,
    padding: 14
  },
  leftoverNoticeText: {
    color: colors.warning,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    lineHeight: 21
  },
  leftoverGuide: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: fonts.body
  },
  leftoverInfo: {
    flex: 1,
    gap: 2
  },
  leftoverHint: {
    color: colors.success,
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  leftoverHintOff: {
    color: colors.muted,
    fontFamily: fonts.body
  },
  cartBar: {
    position: "absolute",
    right: 16,
    // Acima da tab bar flutuante.
    bottom: 94,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: radius.pill,
    // "Ilha" clara como a tab bar, no lugar do marrom escuro que destoava.
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.ink,
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
