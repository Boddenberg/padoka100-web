import * as ImagePicker from "expo-image-picker";
import { MapPin, PackagePlus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Field, Input, Page, Sheet, StateText } from "@/components/ui";
import { api, createProductMediaForm, type NativeFile } from "@/lib/api";
import { cleanPayload, formatCurrency, todayInputValue } from "@/lib/format";
import { colors } from "@/lib/theme";
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
  cor_botao: "#ef4444",
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
          <Button title="Novo produto" onPress={() => setSheet("product")} />
          <Button title="Novo local" tone="dark" onPress={() => setSheet("location")} />
        </View>

        <Text style={styles.sectionTitle}>Produtos</Text>
        {productsQuery.isLoading ? <StateText text="Carregando produtos..." /> : null}
        {productsQuery.error instanceof Error ? <StateText tone="error" text={productsQuery.error.message} /> : null}
        {productsQuery.data?.map((produto) => (
          <Pressable
            key={produto.id}
            onPress={() => {
              setEditing(produto);
              setSheet("edit");
            }}
          >
            <Card>
              <View style={styles.itemHeader}>
                <PackagePlus color={colors.brand} />
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle}>{produto.nome}</Text>
                  <Text style={styles.muted}>
                    {formatCurrency(produto.preco_atual?.preco_venda)} · {produto.situacao}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>Locais</Text>
        {locationsQuery.data?.map((local) => (
          <Card key={local.id}>
            <View style={styles.itemHeader}>
              <MapPin color={colors.brand} />
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>{local.nome}</Text>
                <Text style={styles.muted}>{local.situacao}</Text>
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
    <Sheet visible={visible} title="Novo produto" onClose={onClose}>
      <ProductFields draft={draft} setDraft={setDraft} />
      {createProduct.error instanceof Error ? <StateText tone="error" text={createProduct.error.message} /> : null}
      <Button title={createProduct.isPending ? "Criando..." : "Criar produto"} disabled={!draft.nome || createProduct.isPending} onPress={() => createProduct.mutate()} />
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
    mutationFn: async () => {
      if (!product) throw new Error("Produto não selecionado.");
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error("Permissão de câmera negada.");
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled) throw new Error("Captura cancelada.");
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
    <Sheet visible={visible} title={product?.nome || "Produto"} onClose={onClose}>
      <Card>
        <Text style={styles.itemTitle}>{formatCurrency(product?.preco_atual?.preco_venda)}</Text>
        <Text style={styles.muted}>Situação: {product?.situacao}</Text>
      </Card>
      <Field label="Novo preço de venda">
        <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      </Field>
      <Field label="Custo">
        <Input value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
      </Field>
      {createPrice.error instanceof Error ? <StateText tone="error" text={createPrice.error.message} /> : null}
      <Button title={createPrice.isPending ? "Salvando..." : "Criar preço"} disabled={createPrice.isPending} onPress={() => createPrice.mutate()} />
      <Button title={uploadMedia.isPending ? "Enviando..." : "Fotografar produto"} tone="dark" disabled={uploadMedia.isPending} onPress={() => uploadMedia.mutate()} />
      {uploadMedia.error instanceof Error ? <StateText tone="error" text={uploadMedia.error.message} /> : null}
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
    <Sheet visible={visible} title="Novo local" onClose={onClose}>
      <Field label="Nome">
        <Input value={name} onChangeText={setName} />
      </Field>
      <Field label="Descrição">
        <Input value={description} onChangeText={setDescription} />
      </Field>
      {createLocation.error instanceof Error ? <StateText tone="error" text={createLocation.error.message} /> : null}
      <Button title={createLocation.isPending ? "Criando..." : "Criar local"} disabled={!name || createLocation.isPending} onPress={() => createLocation.mutate()} />
    </Sheet>
  );
}

function ProductFields({
  draft,
  setDraft
}: {
  draft: ProductDraft;
  setDraft: (draft: ProductDraft) => void;
}) {
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
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  itemText: {
    flex: 1
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  muted: {
    color: colors.muted,
    fontWeight: "700"
  }
});
