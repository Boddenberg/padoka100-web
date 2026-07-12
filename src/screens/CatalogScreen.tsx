import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Calculator, Camera, ChevronRight, Images, MapPin, ShoppingCart, Sparkles, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Field, Input, Page, ProductPhoto, SectionTitle, Sheet, StateText } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { featurePlanName, hasAccess, upgradeMessage } from "@/lib/access";
import { api, createMediaForm, type NativeFile } from "@/lib/api";
import { cleanPayload, formatCurrency, toNumber, todayInputValue } from "@/lib/format";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";
import { pickImage } from "@/utils/media";
import { fixProductName } from "@/utils/text";
import type { LocalVenda, Produto, VersaoDePreco } from "@/types/api";

// O assistente marca o custo com origem "ia". Versões antigas (gravadas antes do
// campo existir) só têm o texto do motivo, então caímos nele como fallback.
function isCostFromAI(preco?: VersaoDePreco | null) {
  if (!preco) return false;
  if (preco.origem === "ia") return true;
  if (preco.origem === "manual") return false;
  return /assistente|calculad[oa]\s+com\s+ia|\bia\b/i.test(preco.motivo || "");
}

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

function showUpgrade(capability: string) {
  const plan = featurePlanName(capability);
  Alert.alert(plan ? `Funcionalidade do plano ${plan}` : "Funcionalidade de outro plano", upgradeMessage(capability));
}

// Preço/custo digitados aceitam vírgula ou ponto; no envio viram número.
function inputToDecimal(value: string) {
  return toNumber(value.replace(/\s/g, "").replace(",", "."));
}

// Valor atual do produto → texto do campo, no formato pt-BR ("3,50"). Zero/vazio
// vira "" para o campo mostrar só o placeholder.
function decimalToInput(value: string | number | null | undefined) {
  const amount = toNumber(value);
  return amount > 0 ? amount.toFixed(2).replace(".", ",") : "";
}

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

