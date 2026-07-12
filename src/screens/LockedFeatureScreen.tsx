import { useRouter } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Page } from "@/components/ui";
import { featurePlanName } from "@/lib/access";
import { PLANOS } from "@/lib/plans";
import { colors, fonts, radius } from "@/lib/theme";

// Aviso amigável (não uma tela de erro) para quando a funcionalidade pertence a
// um plano que a conta ainda não tem: explica com calma, mostra o que o plano
// entrega e convida a conhecê-lo — sem cara de falha técnica.
export function LockedFeatureScreen({ capability, title }: { capability: string; title: string }) {
  const router = useRouter();
  const planName = featurePlanName(capability);
  const plano = PLANOS.find((item) => item.nome === planName);
  const beneficios = plano?.beneficios.slice(0, 3) ?? [];

  return (
    <Page
      title={title}
      subtitle={planName ? `Uma funcionalidade do plano ${planName}.` : "Uma funcionalidade de um plano superior."}
    >
      <Card style={styles.card}>
        <View style={styles.iconCircle}>
          <Sparkles size={26} color={colors.brandDeep} />
        </View>

        <Text style={styles.headline}>
          {planName ? `Isto faz parte do plano ${planName}` : "Isto faz parte de um plano superior"}
        </Text>
        <Text style={styles.body}>
          Seu plano atual ainda não inclui esta funcionalidade. Faça o upgrade para desbloquear e aproveitar tudo o que ela
          oferece.
        </Text>

        {beneficios.length ? (
          <View style={styles.benefits}>
            {beneficios.map((beneficio) => (
              <View key={beneficio} style={styles.benefitRow}>
                <View style={styles.benefitDot} />
                <Text style={styles.benefitText}>{beneficio}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Button
          title={planName ? `Conhecer o Plano ${planName}` : "Conhecer os planos"}
          onPress={() => router.push("/perfil")}
        />
        <Button title="Voltar" tone="soft" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "stretch",
    gap: 14
  },
  iconCircle: {
    height: 56,
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft
  },
  headline: {
    color: colors.ink,
    fontSize: 20,
    fontFamily: fonts.display,
    letterSpacing: -0.3
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body
  },
  benefits: {
    gap: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceGlow,
    padding: 14
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  benefitDot: {
    height: 7,
    width: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brand
  },
  benefitText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    fontFamily: fonts.bodyBold
  }
});
