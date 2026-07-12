import { Tabs } from "expo-router";
import { BarChart3, Package, ShoppingBag, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth";
import { hasAccess } from "@/lib/access";
import { colors, fonts } from "@/lib/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const canSeeAdvancedReports = hasAccess(user, "relatorios.avancados");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.muted,
        // Barra encaixada no rodapé (largura total, rente ao fundo, sem folga
        // em baixo nem nas laterais), respeitando a área segura do aparelho.
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          minHeight: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          elevation: 0
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: fonts.bodyBold
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Venda", tabBarIcon: ({ color }) => <ShoppingBag color={color} /> }} />
      <Tabs.Screen name="catalogo" options={{ title: "Produtos", tabBarIcon: ({ color }) => <Package color={color} /> }} />
      <Tabs.Screen
        name="resumo"
        options={{
          title: "Resumo",
          href: canSeeAdvancedReports ? undefined : null,
          tabBarIcon: ({ color }) => <BarChart3 color={color} />
        }}
      />
      <Tabs.Screen name="perfil" options={{ title: "Perfil", tabBarIcon: ({ color }) => <UserRound color={color} /> }} />
    </Tabs>
  );
}