export function CatalogScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canUseShoppingList = hasAccess(user, "compras.usar");
  const [sheet, setSheet] = useState<"product" | "location" | "edit" | "edit-location" | null>(null);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [editingLocal, setEditingLocal] = useState<LocalVenda | null>(null);
  const productsQuery = useQuery({ queryKey: ["produtos", "todos"], queryFn: () => api.produtos.list(false) });
  const locationsQuery = useQuery({ queryKey: ["locais", "todos"], queryFn: () => api.locais.list(false) });
  // Puxar-para-recarregar: refaz as buscas, mesmo se estavam em erro.
  const refreshing = productsQuery.isRefetching || locationsQuery.isRefetching;
  const onRefresh = () => {
    productsQuery.refetch();
    locationsQuery.refetch();
  };
  // Sempre a versão mais fresca do produto em edição (após salvar/foto).
  const editingProduct = productsQuery.data?.find((produto) => produto.id === editing?.id) || editing;
  const editingLocation = locationsQuery.data?.find((local) => local.id === editingLocal?.id) || editingLocal;
  const activeProducts = productsQuery.data?.filter((produto) => produto.situacao === "ativo") || [];
  const inactiveProducts = productsQuery.data?.filter((produto) => produto.situacao !== "ativo") || [];
  const activeLocations = locationsQuery.data?.filter((local) => local.situacao === "ativo") || [];
  const inactiveLocations = locationsQuery.data?.filter((local) => local.situacao !== "ativo") || [];

  const openProduct = (produto: Produto) => {
    setEditing(produto);
    setSheet("edit");
  };

  const locationRow = (local: LocalVenda) => (
    <Pressable
      key={local.id}
      onPress={() => {
        setEditingLocal(local);
        setSheet("edit-location");
      }}
      style={({ pressed }) => [styles.productRow, shadows.soft, pressed && styles.pressed]}
    >
      <LocationPhoto url={local.url_imagem_principal} size={62} />
      <View style={styles.productInfo}>
        <Text style={styles.productTitle}>{local.nome}</Text>
        {local.endereco_texto ? <Text style={styles.locationAddress}>{local.endereco_texto}</Text> : null}
        <Badge text={local.situacao} tone={local.situacao === "ativo" ? "good" : "warn"} />
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );

  const productRow = (produto: Produto) => (
    <Pressable
      key={produto.id}
      onPress={() => openProduct(produto)}
      style={({ pressed }) => [styles.productRow, shadows.soft, pressed && styles.pressed]}
    >
      <ProductPhoto url={produto.url_imagem_principal} name={produto.nome} size={62} rounded={radius.lg} />
      <View style={styles.productInfo}>
        <Text style={styles.productTitle}>{fixProductName(produto.nome)}</Text>
        <Text style={styles.productPrice}>{formatCurrency(produto.preco_atual?.preco_venda)}</Text>
        <Badge text={produto.situacao} tone={produto.situacao === "ativo" ? "good" : "warn"} />
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <>
      <Page title="Catálogo" subtitle="Produtos, preços, fotos e locais de venda." onRefresh={onRefresh} refreshing={refreshing}>
        {/* Porta de entrada da lista de compras por produção planejada. */}
        <Pressable
          onPress={() => (canUseShoppingList ? router.push("/lista-compras") : showUpgrade("compras.usar"))}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.shopCard, shadows.floating]}>
            <View style={styles.shopIcon}>
              <ShoppingCart size={22} color="#fff" />
            </View>
            <View style={styles.shopInfo}>
              <Text style={styles.shopTitle}>Lista de compras</Text>
              <Text style={styles.shopSubtitle}>Planeje a produção e veja o que comprar, com o custo estimado</Text>
            </View>
            <ChevronRight size={20} color="#fff" />
          </LinearGradient>
        </Pressable>
        {!canUseShoppingList ? <StateText text={upgradeMessage("compras.usar")} /> : null}

        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button title="Novo produto" onPress={() => setSheet("product")} />
          </View>
          <View style={styles.actionButton}>
            <Button title="Novo local" tone="soft" onPress={() => setSheet("location")} />
          </View>
        </View>

        <SectionTitle text="Produtos" />
        {productsQuery.isLoading ? <StateText text="Carregando produtos..." /> : null}
        {productsQuery.error instanceof Error ? <StateText tone="error" text={productsQuery.error.message} /> : null}
        {activeProducts.map(productRow)}

        <SectionTitle text="Locais" />
        {locationsQuery.error instanceof Error ? <StateText tone="error" text={locationsQuery.error.message} /> : null}
        {activeLocations.map(locationRow)}

        {inactiveProducts.length > 0 ? (
          <>
            <SectionTitle text="Produtos inativos" />
            <StateText text="Excluídos do catálogo. Toque para reativar." />
            {inactiveProducts.map(productRow)}
          </>
        ) : null}

        {inactiveLocations.length > 0 ? (
          <>
            <SectionTitle text="Locais inativos" />
            <StateText text="Excluídos da lista. Toque para reativar." />
            {inactiveLocations.map(locationRow)}
          </>
        ) : null}
      </Page>

      <ProductSheet visible={sheet === "product"} onClose={() => setSheet(null)} />
      <LocationSheet visible={sheet === "location"} onClose={() => setSheet(null)} />
      <EditProductSheet visible={sheet === "edit"} onClose={() => setSheet(null)} product={editingProduct} />
      <EditLocationSheet visible={sheet === "edit-location"} onClose={() => setSheet(null)} location={editingLocation} />
    </>
  );
}

// Foto do local com fallback de mapinha quando não há imagem.
function LocationPhoto({ url, size }: { url?: string | null; size: number }) {
  if (!url) {
    return (
      <View style={[styles.locationIcon, { height: size, width: size }]}>
        <MapPin size={22} color={colors.brandDeep} />
      </View>
    );
  }
  return <ProductPhoto url={url} name="Local" size={size} rounded={radius.lg} />;
}

function ProductSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
    <Sheet visible={visible} title="Novo produto" subtitle="Depois adicione a foto na edição." onClose={onClose}>
      <ProductFields draft={draft} setDraft={setDraft} />
      {createProduct.error instanceof Error ? <StateText tone="error" text={createProduct.error.message} /> : null}
      <Button
        title={createProduct.isPending ? "Criando..." : "Criar produto"}
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

  // "Excluir" preserva o histórico de vendas: o produto vira inativo e sai do catálogo.
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

  return (
    <>
      {/* Identidade do produto: foto e situação atual. */}
      <View style={styles.editHeader}>
        <ProductPhoto url={photoUrl} name={product.nome} size={96} rounded={radius.xl} />
        <View style={styles.editHeaderInfo}>
          <Text style={styles.editPrice}>{formatCurrency(product.preco_atual?.preco_venda)}</Text>
          <Badge text={situacao} tone={situacao === "ativo" ? "good" : "warn"} />
        </View>
      </View>

      <PhotoPickerButtons onPick={(source) => uploadMedia.mutate(source)} disabled={uploadMedia.isPending} />
      {photoUrl ? (
        <RemovePhotoLink
          pending={removePhoto.isPending}
          onPress={() =>
            confirmDestructive("Remover foto", "O produto fica sem foto até você enviar outra.", "Remover", () =>
              removePhoto.mutate()
            )
          }
        />
      ) : null}
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
        <View style={styles.statusRow}>
          <Pressable
            onPress={() => setSituacao("ativo")}
            style={[styles.statusChip, situacao === "ativo" && styles.statusChipActive]}
          >
            <Text style={[styles.statusChipText, situacao === "ativo" && styles.statusChipTextActive]}>Ativo</Text>
          </Pressable>
          <Pressable
            onPress={() => setSituacao("inativo")}
            style={[styles.statusChip, situacao === "inativo" && styles.statusChipActive]}
          >
            <Text style={[styles.statusChipText, situacao === "inativo" && styles.statusChipTextActive]}>Inativo</Text>
          </Pressable>
        </View>
      </Field>

      {/* 2) Preço e custo — custo acima do preço; salvar cria o novo preço no histórico. */}
      <View style={styles.priceSection}>
        <Text style={styles.priceSectionTitle}>Preço e custo</Text>
        <Field label="Custo">
          <Input value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="0,00" />
        </Field>
        <Field label="Preço de venda">
          <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0,00" />
        </Field>
        {priceOrCostChanged && !priceValid ? (
          <StateText tone="error" text="Informe um preço de venda maior que zero." />
        ) : (
          <Text style={styles.priceHint}>
            {priceOrCostChanged
              ? "Ao salvar, o novo preço entra no histórico do produto."
              : "Mudou o preço ou o custo? É só salvar — o histórico é atualizado sozinho."}
          </Text>
        )}

        {/* Ajuda opcional para descobrir o custo com o assistente. */}
        <Pressable
          onPress={() => {
            if (!canUseCostAssistant) {
              showUpgrade("custos.assistente");
              return;
            }
            onClose();
            router.push(`/produto/${product.id}/custos`);
          }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <LinearGradient colors={gradients.agent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.costCard, shadows.agent]}>
            <View style={styles.costCardIcon}>
              <Calculator size={22} color="#fff" />
            </View>
            <View style={styles.costCardInfo}>
              <Text style={styles.costCardTitle}>Quanto custa fazer?</Text>
              <Text style={styles.costCardSubtitle}>
                {toNumber(product.preco_atual?.preco_custo) > 0
                  ? `Custo atual: ${formatCurrency(product.preco_atual?.preco_custo)} — recalcule com o assistente`
                  : "Descubra o custo e o lucro de cada unidade com o assistente"}
              </Text>
              {isCostFromAI(product.preco_atual) ? (
                <View style={styles.aiPill}>
                  <Sparkles size={11} color="#fff" />
                  <Text style={styles.aiPillText}>Calculado com IA</Text>
                </View>
              ) : null}
            </View>
            <ChevronRight size={20} color="#fff" />
          </LinearGradient>
        </Pressable>
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
              `"${product.nome}" sai do catálogo e das vendas, mas o histórico é mantido. Dá para reativar depois na seção "Produtos inativos".`,
              "Excluir",
              () => removeProduct.mutate()
            )
          }
        />
      </View>
    </>
  );
}

