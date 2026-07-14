import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check, ChevronDown, RotateCcw, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState, Sheet, StateText } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/settings";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import type { FeedNotificacoes, Notificacao } from "@/types/api";

// A lista antiga (compat) pode vir como array puro ou embrulhada; o feed novo já
// entrega { itens, resumo, ... }. Esta função só serve ao fallback do endpoint antigo.
function normalizeNotifications(raw: unknown): Notificacao[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const known = ["itens", "notificacoes", "items", "dados", "results", "data"];
    const value = known.map((key) => obj[key]).find(Array.isArray) || Object.values(obj).find(Array.isArray);
    if (Array.isArray(value)) list = value;
  }
  return list
    .filter((item): item is Notificacao => Boolean(item) && typeof item === "object" && "id" in (item as object))
    .sort((a, b) => String(b.publicado_em || b.criado_em || "").localeCompare(String(a.publicado_em || a.criado_em || "")));
}

function isUnread(item: Notificacao) {
  // `nova` é a dica direta do backend; caímos em lida/lida_em por segurança.
  if (typeof item.nova === "boolean") return item.nova;
  return item.lida !== true && !item.lida_em;
}

// Rota principal do sino. Se o backend ainda não tiver /feed, monta um feed
// local a partir da lista antiga para a tela seguir funcionando.
async function loadFeed(limite: number): Promise<FeedNotificacoes> {
  const feed = await api.notificacoes.feed({ limite, incluirLidas: true });
  if (feed && Array.isArray(feed.itens)) return feed;
  const itens = normalizeNotifications(await api.notificacoes.list());
  return {
    itens,
    resumo: { total: itens.length, nao_lidas: itens.filter(isUnread).length },
    tem_mais: false
  };
}

// Botão de "cartinha" no topo: badge com quantos avisos não lidos; abre a caixa.
export function NotificationsButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [limite, setLimite] = useState(20);

  const query = useQuery({
    queryKey: ["notificacoes", "feed", limite],
    queryFn: () => loadFeed(limite),
    refetchInterval: 60_000,
    staleTime: 30_000
  });

  const feed = query.data;
  const itens = feed?.itens ?? [];
  const novas = itens.filter(isUnread);
  const lidas = itens.filter((item) => !isUnread(item));
  const unreadCount = feed?.resumo?.nao_lidas ?? novas.length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notificacoes"] });

  const markRead = useMutation({ mutationFn: (id: string) => api.notificacoes.marcarLida(id), onSuccess: invalidate });
  const markUnread = useMutation({ mutationFn: (id: string) => api.notificacoes.marcarNaoLida(id), onSuccess: invalidate });
  const hide = useMutation({ mutationFn: (id: string) => api.notificacoes.ocultar(id), onSuccess: invalidate });
  const markAll = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.notificacoes.marcarLida(id).catch(() => undefined)));
    },
    onSuccess: invalidate
  });

  const busy = markRead.isPending || markUnread.isPending || hide.isPending || markAll.isPending;

  const confirmDelete = (item: Notificacao) => {
    Alert.alert("Excluir aviso", "Este aviso vai sumir da sua lista. Deseja excluir?", [
      { text: "Voltar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => hide.mutate(item.id) }
    ]);
  };

  const openNotification = (item: Notificacao) => {
    const route = item.metadados?.rota;
    if (typeof route !== "string" || !route.startsWith("/")) return;
    if (isUnread(item)) markRead.mutate(item.id);
    setOpen(false);
    router.push(route);
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Text style={styles.iconEmoji}>✉️</Text>
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Sheet visible={open} title="Avisos" subtitle="Novidades e recados da padaria" onClose={() => setOpen(false)}>
        {query.isLoading && !feed ? (
          <StateText text="Carregando avisos..." />
        ) : itens.length === 0 ? (
          <EmptyState emoji="📭" title="Sem avisos por aqui" hint="Quando chegar uma novidade, ela aparece aqui." />
        ) : (
          <>
            {novas.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.dot} />
                    <Text style={styles.sectionTitle}>Novas</Text>
                    <View style={styles.countPill}>
                      <Text style={styles.countPillText}>{novas.length}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => markAll.mutate(novas.map((item) => item.id))}
                    disabled={busy}
                    hitSlop={6}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text style={styles.markAllText}>Marcar todas</Text>
                  </Pressable>
                </View>
                {novas.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    unread
                    disabled={busy}
                    onToggleRead={() => markRead.mutate(item.id)}
                    onDelete={() => confirmDelete(item)}
                    onOpen={typeof item.metadados?.rota === "string" ? () => openNotification(item) : undefined}
                  />
                ))}
              </View>
            ) : null}

            {lidas.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={[styles.sectionTitle, styles.sectionTitleMuted]}>Lidas</Text>
                  </View>
                </View>
                {lidas.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    unread={false}
                    disabled={busy}
                    onToggleRead={() => markUnread.mutate(item.id)}
                    onDelete={() => confirmDelete(item)}
                    onOpen={typeof item.metadados?.rota === "string" ? () => openNotification(item) : undefined}
                  />
                ))}
              </View>
            ) : null}

            {feed?.tem_mais ? (
              <Pressable
                onPress={() => setLimite((current) => current + 20)}
                style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
              >
                <ChevronDown size={18} color={colors.brandDeep} />
                <Text style={styles.moreText}>Ver mais avisos</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </Sheet>
    </>
  );
}

