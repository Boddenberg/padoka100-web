import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold, useFonts } from "@expo-google-fonts/space-grotesk";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { AppProviders } from "@/providers";
import { ApiDebugOverlay } from "@/components/api-debug-overlay";
import { AppSplash } from "@/components/app-splash";
import { AUTH_REQUIRED } from "@/constants/auth";
import { useAuth } from "@/contexts/auth";
import { colors } from "@/lib/theme";

// Proteção de rotas + tela de carregamento: enquanto a sessão está sendo
// conferida (ou um redirecionamento está pendente), a splash cobre tudo, para
// a pessoa nunca ver a tela errada — nem um "sessão expirada" piscando — antes
// de o app decidir para onde levar. O Stack continua montado por baixo (o
// expo-router precisa do navegador para o redirect funcionar).
function RootNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inLogin = segments[0] === "login";

  useEffect(() => {
    if (!AUTH_REQUIRED || status === "loading") return;
    if (status === "signed-out" && !inLogin) router.replace("/login");
    if (status === "signed-in" && inLogin) router.replace("/");
  }, [status, inLogin, router]);

  // Cobre o intervalo entre "já sei o status" e "o redirect assentou".
  const redirecting =
    AUTH_REQUIRED && ((status === "signed-out" && !inLogin) || (status === "signed-in" && inLogin));

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      {status === "loading" || redirecting ? <AppSplash /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Nunito_600SemiBold,
    Nunito_800ExtraBold
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <AppProviders>
      <StatusBar style="dark" />
      <RootNavigator />
      <ApiDebugOverlay />
    </AppProviders>
  );
}
