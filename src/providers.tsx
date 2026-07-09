import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { AuthProvider } from "@/contexts/auth";
import { ApiError } from "@/lib/api";
import { FontScaleProvider } from "@/lib/font-scale";

// Erro que vale a pena repetir: queda de rede, timeout ou instabilidade do
// servidor (5xx). Erros do cliente (login, não encontrado, validação) não.
function isTransientError(error: unknown) {
  if (error instanceof ApiError) return error.status >= 500 || error.status === 408 || error.status === 429;
  return true; // sem status = falha de rede/fetch → tenta de novo
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            // Reduz o "erro http" por instabilidade: tenta até 3x com espera
            // crescente antes de mostrar o erro.
            retry: (failureCount, error) => isTransientError(error) && failureCount < 3,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000)
          },
          mutations: {
            // Só repete falha de rede (nunca um erro que o servidor respondeu,
            // para não arriscar gravar duas vezes).
            retry: (failureCount, error) => !(error instanceof ApiError) && failureCount < 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000)
          }
        }
      })
  );

  // Ao voltar para o app (foreground), o react-query re-busca o que está velho
  // — assim uma tela que ficou em erro se recupera sozinha ao reabrir.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
    });
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <FontScaleProvider>
        <AuthProvider>{children}</AuthProvider>
      </FontScaleProvider>
    </QueryClientProvider>
  );
}
