import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold, useFonts } from "@expo-google-fonts/space-grotesk";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { AppProviders } from "@/providers";
import { colors } from "@/lib/theme";

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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </AppProviders>
  );
}
