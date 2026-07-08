import { useLocalSearchParams } from "expo-router";
import { ProductCostScreen } from "@/screens/ProductCostScreen";

export default function ProductCostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductCostScreen produtoId={id || ""} />;
}
