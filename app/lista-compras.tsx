import { ShoppingListScreen } from "@/screens/ShoppingListScreen";
import { useAuth } from "@/contexts/auth";
import { hasAccess } from "@/lib/access";
import { LockedFeatureScreen } from "@/screens/LockedFeatureScreen";

export default function ListaComprasRoute() {
  const { user } = useAuth();
  if (!hasAccess(user, "compras.usar")) {
    return <LockedFeatureScreen capability="compras.usar" title="Lista de compras" />;
  }
  return <ShoppingListScreen />;
}
