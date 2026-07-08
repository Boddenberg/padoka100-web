import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, setApiToken, setUnauthorizedHandler } from "@/lib/api";
import { clearSession, readSession, saveSession } from "@/lib/session";
import type { UsuarioPerfil } from "@/types/api";

type AuthStatus = "loading" | "signed-in" | "signed-out";

interface AuthContextValue {
  status: AuthStatus;
  user: UsuarioPerfil | null;
  signIn: (usuario: string, senha: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UsuarioPerfil | null>(null);

  // Sessão guardada no aparelho volta a valer ao abrir o app.
  useEffect(() => {
    let active = true;
    readSession()
      .then((session) => {
        if (!active) return;
        if (session) {
          setApiToken(session.token);
          setUser(session.usuario);
          setStatus("signed-in");
        } else {
          setStatus("signed-out");
        }
      })
      .catch(() => {
        if (active) setStatus("signed-out");
      });
    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    // Logout no servidor é cortesia; a sessão local morre de qualquer forma.
    api.auth.logout().catch(() => undefined);
    setApiToken(null);
    setUser(null);
    setStatus("signed-out");
    await clearSession();
  }, []);

  // Sessão expirada em qualquer chamada (401): derruba a sessão local.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const signIn = useCallback(async (usuario: string, senha: string) => {
    const response = await api.auth.login({ usuario: usuario.trim(), senha });
    setApiToken(response.token);
    setUser(response.usuario);
    setStatus("signed-in");
    await saveSession({ token: response.token, usuario: response.usuario });
  }, []);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return context;
}

// Erro de login em linguagem humana.
export function loginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if ([401, 403].includes(error.status)) return "Usuário ou senha inválidos. Confira e tente de novo.";
    if ([404, 405, 501].includes(error.status)) {
      return "O servidor ainda não tem login. Essa parte do sistema está em construção.";
    }
  }
  return error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente.";
}
