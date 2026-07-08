import * as ImagePicker from "expo-image-picker";
import { Camera, ChevronRight, Images, MapPin, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Field, Input, Page, ProductPhoto, SectionTitle, Sheet, StateText } from "@/components/ui";
import { api, createMediaForm, type NativeFile } from "@/lib/api";
import { cleanPayload, formatCurrency, todayInputValue } from "@/lib/format";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import type { LocalVenda, Produto } from "@/types/api";

// Abre câmera ou galeria e devolve o arquivo escolhido (ou null se cancelou).
async function pickImage(source: "camera" | "gallery", prefix: string): Promise<NativeFile | null> {
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Permissão de câmera negada.");
    result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error("Permissão de fotos negada.");
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
  }

  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName || `${prefix}-${Date.now()}.jpg`,
    type: asset.mimeType || "image/jpeg"
  };
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
  const [sheet, setSheet] = useState<"product" | "location" | "edit" | "edit-location" | null>(null);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [editingLocal, setEditingLocal] = useState<LocalVenda | null>(null);
  const productsQuery = useQuery({ queryKey: ["produtos", "todos"], queryFn: () => api.produtos.list(false) });
  const locationsQuery = useQuery({ queryKey: ["locais", "todos"], queryFn: () => api.locais.list(false) });
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
        <Text style={styles.productTitle}>{produto.nome}</Text>
        <Text style={styles.productPrice}>{formatCurrency(produto.preco_atual?.preco_venda)}</Text>
        <Badge text={produto.situacao} tone={produto.situacao === "ativo" ? "good" : "warn"} />
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <>
      <Page title="Catálogo" subtitle="Produtos, preços, fotos e locais de venda.">
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
      const created = await api.produtos.create(
        cleanPayload({
          nome: draft.nome,
          descricao: draft.descricao,
          cor_botao: draft.cor_botao,
          ordem_exibicao: 0,
          situacao: "ativo",
          preco_inicial: draft.preco_venda
            ? {
                preco_venda: Number(draft.preco_venda),
                preco_custo: Number(draft.preco_custo || 0),
                vigente_desde: todayInputValue(),
                motivo: "Preço inicial"
              }
            : undefined
        })
      );
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
    <Sheet visible={visible} title={product?.nome || "Produto"} subtitle="Dados, foto e preço" onClose={onClose}>
      {visible && product ? <EditProductForm onClose={onClose} product={product} /> : null}
    </Sheet>
  );
}

function EditProductForm({ onClose, product }: { onClose: () => void; product: Produto }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(product.nome);
  const [descricao, setDescricao] = useState(product.descricao || "");
  const [situacao, setSituacao] = useState(product.situacao || "ativo");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState(product.preco_atual?.preco_custo || "0");
  // Foto recém-enviada: mostra na hora, sem esperar a lista recarregar.
  const [photoUrl, setPhotoUrl] = useState(product.url_imagem_principal);

  // Dados cadastrais salvos pelo endpoint de atualização (PATCH), sem exigir preço.
  const updateProduct = useMutation({
    mutationFn: () =>
      api.produtos.update(
        product.id,
        cleanPayload({
          nome,
          descricao,
          situacao
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      onClose();
    }
  });

  const createPrice = useMutation({
    mutationFn: () =>
      api.produtos.createPrice(product.id, {
        preco_venda: Number(price),
        preco_custo: Number(cost || 0),
        vigente_desde: todayInputValue(),
        motivo: "Atualização pelo app"
      }),
    onSuccess: () => {
      setPrice("");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
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

  return (
    <>
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

      <Field label="Nome">
        <Input value={nome} onChangeText={setNome} />
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
      {updateProduct.error instanceof Error ? <StateText tone="error" text={updateProduct.error.message} /> : null}
      <Button
        title={updateProduct.isPending ? "Salvando..." : "Salvar alterações"}
        disabled={!nome.trim() || updateProduct.isPending}
        onPress={() => updateProduct.mutate()}
      />

      <View style={styles.priceSection}>
        <Text style={styles.priceSectionTitle}>Novo preço (opcional)</Text>
        <Field label="Preço de venda">
          <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Deixe vazio para manter o atual" />
        </Field>
        <Field label="Custo">
          <Input value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
        </Field>
        {createPrice.error instanceof Error ? <StateText tone="error" text={createPrice.error.message} /> : null}
        {createPrice.isSuccess ? <StateText tone="success" text="Preço atualizado!" /> : null}
        <Button
          title={createPrice.isPending ? "Salvando..." : "Criar novo preço"}
          tone="soft"
          disabled={!price.trim() || createPrice.isPending}
          onPress={() => createPrice.mutate()}
        />
      </View>

      <View style={styles.dangerSection}>
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
        <Input value={draft.nome} onChangeText={(nome) => setDraft({ ...draft, nome })} />
      </Field>
      <Field label="Descrição">
        <Input value={draft.descricao} onChangeText={(descricao) => setDraft({ ...draft, descricao })} />
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
