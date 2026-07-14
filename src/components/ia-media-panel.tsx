import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { ImageOff, Pause, Play, RefreshCw, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, Input, StateText } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { isAdmin } from "@/lib/access";
import { api } from "@/lib/api";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import type { MidiaRecebidaIA } from "@/types/api";

type ItemFilter = "todas" | "audio" | "foto";

// Data/hora amigável (dd/mm/aaaa às hh:mm) do criado_em.
function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Rastreio admin: áudios e fotos que os clientes enviaram para a IA. Fica no
// fim do Perfil, logo abaixo do Diagnóstico, e só existe para contas admin.
// A pessoa pode ouvir os áudios, abrir as fotos e filtrar pelo nome.
export function IaMediaPanel() {
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [visible, setVisible] = useState(10);
  const [nameFilter, setNameFilter] = useState("");
  const [itemFilter, setItemFilter] = useState<ItemFilter>("todas");
  const [preview, setPreview] = useState<MidiaRecebidaIA | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Um único player para a lista toda; a atualização de status é lenta (1s) só
  // para o botão trocar entre tocar/pausar sem repintar a tela o tempo todo.
  const player = useAudioPlayer(undefined, { updateInterval: 1000 });
  const playerStatus = useAudioPlayerStatus(player);

  const query = useQuery({
    queryKey: ["ia-midias-recebidas"],
    queryFn: () => api.ia.midiasRecebidas({ limite: 200 }),
    enabled: admin
  });

  // Terminou de tocar: solta o botão de volta para "tocar".
  useEffect(() => {
    if (playerStatus.didJustFinish) setPlayingId(null);
  }, [playerStatus.didJustFinish]);

  function stopPlayback() {
    try {
      player.pause();
    } catch {
      // player pode não ter fonte ainda — tudo bem.
    }
    setPlayingId(null);
  }

  function togglePlay(media: MidiaRecebidaIA) {
    if (!media.url_publica) return;
    if (playingId === media.id) {
      stopPlayback();
      return;
    }
    // Toca mesmo com o celular no silencioso (iOS).
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    player.replace({ uri: media.url_publica });
    player.play();
    setPlayingId(media.id);
  }

  if (!admin) return null;

  const all = query.data || [];
  const filtered = all.filter((media) => {
    if (itemFilter !== "todas" && media.item !== itemFilter) return false;
    const term = nameFilter.trim().toLowerCase();
    if (term && !(media.usuario_nome_cadastrado || "").toLowerCase().includes(term)) return false;
    return true;
  });
  const shown = filtered.slice(0, visible);
  const restantes = filtered.length - shown.length;

  function changeItemFilter(next: ItemFilter) {
    stopPlayback();
    setItemFilter(next);
    setVisible(10);
  }

  function refresh() {
    stopPlayback();
    query.refetch();
  }

  return (
    <Collapsible
      title="Mídias recebidas"
      subtitle="Áudios e fotos que os clientes enviaram para a IA. Toque para ouvir ou ampliar."
      badge={all.length}
    >
      <View style={styles.actionsRow}>
        <Pressable
          accessibilityLabel="Atualizar mídias recebidas"
          disabled={query.isFetching}
          onPress={refresh}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed, query.isFetching && styles.pressed]}
        >
          {query.isFetching ? (
            <ActivityIndicator size="small" color={colors.brandDeep} />
          ) : (
            <RefreshCw size={18} color={colors.brandDeep} />
          )}
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Chip label="Todas" active={itemFilter === "todas"} onPress={() => changeItemFilter("todas")} />
        <Chip label="🎙️ Áudios" active={itemFilter === "audio"} onPress={() => changeItemFilter("audio")} />
        <Chip label="📷 Fotos" active={itemFilter === "foto"} onPress={() => changeItemFilter("foto")} />
      </View>
      <Input
        placeholder="Filtrar pelo nome da pessoa"
        value={nameFilter}
        onChangeText={(value) => {
          setNameFilter(value);
          setVisible(10);
        }}
        style={styles.nameInput}
      />

      {query.isLoading ? <StateText text="Carregando mídias..." /> : null}
      {query.error ? <StateText tone="error" text="Não foi possível carregar as mídias agora." /> : null}
      {!query.isLoading && !query.error && filtered.length === 0 ? (
        <Text style={styles.empty}>
          {all.length === 0 ? "Nenhuma mídia recebida ainda." : "Ninguém com esse filtro."}
        </Text>
      ) : null}

      {shown.map((media) => (
        <MediaRow
          key={media.id}
          media={media}
          playing={playingId === media.id}
          onPlay={() => togglePlay(media)}
          onOpenPhoto={() => setPreview(media)}
        />
      ))}

      {restantes > 0 ? (
        <Pressable onPress={() => setVisible((value) => value + 10)} style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}>
          <Text style={styles.loadMoreText}>Carregar mais ({restantes})</Text>
        </Pressable>
      ) : null}

      {/* Visualizador de foto em tela cheia (toque para fechar). */}
      <Modal visible={Boolean(preview)} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)}>
          {preview?.url_publica ? (
            <Image source={{ uri: preview.url_publica }} style={styles.previewImage} contentFit="contain" />
          ) : null}
          <View style={styles.previewClose}>
            <X size={18} color="#fff" />
            <Text style={styles.previewCloseText}>Toque para fechar</Text>
          </View>
        </Pressable>
      </Modal>
    </Collapsible>
  );
}

function MediaRow({
  media,
  playing,
  onPlay,
  onOpenPhoto
}: {
  media: MidiaRecebidaIA;
  playing: boolean;
  onPlay: () => void;
  onOpenPhoto: () => void;
}) {
  const isAudio = media.item === "audio";
  return (
    <View style={styles.row}>
      {isAudio ? (
        <Pressable onPress={onPlay} style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
          {playing ? <Pause size={20} color="#fff" fill="#fff" /> : <Play size={20} color="#fff" fill="#fff" />}
        </Pressable>
      ) : (
        <Pressable onPress={onOpenPhoto} style={({ pressed }) => [styles.thumbWrap, pressed && styles.pressed]}>
          {media.url_publica ? (
            <Image source={{ uri: media.url_publica }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <ImageOff size={18} color={colors.muted} />
            </View>
          )}
        </Pressable>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {media.usuario_nome_cadastrado || "Sem nome"}
        </Text>
        <Text style={styles.rowMeta}>
          {isAudio ? "🎙️ Áudio" : "📷 Foto"}
          {media.data ? ` · ${formatWhen(media.data)}` : ""}
        </Text>
        {media.nome_arquivo ? (
          <Text style={styles.rowFile} numberOfLines={1}>
            {media.nome_arquivo}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  refreshButton: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surfaceGlow
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  chipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.bodyBold
  },
  chipTextActive: {
    color: colors.brandDeep
  },
  nameInput: {
    marginTop: 2
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 10
  },
  playButton: {
    height: 46,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.agentDeep,
    ...shadows.soft
  },
  thumbWrap: {
    height: 52,
    width: 52,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm
  },
  thumb: {
    height: "100%",
    width: "100%"
  },
  thumbPlaceholder: {
    height: "100%",
    width: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  rowInfo: {
    flex: 1,
    gap: 2
  },
  rowName: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  rowFile: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.body
  },
  loadMore: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surface
  },
  loadMoreText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  previewBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "rgba(0,0,0,0.9)",
    padding: 20
  },
  previewImage: {
    width: "100%",
    height: "80%"
  },
  previewClose: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  previewCloseText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: fonts.bodyBold
  }
});
