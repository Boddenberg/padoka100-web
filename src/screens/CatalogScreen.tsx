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
      <EditProductSheet visible={sheet === "edit"} onClose={() => setSheet(null)} product={editing} />
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
  const queryClient = useQueryClient();
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("0");
  const createPrice = useMutation({
    mutationFn: () => {
      if (!product || !price) throw new Error("Informe o preço.");
      return api.produtos.createPrice(product.id, {
        preco_venda: Number(price),
        preco_custo: Number(cost || 0),
        vigente_desde: todayInputValue(),
        motivo: "Atualização pelo app"
      });
    },
    onSuccess: () => {
      setPrice("");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    }
  });
  const uploadMedia = useMutation({
    mutationFn: async (source: "camera" | "gallery") => {
      if (!product) throw new Error("Produto não selecionado.");

      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error("Permissão de câmera negada.");
        result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error("Permissão de fotos negada.");
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      }

      if (result.canceled) throw new Error("Seleção cancelada.");
      const asset = result.assets[0];
      const file: NativeFile = {
        uri: asset.uri,
        name: asset.fileName || `produto-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg"
      };
      return api.produtos.uploadMedia(product.id, createProductMediaForm(file));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["produtos"] })
  });

  return (
    <Sheet visible={visible} title={product?.nome || "Produto"} subtitle="Preço e foto do produto" onClose={onClose}>
      <View style={styles.editHeader}>
        <ProductPhoto url={product?.url_imagem_principal} name={product?.nome || ""} size={96} rounded={radius.xl} />
        <View style={styles.editHeaderInfo}>
          <Text style={styles.editPrice}>{formatCurrency(product?.preco_atual?.preco_venda)}</Text>
          <Badge text={product?.situacao || ""} tone={product?.situacao === "ativo" ? "good" : "warn"} />
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
      {uploadMedia.error instanceof Error ? <StateText tone="error" text={uploadMedia.error.message} /> : null}

      <Field label="Novo preço de venda">
        <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      </Field>
      <Field label="Custo">
        <Input value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
      </Field>
      {createPrice.error instanceof Error ? <StateText tone="error" text={createPrice.error.message} /> : null}
      <Button title={createPrice.isPending ? "Salvando..." : "Salvar preço"} disabled={createPrice.isPending} onPress={() => createPrice.mutate()} />
    </Sheet>
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
  }
});
