import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import { Mic, Minus, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Field, Input, Page, Sheet, StateText } from "@/components/ui";
import { api, createAudioForm, type NativeFile } from "@/lib/api";
import { formatCurrency, formatDate, toNumber, todayInputValue } from "@/lib/format";
import { colors, radius } from "@/lib/theme";
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

  function addProduct(produto: Produto) {
    if (!produto.preco_atual || !stockReady) return;
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

  const loading = currentDayQuery.isLoading || productsQuery.isLoading;
  const error = currentDayQuery.error || productsQuery.error || resumoQuery.error;
  const saleDisabled = !currentDay || !itemCount || currentDay.situacao !== "aberto" || !stockReady || hasStockIssue;

  return (
    <>
      <Page title="Venda" subtitle="Abra o dia, toque nos produtos e registre a sacola.">
        {loading ? <StateText text="Preparando a venda..." /> : null}
        {error instanceof Error ? <StateText tone="error" text={error.message} /> : null}
        {message ? <StateText tone="success" text={message} /> : null}

        {currentDay ? (
          <DayCard
            day={currentDay}
            sold={resumoQuery.data?.total_vendido}
            revenue={resumoQuery.data?.faturamento_bruto}
            onProduction={() => setSheet("production")}
            onSales={() => setSheet("sales")}
            onClose={() => setSheet("close-day")}
          />
        ) : (
          <Card>
            <Text style={styles.heroTitle}>Bora começar o dia?</Text>
            <Text style={styles.muted}>Registre a produção de hoje antes de vender.</Text>
            <Button title="Abrir dia de venda" onPress={() => setSheet("open-day")} />
          </Card>
        )}

        {currentDay ? (
          <>
            <View style={styles.row}>
              <Input
                placeholder="Buscar produto"
                value={search}
                onChangeText={setSearch}
                style={styles.search}
              />
              <Pressable style={styles.micButton} onPress={() => setSheet("ai")}>
                <Mic color="#fff" />
              </Pressable>
            </View>

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
        <View style={styles.cartBar}>
          <View>
            <Text style={styles.cartCount}>{itemCount} item(ns)</Text>
            <Text style={styles.cartTotal}>{formatCurrency(total)}</Text>
          </View>
          <Button title="Registrar" disabled={saleDisabled || registerSale.isPending} onPress={() => registerSale.mutate()} />
        </View>
      ) : null}

      <OpenDaySheet visible={sheet === "open-day"} onClose={() => setSheet(null)} products={products} />
      <ProductionSheet visible={sheet === "production"} onClose={() => setSheet(null)} day={currentDay} products={products} />
      <CloseDaySheet visible={sheet === "close-day"} onClose={() => setSheet(null)} day={currentDay} />
      <SalesListSheet visible={sheet === "sales"} onClose={() => setSheet(null)} day={currentDay} />
      <AiSaleSheet visible={sheet === "ai"} onClose={() => setSheet(null)} day={currentDay} onMessage={setMessage} />
    </>
  );
}

