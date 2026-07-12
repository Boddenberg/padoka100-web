import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, EmptyState, Field, Input, SectionTitle, Sheet, StateText } from "@/components/ui";
import { api, friendlyErrorMessage, type NativeFile } from "@/lib/api";
import { cleanPayload } from "@/lib/format";
import { colors, fonts, shadows } from "@/lib/theme";
import { pickImage } from "@/utils/media";
import type { LocalVenda } from "@/types/api";
import {
  LocationPhoto,
  PhotoPickerButtons,
  RemovePhotoLink,
  SubPage,
  confirmDestructive,
  sharedStyles,
  uploadLocationPhoto
} from "./shared";

// "Locais de venda": porta do hub Minha padoca. Feira, ponto fixo, eventos —
// separados dos produtos para cada cadastro ter a própria casa.
export function LocationsScreen() {
  const [sheet, setSheet] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<LocalVenda | null>(null);
  const locationsQuery = useQuery({ queryKey: ["locais", "todos"], queryFn: () => api.locais.list(false) });

  // Sempre a versão mais fresca do local em edição (após salvar/foto).
  const editingLocation = locationsQuery.data?.find((local) => local.id === editing?.id) || editing;
  const activeLocations = locationsQuery.data?.filter((local) => local.situacao === "ativo") || [];
  const inactiveLocations = locationsQuery.data?.filter((local) => local.situacao !== "ativo") || [];

  const locationRow = (local: LocalVenda) => (
    <Pressable
      key={local.id}
      onPress={() => {
        setEditing(local);
        setSheet("edit");
      }}
      style={({ pressed }) => [sharedStyles.itemRow, shadows.soft, pressed && sharedStyles.pressed]}
    >
      <LocationPhoto url={local.url_imagem_principal} size={62} />
      <View style={sharedStyles.itemInfo}>
        <Text style={sharedStyles.itemTitle}>{local.nome}</Text>
        {local.endereco_texto ? <Text style={sharedStyles.itemHint}>{local.endereco_texto}</Text> : null}
        <Badge text={local.situacao} tone={local.situacao === "ativo" ? "good" : "warn"} />
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <>
      <SubPage
        title="Locais de venda"
        subtitle="Feira, ponto fixo, eventos."
        onRefresh={() => locationsQuery.refetch()}
        refreshing={locationsQuery.isRefetching}
      >
        <Button title="Cadastrar local" onPress={() => setSheet("create")} />

        {locationsQuery.isLoading ? <StateText text="Carregando locais..." /> : null}
        {locationsQuery.error ? <StateText tone="error" text={friendlyErrorMessage(locationsQuery.error)} /> : null}
        {activeLocations.map(locationRow)}
        {locationsQuery.isSuccess && activeLocations.length === 0 ? (
          <EmptyState
            emoji="📍"
            title="Nenhum local cadastrado"
            hint="Opcional: registre a feira, o ponto ou o evento onde você vende."
            actionLabel="Cadastrar local"
            onAction={() => setSheet("create")}
          />
        ) : null}

        {inactiveLocations.length > 0 ? (
          <>
            <SectionTitle text="Locais inativos" />
            <StateText text="Excluídos da lista. Toque para reativar." />
            {inactiveLocations.map(locationRow)}
          </>
        ) : null}
      </SubPage>

      <CreateLocationSheet visible={sheet === "create"} onClose={() => setSheet(null)} />
      <EditLocationSheet visible={sheet === "edit"} onClose={() => setSheet(null)} location={editingLocation} />
    </>
  );
}

function CreateLocationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
    <Sheet visible={visible} title="Cadastrar local" subtitle="Feira, evento, ponto fixo..." onClose={onClose}>
      <View style={sharedStyles.editHeader}>
        <LocationPhoto url={photo?.uri} size={96} />
        <View style={sharedStyles.editHeaderInfo}>
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
        title={createLocation.isPending ? "Cadastrando..." : "Cadastrar local"}
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
      <View style={sharedStyles.editHeader}>
        <LocationPhoto url={photoUrl} size={96} />
        <View style={sharedStyles.editHeaderInfo}>
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
      {updateLocation.error instanceof Error ? <StateText tone="error" text={updateLocation.error.message} /> : null}
      <Button
        title={updateLocation.isPending ? "Salvando..." : "Salvar alterações"}
        disabled={!nome.trim() || updateLocation.isPending}
        onPress={() => updateLocation.mutate()}
      />

      <View style={sharedStyles.dangerSection}>
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

const styles = StyleSheet.create({
  photoHint: {
    color: colors.muted,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  }
});
