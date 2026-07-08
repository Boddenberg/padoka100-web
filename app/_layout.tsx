import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold, useFonts } from "@expo-google-fonts/space-grotesk";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { AppProviders } from "@/providers";
import { AUTH_REQUIRED } from "@/constants/auth";
import { useAuth } from "@/contexts/auth";
import { colors } from "@/lib/theme";

// Proteção de rotas: com AUTH_REQUIRED ligado, quem não está logado só vê
// a tela de login (e quem está logado não volta para ela).
function AuthRedirector() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!AUTH_REQUIRED || status === "loading") return;
    const inLogin = segments[0] === "login";
    if (status === "signed-out" && !inLogin) router.replace("/login");
    if (status === "signed-in" && inLogin) router.replace("/");
  }, [status, segments, router]);

  return null;
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
      <AuthRedirector />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </AppProviders>
  );
}
