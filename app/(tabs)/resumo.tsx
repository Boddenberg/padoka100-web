import { SummaryScreen } from "@/screens/SummaryScreen";
import { useAuth } from "@/contexts/auth";
import { hasAccess } from "@/lib/access";
import { LockedFeatureScreen } from "@/screens/LockedFeatureScreen";

export default function ResumoRoute() {
  const { user } = useAuth();
  if (!hasAccess(user, "relatorios.avancados")) {
    return <LockedFeatureScreen capability="relatorios.avancados" title="Resumo" />;
  }
  return <SummaryScreen />;
}
