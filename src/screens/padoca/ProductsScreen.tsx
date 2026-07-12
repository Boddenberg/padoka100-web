import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, ChevronRight, Mic, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AGENT_NAME, AgentSays } from "@/components/agent";
import { AgentSheet } from "@/components/agent-sheet";
import { Badge, Button, EmptyState, Field, Input, MoneyInput, ProductPhoto, SectionTitle, Sheet, StateText } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { hasAccess, upgradeMessage } from "@/lib/access";
import { api, createMediaForm, friendlyErrorMessage } from "@/lib/api";
import { cleanPayload, formatCurrency, toNumber, todayInputValue } from "@/lib/format";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import { pickImage } from "@/utils/media";
import { fixProductName } from "@/utils/text";
import type { Produto } from "@/types/api";
import {
  PhotoPickerButtons,
  SubPage,
  confirmDestructive,
  decimalToInput,
  inputToDecimal,
  isCostFromAI,
  sharedStyles,
  showUpgrade
} from "./shared";

type ProductDraft = {
  nome: string;
  descricao: string;
  cor_botao: string;
  preco_venda: string;
  preco_custo: string;
};

const emptyProduct: ProductDraft = {
  nome: "",
  descricao: "",
  cor_botao: "#ff7a1a",
  preco_venda: "",
  preco_custo: "0"
};

