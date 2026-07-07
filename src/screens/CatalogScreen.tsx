import * as ImagePicker from "expo-image-picker";
import { Camera, ChevronRight, Images, MapPin } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, Field, Input, Page, ProductPhoto, SectionTitle, Sheet, StateText } from "@/components/ui";
import { api, createProductMediaForm, type NativeFile } from "@/lib/api";
import { cleanPayload, formatCurrency, todayInputValue } from "@/lib/format";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import type { Produto } from "@/types/api";

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
  const [sheet, setSheet] = useState<"product" | "location" | "edit" | null>(null);
  const [editing, setEditing] = useState<Produto | null>(null);
  const productsQuery = useQuery({ queryKey: ["produtos", "todos"], queryFn: () => api.produtos.list(false) });
  const locationsQuery = useQuery({ queryKey: ["locais", "todos"], queryFn: () => api.locais.list(false) });
  // Sempre a versão mais fresca do produto em edição (após salvar/foto).
  const editingProduct = productsQuery.data?.find((produto) => produto.id === editing?.id) || editing;

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
        {productsQuery.data?.map((produto) => (
          <Pressable
            key={produto.id}
            onPress={() => {
              setEditing(produto);
              setSheet("edit");
            }}
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
        ))}

        <SectionTitle text="Locais" />
        {locationsQuery.data?.map((local) => (
          <Card key={local.id}>
            <View style={styles.locationRow}>
              <View style={styles.locationIcon}>
                <MapPin size={20} color={colors.brandDeep} />
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productTitle}>{local.nome}</Text>
                <Badge text={local.situacao} tone={local.situacao === "ativo" ? "good" : "warn"} />
              </View>
            </View>
          </Card>
        ))}
      </Page>

      <ProductSheet visible={sheet === "product"} onClose={() => setSheet(null)} />
      <LocationSheet visible={sheet === "location"} onClose={() => setSheet(null)} />
      <EditProductSheet visible={sheet === "edit"} onClose={() => setSheet(null)} product={editingProduct} />
    </>
  );
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
      const file: NativeFile = {
        uri: asset.uri,
        name: asset.fileName || `produto-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg"
      };

      const media = await api.produtos.uploadMedia(product.id, createProductMediaForm(file));

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

  return (
    <>
      <View style={styles.editHeader}>
        <ProductPhoto url={photoUrl} name={product.nome} size={96} rounded={radius.xl} />
        <View style={styles.editHeaderInfo}>
          <Text style={styles.editPrice}>{formatCurrency(product.preco_atual?.preco_venda)}</Text>
          <Badge text={situacao} tone={situacao === "ativo" ? "good" : "warn"} />
        </View>
      </View>

      <View style={styles.photoActions}>
        <Pressable
          onPress={() => uploadMedia.mutate("camera")}
          disabled={uploadMedia.isPending}
          style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}
        >
          <Camera size={20} color={colors.brandDeep} />
          <Text style={styles.photoActionText}>Fotografar</Text>
        </Pressable>
        <Pressable
          onPress={() => uploadMedia.mutate("gallery")}
          disabled={uploadMedia.isPending}
          style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}
        >
          <Images size={20} color={colors.brandDeep} />
          <Text style={styles.photoActionText}>Galeria</Text>
        </Pressable>
      </View>
      {uploadMedia.isPending ? <StateText text="Enviando foto..." /> : null}
      {uploadMedia.isSuccess && uploadMedia.data ? <StateText tone="success" text="Foto atualizada!" /> : null}
      {uploadMedia.error instanceof Error ? <StateText tone="error" text={uploadMedia.error.message} /> : null}

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
    </>
  );
}

function LocationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createLocation = useMutation({
    mutationFn: () =>
      api.locais.create(
        cleanPayload({
          nome: name,
          descricao: description,
          situacao: "ativo"
        })
      ),
    onSuccess: () => {
      setName("");
      setDescription("");
      onClose();
      queryClient.invalidateQueries({ queryKey: ["locais"] });
    }
  });

  return (
    <Sheet visible={visible} title="Novo local" subtitle="Feira, evento, ponto fixo..." onClose={onClose}>
      <Field label="Nome">
        <Input value={name} onChangeText={setName} />
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
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
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
  }
});
