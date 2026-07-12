import { useRouter } from "expo-router";
import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ProductPhoto, StateText } from "@/components/ui";
import { api, friendlyErrorMessage } from "@/lib/api";
import { formatCurrency, toNumber } from "@/lib/format";
import { colors, fonts, radius, shadows } from "@/lib/theme";
import { fixProductName } from "@/utils/text";
import type { Produto } from "@/types/api";
import { SubPage, isCostFromAI, sharedStyles } from "./shared";

// "Receitas e custos": porta do hub Minha padoca. A mesma jornada de custo
// que existia escondida na edição do produto, agora com entrada própria —
// a lista mostra quem já tem custo e quem ainda não.
export function CostsScreen() {
  const router = useRouter();
  const productsQuery = useQuery({ queryKey: ["produtos", "ativos"], queryFn: () => api.produtos.list(true) });
  const products = productsQuery.data || [];

  const row = (produto: Produto) => {
    const cost = toNumber(produto.preco_atual?.preco_custo);
    const hasCost = cost > 0;
    return (
      <Pressable
        key={produto.id}
        onPress={() => router.push(`/produto/${produto.id}/custos`)}
        style={({ pressed }) => [sharedStyles.itemRow, shadows.soft, pressed && sharedStyles.pressed]}
      >
        <ProductPhoto url={produto.url_imagem_principal} name={produto.nome} size={62} rounded={radius.lg} />
        <View style={sharedStyles.itemInfo}>
          <Text style={sharedStyles.itemTitle}>{fixProductName(produto.nome)}</Text>
          {hasCost ? (
            <View style={styles.costRow}>
              <CheckCircle2 size={15} color={colors.success} />
              <Text style={styles.costDone}>Custa {formatCurrency(cost)} para fazer</Text>
              {isCostFromAI(produto.preco_atual) ? <Sparkles size={13} color={colors.agentDeep} /> : null}
            </View>
          ) : (
            <Text style={styles.costMissing}>Sem custo calculado — toque para descobrir</Text>
          )}
        </View>
        <ChevronRight size={20} color={colors.muted} />
      </Pressable>
    );
  };

  return (
    <SubPage
      title="Receitas e custos"
      subtitle="Descubra quanto custa fazer cada produto, com o assistente."
      onRefresh={() => productsQuery.refetch()}
      refreshing={productsQuery.isRefetching}
    >
      {productsQuery.isLoading ? <StateText text="Carregando produtos..." /> : null}
      {productsQuery.error ? <StateText tone="error" text={friendlyErrorMessage(productsQuery.error)} /> : null}
      {products.map(row)}
      {productsQuery.isSuccess && products.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title="Nenhum produto para calcular"
          hint="Cadastre o que você vende e depois volte aqui para descobrir o custo de cada um."
          actionLabel="Cadastrar produto"
          onAction={() => router.push("/produtos?novo=1")}
        />
      ) : null}
    </SubPage>
  );
}

const styles = StyleSheet.create({
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  costDone: {
    color: colors.success,
    fontSize: 13.5,
    fontFamily: fonts.bodyBold
  },
  costMissing: {
    color: colors.muted,
    fontSize: 13.5,
    fontFamily: fonts.body
  }
});
