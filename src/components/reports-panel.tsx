import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { CheckCheck, Pause, Play, RefreshCw, UserRound, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Collapsible, StateText } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { isAdmin } from "@/lib/access";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/settings";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import type { ReportAdmin, ReportStatus } from "@/types/api";

type StatusFilter = "todas" | ReportStatus;

const TIPO_INFO: Record<string, { label: string; emoji: string }> = {
  erro: { label: "Erro", emoji: "🐞" },
  dificuldade: { label: "Dificuldade", emoji: "🤔" },
  sugestao: { label: "Sugestão", emoji: "💡" },
  recado: { label: "Recado", emoji: "💌" }
};

const STATUS_INFO: Record<string, { label: string; bg: string; fg: string }> = {
  novo: { label: "Nova", bg: colors.warningSoft, fg: colors.warning },
  lido: { label: "Lida", bg: colors.surfaceWarm, fg: colors.muted },
  resolvido: { label: "Resolvida", bg: colors.successSoft, fg: colors.success }
};

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Área admin de reports (fim do Perfil, só para contas admin): mensagens que os
// usuários enviaram, com quem mandou, prints/fotos, áudios e data. Dá para
// marcar como lida/resolvida para acompanhar o que já foi tratado.
export function ReportsPanel() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [preview, setPreview] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const player = useAudioPlayer(undefined, { updateInterval: 1000 });
  const playerStatus = useAudioPlayerStatus(player);

  const query = useQuery({
    queryKey: ["reports", "admin"],
    queryFn: () => api.reports.listarAdmin({ limite: 200 }),
    enabled: admin
  });

  const atualizar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReportStatus }) => api.reports.atualizar(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] })
  });

  useEffect(() => {
    if (playerStatus.didJustFinish) setPlayingId(null);
  }, [playerStatus.didJustFinish]);

  function stopPlayback() {
    try {
      player.pause();
    } catch {
      // sem fonte ainda.
    }
    setPlayingId(null);
  }

  function togglePlay(id: string, url: string) {
    if (playingId === id) {
      stopPlayback();
      return;
    }
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    player.replace({ uri: url });
    player.play();
    setPlayingId(id);
  }

  if (!admin) return null;

  const all = query.data || [];
  const shown = statusFilter === "todas" ? all : all.filter((report) => report.status === statusFilter);
  const novas = all.filter((report) => report.status === "novo").length;

  return (
    <Collapsible title="Reports recebidos" subtitle="Erros, dúvidas e recados que os usuários enviaram." badge={novas || all.length}>
      <View style={styles.headerRow}>
        <View style={styles.filterRow}>
          <Chip label="Todas" active={statusFilter === "todas"} onPress={() => setStatusFilter("todas")} />
          <Chip label="Novas" active={statusFilter === "novo"} onPress={() => setStatusFilter("novo")} />
          <Chip label="Lidas" active={statusFilter === "lido"} onPress={() => setStatusFilter("lido")} />
          <Chip label="Resolvidas" active={statusFilter === "resolvido"} onPress={() => setStatusFilter("resolvido")} />
        </View>
        <Pressable
          accessibilityLabel="Atualizar reports"
          disabled={query.isFetching}
          onPress={() => {
            stopPlayback();
            query.refetch();
          }}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed, query.isFetching && styles.pressed]}
        >
          {query.isFetching ? (
            <ActivityIndicator size="small" color={colors.brandDeep} />
          ) : (
            <RefreshCw size={18} color={colors.brandDeep} />
          )}
        </Pressable>
      </View>

      {query.isLoading ? <StateText text="Carregando reports..." /> : null}
      {query.error ? <StateText tone="error" text="Não foi possível carregar os reports agora." /> : null}
      {!query.isLoading && !query.error && shown.length === 0 ? (
        <Text style={styles.empty}>{all.length === 0 ? "Nenhum report recebido ainda." : "Nada com esse filtro."}</Text>
      ) : null}

      {shown.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          playingId={playingId}
          onPlay={togglePlay}
          onOpenImage={setPreview}
          onStatus={(status) => atualizar.mutate({ id: report.id, status })}
          busy={atualizar.isPending}
        />
      ))}

      <Modal visible={Boolean(preview)} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)}>
          {preview ? <Image source={{ uri: preview }} style={styles.previewImage} contentFit="contain" /> : null}
          <View style={styles.previewClose}>
            <X size={18} color="#fff" />
            <Text style={styles.previewCloseText}>Toque para fechar</Text>
          </View>
        </Pressable>
      </Modal>
    </Collapsible>
  );
}

