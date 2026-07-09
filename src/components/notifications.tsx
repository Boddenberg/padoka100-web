import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState, Sheet } from "@/components/ui";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/settings";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import type { Notificacao } from "@/types/api";

// A resposta pode vir como lista pura ou embrulhada ({ notificacoes: [...] }).
function normalizeNotifications(raw: unknown): Notificacao[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    for (const key of ["notificacoes", "items", "dados", "results", "data"]) {
      const value = (raw as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        list = value;
        break;
      }
    }
  }
  return list
    .filter((item): item is Notificacao => Boolean(item) && typeof item === "object" && "id" in (item as object))
    .sort((a, b) => String(b.publicado_em || b.criado_em || "").localeCompare(String(a.publicado_em || a.criado_em || "")));
}

function isUnread(item: Notificacao) {
  return item.lida !== true && !item.lida_em;
}

// Botão de "cartinha" no topo: badge com quantos avisos não lidos; abre a caixa.
export function NotificationsButton() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["notificacoes"],
    queryFn: api.notificacoes.list,
    enabled: status === "signed-in",
    // Busca de tempos em tempos para pegar avisos novos publicados no backend.
    refetchInterval: 60_000,
    staleTime: 30_000
  });

  const items = normalizeNotifications(query.data);
  const unread = items.filter(isUnread).length;

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.notificacoes.marcarLida(id).catch(() => undefined)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes"] })
  });

  // Ao abrir a caixa, marca os não lidos como lidos (best-effort).
  useEffect(() => {
    if (!open) return;
    const ids = items.filter(isUnread).map((item) => item.id);
    if (ids.length && !markRead.isPending) markRead.mutate(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Text style={styles.iconEmoji}>✉️</Text>
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        ) : null}
      </Pressable>

      <Sheet visible={open} title="Avisos" subtitle="Novidades e recados da padaria" onClose={() => setOpen(false)}>
        {items.length === 0 ? (
          <EmptyState emoji="📭" title="Sem avisos por aqui" hint="Quando chegar uma novidade, ela aparece aqui." />
        ) : (
          items.map((item) => <NotificationCard key={item.id} item={item} />)
        )}
      </Sheet>
    </>
  );
}

function NotificationCard({ item }: { item: Notificacao }) {
  const date = item.publicado_em || item.criado_em;
  const midias = (item.midias || []).filter((midia) => midia && midia.url);

  return (
    <View style={[styles.card, isUnread(item) && styles.cardUnread, shadows.soft]}>
      <View style={styles.cardHeader}>
        {isUnread(item) ? <View style={styles.dot} /> : null}
        <Text style={styles.cardTitle}>{item.titulo || "Aviso"}</Text>
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
  }
});
