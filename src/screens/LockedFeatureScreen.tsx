import { useRouter } from "expo-router";
import { LockKeyhole } from "lucide-react-native";
import { Text } from "react-native";

import { Button, Card, Page, StateText } from "@/components/ui";
import { upgradeMessage } from "@/lib/access";
import { colors, fonts } from "@/lib/theme";

export function LockedFeatureScreen({ capability, title }: { capability: string; title: string }) {
  const router = useRouter();
  return (
    <Page title={title} subtitle="Feature bloqueada pelo plano atual.">
      <Card>
        <LockKeyhole size={28} color={colors.brandDeep} />
        <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 20 }}>Upgrade necessario</Text>
        <StateText text={upgradeMessage(capability)} />
        <Button title="Voltar" tone="soft" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      </Card>
    </Page>
  );
}