function ReportCard({
  report,
  playingId,
  onPlay,
  onOpenImage,
  onStatus,
  busy
}: {
  report: ReportAdmin;
  playingId: string | null;
  onPlay: (id: string, url: string) => void;
  onOpenImage: (url: string) => void;
  onStatus: (status: ReportStatus) => void;
  busy?: boolean;
}) {
  const tipo = TIPO_INFO[String(report.tipo)] || { label: String(report.tipo), emoji: "📝" };
  const status = STATUS_INFO[String(report.status)] || STATUS_INFO.novo;
  const imagens = (report.anexos || []).filter((anexo) => anexo.tipo === "imagem" && anexo.url);
  const audios = (report.anexos || []).filter((anexo) => anexo.tipo === "audio" && anexo.url);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SenderAvatar nome={report.usuario_nome} foto={report.usuario_foto_url} />
        <View style={styles.senderInfo}>
          <Text style={styles.senderName} numberOfLines={1}>
            {report.usuario_nome || "Sem nome"}
          </Text>
          {report.usuario_email ? (
            <Text style={styles.senderEmail} numberOfLines={1}>
              {report.usuario_email}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.tipoPill}>
          <Text style={styles.tipoText}>
            {tipo.emoji} {tipo.label}
          </Text>
        </View>
        <Text style={styles.metaWhen}>{formatWhen(report.criado_em)}</Text>
      </View>

      {report.mensagem ? <Text style={styles.message}>{report.mensagem}</Text> : null}
      {report.contexto ? <Text style={styles.contexto}>Tela: {report.contexto}</Text> : null}

      {imagens.length > 0 ? (
        <View style={styles.attachments}>
          {imagens.map((anexo, index) => {
            const uri = resolveMediaUrl(anexo.url);
            if (!uri) return null;
            return (
              <Pressable key={`${report.id}-img-${index}`} onPress={() => onOpenImage(uri)} style={({ pressed }) => [styles.attachThumbWrap, pressed && styles.pressed]}>
                <Image source={{ uri }} style={styles.attachThumb} contentFit="cover" />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {audios.map((anexo, index) => {
        const uri = resolveMediaUrl(anexo.url);
        if (!uri) return null;
        const audioId = `${report.id}-audio-${index}`;
        const playing = playingId === audioId;
        return (
          <Pressable key={audioId} onPress={() => onPlay(audioId, uri)} style={({ pressed }) => [styles.audioRow, pressed && styles.pressed]}>
            <View style={styles.audioPlay}>{playing ? <Pause size={18} color="#fff" fill="#fff" /> : <Play size={18} color="#fff" fill="#fff" />}</View>
            <Text style={styles.audioLabel}>{playing ? "Tocando áudio..." : "Ouvir áudio"}</Text>
          </Pressable>
        );
      })}

      <View style={styles.actions}>
        {report.status !== "lido" && report.status !== "resolvido" ? (
          <Pressable onPress={() => onStatus("lido")} disabled={busy} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <CheckCheck size={15} color={colors.muted} />
            <Text style={styles.actionText}>Marcar como lida</Text>
          </Pressable>
        ) : null}
        {report.status !== "resolvido" ? (
          <Pressable onPress={() => onStatus("resolvido")} disabled={busy} style={({ pressed }) => [styles.actionButton, styles.resolveButton, pressed && styles.pressed]}>
            <CheckCheck size={15} color={colors.success} />
            <Text style={[styles.actionText, styles.resolveText]}>Resolvida</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => onStatus("novo")} disabled={busy} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <Text style={styles.actionText}>Reabrir</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SenderAvatar({ nome, foto }: { nome?: string | null; foto?: string | null }) {
  const uri = resolveMediaUrl(foto);
  if (uri) {
    return <Image source={{ uri }} style={styles.avatar} contentFit="cover" transition={150} />;
  }
  const inicial = (nome || "").trim().charAt(0).toUpperCase();
  return (
    <View style={styles.avatarFallback}>
      {inicial ? <Text style={styles.avatarInitial}>{inicial}</Text> : <UserRound size={20} color={colors.brandDeep} />}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  filterRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
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
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  chipTextActive: {
    color: colors.brandDeep
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body
  },
  card: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 12
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatar: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceWarm
  },
  avatarFallback: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.brandSoft
  },
  avatarInitial: {
    color: colors.brandDeep,
    fontSize: 18,
    fontFamily: fonts.display
  },
  senderInfo: {
    flex: 1
  },
  senderName: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: fonts.bodyBold
  },
  senderEmail: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.body
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusText: {
    fontSize: 11.5,
    fontFamily: fonts.bodyBold
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  tipoPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  tipoText: {
    color: colors.ink,
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  metaWhen: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  message: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body
  },
  contexto: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  attachments: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  attachThumbWrap: {
    height: 72,
    width: 72,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm
  },
  attachThumb: {
    height: "100%",
    width: "100%"
  },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceGlow,
    padding: 8
  },
  audioPlay: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.agentDeep,
    ...shadows.soft
  },
  audioLabel: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 12
  },
  resolveButton: {
    backgroundColor: colors.successSoft
  },
  actionText: {
    color: colors.muted,
    fontSize: 13.5,
    fontFamily: fonts.bodyBold
  },
  resolveText: {
    color: colors.success
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
