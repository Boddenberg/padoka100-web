import { Tabs } from "expo-router";
import { BarChart3, Package, ShoppingBag, UserRound } from "lucide-react-native";
import { colors, fonts } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.muted,
        // Tab bar flutuante estilo "ilha": descolada do rodapé, cantos
        // redondos e sombra suave — o conteúdo passa por baixo.
        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 12,
          minHeight: 68,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopWidth: 0,
          borderRadius: 28,
          backgroundColor: colors.surface,
          shadowColor: "#4a2c12",
          shadowOpacity: 0.16,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 16
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: fonts.bodyBold
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Venda", tabBarIcon: ({ color }) => <ShoppingBag color={color} /> }} />
      <Tabs.Screen name="catalogo" options={{ title: "Catálogo", tabBarIcon: ({ color }) => <Package color={color} /> }} />
      <Tabs.Screen name="resumo" options={{ title: "Resumo", tabBarIcon: ({ color }) => <BarChart3 color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil", tabBarIcon: ({ color }) => <UserRound color={color} /> }} />
    </Tabs>
  );
}
