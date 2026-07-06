import { Navigate, Route, Routes } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { MainLayout } from "@/app/layout/MainLayout";
import { CatalogoPage } from "@/features/catalogo/CatalogoPage";
import { SettingsPage } from "@/features/configuracao/SettingsPage";
import { ResumoPage } from "@/features/resumo/ResumoPage";
import { SalesModePage } from "@/features/vendas/SalesModePage";

export function App() {
  return (
    <AppProviders>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<SalesModePage />} />
          <Route path="catalogo" element={<CatalogoPage />} />
          <Route path="resumo" element={<ResumoPage />} />
          <Route path="ajustes" element={<SettingsPage />} />

          {/* Rotas antigas: bookmarks e atalhos de PWA continuam funcionando */}
          <Route path="abrir-dia" element={<Navigate to="/?sheet=abrir-dia" replace />} />
          <Route path="vendas" element={<Navigate to="/?sheet=vendas" replace />} />
          <Route path="ia" element={<Navigate to="/?sheet=ia" replace />} />
          <Route path="produtos" element={<Navigate to="/catalogo" replace />} />
          <Route path="locais" element={<Navigate to="/catalogo?tab=locais" replace />} />
          <Route path="relatorios" element={<Navigate to="/resumo" replace />} />
          <Route path="historico" element={<Navigate to="/resumo?tab=historico" replace />} />
          <Route path="configuracao" element={<Navigate to="/ajustes" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppProviders>
  );
}