function NotificationCard({
  item,
  unread,
  disabled,
  onToggleRead,
  onDelete,
  onOpen
}: {
  item: Notificacao;
  unread: boolean;
  disabled?: boolean;
  onToggleRead: () => void;
  onDelete: () => void;
  onOpen?: () => void;
}) {
  const date = item.publicado_em || item.criado_em;
  const midias = (item.midias || []).filter((midia) => midia && midia.url);
  const highPriority = item.prioridade === "alta";

  return (
    <View style={[styles.card, unread && styles.cardUnread, shadows.soft]}>
      <View style={styles.cardHeader}>
        {unread ? <View style={styles.dot} /> : null}
        <Text style={styles.cardTitle}>{item.titulo || "Aviso"}</Text>
        {highPriority ? (
          <View style={styles.priorityPill}>
            <Text style={styles.priorityText}>urgente</Text>
          </View>
        ) : null}
      </View>
      {item.corpo ? <Text style={styles.cardBody}>{item.corpo}</Text> : null}
      {midias.map((midia, index) => {
        const uri = resolveMediaUrl(midia.url);
        if (!uri) return null;
        return (
          <Image
            key={`${item.id}-${index}`}
            source={{ uri }}
            style={styles.cardImage}
            contentFit="cover"
            transition={180}
            accessibilityLabel={midia.descricao || undefined}
          />
        );
      })}
      {date ? <Text style={styles.cardDate}>{formatDate(date)}</Text> : null}

      {onOpen ? (
        <Pressable onPress={onOpen} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}>
          <Text style={styles.openButtonText}>Abrir relatório</Text>
          <ChevronDown size={18} color="#fff" style={styles.openButtonArrow} />
        </Pressable>
      ) : null}

      <View style={styles.cardActions}>
        <Pressable
          onPress={onToggleRead}
          disabled={disabled}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          {unread ? <Check size={16} color={colors.success} /> : <RotateCcw size={15} color={colors.muted} />}
          <Text style={[styles.actionText, unread && styles.actionTextRead]}>
            {unread ? "Marcar como lida" : "Marcar como nova"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          disabled={disabled}
          style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.pressed]}
        >
          <Trash2 size={16} color={colors.danger} />
          <Text style={[styles.actionText, styles.deleteText]}>Excluir</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9
  },
  iconButton: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  iconEmoji: {
    fontSize: 19
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
    paddingHorizontal: 5
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: fonts.bodyBold
  },
  section: {
    gap: 10
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.display,
    letterSpacing: -0.2
  },
  sectionTitleMuted: {
    color: colors.muted
  },
  countPill: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    paddingHorizontal: 7
  },
  countPillText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  markAllText: {
    color: colors.brandDeep,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  card: {
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  cardUnread: {
    borderColor: colors.agentSoft,
    backgroundColor: colors.surfaceGlow
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  dot: {
    height: 9,
    width: 9,
    borderRadius: 5,
    backgroundColor: colors.brand
  },
  cardTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 16.5,
    fontFamily: fonts.bodyBold
  },
  priorityPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  priorityText: {
    color: colors.danger,
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  cardBody: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body
  },
  cardImage: {
    width: "100%",
    height: 170,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceWarm
  },
  cardDate: {
    color: colors.muted,
    fontSize: 12.5,
    fontFamily: fonts.bodyBold
  },
  openButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand
  },
  openButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  openButtonArrow: {
    transform: [{ rotate: "-90deg" }]
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
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
  deleteButton: {
    backgroundColor: colors.dangerSoft
  },
  actionText: {
    color: colors.muted,
    fontSize: 13.5,
    fontFamily: fonts.bodyBold
  },
  actionTextRead: {
    color: colors.success
  },
  deleteText: {
    color: colors.danger
  },
  moreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.surfaceWarm
  },
  moreText: {
    color: colors.brandDeep,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  }
});