// Link discreto de tirar a foto atual, sempre logo abaixo dos botões de foto.
function RemovePhotoLink({ onPress, pending }: { onPress: () => void; pending?: boolean }) {
  return (
    <Pressable onPress={pending ? undefined : onPress} style={({ pressed }) => [styles.removePhoto, pressed && styles.pressed]}>
      <Trash2 size={16} color={colors.danger} />
      <Text style={styles.removePhotoText}>{pending ? "Removendo foto..." : "Remover foto"}</Text>
    </Pressable>
  );
}

function PhotoPickerButtons({ onPick, disabled }: { onPick: (source: "camera" | "gallery") => void; disabled?: boolean }) {
  return (
    <View style={styles.photoActions}>
      <Pressable
        onPress={() => onPick("camera")}
        disabled={disabled}
        style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}
      >
        <Camera size={20} color={colors.brandDeep} />
        <Text style={styles.photoActionText}>Fotografar</Text>
      </Pressable>
      <Pressable
        onPress={() => onPick("gallery")}
        disabled={disabled}
        style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}
      >
        <Images size={20} color={colors.brandDeep} />
        <Text style={styles.photoActionText}>Galeria</Text>
      </Pressable>
    </View>
  );
}

// Envia a foto pelo endpoint de mídia e grava a URL no cadastro do local.
async function uploadLocationPhoto(localId: string, file: NativeFile) {
  const media = await api.locais.uploadMedia(localId, createMediaForm(file));
  const mediaUrl = media?.url_publica || media?.caminho_arquivo || null;
  if (mediaUrl) {
    await api.locais.update(localId, { url_imagem_principal: mediaUrl });
  }
  return mediaUrl;
}

function LocationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  // Foto escolhida antes de criar: sobe logo depois que o local ganha id.
  const [photo, setPhoto] = useState<NativeFile | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const choosePhoto = async (source: "camera" | "gallery") => {
    try {
      setPhotoError(null);
      const file = await pickImage(source, "local");
      if (file) setPhoto(file);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Não foi possível escolher a foto.");
    }
  };

  const createLocation = useMutation({
    mutationFn: async () => {
      const created = await api.locais.create(
        cleanPayload({
          nome: name,
          endereco_texto: address,
          descricao: description,
          situacao: "ativo"
        })
      );

      if (photo) {
        // O local já existe; se a foto falhar, dá para reenviar depois na edição.
        try {
          await uploadLocationPhoto(created.id, photo);
        } catch {
          setPhotoError("O local foi criado, mas a foto falhou. Toque no local para tentar de novo.");
        }
      }
      return created;
    },
    onSuccess: () => {
      setName("");
      setAddress("");
      setDescription("");
      setPhoto(null);
      onClose();
      queryClient.invalidateQueries({ queryKey: ["locais"] });
    }
  });

  return (
    <Sheet visible={visible} title="Novo local" subtitle="Feira, evento, ponto fixo..." onClose={onClose}>
      <View style={styles.editHeader}>
        <LocationPhoto url={photo?.uri} size={96} />
        <View style={styles.editHeaderInfo}>
          <Text style={styles.photoHint}>{photo ? "Foto escolhida!" : "Foto do local (opcional)"}</Text>
        </View>
      </View>
      <PhotoPickerButtons onPick={choosePhoto} disabled={createLocation.isPending} />
      {photo ? <RemovePhotoLink onPress={() => setPhoto(null)} /> : null}
      {photoError ? <StateText tone="error" text={photoError} /> : null}

      <Field label="Nome">
        <Input value={name} onChangeText={setName} />
      </Field>
      <Field label="Endereço">
        <Input value={address} onChangeText={setAddress} />
      </Field>
      <Field label="Descrição">
        <Input value={description} onChangeText={setDescription} />
      </Field>
      {createLocation.error instanceof Error ? <StateText tone="error" text={createLocation.error.message} /> : null}
      <Button
        title={createLocation.isPending ? "Criando..." : "Criar local"}
        disabled={!name || createLocation.isPending}
        onPress={() => createLocation.mutate()}
      />
    </Sheet>
  );
}

