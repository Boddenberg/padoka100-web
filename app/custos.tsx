import { CostsScreen } from "@/screens/padoca/CostsScreen";
import { useAuth } from "@/contexts/auth";
import { hasAccess } from "@/lib/access";
import { LockedFeatureScreen } from "@/screens/LockedFeatureScreen";

export default function CustosRoute() {
  const { user } = useAuth();
  if (!hasAccess(user, "custos.assistente")) {
    return <LockedFeatureScreen capability="custos.assistente" title="Receitas e custos" />;
  }
  return <CostsScreen />;
}
