import { Tabs } from "expo-router";
import { BarChart3, Package, Settings, ShoppingBag } from "lucide-react-native";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          minHeight: 70,
          borderTopColor: colors.border,
          backgroundColor: colors.surface
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "800"
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Venda", tabBarIcon: ({ color }) => <ShoppingBag color={color} /> }} />
      <Tabs.Screen name="catalogo" options={{ title: "Catalogo", tabBarIcon: ({ color }) => <Package color={color} /> }} />
      <Tabs.Screen name="resumo" options={{ title: "Resumo", tabBarIcon: ({ color }) => <BarChart3 color={color} /> }} />
      <Tabs.Screen name="ajustes" options={{ title: "Ajustes", tabBarIcon: ({ color }) => <Settings color={color} /> }} />
    </Tabs>
  );
}
