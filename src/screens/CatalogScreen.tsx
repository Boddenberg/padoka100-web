import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Boxes, ChevronRight, MapPin, Package, ReceiptText, ShoppingCart } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Page } from "@/components/ui";
import { api } from "@/lib/api";
import { useFontMultiplier } from "@/lib/font-scale";
import { colors, fonts, gradients, radius, shadows } from "@/lib/theme";

// "Minha padoca": o hub dos cadastros e do planejamento. Cada capacidade do
// app tem uma porta com nome, ícone e uma linha do que faz — nada fica
// escondido dentro de outra tela. O dia a dia (vender) mora na aba Hoje.
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
      <Door
        icon={<Package size={24} color="#fff" />}
        title="Produtos e preços"
        hint={productsHint}
        onPress={() => router.push("/produtos")}
      />
      <Door
        icon={<ReceiptText size={24} color="#fff" />}
        title="Receitas e custos"
        hint="Saiba quanto custa cada produto — com o Seu Pãozinho"
        tint="agent"
        onPress={() => router.push("/custos")}
      />
      <Door
        icon={<ShoppingCart size={24} color="#fff" />}
        title="Lista de compras"
        hint="Planeje a produção e veja o que comprar"
        onPress={() => router.push("/lista-compras")}
      />
      <Door
        icon={<MapPin size={24} color="#fff" />}
        title="Locais de venda"
        hint={locationsHint}
        onPress={() => router.push("/locais")}
      />
      <SoonDoor icon={<Boxes size={22} color={colors.muted} />} title="Estoque de ingredientes" />
    </Page>
  );
}

// Porta do hub: tile de ícone com gradiente (laranja da marca; violeta para o
// que envolve o agente), nome em destaque e uma linha do que faz.
function Door({
  icon,
  title,
  hint,
  tint = "brand",
  onPress
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  tint?: "brand" | "agent";
  onPress: () => void;
}) {
  const scale = useFontMultiplier();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.door, shadows.soft, pressed && styles.pressed]}>
      <LinearGradient
        colors={tint === "agent" ? gradients.agent : gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.doorIcon}
      >
        {icon}
      </LinearGradient>
      <View style={styles.doorInfo}>
        <Text style={[styles.doorTitle, { fontSize: 17 * scale }]}>{title}</Text>
        <Text style={[styles.doorHint, { fontSize: 13 * scale }]}>{hint}</Text>
      </View>
      <View style={styles.doorChevron}>
        <ChevronRight size={18} color={colors.brandDeep} />
      </View>
    </Pressable>
  );
}

// Porta do que ainda vem por aí: mostra o rumo do app sem prometer o que não
// existe. Não é tocável, e o selo "Em breve" deixa claro.
function SoonDoor({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={[styles.door, styles.doorSoon]}>
      <View style={styles.doorIconSoon}>{icon}</View>
      <View style={styles.doorInfo}>
        <Text style={styles.doorTitleSoon}>{title}</Text>
        <Text style={styles.doorHint}>Chega em uma próxima atualização</Text>
      </View>
      <View style={styles.soonBadge}>
        <Text style={styles.soonBadgeText}>Em breve</Text>
      </View>
    </View>
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
    padding: 14,
    minHeight: 84
  },
  doorIcon: {
    height: 56,
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg
  },
  doorInfo: {
    flex: 1,
    gap: 3
  },
  doorTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  doorHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body
  },
  doorChevron: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm
  },
  doorSoon: {
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surfaceGlow
  },
  doorIconSoon: {
    height: 56,
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceWarm
  },
  doorTitleSoon: {
    color: colors.muted,
    fontSize: 17,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  soonBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  soonBadgeText: {
    color: colors.muted,
    fontSize: 11.5,
    fontFamily: fonts.bodyBold
  }
});