function DayCard({
  day,
  sold,
  revenue,
  onProduction,
  onSales,
  onClose
}: {
  day: DiaDeVenda;
  sold?: number;
  revenue?: string;
  onProduction: () => void;
  onSales: () => void;
  onClose: () => void;
}) {
  return (
    <Card>
      <Text style={styles.heroTitle}>Dia {day.situacao}</Text>
      <Text style={styles.muted}>{formatDate(day.data_venda)}{day.nome_local_no_momento ? ` · ${day.nome_local_no_momento}` : ""}</Text>
      <View style={styles.stats}>
        <Text style={styles.stat}>Vendidos: {sold ?? 0}</Text>
        <Text style={styles.stat}>Faturamento: {formatCurrency(revenue)}</Text>
      </View>
      <View style={styles.actions}>
        <Button title="Produção" tone="light" onPress={onProduction} />
        <Button title="Vendas" tone="light" onPress={onSales} />
        {day.situacao === "aberto" ? <Button title="Fechar" tone="dark" onPress={onClose} /> : null}
      </View>
    </Card>
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
  return (
    <Pressable onPress={onAdd} disabled={disabled} style={[styles.product, disabled && styles.disabledProduct]}>
      <Text style={styles.productName} numberOfLines={2}>{product.nome}</Text>
      <Text style={styles.price}>{formatCurrency(product.preco_atual?.preco_venda)}</Text>
      <Text style={styles.stock}>Sobra: {available}</Text>
      <View style={styles.qtyRow}>
        <Pressable style={styles.qtyButton} onPress={onRemove} disabled={!quantity}>
          <Minus size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.qty}>{quantity}</Text>
        <Pressable style={styles.qtyButton} onPress={onAdd} disabled={disabled}>
          <Plus size={18} color={colors.ink} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function OpenDaySheet({ visible, onClose, products }: { visible: boolean; onClose: () => void; products: Produto[] }) {
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
    <Sheet visible={visible} title="Abrir dia" onClose={onClose}>
      <Field label="Observações">
        <Input value={notes} onChangeText={setNotes} placeholder="Opcional" />
      </Field>
      {products.map((produto) => (
        <Field key={produto.id} label={produto.nome}>
          <Input
            value={String(quantities[produto.id] || "")}
            onChangeText={(value) => setQuantities((current) => ({ ...current, [produto.id]: Number(value || 0) }))}
            keyboardType="number-pad"
            placeholder="Quantidade produzida"
          />
        </Field>
      ))}
      {createDay.error instanceof Error ? <StateText tone="error" text={createDay.error.message} /> : null}
      <Button title={createDay.isPending ? "Abrindo..." : "Abrir dia"} disabled={createDay.isPending} onPress={() => createDay.mutate()} />
    </Sheet>
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
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const save = useMutation({
    mutationFn: () => {
      if (!day || !productId || !Number(quantity)) throw new Error("Escolha produto e quantidade.");
      return api.dias.saveProductionItem(day.id, { produto_id: productId, quantidade_produzida: Number(quantity) });
    },
    onSuccess: () => {
      setQuantity("");
      invalidateDay(queryClient);
    }
  });

  return (
    <Sheet visible={visible} title="Editar produção" onClose={onClose}>
      {products.map((produto) => (
        <Pressable
          key={produto.id}
          style={[styles.choice, productId === produto.id && styles.choiceActive]}
          onPress={() => setProductId(produto.id)}
        >
          <Text style={styles.choiceText}>{produto.nome}</Text>
        </Pressable>
      ))}
      <Field label="Quantidade produzida">
        <Input value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
      </Field>
      {save.error instanceof Error ? <StateText tone="error" text={save.error.message} /> : null}
      <Button title={save.isPending ? "Salvando..." : "Salvar produção"} disabled={save.isPending} onPress={() => save.mutate()} />
    </Sheet>
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
    <Sheet visible={visible} title="Fechar dia" onClose={onClose}>
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

  return (
    <Sheet visible={visible} title="Vendas do dia" onClose={onClose}>
      {salesQuery.isLoading ? <StateText text="Carregando vendas..." /> : null}
      {salesQuery.error instanceof Error ? <StateText tone="error" text={salesQuery.error.message} /> : null}
      {salesQuery.data?.map((sale) => {
        const total = (sale.itens || []).reduce((sum, item) => sum + toNumber(item.valor_total_venda), 0);
        return (
          <Card key={sale.id}>
            <Text style={styles.productName}>{formatCurrency(total)}</Text>
            <Text style={styles.muted}>{sale.itens?.length || 0} item(ns) · {sale.situacao}</Text>
            {sale.situacao !== "cancelada" ? (
              <Button title="Cancelar" tone="danger" disabled={cancelSale.isPending} onPress={() => cancelSale.mutate(sale)} />
            ) : null}
          </Card>
        );
      })}
    </Sheet>
  );
}

function AiSaleSheet({
  visible,
  onClose,
  day,
  onMessage
}: {
  visible: boolean;
  onClose: () => void;
  day: DiaDeVenda | null;
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [result, setResult] = useState<RespostaInterpretarVenda | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const interpret = useMutation({
    mutationFn: () => api.ia.interpretSale({ texto: text, dia_de_venda_id: day?.id, permitir_fallback: true }),
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
    mutationFn: () => api.ia.confirmSale(result!.interacao_ia_id),
    onSuccess: () => {
      onMessage("Venda registrada por IA.");
      onClose();
      invalidateDay(queryClient);
    }
  });

  async function toggleRecording() {
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        if (recorder.uri) {
          upload.mutate({ uri: recorder.uri, name: `venda-${Date.now()}.m4a`, type: "audio/mp4" });
        }
        return;
      }

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

  return (
    <Sheet visible={visible} title="Falar a venda" onClose={onClose}>
      <Field label="Comando">
        <Input value={text} onChangeText={setText} placeholder="Ex: vende 2 pães de queijo" multiline />
      </Field>
      <View style={styles.actions}>
        <Button title={interpret.isPending ? "Interpretando..." : "Interpretar"} disabled={!text.trim() || interpret.isPending} onPress={() => interpret.mutate()} />
        <Button title={recorderState.isRecording ? "Parar gravação" : upload.isPending ? "Enviando..." : "Gravar"} tone="dark" disabled={upload.isPending} onPress={toggleRecording} />
      </View>
      {interpret.error instanceof Error ? <StateText tone="error" text={interpret.error.message} /> : null}
      {upload.error instanceof Error ? <StateText tone="error" text={upload.error.message} /> : null}
      {result ? (
        <Card>
          <Text style={styles.productName}>{result.mensagem_assistente}</Text>
          {result.itens?.map((item) => (
            <Text key={`${item.produto_id}-${item.nome_produto}`} style={styles.muted}>
              {item.quantidade}x {item.nome_produto} · {Math.round(item.confianca * 100)}%
            </Text>
          ))}
          <Button title={confirm.isPending ? "Confirmando..." : "Confirmar venda"} tone="success" disabled={!result.interacao_ia_id || confirm.isPending} onPress={() => confirm.mutate()} />
        </Card>
      ) : null}
    </Sheet>
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

const styles = StyleSheet.create({
  heroTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  muted: {
    color: colors.muted,
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  search: {
    flex: 1
  },
  micButton: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.ink
  },
  productRow: {
    gap: 10,
    marginBottom: 10
  },
  product: {
    flex: 1,
    minHeight: 168,
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 12
  },
  disabledProduct: {
    opacity: 0.48
  },
  productName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  price: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: "900"
  },
  stock: {
    color: colors.muted,
    fontWeight: "800"
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  qtyButton: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong
  },
  qty: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  stats: {
    gap: 4
  },
  stat: {
    color: colors.ink,
    fontWeight: "800"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  cartBar: {
    position: "absolute",
    right: 16,
    bottom: 86,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    padding: 14
  },
  cartCount: {
    color: "#fff",
    fontWeight: "800"
  },
  cartTotal: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900"
  },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12
  },
  choiceActive: {
    borderColor: colors.brand,
    backgroundColor: colors.surfaceStrong
  },
  choiceText: {
    color: colors.ink,
    fontWeight: "900"
  }
});
