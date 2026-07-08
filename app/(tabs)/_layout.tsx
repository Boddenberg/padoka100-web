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
        tabBarStyle: {
          minHeight: 72,
          paddingTop: 8,
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          shadowColor: "#4a2c12",
          shadowOpacity: 0.1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -6 },
          elevation: 14
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
