import { Navigate, Route, Routes } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { MainLayout } from "@/app/layout/MainLayout";
import { SettingsPage } from "@/features/configuracao/SettingsPage";
import { OpenDayPage } from "@/features/diasDeVenda/OpenDayPage";
import { HistoryPage } from "@/features/historico/HistoryPage";
import { AiPage } from "@/features/ia/AiPage";
import { LocationsPage } from "@/features/locais/LocationsPage";
import { ProductsPage } from "@/features/produtos/ProductsPage";
import { ReportsPage } from "@/features/relatorios/ReportsPage";
import { SalesListPage } from "@/features/vendas/SalesListPage";
import { SalesModePage } from "@/features/vendas/SalesModePage";

export function App() {
  return (
    <AppProviders>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<SalesModePage />} />
          <Route path="abrir-dia" element={<OpenDayPage />} />
          <Route path="produtos" element={<ProductsPage />} />
          <Route path="locais" element={<LocationsPage />} />
          <Route path="vendas" element={<SalesListPage />} />
          <Route path="relatorios" element={<ReportsPage />} />
          <Route path="historico" element={<HistoryPage />} />
          <Route path="ia" element={<AiPage />} />
          <Route path="configuracao" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppProviders>
  );
}
