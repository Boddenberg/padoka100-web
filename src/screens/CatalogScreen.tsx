import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Page, StateText } from "@/components/ui";
import { api } from "@/lib/api";
import { useFontMultiplier } from "@/lib/font-scale";
import { colors, fonts, radius, shadows } from "@/lib/theme";

// "Minha padoca": o hub dos cadastros e do planejamento. Cada capacidade do
// app tem uma porta com nome e explicação de uma linha — nada fica escondido
// dentro de outra tela. O dia a dia (vender) mora na aba Hoje.
export function CatalogScreen() {
  const router = useRouter();
  const productsQuery = useQuery({ queryKey: ["produtos", "todos"], queryFn: () => api.produtos.list(false) });
  const locationsQuery = useQuery({ queryKey: ["locais", "todos"], queryFn: () => api.locais.list(false) });

  // Links antigos (?novo=1) continuam valendo: seguem direto pro cadastro.
  const params = useLocalSearchParams<{ novo?: string }>();
  useEffect(() => {
    if (params.novo) {
      router.setParams({ novo: "" });
      router.push("/produtos?novo=1");
    }
  }, [params.novo, router]);

  const activeProducts = productsQuery.data?.filter((produto) => produto.situacao === "ativo").length ?? null;
  const activeLocations = locationsQuery.data?.filter((local) => local.situacao === "ativo").length ?? null;

  const productsHint =
    activeProducts === null
      ? "O que você vende, com preço e foto"
      : activeProducts === 0
        ? "Nenhum ainda — comece por aqui"
        : activeProducts === 1
          ? "1 produto ativo"
          : `${activeProducts} produtos ativos`;

  const locationsHint =
    activeLocations === null || activeLocations === 0
      ? "Opcional: feira, ponto fixo, eventos"
      : activeLocations === 1
        ? "1 local cadastrado"
        : `${activeLocations} locais cadastrados`;

  const refreshing = productsQuery.isRefetching || locationsQuery.isRefetching;
  const onRefresh = () => {
    productsQuery.refetch();
    locationsQuery.refetch();
  };

  return (
    <Page
      title="Minha padoca"
      subtitle="Tudo o que você vende e usa para produzir."
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      <Door emoji="🥖" title="Produtos e preços" hint={productsHint} onPress={() => router.push("/produtos")} />
      <Door
        emoji="🧾"
        title="Receitas e custos"
        hint="Saiba quanto custa cada produto — com o Seu Pãozinho"
        onPress={() => router.push("/custos")}
      />
      <Door
        emoji="🛒"
        title="Lista de compras"
        hint="Planeje a produção e veja o que comprar"
        onPress={() => router.push("/lista-compras")}
      />
      <Door emoji="📍" title="Locais de venda" hint={locationsHint} onPress={() => router.push("/locais")} />

      <StateText text="Em breve por aqui: estoque de ingredientes." />
    </Page>
  );
}

// Porta do hub: ícone quente, nome da capacidade e uma linha do que ela faz.
function Door({ emoji, title, hint, onPress }: { emoji: string; title: string; hint: string; onPress: () => void }) {
  const scale = useFontMultiplier();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.door, shadows.soft, pressed && styles.pressed]}>
      <View style={styles.doorIcon}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </View>
      <View style={styles.doorInfo}>
        <Text style={[styles.doorTitle, { fontSize: 17 * scale }]}>{title}</Text>
        <Text style={[styles.doorHint, { fontSize: 13 * scale }]}>{hint}</Text>
      </View>
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92
  },
  door: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    minHeight: 76
  },
  doorIcon: {
    height: 52,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceWarm
  },
  doorInfo: {
    flex: 1,
    gap: 2
  },
  doorTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.bodyBold
  },
  doorHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body
  }
});