// "Produtos e preços": porta do hub Minha padoca. Mesmo conteúdo e visual do
// antigo Catálogo, agora só de produtos — locais têm a própria tela.
export function ProductsScreen() {
  const [sheet, setSheet] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Produto | null>(null);
  const productsQuery = useQuery({ queryKey: ["produtos", "todos"], queryFn: () => api.produtos.list(false) });

  // Cadastro por voz ou foto do cardápio com o Pãozinho (plano com IA).
  const { user } = useAuth();
  const canUseAgent = hasAccess(user, "ia.operacional");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentAutoRecord, setAgentAutoRecord] = useState(false);
  const [agentMessage, setAgentMessage] = useState<string | null>(null);

  // "Por voz" já abre gravando; "por foto" abre nos botões de foto.
  const openAgent = (mode: "voice" | "photo") => {
    setSheet(null);
    setAgentAutoRecord(mode === "voice");
    setAgentOpen(true);
  };

  // O recado de sucesso do Pãozinho se despede sozinho.
  useEffect(() => {
    if (!agentMessage) return;
    const timer = setTimeout(() => setAgentMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [agentMessage]);

  // Atalho vindo de "Hoje" (?novo=1): abre o cadastro direto, sem caçar botão.
  const router = useRouter();
  const params = useLocalSearchParams<{ novo?: string }>();
  useEffect(() => {
    if (params.novo) {
      setSheet("create");
      router.setParams({ novo: "" });
    }
  }, [params.novo, router]);

  // Sempre a versão mais fresca do produto em edição (após salvar/foto).
  const editingProduct = productsQuery.data?.find((produto) => produto.id === editing?.id) || editing;
  const activeProducts = productsQuery.data?.filter((produto) => produto.situacao === "ativo") || [];
  const inactiveProducts = productsQuery.data?.filter((produto) => produto.situacao !== "ativo") || [];

  const productRow = (produto: Produto) => (
    <Pressable
      key={produto.id}
      onPress={() => {
        setEditing(produto);
        setSheet("edit");
      }}
      style={({ pressed }) => [sharedStyles.itemRow, shadows.soft, pressed && sharedStyles.pressed]}
    >
      <ProductPhoto url={produto.url_imagem_principal} name={produto.nome} size={62} rounded={radius.lg} />
      <View style={sharedStyles.itemInfo}>
        <Text style={sharedStyles.itemTitle}>{fixProductName(produto.nome)}</Text>
        <Text style={sharedStyles.itemPrice}>{formatCurrency(produto.preco_atual?.preco_venda)}</Text>
        <Badge text={produto.situacao} tone={produto.situacao === "ativo" ? "good" : "warn"} />
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <>
      <SubPage
        title="Produtos e preços"
        subtitle="O que você vende, com preço e foto."
        onRefresh={() => productsQuery.refetch()}
        refreshing={productsQuery.isRefetching}
      >
        <Button title="Cadastrar produto" onPress={() => setSheet("create")} />

        {agentMessage ? <StateText tone="success" text={agentMessage} /> : null}
        {productsQuery.isLoading ? <StateText text="Carregando produtos..." /> : null}
        {productsQuery.error ? <StateText tone="error" text={friendlyErrorMessage(productsQuery.error)} /> : null}
        {activeProducts.map(productRow)}
        {productsQuery.isSuccess && activeProducts.length === 0 ? (
          <EmptyState
            emoji="🥖"
            title="Nenhum produto cadastrado"
            hint="Comece pelo que você mais vende. Nome e preço já bastam."
            actionLabel="Cadastrar produto"
            onAction={() => setSheet("create")}
          />
        ) : null}

        {inactiveProducts.length > 0 ? (
          <>
            <SectionTitle text="Produtos inativos" />
            <StateText text="Fora da venda e da lista. Toque para reativar." />
            {inactiveProducts.map(productRow)}
          </>
        ) : null}
      </SubPage>

      <CreateProductSheet
        visible={sheet === "create"}
        onClose={() => setSheet(null)}
        onAssistant={canUseAgent ? openAgent : undefined}
      />
      <EditProductSheet visible={sheet === "edit"} onClose={() => setSheet(null)} product={editingProduct} />
      <AgentSheet
        visible={agentOpen}
        onClose={() => setAgentOpen(false)}
        day={null}
        initialText=""
        autoRecord={agentAutoRecord}
        onMessage={setAgentMessage}
        prompts={{
          idle: "Me fala o produto e o preço — por voz, foto do cardápio ou texto — que eu cadastro pra você.",
          exampleVoice: "Ex: “cadastra pão de queijo por 4 e 50”",
          exampleText: "Ex: cadastra pão de queijo por 4,50"
        }}
        photo={{ kind: "cardapio", contexto: "Cardápio da banca" }}
      />
    </>
  );
}

function CreateProductSheet({
  visible,
  onClose,
  onAssistant
}: {
  visible: boolean;
  onClose: () => void;
  onAssistant?: (mode: "voice" | "photo") => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const createProduct = useMutation({
    mutationFn: async () => {
      // Preço vai flat no cadastro (preco_venda/preco_custo/vigente_desde).
      const payload: Record<string, unknown> = {
        nome: draft.nome,
        descricao: draft.descricao,
        cor_botao: draft.cor_botao,
        ordem_exibicao: 0,
        situacao: "ativo"
      };
      if (draft.preco_venda) {
        payload.preco_venda = Number(draft.preco_venda);
        payload.preco_custo = Number(draft.preco_custo || 0);
        payload.vigente_desde = todayInputValue();
      }
      const created = await api.produtos.create(cleanPayload(payload));
      return created;
    },
    onSuccess: () => {
      setDraft(emptyProduct);
      onClose();
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });

  return (
    <Sheet visible={visible} title="Cadastrar produto" subtitle="Depois adicione a foto na edição." onClose={onClose}>
      {onAssistant ? (
        <AgentSays size={40} text="Se preferir, eu cadastro pra você: me fale o produto e o preço, ou mande a foto do seu cardápio.">
          <View style={styles.assistantActions}>
            <Button title="Por voz" tone="agent" icon={<Mic size={18} color="#fff" />} onPress={() => onAssistant("voice")} style={styles.assistantButton} />
            <Button title="Por foto" tone="agent" icon={<Camera size={18} color="#fff" />} onPress={() => onAssistant("photo")} style={styles.assistantButton} />
          </View>
        </AgentSays>
      ) : null}
      <ProductFields draft={draft} setDraft={setDraft} />
      {createProduct.error instanceof Error ? <StateText tone="error" text={createProduct.error.message} /> : null}
      <Button
        title={createProduct.isPending ? "Cadastrando..." : "Cadastrar produto"}
        disabled={!draft.nome || createProduct.isPending}
        onPress={() => createProduct.mutate()}
      />
    </Sheet>
  );
}

function EditProductSheet({ visible, onClose, product }: { visible: boolean; onClose: () => void; product: Produto | null }) {
  return (
    <Sheet visible={visible} title={product ? fixProductName(product.nome) : "Produto"} subtitle="Dados, foto e preço" onClose={onClose}>
      {visible && product ? <EditProductForm onClose={onClose} product={product} /> : null}
    </Sheet>
  );
}

function EditProductForm({ onClose, product }: { onClose: () => void; product: Produto }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const canUseCostAssistant = hasAccess(user, "custos.assistente");
  const [nome, setNome] = useState(product.nome);
  const [descricao, setDescricao] = useState(product.descricao || "");
  const [situacao, setSituacao] = useState(product.situacao || "ativo");
  // Preço e custo começam com os valores atuais: mexer e salvar cria uma nova
  // versão de preço (histórico) sozinho, sem uma ação "Criar novo preço" à parte.
  const [price, setPrice] = useState(decimalToInput(product.preco_atual?.preco_venda));
  const [cost, setCost] = useState(decimalToInput(product.preco_atual?.preco_custo));
  // Foto recém-enviada: mostra na hora, sem esperar a lista recarregar.
  const [photoUrl, setPhotoUrl] = useState(product.url_imagem_principal);

  const priceChanged = inputToDecimal(price) !== toNumber(product.preco_atual?.preco_venda);
  const costChanged = inputToDecimal(cost) !== toNumber(product.preco_atual?.preco_custo);
  const priceOrCostChanged = priceChanged || costChanged;
  const priceValid = inputToDecimal(price) > 0;

  // Um único "Salvar alterações": grava os dados cadastrais e, se o preço ou o
  // custo mudou, registra a nova versão de preço no histórico — sem passo extra.
  const save = useMutation({
    mutationFn: async () => {
      await api.produtos.update(product.id, cleanPayload({ nome, descricao, situacao }));
      if (priceOrCostChanged) {
        await api.produtos.createPrice(product.id, {
          preco_venda: inputToDecimal(price),
          preco_custo: inputToDecimal(cost),
          vigente_desde: todayInputValue(),
          motivo: "Atualização pelo app"
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      onClose();
    }
  });

  const uploadMedia = useMutation({
    mutationFn: async (source: "camera" | "gallery") => {
      const file = await pickImage(source, "produto");
      if (!file) return null;

      const media = await api.produtos.uploadMedia(product.id, createMediaForm(file));

      // Garante a troca: grava a URL nova no produto pelo endpoint de atualização.
      const mediaUrl = media?.url_publica || media?.caminho_arquivo || null;
      if (mediaUrl) {
        await api.produtos.update(product.id, { url_imagem_principal: mediaUrl });
      }
      return mediaUrl;
    },
    onSuccess: (mediaUrl) => {
      if (mediaUrl) setPhotoUrl(mediaUrl);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });

  // "Excluir" preserva o histórico de vendas: o produto vira inativo e sai da lista.
  const removeProduct = useMutation({
    mutationFn: () => api.produtos.update(product.id, { situacao: "inativo" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      onClose();
    }
  });

  const removePhoto = useMutation({
    mutationFn: () => api.produtos.update(product.id, { url_imagem_principal: null }),
    onSuccess: () => {
      setPhotoUrl(null);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });

  const canSave = nome.trim().length > 0 && (!priceOrCostChanged || priceValid) && !save.isPending;

  // "Calcular com IA" / "Quanto custa fazer": leva ao assistente de custo,
  // ou oferece o upgrade se o plano não cobre.
  const openCostAssistant = () => {
    if (!canUseCostAssistant) {
      showUpgrade("custos.assistente");
      return;
    }
    onClose();
    router.push(`/produto/${product.id}/custos`);
  };

  return (
    <>
      {/* Identidade do produto: foto e situação atual. */}
      <View style={sharedStyles.editHeader}>
        <ProductPhoto url={photoUrl} name={product.nome} size={96} rounded={radius.xl} />
        <View style={sharedStyles.editHeaderInfo}>
          <Text style={styles.editPrice}>{formatCurrency(product.preco_atual?.preco_venda)}</Text>
          <Badge text={situacao} tone={situacao === "ativo" ? "good" : "warn"} />
        </View>
      </View>

      <PhotoPickerButtons
        onPick={(source) => uploadMedia.mutate(source)}
        disabled={uploadMedia.isPending}
        onRemove={
          photoUrl
            ? () =>
                confirmDestructive("Remover foto", "O produto fica sem foto até você enviar outra.", "Remover", () =>
                  removePhoto.mutate()
                )
            : undefined
        }
        removing={removePhoto.isPending}
      />
      {uploadMedia.isPending ? <StateText text="Enviando foto..." /> : null}
      {uploadMedia.isSuccess && uploadMedia.data ? <StateText tone="success" text="Foto atualizada!" /> : null}
      {uploadMedia.error instanceof Error ? <StateText tone="error" text={uploadMedia.error.message} /> : null}
      {removePhoto.error instanceof Error ? <StateText tone="error" text={removePhoto.error.message} /> : null}

      {/* 1) Dados principais: nome, descrição e situação (juntos, sem competir com Salvar). */}
      <Field label="Nome">
        <Input value={nome} onChangeText={setNome} maxLength={60} />
      </Field>
      <Field label="Descrição">
        <Input value={descricao} onChangeText={setDescricao} maxLength={160} />
      </Field>
      <Field label="Situação">
        <View style={sharedStyles.statusRow}>
          <Pressable
            onPress={() => setSituacao("ativo")}
            style={[sharedStyles.statusChip, situacao === "ativo" && sharedStyles.statusChipActive]}
          >
            <Text style={[sharedStyles.statusChipText, situacao === "ativo" && sharedStyles.statusChipTextActive]}>Ativo</Text>
          </Pressable>
          <Pressable
            onPress={() => setSituacao("inativo")}
            style={[sharedStyles.statusChip, situacao === "inativo" && sharedStyles.statusChipActive]}
          >
            <Text style={[sharedStyles.statusChipText, situacao === "inativo" && sharedStyles.statusChipTextActive]}>Inativo</Text>
          </Pressable>
        </View>
      </Field>

      {/* 2) Preço e custo com R$; ao lado do custo, atalho "Calcular com IA"
             (é o "quanto custa fazer"). Salvar cria o novo preço no histórico. */}
      <View style={styles.priceSection}>
        <Text style={styles.priceSectionTitle}>Preço e custo</Text>
        <Field label="Preço de venda">
          <MoneyInput value={price} onChangeText={setPrice} />
        </Field>
        <Field label="Custo">
          <View style={styles.costRow}>
            <View style={styles.costField}>
              <MoneyInput value={cost} onChangeText={setCost} />
            </View>
            <Pressable onPress={openCostAssistant} style={({ pressed }) => [styles.iaButton, pressed && sharedStyles.pressed]}>
              <Sparkles size={16} color={colors.agentDeep} />
              <Text style={styles.iaButtonText}>Calcular com IA</Text>
            </Pressable>
          </View>
        </Field>

        {priceOrCostChanged && !priceValid ? (
          <StateText tone="error" text="Informe um preço de venda maior que zero." />
        ) : priceOrCostChanged ? (
          <Text style={styles.priceHint}>Ao salvar, o novo preço entra no histórico do produto.</Text>
        ) : isCostFromAI(product.preco_atual) ? (
          <View style={styles.costFromAi}>
            <Sparkles size={13} color={colors.agentDeep} />
            <Text style={styles.costFromAiText}>Este custo foi calculado com IA.</Text>
          </View>
        ) : (
          <Text style={styles.priceHint}>
            Quanto custa fazer? Toque em “Calcular com IA” que o {AGENT_NAME} descobre pra você.
          </Text>
        )}
        {!canUseCostAssistant ? <StateText text={upgradeMessage("custos.assistente")} /> : null}
      </View>

      {/* 3) Ações no final: salvar (principal) e excluir (destrutiva). */}
      <View style={styles.footerActions}>
        {save.error instanceof Error ? <StateText tone="error" text={save.error.message} /> : null}
        <Button
          title={save.isPending ? "Salvando..." : "Salvar alterações"}
          disabled={!canSave}
          onPress={() => save.mutate()}
        />
        {removeProduct.error instanceof Error ? <StateText tone="error" text={removeProduct.error.message} /> : null}
        <Button
          title={removeProduct.isPending ? "Excluindo..." : "Excluir produto"}
          tone="danger"
          disabled={removeProduct.isPending}
          onPress={() =>
            confirmDestructive(
              "Excluir produto",
              `"${product.nome}" sai da venda e da lista de produtos, mas o histórico é mantido. Dá para reativar depois na seção "Produtos inativos".`,
              "Excluir",
              () => removeProduct.mutate()
            )
          }
        />
      </View>
    </>
  );
}

function ProductFields({ draft, setDraft }: { draft: ProductDraft; setDraft: (draft: ProductDraft) => void }) {
  return (
    <>
      <Field label="Nome">
        <Input value={draft.nome} onChangeText={(nome) => setDraft({ ...draft, nome })} maxLength={60} />
      </Field>
      <Field label="Descrição">
        <Input value={draft.descricao} onChangeText={(descricao) => setDraft({ ...draft, descricao })} maxLength={160} />
      </Field>
      <View style={styles.priceRow}>
        <View style={styles.priceCol}>
          <Field label="Preço de venda">
            <MoneyInput value={draft.preco_venda} onChangeText={(preco_venda) => setDraft({ ...draft, preco_venda })} />
          </Field>
        </View>
        <View style={styles.priceCol}>
          <Field label="Custo">
            <MoneyInput value={draft.preco_custo} onChangeText={(preco_custo) => setDraft({ ...draft, preco_custo })} />
          </Field>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  assistantActions: {
    flexDirection: "row",
    gap: 8
  },
  assistantButton: {
    flex: 1
  },
  editPrice: {
    color: colors.ink,
    fontSize: 26,
    fontFamily: fonts.display,
    letterSpacing: -0.5
  },
  // Preço e custo lado a lado no cadastro: menos rolagem.
  priceRow: {
    flexDirection: "row",
    gap: 10
  },
  priceCol: {
    flex: 1
  },
  // Custo + atalho "Calcular com IA" na mesma linha.
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  costField: {
    flex: 1
  },
  iaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.agentSoft,
    paddingHorizontal: 14
  },
  iaButtonText: {
    color: colors.agentDeep,
    fontSize: 13.5,
    fontFamily: fonts.bodyBold
  },
  costFromAi: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  costFromAiText: {
    color: colors.agentDeep,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  priceSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginTop: 4
  },
  priceSectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.display
  },
  priceHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body
  },
  footerActions: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    marginTop: 4
  }
});