function EditLocationSheet({ visible, onClose, location }: { visible: boolean; onClose: () => void; location: LocalVenda | null }) {
  return (
    <Sheet visible={visible} title={location?.nome || "Local"} subtitle="Dados e foto do local" onClose={onClose}>
      {visible && location ? <EditLocationForm onClose={onClose} location={location} /> : null}
    </Sheet>
  );
}

function EditLocationForm({ onClose, location }: { onClose: () => void; location: LocalVenda }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(location.nome);
  const [endereco, setEndereco] = useState(location.endereco_texto || "");
  const [descricao, setDescricao] = useState(location.descricao || "");
  const [situacao, setSituacao] = useState(location.situacao || "ativo");
  // Foto recém-enviada: mostra na hora, sem esperar a lista recarregar.
  const [photoUrl, setPhotoUrl] = useState(location.url_imagem_principal);

  const updateLocation = useMutation({
    mutationFn: () =>
      api.locais.update(
        location.id,
        cleanPayload({
          nome,
          endereco_texto: endereco,
          descricao,
          situacao
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locais"] });
      onClose();
    }
  });

  const uploadMedia = useMutation({
    mutationFn: async (source: "camera" | "gallery") => {
      const file = await pickImage(source, "local");
      if (!file) return null;
      return uploadLocationPhoto(location.id, file);
    },
    onSuccess: (mediaUrl) => {
      if (mediaUrl) setPhotoUrl(mediaUrl);
      queryClient.invalidateQueries({ queryKey: ["locais"] });
    }
  });

  const removePhoto = useMutation({
    mutationFn: () => api.locais.update(location.id, { url_imagem_principal: null }),
    onSuccess: () => {
      setPhotoUrl(null);
      queryClient.invalidateQueries({ queryKey: ["locais"] });
    }
  });

  // "Excluir" preserva o histórico dos dias de venda: o local vira inativo.
  const removeLocation = useMutation({
    mutationFn: () => api.locais.update(location.id, { situacao: "inativo" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locais"] });
      onClose();
    }
  });

  return (
    <>
      <View style={styles.editHeader}>
        <LocationPhoto url={photoUrl} size={96} />
        <View style={styles.editHeaderInfo}>
          <Badge text={situacao} tone={situacao === "ativo" ? "good" : "warn"} />
        </View>
      </View>

      <PhotoPickerButtons onPick={(source) => uploadMedia.mutate(source)} disabled={uploadMedia.isPending} />
      {photoUrl ? (
        <RemovePhotoLink
          pending={removePhoto.isPending}
          onPress={() =>
            confirmDestructive("Remover foto", "O local fica sem foto até você enviar outra.", "Remover", () =>
              removePhoto.mutate()
            )
          }
        />
      ) : null}
      {uploadMedia.isPending ? <StateText text="Enviando foto..." /> : null}
      {uploadMedia.isSuccess && uploadMedia.data ? <StateText tone="success" text="Foto atualizada!" /> : null}
      {uploadMedia.error instanceof Error ? <StateText tone="error" text={uploadMedia.error.message} /> : null}
      {removePhoto.error instanceof Error ? <StateText tone="error" text={removePhoto.error.message} /> : null}

      <Field label="Nome">
        <Input value={nome} onChangeText={setNome} />
      </Field>
      <Field label="Endereço">
        <Input value={endereco} onChangeText={setEndereco} />
      </Field>
      <Field label="Descrição">
        <Input value={descricao} onChangeText={setDescricao} />
      </Field>
      <Field label="Situação">
        <View style={styles.statusRow}>
          <Pressable
            onPress={() => setSituacao("ativo")}
            style={[styles.statusChip, situacao === "ativo" && styles.statusChipActive]}
          >
            <Text style={[styles.statusChipText, situacao === "ativo" && styles.statusChipTextActive]}>Ativo</Text>
          </Pressable>
          <Pressable
            onPress={() => setSituacao("inativo")}
            style={[styles.statusChip, situacao === "inativo" && styles.statusChipActive]}
          >
            <Text style={[styles.statusChipText, situacao === "inativo" && styles.statusChipTextActive]}>Inativo</Text>
          </Pressable>
        </View>
      </Field>
      {updateLocation.error instanceof Error ? <StateText tone="error" text={updateLocation.error.message} /> : null}
      <Button
        title={updateLocation.isPending ? "Salvando..." : "Salvar alterações"}
        disabled={!nome.trim() || updateLocation.isPending}
        onPress={() => updateLocation.mutate()}
      />

      <View style={styles.dangerSection}>
        {removeLocation.error instanceof Error ? <StateText tone="error" text={removeLocation.error.message} /> : null}
        <Button
          title={removeLocation.isPending ? "Excluindo..." : "Excluir local"}
          tone="danger"
          disabled={removeLocation.isPending}
          onPress={() =>
            confirmDestructive(
              "Excluir local",
              `"${location.nome}" sai da lista de locais, mas o histórico é mantido. Dá para reativar depois na seção "Locais inativos".`,
              "Excluir",
              () => removeLocation.mutate()
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
      <Field label="Preço de venda">
        <Input value={draft.preco_venda} onChangeText={(preco_venda) => setDraft({ ...draft, preco_venda })} keyboardType="decimal-pad" />
      </Field>
      <Field label="Custo">
        <Input value={draft.preco_custo} onChangeText={(preco_custo) => setDraft({ ...draft, preco_custo })} keyboardType="decimal-pad" />
      </Field>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92
  },
  shopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.xl,
    padding: 16
  },
  shopIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  shopInfo: {
    flex: 1,
    gap: 2
  },
  shopTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: fonts.bodyBold
  },
  shopSubtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fonts.body
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  actionButton: {
    flex: 1
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  productInfo: {
    flex: 1,
    gap: 4
  },
  productTitle: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.bodyBold
  },
  productPrice: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  locationAddress: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body
  },
  locationIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  editHeaderInfo: {
    gap: 6
  },
  editPrice: {
    color: colors.ink,
    fontSize: 26,
    fontFamily: fonts.display,
    letterSpacing: -0.5
  },
  costCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.xl,
    padding: 14
  },
  costCardIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  costCardInfo: {
    flex: 1,
    gap: 2
  },
  costCardTitle: {
    color: "#fff",
    fontSize: 16.5,
    fontFamily: fonts.bodyBold
  },
  costCardSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fonts.body
  },
  aiPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 9,
    paddingVertical: 3
  },
  aiPillText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: fonts.bodyBold
  },
  photoActions: {
    flexDirection: "row",
    gap: 10
  },
  photoAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surfaceGlow
  },
  photoActionText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  statusRow: {
    flexDirection: "row",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    padding: 5
  },
  statusChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingVertical: 10
  },
  statusChipActive: {
    backgroundColor: colors.brand,
    ...shadows.brand
  },
  statusChipText: {
    color: colors.muted,
    fontFamily: fonts.bodyBold
  },
  statusChipTextActive: {
    color: "#fff"
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
  },
  dangerSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginTop: 4
  },
  photoHint: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  removePhoto: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    minHeight: 40,
    paddingHorizontal: 16
  },
  removePhotoText: {
    color: colors.danger,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  }
});
