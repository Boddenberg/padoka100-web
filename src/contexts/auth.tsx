import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, setApiToken, setUnauthorizedHandler } from "@/lib/api";
import { clearSession, readSession, saveSession } from "@/lib/session";
import type { UsuarioPerfil } from "@/types/api";

type AuthStatus = "loading" | "signed-in" | "signed-out";

interface AuthContextValue {
  status: AuthStatus;
  user: UsuarioPerfil | null;
  signIn: (email: string, senha: string) => Promise<void>;
  register: (data: { nome: string; email: string; telefone: string; senha: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UsuarioPerfil) => void;
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

  // Aplica o token e resolve o perfil (o login só devolve o access_token).
  const establishSession = useCallback(async (accessToken: string, fallback?: UsuarioPerfil) => {
    setApiToken(accessToken);
    let profile = fallback;
    try {
      profile = await api.auth.me();
    } catch {
      // Sem /perfil/me acessível, segue com o que veio do login (se veio).
    }
    if (!profile) throw new Error("Não foi possível carregar o perfil da conta.");
    setUser(profile);
    setStatus("signed-in");
    await saveSession({ token: accessToken, usuario: profile });
  }, []);

  const signIn = useCallback(
    async (email: string, senha: string) => {
      const response = await api.auth.login({ email: email.trim(), senha });
      await establishSession(response.access_token, response.usuario);
    },
    [establishSession]
  );

  const register = useCallback(
    async (data: { nome: string; email: string; telefone: string; senha: string }) => {
      const response = await api.auth.register({
        nome: data.nome.trim(),
        email: data.email.trim(),
        telefone: data.telefone.trim() || null,
        senha: data.senha
      });
      // Alguns backends já devolvem token no registro; se não, faz login.
      if (response?.access_token) {
        await establishSession(response.access_token, response.usuario);
      } else {
        await signIn(data.email, data.senha);
      }
    },
    [establishSession, signIn]
  );

  const refreshUser = useCallback(async () => {
    const profile = await api.auth.me();
    setUser(profile);
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, register, signOut, refreshUser, setUser }),
    [status, user, signIn, register, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return context;
}

// Erro de login/registro em linguagem humana.
export function loginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if ([401, 403].includes(error.status)) return "E-mail ou senha inválidos. Confira e tente de novo.";
    if (error.status === 409) return "Já existe uma conta com esse e-mail.";
    if (error.status === 422) return "Confira os dados: e-mail válido e senha com pelo menos 6 caracteres.";
  }
  return error instanceof Error ? error.message : "Não foi possível continuar. Tente novamente.";
}
