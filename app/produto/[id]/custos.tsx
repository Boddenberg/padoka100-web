import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/auth";
import { hasAccess } from "@/lib/access";
import { LockedFeatureScreen } from "@/screens/LockedFeatureScreen";
import { ProductCostScreen } from "@/screens/ProductCostScreen";

export default function ProductCostRoute() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!hasAccess(user, "custos.assistente")) {
    return <LockedFeatureScreen capability="custos.assistente" title="Assistente de custos" />;
  }
  return <ProductCostScreen produtoId={id || ""} />;
}
